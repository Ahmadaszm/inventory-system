import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, hasPermission } from "@/lib/auth/options"
import prisma from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const {
    arabicNormalize,
    arabicSearchVariants,
    searchTokens,
    scoreItemSearch,
  } = await import("@/lib/arabicSearch")

  const q = (req.nextUrl.searchParams.get("q") || "").trim()
  const variants = q ? arabicSearchVariants(q) : []
  const qNorm = arabicNormalize(q)
  const tokens = q ? searchTokens(q) : []

  // Build field OR helper for a single token/variant
  const fieldContains = (v: string) => [
    { sku: { contains: v, mode: "insensitive" as const } },
    { nameAr: { contains: v, mode: "insensitive" as const } },
    { nameEn: { contains: v, mode: "insensitive" as const } },
    { internalId: { contains: v, mode: "insensitive" as const } },
    { model: { contains: v, mode: "insensitive" as const } },
    { size: { contains: v, mode: "insensitive" as const } },
    { color: { contains: v, mode: "insensitive" as const } },
  ]

  // Multi-token: require each token (or a short synonym set) via AND of ORs
  // so DB already narrows to candidates that can satisfy AND logic.
  let whereExtra: Record<string, unknown> = {}
  if (tokens.length >= 2) {
    const andParts = tokens.slice(0, 5).map((t) => {
      const vars = arabicSearchVariants(t).slice(0, 8)
      return { OR: vars.flatMap((v) => fieldContains(v)) }
    })
    whereExtra = { AND: andParts }
  } else if (variants.length > 0) {
    whereExtra = { OR: variants.flatMap((v) => fieldContains(v)) }
  }

  let items = await prisma.item.findMany({
    where: {
      isActive: true,
      ...whereExtra,
    },
    include: { category: true, brand: true, _count: { select: { cartons: true } } },
    orderBy: { sku: "asc" },
    take: q ? 250 : 500,
  })

  // Fallback: broader load then in-memory filter (covers synonym / normalize edge cases)
  if (q && items.length === 0) {
    items = await prisma.item.findMany({
      where: { isActive: true },
      include: { category: true, brand: true, _count: { select: { cartons: true } } },
      orderBy: { sku: "asc" },
      take: 900,
    })
  }

  if (qNorm) {
    items = items
      .map((it) => ({ it, score: scoreItemSearch(it, q) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map(({ it }) => it)
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
