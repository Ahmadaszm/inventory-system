import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import prisma from "@/lib/prisma"
import ExcelJS from "exceljs"
import { extractProductCode, cleanQrText } from "@/lib/barcodeExtract"

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

  const totalQty = stocktake.countRecords.reduce((s, r) => s + Number(r.countedQty), 0)
  const unknown = stocktake.countRecords.filter((r) => r.isUnknownQr || !r.itemId).length

  const wsSum = wb.addWorksheet("ملخص الجلسة")
  wsSum.columns = [
    { header: "البند", key: "k", width: 24 },
    { header: "القيمة", key: "v", width: 42 },
  ]
  wsSum.getRow(1).font = { bold: true }
  for (const [k, v] of [
    ["رقم الجلسة", stocktake.sessionNumber],
    ["العنوان", stocktake.titleAr || stocktake.title],
    ["الحالة", stocktake.status],
    ["النوع", stocktake.isSurprise ? "مفاجئ" : stocktake.type],
    ["تاريخ الجرد", new Date(stocktake.countDate).toLocaleDateString("ar-EG")],
    ["أنشئت بواسطة", stocktake.createdBy?.nameAr || stocktake.createdBy?.name || ""],
    ["عدد السجلات", stocktake.countRecords.length],
    ["إجمالي الكميات", totalQty],
    ["غير معرّف", unknown],
    ["تاريخ الاعتماد", stocktake.approvedAt ? new Date(stocktake.approvedAt).toLocaleString("ar-EG") : "—"],
    ["تاريخ الإنهاء", stocktake.completedAt ? new Date(stocktake.completedAt).toLocaleString("ar-EG") : "—"],
  ] as [string, string | number][]) {
    wsSum.addRow({ k, v })
  }

  const ws = wb.addWorksheet("تفاصيل العد")
  ws.columns = [
    { header: "#", key: "n", width: 6 },
    { header: "الوقت", key: "time", width: 18 },
    { header: "الباركود", key: "barcode", width: 22 },
    { header: "رمز الصنف", key: "sku", width: 14 },
    { header: "اسم الصنف", key: "name", width: 36 },
    { header: "الكمية", key: "qty", width: 12 },
    { header: "القائم بالجرد", key: "counter", width: 18 },
    { header: "الحالة", key: "status", width: 12 },
  ]
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF9B1B1E" },
  }

  let i = 0
  for (const r of stocktake.countRecords) {
    i++
    const full = r.qrCodeScanned || r.carton?.qrCode || ""
    const barcode = r.item?.sku || extractProductCode(full) || full
    ws.addRow({
      n: i,
      time: new Date(r.countedAt).toLocaleString("ar-EG"),
      barcode: String(barcode).slice(0, 80),
      sku: r.item?.sku || "",
      name: r.item?.nameAr || r.item?.nameEn || (r.isUnknownQr ? "غير معرّف" : cleanQrText(full)),
      qty: Number(r.countedQty),
      counter: r.countedBy?.nameAr || r.countedBy?.name || "",
      status: r.isUnknownQr ? "غير معرّف" : "تم",
    })
  }

  const tot = ws.addRow({
    n: "",
    time: "",
    barcode: "",
    sku: "",
    name: "المجموع",
    qty: totalQty,
    counter: "",
    status: `${stocktake.countRecords.length} سجل`,
  })
  tot.font = { bold: true }

  const buffer = await wb.xlsx.writeBuffer()
  const fname = `jurd-${stocktake.sessionNumber}.xlsx`
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  })
}
