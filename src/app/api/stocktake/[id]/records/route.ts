import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import prisma from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const records = await prisma.countRecord.findMany({
    where: { sessionId: id },
    include: {
      item: { select: { id: true, sku: true, nameAr: true, nameEn: true } },
      countedBy: { select: { id: true, name: true, nameAr: true } },
    },
    orderBy: { countedAt: "desc" },
    take: 500,
  })

  const map = new Map<string, any>()
  for (const r of records) {
    const key = (r.qrCodeScanned || r.itemId || r.id).trim()
    const qty = Number(r.countedQty)
    const existing = map.get(key)
    if (existing) {
      existing.qty += qty
      existing.lastAt = r.countedAt
      existing.recordId = r.id
    } else {
      map.set(key, {
        recordId: r.id,
        qr: r.qrCodeScanned,
        qty,
        sku: r.item?.sku || "",
        nameAr: r.item?.nameAr || r.item?.nameEn || "",
        isUnknown: !!r.isUnknownQr || !r.itemId,
        countedBy: r.countedBy?.nameAr || r.countedBy?.name || "",
        lastAt: r.countedAt,
        status: r.isUnknownQr ? "UNKNOWN" : "COUNTED",
      })
    }
  }

  return NextResponse.json({
    records: records.map((r) => ({
      id: r.id,
      qr: r.qrCodeScanned,
      qty: Number(r.countedQty),
      sku: r.item?.sku || "",
      nameAr: r.item?.nameAr || r.item?.nameEn || "",
      isUnknown: !!r.isUnknownQr || !r.itemId,
      countedBy: r.countedBy?.nameAr || r.countedBy?.name || "",
      countedAt: r.countedAt,
    })),
    aggregated: Array.from(map.values()),
    total: records.length,
  })
}
