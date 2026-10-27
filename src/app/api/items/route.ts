import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, hasPermission } from "@/lib/auth/options"
import prisma from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { arabicNormalize, arabicSearchVariants, matchesArabicSearch } = await import(
    "@/lib/arabicSearch"
  )

  const q = (req.nextUrl.searchParams.get("q") || "").trim()
  const variants = q ? arabicSearchVariants(q) : []
  const qNorm = arabicNormalize(q)

  const orClause =
    variants.length > 0
      ? variants.flatMap((v) => [
          { sku: { contains: v, mode: "insensitive" as const } },
          { nameAr: { contains: v, mode: "insensitive" as const } },
          { nameEn: { contains: v, mode: "insensitive" as const } },
          { internalId: { contains: v, mode: "insensitive" as const } },
          { model: { contains: v, mode: "insensitive" as const } },
          { size: { contains: v, mode: "insensitive" as const } },
          { color: { contains: v, mode: "insensitive" as const } },
        ])
      : undefined

  let items = await prisma.item.findMany({
    where: {
      isActive: true,
      ...(orClause ? { OR: orClause } : {}),
    },
    include: { category: true, brand: true, _count: { select: { cartons: true } } },
    orderBy: { sku: "asc" },
    take: q ? 120 : 500,
  })

  if (qNorm) {
    items = items
      .filter(
        (it) =>
          matchesArabicSearch(it.sku, qNorm) ||
          matchesArabicSearch(it.internalId, qNorm) ||
          matchesArabicSearch(it.nameAr, qNorm) ||
          matchesArabicSearch(it.nameEn, qNorm) ||
          matchesArabicSearch(it.model, qNorm) ||
          matchesArabicSearch(it.size, qNorm) ||
          matchesArabicSearch(it.color, qNorm) ||
          matchesArabicSearch(it.descriptionAr, qNorm) ||
          matchesArabicSearch(it.description, qNorm)
      )
      .slice(0, 40)
  }

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
