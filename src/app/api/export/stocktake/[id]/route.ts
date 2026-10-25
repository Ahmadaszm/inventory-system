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
    },
  })

  if (!stocktake) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = "Inventory System"
  const ws = wb.addWorksheet("Counts")

  ws.columns = [
    { header: "الوقت", key: "time", width: 18 },
    { header: "الباركود", key: "qr", width: 16 },
    { header: "اسم الصنف", key: "name", width: 40 },
    { header: "الكمية", key: "qty", width: 12 },
    { header: "القائم بالجرد", key: "counter", width: 18 },
    { header: "الحالة", key: "status", width: 12 },
    { header: "غير معرّف", key: "unknown", width: 10 },
    { header: "النص الكامل للباركود", key: "full", width: 40 },
  ]

  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A5F" },
  }

  for (const r of stocktake.countRecords) {
    const full = r.qrCodeScanned || r.carton?.qrCode || ""
    ws.addRow({
      time: new Date(r.countedAt).toLocaleString("ar-EG"),
      qr: r.item?.sku || extractProductCode(full),
      name: r.item?.nameAr || r.item?.nameEn || cleanQrText(full),
      qty: Number(r.countedQty),
      counter: r.countedBy?.nameAr || r.countedBy?.name || "",
      status: r.isUnknownQr ? "غير معرّف" : r.status,
      unknown: r.isUnknownQr ? "نعم" : "لا",
      full: cleanQrText(full),
    })
  }

  const sum = wb.addWorksheet("Summary")
  sum.addRow(["Session", stocktake.sessionNumber])
  sum.addRow(["Title", stocktake.titleAr || stocktake.title])
  sum.addRow(["Records", stocktake.countRecords.length])
  sum.addRow(["Exported", new Date().toISOString()])

  const buffer = await wb.xlsx.writeBuffer()
  const fname = `stocktake-${stocktake.sessionNumber}.xlsx`
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  })
}
