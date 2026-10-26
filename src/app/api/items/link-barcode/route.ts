import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, hasPermission } from "@/lib/auth/options"
import prisma from "@/lib/prisma"
import { normalizeBarcode } from "@/lib/services/resolveBarcode"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 })
    }
    const user = session.user as any
    if (
      !hasPermission(user.role, "items:write") &&
      !hasPermission(user.role, "*") &&
      !hasPermission(user.role, "scan:perform")
    ) {
      return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })
    }

    const body = await req.json()
    const qrCode =
      normalizeBarcode(String(body.qrCode || "")) || String(body.qrCode || "").trim()
    if (!qrCode) {
      return NextResponse.json({ error: "الباركود مطلوب" }, { status: 400 })
    }

    const existingCarton = await prisma.carton.findUnique({
      where: { qrCode },
      include: { item: true },
    })
    if (existingCarton?.isActive) {
      return NextResponse.json({
        ok: true,
        alreadyLinked: true,
        item: existingCarton.item,
        carton: { id: existingCarton.id, qrCode: existingCarton.qrCode },
      })
    }

    let item = body.itemId
      ? await prisma.item.findUnique({ where: { id: body.itemId } })
      : null

    if (!item) {
      const nameAr = String(body.nameAr || "").trim()
      if (!nameAr) {
        return NextResponse.json(
          { error: "اختر صنفاً موجوداً أو أدخل اسم الصنف" },
          { status: 400 }
        )
      }
      let sku = String(body.sku || qrCode).trim().slice(0, 80)
      const skuExists = await prisma.item.findFirst({ where: { sku } })
      if (skuExists) {
        sku = `${sku}-${Date.now().toString(36)}`.slice(0, 80)
      }
      item = await prisma.item.create({
        data: {
          sku,
          internalId: sku,
          nameAr,
          nameEn: String(body.nameEn || nameAr).trim(),
          sourceType: body.sourceType || "FACTORY",
          uom: body.uom || "PCS",
          unitsPerCarton: Number(body.unitsPerCarton) || 1,
          costPerUnit: 0,
          currency: "USD",
          isActive: true,
          createdById: user.id,
        },
      })
    }

    let batch = await prisma.batch.findFirst({ where: { itemId: item.id } })
    if (!batch) {
      batch = await prisma.batch.create({
        data: {
          itemId: item.id,
          batchNumber: `B-${item.sku}`.slice(0, 60),
          sourceType: item.sourceType,
          isActive: true,
        },
      })
    }

    const qty = Number(body.quantity) || item.unitsPerCarton || 1
    const carton = existingCarton
      ? await prisma.carton.update({
          where: { id: existingCarton.id },
          data: {
            itemId: item.id,
            batchId: batch.id,
            isActive: true,
            status: "AVAILABLE",
            quantity: qty,
          },
          include: { item: true },
        })
      : await prisma.carton.create({
          data: {
            qrCode,
            cartonNumber: `CTN-${qrCode}`.slice(0, 60),
            itemId: item.id,
            batchId: batch.id,
            quantity: qty,
            originalQty: qty,
            status: "AVAILABLE",
            isActive: true,
          },
          include: { item: true },
        })

    return NextResponse.json({
      ok: true,
      item: {
        id: item.id,
        sku: item.sku,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
      },
      carton: { id: carton.id, qrCode: carton.qrCode },
    })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e?.message || "فشل الربط" }, { status: 500 })
  }
}
