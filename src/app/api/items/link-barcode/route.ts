import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, hasPermission } from "@/lib/auth/options"
import { ensurePermissionsLoaded } from "@/lib/auth/permissions"
import prisma from "@/lib/prisma"
import { normalizeBarcode } from "@/lib/services/resolveBarcode"

/**
 * Link a physical barcode to an existing item, or create a new item + carton.
 * Body:
 *  - qrCode (required)
 *  - itemId (optional) — link to existing
 *  - nameAr, nameEn, sku (optional) — create new if no itemId
 *  - quantity (optional)
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
    const qrCode = normalizeBarcode(String(body.qrCode || "")) || String(body.qrCode || "").trim()
    if (!qrCode) {
      return NextResponse.json({ error: "الباركود مطلوب" }, { status: 400 })
    }

    // Already linked?
    const existingCarton = await prisma.carton.findUnique({
      where: { qrCode },
      include: { item: true },
    })
    if (existingCarton) {
      return NextResponse.json({
        ok: true,
        alreadyLinked: true,
        carton: existingCarton,
        item: existingCarton.item,
      })
    }

    let itemId = body.itemId ? String(body.itemId) : null
    let item = itemId
      ? await prisma.item.findUnique({ where: { id: itemId } })
      : null

    if (!item && (body.nameAr || body.sku)) {
      const sku = String(body.sku || `AUTO-${Date.now()}`).trim()
      const nameAr = String(body.nameAr || sku).trim()
      const nameEn = String(body.nameEn || nameAr).trim()
      item = await prisma.item.create({
        data: {
          sku,
          internalId: sku,
          nameAr,
          nameEn,
          sourceType: body.sourceType || "FACTORY",
          uom: body.uom || "PCS",
          unitsPerCarton: Number(body.unitsPerCarton) || 1,
          costPerUnit: Number(body.costPerUnit) || 0,
          currency: body.currency || "USD",
          createdById: user.id,
          isActive: true,
        },
      })
      itemId = item.id
    }

    if (!item || !itemId) {
      return NextResponse.json({ error: "الصنف مطلوب" }, { status: 400 })
    }

    const batch = await prisma.batch.create({
      data: {
        itemId,
        batchNumber: body.batchNumber || `B-${Date.now()}`,
        sourceType: item.sourceType,
      },
    })

    const carton = await prisma.carton.create({
      data: {
        qrCode,
        cartonNumber: body.cartonNumber || "CTN-1",
        itemId,
        batchId: batch.id,
        quantity: Number(body.quantity) || Number(item.unitsPerCarton) || 1,
        originalQty: Number(body.quantity) || Number(item.unitsPerCarton) || 1,
        status: "AVAILABLE",
      },
      include: { item: true },
    })

    return NextResponse.json({ ok: true, carton, item: carton.item })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e?.message || "فشل الربط" }, { status: 500 })
  }
}
