import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import prisma from "@/lib/prisma"

type Step = {
  qty: number
  at: Date
  mode: "add" | "replace"
  unit: "PCS" | "KG"
}

/** SCAN|+qty|UNIT|ISO  or legacy SCAN|+qty|ISO */
function parseScanLines(
  notes: string | null | undefined,
  fallbackQty: number,
  fallbackAt: Date
): Step[] {
  const lines = (notes || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("SCAN|"))
  if (lines.length === 0) {
    const unit: "PCS" | "KG" =
      notes && /وحدة:\s*كجم|\bKG\b/i.test(notes) ? "KG" : "PCS"
    return [{ qty: fallbackQty, at: fallbackAt, mode: "add", unit }]
  }
  return lines.map((l) => {
    const parts = l.split("|")
    const flag = parts[1] || "+0"
    const mode = flag.startsWith("=") ? ("replace" as const) : ("add" as const)
    const qty = Math.abs(parseFloat(flag.replace(/^[+=]/, "")) || 0)
    let unit: "PCS" | "KG" = "PCS"
    let at = fallbackAt
    if (parts[2] === "PCS" || parts[2] === "KG") {
      unit = parts[2] as "PCS" | "KG"
      at = parts[3] ? new Date(parts[3]) : fallbackAt
    } else if (parts[2]) {
      at = new Date(parts[2])
      unit = "PCS"
    }
    return { qty, at, mode, unit }
  })
}

function totalsByUnit(steps: Step[]) {
  let pcs = 0
  let kg = 0
  for (const s of steps) {
    if (s.mode === "replace") {
      if (s.unit === "KG") kg = s.qty
      else pcs = s.qty
    } else {
      if (s.unit === "KG") kg += s.qty
      else pcs += s.qty
    }
  }
  return { pcs, kg }
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
      item: { select: { id: true, sku: true, nameAr: true, nameEn: true, uom: true } },
      countedBy: { select: { id: true, name: true, nameAr: true } },
    },
    orderBy: { countedAt: "desc" },
    take: 500,
  })

  const detail: any[] = []
  const aggregated: any[] = []

  for (const r of records) {
    const steps = parseScanLines(r.notes, Number(r.countedQty), r.countedAt)
    const { pcs, kg } = totalsByUnit(steps)
    const nameAr = r.item?.nameAr || r.item?.nameEn || ""
    const sku = r.item?.sku || ""
    const qr = r.qrCodeScanned || ""
    const countedBy = r.countedBy?.nameAr || r.countedBy?.name || ""

    let displayTotal: number | string = Number(r.countedQty)
    if (pcs > 0 && kg > 0) displayTotal = `${pcs} قطعة + ${kg} كجم`
    else if (kg > 0 && pcs === 0) displayTotal = kg
    else displayTotal = pcs || Number(r.countedQty)

    aggregated.push({
      recordId: r.id,
      qr,
      qty: displayTotal,
      qtyPcs: pcs,
      qtyKg: kg,
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
        unit: s.unit,
        mode: s.mode,
        time: s.at.toISOString(),
        countedAt: s.at.toISOString(),
        sku,
        nameAr,
        isUnknown: !!r.isUnknownQr || !r.itemId,
        countedBy,
        totalForItem: displayTotal,
        qtyPcs: pcs,
        qtyKg: kg,
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = session.user as any
  const { id: sessionId } = await params

  const { searchParams } = new URL(req.url)
  let recordId = searchParams.get("recordId")
  if (!recordId) {
    try {
      const body = await req.json()
      recordId = body.recordId
    } catch {
      /* empty */
    }
  }
  if (!recordId) {
    return NextResponse.json({ error: "recordId مطلوب" }, { status: 400 })
  }

  const stocktake = await prisma.stocktakeSession.findUnique({ where: { id: sessionId } })
  if (!stocktake) {
    return NextResponse.json({ error: "الجلسة غير موجودة" }, { status: 404 })
  }
  if (["CLOSED", "APPROVED", "CANCELLED"].includes(stocktake.status)) {
    return NextResponse.json({ error: "لا يمكن الحذف من جلسة مغلقة" }, { status: 400 })
  }

  const record = await prisma.countRecord.findFirst({
    where: { id: recordId, sessionId },
  })
  if (!record) {
    return NextResponse.json({ error: "السجل غير موجود" }, { status: 404 })
  }

  const isManager = ["SYSTEM_ADMIN", "INVENTORY_MANAGER", "WAREHOUSE_SUPERVISOR"].includes(
    user.role
  )
  if (!isManager && record.countedById !== user.id) {
    return NextResponse.json({ error: "ليس لديك صلاحية حذف هذا السجل" }, { status: 403 })
  }

  await prisma.countRecord.delete({ where: { id: recordId } })

  await prisma.sessionProgress
    .update({
      where: { sessionId },
      data: {
        totalCounted: { decrement: 1 },
        unknownCount: record.isUnknownQr ? { decrement: 1 } : undefined,
      },
    })
    .catch(() => {})

  return NextResponse.json({ ok: true, deletedId: recordId })
}
