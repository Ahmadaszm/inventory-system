import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import prisma from "@/lib/prisma"

function parseScanLines(notes: string | null | undefined, fallbackQty: number, fallbackAt: Date) {
  const lines = (notes || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("SCAN|"))
  if (lines.length === 0) {
    return [{ qty: fallbackQty, at: fallbackAt, mode: "add" as const }]
  }
  return lines.map((l) => {
    const parts = l.split("|")
    const flag = parts[1] || "+0"
    const mode = flag.startsWith("=") ? ("replace" as const) : ("add" as const)
    const qty = Math.abs(parseFloat(flag.replace(/^[+=]/, "")) || 0)
    const at = parts[2] ? new Date(parts[2]) : fallbackAt
    return { qty, at, mode }
  })
}

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

  const detail: any[] = []
  const aggregated: any[] = []

  for (const r of records) {
    const steps = parseScanLines(r.notes, Number(r.countedQty), r.countedAt)
    const total = Number(r.countedQty)
    const nameAr = r.item?.nameAr || r.item?.nameEn || ""
    const sku = r.item?.sku || ""
    const qr = r.qrCodeScanned || ""
    const countedBy = r.countedBy?.nameAr || r.countedBy?.name || ""

    aggregated.push({
      recordId: r.id,
      qr,
      qty: total,
      sku,
      nameAr,
      isUnknown: !!r.isUnknownQr || !r.itemId,
      countedBy,
      lastAt: r.countedAt,
      steps: steps.length,
    })

    const ordered = [...steps].reverse()
    ordered.forEach((s, idx) => {
      detail.push({
        id: `${r.id}-${idx}`,
        recordId: r.id,
        qr,
        qty: s.qty,
        mode: s.mode,
        time: s.at.toISOString(),
        countedAt: s.at.toISOString(),
        sku,
        nameAr,
        isUnknown: !!r.isUnknownQr || !r.itemId,
        countedBy,
        totalForItem: total,
      })
    })
  }

  return NextResponse.json({
    records: detail,
    aggregated,
    total: detail.length,
    recordCount: records.length,
  })
}
