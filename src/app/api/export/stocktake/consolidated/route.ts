import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import prisma from "@/lib/prisma"
import ExcelJS from "exceljs"
import { totalsFromNotes, formatDualTotal } from "@/lib/services/stocktake"

/**
 * Consolidated export: merge counted items across stocktake sessions.
 * Query:
 *  - status=closed|all|active  (default: closed = COUNTING_COMPLETE, APPROVED, CLOSED)
 *  - ids=id1,id2              (optional explicit session ids)
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const statusMode = (sp.get("status") || "closed").toLowerCase()
  const idsParam = sp.get("ids")

  let statusFilter: string[] | undefined
  if (idsParam) {
    statusFilter = undefined
  } else if (statusMode === "all") {
    statusFilter = undefined
  } else if (statusMode === "active") {
    statusFilter = ["IN_PROGRESS", "COUNTING_COMPLETE", "UNDER_REVIEW", "PENDING_APPROVAL"]
  } else {
    statusFilter = ["COUNTING_COMPLETE", "UNDER_REVIEW", "PENDING_APPROVAL", "APPROVED", "CLOSED"]
  }

  const idList = idsParam
    ? idsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : []

  const where: any = {}
  if (idList.length) {
    where.id = { in: idList }
  } else if (statusFilter) {
    where.status = { in: statusFilter }
  } else {
    where.status = { not: "CANCELLED" }
  }

  const sessions = await prisma.stocktakeSession.findMany({
    where,
    include: {
      countRecords: {
        include: {
          item: true,
        },
      },
      createdBy: { select: { name: true, nameAr: true } },
      warehouse: true,
    },
    orderBy: { createdAt: "asc" },
  })

  type Agg = {
    itemId: string | null
    sku: string
    nameAr: string
    nameEn: string
    uom: string
    pcs: number
    kg: number
    sessions: Set<string>
    records: number
    unknown: boolean
  }
  const map = new Map<string, Agg>()

  for (const s of sessions) {
    for (const r of s.countRecords) {
      const { pcs, kg } = totalsFromNotes(r.notes, Number(r.countedQty))
      const sku = r.item?.sku || ""
      const key = r.itemId || (sku ? `sku:${sku}` : `qr:${r.qrCodeScanned || r.id}`)
      const existing = map.get(key)
      if (existing) {
        existing.pcs += pcs
        existing.kg += kg
        existing.sessions.add(s.sessionNumber)
        existing.records += 1
      } else {
        map.set(key, {
          itemId: r.itemId,
          sku: sku || r.qrCodeScanned || "—",
          nameAr: r.item?.nameAr || (r.isUnknownQr ? "غير معرّف" : ""),
          nameEn: r.item?.nameEn || "",
          uom: r.item?.uom || "",
          pcs,
          kg,
          sessions: new Set([s.sessionNumber]),
          records: 1,
          unknown: !!r.isUnknownQr || !r.itemId,
        })
      }
    }
  }

  const rows = [...map.values()].sort((a, b) =>
    (a.sku || a.nameAr).localeCompare(b.sku || b.nameAr, "ar")
  )

  const wb = new ExcelJS.Workbook()
  wb.creator = "ZMZM Inventory"
  wb.created = new Date()

  const wsSum = wb.addWorksheet("ملخص التجميع")
  wsSum.columns = [
    { header: "البند", key: "k", width: 28 },
    { header: "القيمة", key: "v", width: 50 },
  ]
  wsSum.getRow(1).font = { bold: true }
  let totalPcs = 0
  let totalKg = 0
  for (const r of rows) {
    totalPcs += r.pcs
    totalKg += r.kg
  }
  const summary = [
    ["تاريخ التصدير", new Date().toLocaleString("ar-EG")],
    ["عدد الجلسات المشمولة", sessions.length],
    ["أرقام الجلسات", sessions.map((s) => s.sessionNumber).join(" ، ") || "—"],
    ["عدد الأصناف الموحّدة", rows.length],
    ["إجمالي القطع", Math.round(totalPcs * 1000) / 1000],
    ["إجمالي الكجم", Math.round(totalKg * 1000) / 1000],
    ["الكمية (عرض)", formatDualTotal(totalPcs, totalKg)],
  ]
  for (const [k, v] of summary) wsSum.addRow({ k, v })

  const wsSess = wb.addWorksheet("الجلسات")
  wsSess.columns = [
    { header: "#", key: "n", width: 6 },
    { header: "رقم الجلسة", key: "num", width: 20 },
    { header: "العنوان", key: "title", width: 32 },
    { header: "الحالة", key: "status", width: 16 },
    { header: "عدد السجلات", key: "recs", width: 12 },
    { header: "بواسطة", key: "by", width: 18 },
    { header: "تاريخ", key: "date", width: 16 },
  ]
  wsSess.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
  wsSess.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9B1B1E" } }
  sessions.forEach((s, i) => {
    wsSess.addRow({
      n: i + 1,
      num: s.sessionNumber,
      title: s.titleAr || s.title,
      status: s.status,
      recs: s.countRecords.length,
      by: s.createdBy?.nameAr || s.createdBy?.name || "",
      date: new Date(s.countDate).toLocaleDateString("ar-EG"),
    })
  })

  const ws = wb.addWorksheet("أصناف موحّدة")
  ws.columns = [
    { header: "#", key: "n", width: 6 },
    { header: "رمز الصنف (SKU)", key: "sku", width: 18 },
    { header: "اسم الصنف", key: "name", width: 40 },
    { header: "كمية قطعة", key: "pcs", width: 12 },
    { header: "كمية كجم", key: "kg", width: 12 },
    { header: "الكمية (عرض)", key: "display", width: 22 },
    { header: "وحدة الصنف", key: "uom", width: 10 },
    { header: "عدد السجلات", key: "recs", width: 12 },
    { header: "من جلسات", key: "sessions", width: 36 },
    { header: "ملاحظات", key: "note", width: 14 },
  ]
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9B1B1E" } }

  rows.forEach((r, i) => {
    const pcs = Math.round(r.pcs * 1000) / 1000
    const kg = Math.round(r.kg * 1000) / 1000
    ws.addRow({
      n: i + 1,
      sku: r.sku,
      name: r.nameAr || r.nameEn || "—",
      pcs: pcs || "",
      kg: kg || "",
      display: formatDualTotal(r.pcs, r.kg),
      uom: r.uom || "",
      recs: r.records,
      sessions: [...r.sessions].join(" ، "),
      note: r.unknown ? "غير معرّف" : "",
    })
  })

  ws.addRow({})
  const tot = ws.addRow({
    n: "",
    sku: "",
    name: "المجموع",
    pcs: Math.round(totalPcs * 1000) / 1000 || "",
    kg: Math.round(totalKg * 1000) / 1000 || "",
    display: formatDualTotal(totalPcs, totalKg),
    uom: "",
    recs: rows.reduce((a, r) => a + r.records, 0),
    sessions: `${sessions.length} جلسة`,
    note: "",
  })
  tot.font = { bold: true }

  const buf = await wb.xlsx.writeBuffer()
  const filename = `jurd-consolidated-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
