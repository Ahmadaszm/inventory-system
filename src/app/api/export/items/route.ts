import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import prisma from "@/lib/prisma"
import ExcelJS from "exceljs"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const items = await prisma.item.findMany({
    include: { category: true, brand: true },
    orderBy: { sku: "asc" },
  })

  const wb = new ExcelJS.Workbook()
  wb.creator = "Inventory System"
  const ws = wb.addWorksheet("Items")

  ws.columns = [
    { header: "SKU", key: "sku", width: 16 },
    { header: "Internal ID", key: "internalId", width: 16 },
    { header: "Name AR", key: "nameAr", width: 28 },
    { header: "Name EN", key: "nameEn", width: 28 },
    { header: "Category", key: "category", width: 16 },
    { header: "Brand", key: "brand", width: 14 },
    { header: "Source", key: "sourceType", width: 12 },
    { header: "UOM", key: "uom", width: 10 },
    { header: "Units/Carton", key: "unitsPerCarton", width: 12 },
    { header: "Cost", key: "cost", width: 12 },
    { header: "Currency", key: "currency", width: 8 },
    { header: "Active", key: "active", width: 8 },
  ]

  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A5F" },
  }

  for (const item of items) {
    ws.addRow({
      sku: item.sku,
      internalId: item.internalId,
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      category: item.category?.nameAr || item.category?.name || "",
      brand: item.brand?.nameAr || item.brand?.name || "",
      sourceType: item.sourceType,
      uom: item.uom,
      unitsPerCarton: item.unitsPerCarton,
      cost: Number(item.costPerUnit),
      currency: item.currency,
      active: item.isActive ? "Yes" : "No",
    })
  }

  const buffer = await wb.xlsx.writeBuffer()
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="items-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
