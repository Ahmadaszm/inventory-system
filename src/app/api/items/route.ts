import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, hasPermission } from "@/lib/auth/options"
import prisma from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const items = await prisma.item.findMany({
    where: { isActive: true },
    include: { category: true, brand: true, _count: { select: { cartons: true } } },
    orderBy: { sku: "asc" },
    take: 500,
  })
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 })

    const user = session.user as any
    if (!hasPermission(user.role, "items:write") && !hasPermission(user.role, "*")) {
      return NextResponse.json({ error: "ليس لديك صلاحية إضافة أصناف" }, { status: 403 })
    }

    const body = await req.json()
    const sku = String(body.sku || "").trim()
    const nameAr = String(body.nameAr || "").trim()
    const nameEn = String(body.nameEn || nameAr || "").trim()

    if (!sku || !nameAr) {
      return NextResponse.json({ error: "SKU والاسم العربي مطلوبان" }, { status: 400 })
    }

    const existing = await prisma.item.findFirst({
      where: { OR: [{ sku }, { internalId: body.internalId || sku }] },
    })
    if (existing) {
      return NextResponse.json({ error: "SKU أو الرقم الداخلي مستخدم مسبقاً" }, { status: 400 })
    }

    const item = await prisma.item.create({
      data: {
        sku,
        internalId: String(body.internalId || sku).trim(),
        nameEn,
        nameAr,
        description: body.description || null,
        descriptionAr: body.descriptionAr || null,
        sourceType: body.sourceType || "FACTORY",
        uom: body.uom || "PCS",
        unitsPerCarton: Number(body.unitsPerCarton) || 1,
        costPerUnit: Number(body.costPerUnit) || 0,
        currency: body.currency || "USD",
        model: body.model || null,
        size: body.size || null,
        color: body.color || null,
        notes: body.notes || null,
        createdById: user.id,
        isActive: true,
      },
    })

    if (body.qrCode && String(body.qrCode).trim()) {
      const qr = String(body.qrCode).trim()
      const batch = await prisma.batch.create({
        data: {
          itemId: item.id,
          batchNumber: body.batchNumber || `B-${Date.now()}`,
          sourceType: item.sourceType,
        },
      })
      await prisma.carton.create({
        data: {
          qrCode: qr,
          cartonNumber: body.cartonNumber || "CTN-1",
          itemId: item.id,
          batchId: batch.id,
          quantity: Number(body.quantity) || Number(body.unitsPerCarton) || 1,
          originalQty: Number(body.quantity) || Number(body.unitsPerCarton) || 1,
          status: "AVAILABLE",
        },
      })
    }

    return NextResponse.json({ ok: true, item })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e?.message || "فشل الحفظ" }, { status: 500 })
  }
}
