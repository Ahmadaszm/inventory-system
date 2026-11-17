import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import prisma from "@/lib/prisma"
import ExcelJS from "exceljs"
import { extractProductCode, cleanQrText } from "@/lib/barcodeExtract"
import { totalsFromNotes, formatDualTotal } from "@/lib/services/stocktake"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const stocktake = await prisma.stocktakeSession.findUnique({
    where: { id },
    include: {
      countRecords: {
        include: {
          item: true,
          carton: true,
          countedBy: true,
          location: true,
        },
        orderBy: { countedAt: "asc" },
      },
      warehouse: true,
      createdBy: true,
    },
  })

  if (!stocktake) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = "ZMZM Inventory"
  wb.created = new Date()

  // ---- Summary sheet ----
  const wsSum = wb.addWorksheet("ملخص الجلسة")
  wsSum.columns = [
    { header: "البند", key: "k", width: 22 },
    { header: "القيمة", key: "v", width: 40 },
  ]
  wsSum.getRow(1).font = { bold: true }
  const totalQty = stocktake.countRecords.reduce((s, r) => s + Number(r.countedQty), 0)
  const unknown = stocktake.countRecords.filter((r) => r.isUnknownQr || !r.itemId).length
  let sumPcsAll = 0
  let sumKgAll = 0
  for (const r of stocktake.countRecords) {
    const t = totalsFromNotes(r.notes, Number(r.countedQty))
    sumPcsAll += t.pcs
    sumKgAll += t.kg
  }
  const summaryRows = [
    ["رقم الجلسة", stocktake.sessionNumber],
    ["العنوان", stocktake.titleAr || stocktake.title],
    ["الحالة", stocktake.status],
    ["النوع", stocktake.isSurprise ? "مفاجئ" : stocktake.type],
    ["أعمى", stocktake.isBlind ? "نعم" : "لا"],
    ["تاريخ الجرد", new Date(stocktake.countDate).toLocaleDateString("ar-EG")],
    ["أنشئت بواسطة", stocktake.createdBy?.nameAr || stocktake.createdBy?.name || ""],
    ["عدد الأصناف (سجلات)", stocktake.countRecords.length],
    ["إجمالي القطع", Math.round(sumPcsAll * 1000) / 1000],
    ["إجمالي الكجم", Math.round(sumKgAll * 1000) / 1000],
    ["الكمية (عرض)", formatDualTotal(sumPcsAll, sumKgAll, totalQty)],
    ["غير معرّف", unknown],
    ["تاريخ الاعتماد", stocktake.approvedAt ? new Date(stocktake.approvedAt).toLocaleString("ar-EG") : "—"],
    ["تاريخ الإنهاء", stocktake.completedAt ? new Date(stocktake.completedAt).toLocaleString("ar-EG") : "—"],
  ]
  for (const [k, v] of summaryRows) wsSum.addRow({ k, v })

  // ---- Detail sheet ----
  const ws = wb.addWorksheet("تفاصيل العد")
  ws.columns = [
    { header: "#", key: "n", width: 6 },
    { header: "الوقت", key: "time", width: 18 },
    { header: "الباركود", key: "barcode", width: 22 },
    { header: "رمز الصنف (SKU)", key: "sku", width: 16 },
    { header: "اسم الصنف", key: "name", width: 36 },
    { header: "كمية قطعة", key: "qtyPcs", width: 12 },
    { header: "كمية كجم", key: "qtyKg", width: 12 },
    { header: "الكمية (عرض)", key: "qtyDisplay", width: 22 },
    { header: "القائم بالجرد", key: "counter", width: 18 },
    { header: "الحالة", key: "status", width: 12 },
    { header: "ملاحظات", key: "notes", width: 28 },
  ]
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF9B1B1E" },
  }

  let i = 0
  let sumPcs = 0
  let sumKg = 0
  for (const r of stocktake.countRecords) {
    i++
    const barcode =
      extractProductCode(r.qrCodeScanned || "") ||
      r.qrCodeScanned ||
      r.carton?.qrCode ||
      r.item?.sku ||
      ""
    const notesClean = (r.notes || "")
      .split("\n")
      .filter((l) => !l.startsWith("SCAN|"))
      .join(" ")
      .trim()
    const { pcs, kg } = totalsFromNotes(r.notes, Number(r.countedQty))
    sumPcs += pcs
    sumKg += kg
    const qtyPcs = Math.round(pcs * 1000) / 1000
    const qtyKg = Math.round(kg * 1000) / 1000
    ws.addRow({
      n: i,
      time: new Date(r.countedAt).toLocaleString("ar-EG"),
      barcode: String(barcode).slice(0, 80),
      sku: r.item?.sku || "",
      name: r.item?.nameAr || r.item?.nameEn || (r.isUnknownQr ? "غير معرّف" : ""),
      qtyPcs: qtyPcs || "",
      qtyKg: qtyKg || "",
      qtyDisplay: formatDualTotal(pcs, kg, Number(r.countedQty)),
      counter: r.countedBy?.nameAr || r.countedBy?.name || "",
      status: r.isUnknownQr ? "غير معرّف" : r.status === "DISCREPANCY" ? "فرق" : "تم",
      notes: notesClean,
    })
  }

  // totals row — separate PCS and KG, never mix
  ws.addRow({})
  const tot = ws.addRow({
    n: "",
    time: "",
    barcode: "",
    sku: "",
    name: "المجموع",
    qtyPcs: Math.round(sumPcs * 1000) / 1000 || "",
    qtyKg: Math.round(sumKg * 1000) / 1000 || "",
    qtyDisplay: formatDualTotal(sumPcs, sumKg),
    counter: "",
    status: "",
    notes: `${stocktake.countRecords.length} سجل`,
  })
  tot.font = { bold: true }

  const buf = await wb.xlsx.writeBuffer()
  const filename = `jurd-${stocktake.sessionNumber}.xlsx`

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
