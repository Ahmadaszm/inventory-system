import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import prisma from "@/lib/prisma"
import ExcelJS from "exceljs"

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
    { header: "Time", key: "time", width: 18 },
    { header: "QR / Barcode", key: "qr", width: 28 },
    { header: "SKU", key: "sku", width: 14 },
    { header: "Item Name", key: "name", width: 28 },
    { header: "Counted Qty", key: "qty", width: 14 },
    { header: "Book Qty", key: "book", width: 12 },
    { header: "Variance", key: "variance", width: 10 },
    { header: "Status", key: "status", width: 14 },
    { header: "Unknown", key: "unknown", width: 10 },
    { header: "Duplicate", key: "dup", width: 10 },
    { header: "Counter", key: "counter", width: 16 },
    { header: "Notes", key: "notes", width: 24 },
  ]

  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A5F" },
  }

  for (const r of stocktake.countRecords) {
    ws.addRow({
      time: new Date(r.countedAt).toLocaleString("en-GB"),
      qr: r.qrCodeScanned || r.carton?.qrCode || "",
      sku: r.item?.sku || "",
      name: r.item?.nameAr || r.item?.nameEn || (r.isUnknownQr ? "UNKNOWN" : ""),
      qty: Number(r.countedQty),
      book: r.bookQty != null ? Number(r.bookQty) : "",
      variance: r.varianceQty != null ? Number(r.varianceQty) : "",
      status: r.status,
      unknown: r.isUnknownQr ? "Yes" : "No",
      dup: r.isDuplicate ? "Yes" : "No",
      counter: r.countedBy?.nameAr || r.countedBy?.name || "",
      notes: r.notes || "",
    })
  }

  const sum = wb.addWorksheet("Summary")
  sum.addRow(["Session", stocktake.sessionNumber])
  sum.addRow(["Title", stocktake.titleAr || stocktake.title])
  sum.addRow(["Type", stocktake.type])
  sum.addRow(["Status", stocktake.status])
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
