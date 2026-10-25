import prisma from "@/lib/prisma"

/** Normalize scanned barcode text (remove spaces/newlines) */
export function normalizeBarcode(raw: string): string {
  return raw
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, "")
    .trim()
}

/**
 * Resolve a scanned code to an inventory carton/item.
 * 1) Exact carton QR
 * 2) Item SKU
 * 3) Barcode / catalog number found inside item name
 * Auto-links a Carton when found via name so next scan is instant.
 */
export async function resolveBarcode(rawCode: string) {
  const code = normalizeBarcode(rawCode)
  if (!code) return null

  let carton = await prisma.carton.findUnique({
    where: { qrCode: code },
    include: {
      item: { include: { category: true, brand: true } },
      batch: true,
      location: { include: { warehouse: true } },
    },
  })
  if (carton) return { carton, matchedBy: "carton_qr" as const, code }

  let item = await prisma.item.findFirst({
    where: { sku: code, isActive: true },
    include: { category: true, brand: true },
  })

  if (!item && code.length >= 4) {
    item = await prisma.item.findFirst({
      where: {
        isActive: true,
        OR: [
          { nameAr: { contains: code } },
          { nameEn: { contains: code } },
          { description: { contains: code } },
          { descriptionAr: { contains: code } },
        ],
      },
      include: { category: true, brand: true },
    })
  }

  if (!item && /^\d{12,14}$/.test(code)) {
    const short = code.slice(-12)
    item = await prisma.item.findFirst({
      where: {
        isActive: true,
        OR: [{ nameAr: { contains: short } }, { nameAr: { contains: code } }],
      },
      include: { category: true, brand: true },
    })
  }

  if (!item) return null

  let batch = await prisma.batch.findFirst({ where: { itemId: item.id } })
  if (!batch) {
    batch = await prisma.batch.create({
      data: {
        itemId: item.id,
        batchNumber: `B-${item.sku}`.slice(0, 60),
        sourceType: item.sourceType,
        isActive: true,
      },
    })
  }

  const existingSame = await prisma.carton.findUnique({ where: { qrCode: code } })
  if (existingSame) {
    carton = await prisma.carton.findUnique({
      where: { qrCode: code },
      include: {
        item: { include: { category: true, brand: true } },
        batch: true,
        location: { include: { warehouse: true } },
      },
    })
  } else {
    carton = await prisma.carton.create({
      data: {
        qrCode: code,
        cartonNumber: `CTN-${code}`.slice(0, 60),
        itemId: item.id,
        batchId: batch.id,
        quantity: item.unitsPerCarton || 1,
        originalQty: item.unitsPerCarton || 1,
        status: "AVAILABLE",
        isActive: true,
      },
      include: {
        item: { include: { category: true, brand: true } },
        batch: true,
        location: { include: { warehouse: true } },
      },
    })
  }

  return { carton, matchedBy: "item_name" as const, code }
}
