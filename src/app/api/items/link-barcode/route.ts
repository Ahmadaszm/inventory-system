import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, hasPermission } from "@/lib/auth/options"
import { ensurePermissionsLoaded } from "@/lib/auth/permissions"
import prisma from "@/lib/prisma"
import {
  barcodeVariants,
  ensureVariantCartons,
  normalizeBarcode,
} from "@/lib/services/resolveBarcode"

function preferredCode(raw: string): string {
  const variants = barcodeVariants(raw)
  // Prefer short dash codes like 7-150023
  const dash = variants.find((v) => /^\d{1,6}-\d{2,10}$/.test(v))
  if (dash) return dash
  const compact = variants.find((v) => v.length <= 40)
  return (compact || normalizeBarcode(raw) || raw).slice(0, 190)
}

/**
 * Link a physical barcode to an existing item, or create a new item + carton.
 * Saves ALL barcode variants (original, reverse dash, extracted) so re-scan always finds the item.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 })
    }
    await ensurePermissionsLoaded(prisma as any)
    const user = session.user as any
    const role = String(user?.role || "")
    const allowed =
      role === "SYSTEM_ADMIN" ||
      hasPermission(role, "*") ||
      hasPermission(role, "items:write") ||
      hasPermission(role, "scan:perform") ||
      hasPermission(role, "stocktake:count") ||
      hasPermission(role, "stocktake:manage")
    if (!allowed) {
      return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })
    }

    const body = await req.json()
    const rawQr = String(body.qrCode || "").trim()
    if (!rawQr) {
      return NextResponse.json({ error: "الباركود مطلوب" }, { status: 400 })
    }

    const variants = barcodeVariants(rawQr)
    const primaryCode = preferredCode(rawQr)

    // Already linked under any variant?
    for (const code of variants) {
      const existingCarton = await prisma.carton.findUnique({
        where: { qrCode: code },
        include: { item: true },
      })
      if (existingCarton?.isActive && existingCarton.item) {
        let batch = await prisma.batch.findFirst({ where: { itemId: existingCarton.itemId } })
        if (batch) {
          await ensureVariantCartons(
            existingCarton.itemId,
            batch.id,
            variants,
            Number(existingCarton.quantity) || 1
          )
        }
        return NextResponse.json({
          ok: true,
          alreadyLinked: true,
          item: {
            id: existingCarton.item.id,
            sku: existingCarton.item.sku,
            nameAr: existingCarton.item.nameAr,
            nameEn: existingCarton.item.nameEn,
          },
          carton: { id: existingCarton.id, qrCode: existingCarton.qrCode },
        })
      }
    }

    let item =
      body.itemId
        ? await prisma.item.findUnique({ where: { id: String(body.itemId) } })
        : null

    if (!item) {
      const nameAr = String(body.nameAr || "").trim()
      if (!nameAr) {
        return NextResponse.json(
          { error: "اختر صنفاً موجوداً أو أدخل اسم الصنف" },
          { status: 400 }
        )
      }
      let sku = String(body.sku || primaryCode).trim().slice(0, 80)
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

    // Primary carton
    let carton = await prisma.carton.findUnique({ where: { qrCode: primaryCode } })
    if (carton) {
      carton = await prisma.carton.update({
        where: { id: carton.id },
        data: {
          itemId: item.id,
          batchId: batch.id,
          isActive: true,
          status: "AVAILABLE",
          quantity: qty,
        },
      })
    } else {
      carton = await prisma.carton.create({
        data: {
          qrCode: primaryCode,
          cartonNumber: `CTN-${primaryCode}`.slice(0, 60),
          itemId: item.id,
          batchId: batch.id,
          quantity: qty,
          originalQty: qty,
          status: "AVAILABLE",
          isActive: true,
        },
      })
    }

    // Save ALL variants so re-scan finds the item
    await ensureVariantCartons(item.id, batch.id, variants, qty)

    if (item.sku && item.sku !== primaryCode) {
      await ensureVariantCartons(
        item.id,
        batch.id,
        [item.sku, item.internalId].filter(Boolean) as string[],
        qty
      )
    }

    return NextResponse.json({
      ok: true,
      item: {
        id: item.id,
        sku: item.sku,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
      },
      carton: { id: carton.id, qrCode: carton.qrCode },
      linkedCodes: variants.slice(0, 8),
    })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e?.message || "فشل الربط" }, { status: 500 })
  }
}
