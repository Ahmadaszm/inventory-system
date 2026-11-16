import prisma from "@/lib/prisma"
import { extractProductCode } from "@/lib/barcodeExtract"

/** Light normalize: keep spaces (needed for free-text QR labels) */
export function normalizeBarcode(raw: string): string {
  return String(raw || "")
replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Compact form without spaces (legacy scans / pure codes) */
export function compactBarcode(raw: string): string {
  return normalizeBarcode(raw).replace(/\s+/g, "")
}

/**
 * Swap segments around a single hyphen: 30-150540 ↔ 150540-30
 * Handles labels printed / read in reverse order.
 */
export function reverseDashCode(code: string): string | null {
  const m = String(code || "").match(/^(\d+)-(\d+)$/)
  if (!m) return null
  return `${m[2]}-${m[1]}`
}

/**
 * Build lookup variants for a scanned/typed code.
 * Includes: original, compact, reversed dash, extracted product codes.
 */
export function barcodeVariants(raw: string): string[] {
  const set = new Set<string>()
  const add = (v: string | null | undefined) => {
    const n = normalizeBarcode(v || "")
    if (!n) return
    set.add(n)
    const compact = n.replace(/\s+/g, "")
    if (compact) set.add(compact)
    const rev = reverseDashCode(compact)
    if (rev) set.add(rev)
    const rev2 = reverseDashCode(n)
    if (rev2) set.add(rev2)
  }

  add(raw)
  add(extractProductCode(raw))

  const text = String(raw || "").replace(/[\r\n]+/g, " ")
  for (const m of text.matchAll(/\b(\d{1,6}-\d{2,10})\b/g)) {
    add(m[1])
  }

  return [...set].filter((s) => s.length > 0)
}

const cartonInclude = {
  item: { include: { category: true, brand: true } },
  batch: true,
  location: { include: { warehouse: true } },
} as const

/**
 * Resolve a scanned code to an inventory carton/item.
 */
export async function resolveBarcode(rawCode: string) {
  const primary = normalizeBarcode(rawCode)
  if (!primary) return null

  const variants = barcodeVariants(rawCode)
  if (variants.length === 0) return null

  // 1. Exact carton QR (any variant)
  for (const code of variants) {
    const carton = await prisma.carton.findUnique({
      where: { qrCode: code },
      include: cartonInclude,
    })
    if (carton && carton.isActive !== false) {
      return { carton, matchedBy: "carton_qr" as const, code }
    }
  }

  // 2. Item SKU or internalId
  let item =
    (await prisma.item.findFirst({
      where: {
        isActive: true,
        OR: [
          { sku: { in: variants } },
          { internalId: { in: variants } },
        ],
      },
      include: { category: true, brand: true },
    })) || null

  // 3. Code in item name
  if (!item) {
    const nameVariants = [...variants].sort((a, b) => b.length - a.length)
    for (const code of nameVariants) {
      if (code.length < 4) continue
      item = await prisma.item.findFirst({
        where: {
          isActive: true,
          OR: [
            { nameAr: { contains: code } },
            { nameEn: { contains: code } },
            { description: { contains: code } },
            { descriptionAr: { contains: code } },
            { notes: { contains: code } },
          ],
        },
        include: { category: true, brand: true },
      })
      if (item) break
    }
  }

  // 4. Long numeric
  if (!item) {
    for (const code of variants) {
      if (!/^\d{12,14}$/.test(code)) continue
      const short = code.slice(-12)
      item = await prisma.item.findFirst({
        where: {
          isActive: true,
          OR: [{ nameAr: { contains: short } }, { nameAr: { contains: code } }, { sku: short }],
        },
        include: { category: true, brand: true },
      })
      if (item) break
    }
  }

  if (!item) return null

  const linkCode = (
    variants.find((v) => v === item!.sku || v === item!.internalId) ||
    extractProductCode(rawCode) ||
    compactBarcode(primary) ||
    primary
  ).slice(0, 190)

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

  let carton = await prisma.carton.findUnique({
    where: { qrCode: linkCode },
    include: cartonInclude,
  })

  if (!carton) {
    for (const code of variants) {
      const existing = await prisma.carton.findUnique({
        where: { qrCode: code },
        include: cartonInclude,
      })
      if (existing && existing.itemId === item.id) {
        carton = existing
        break
      }
    }
  }

  if (!carton) {
    carton = await prisma.carton.create({
      data: {
        qrCode: linkCode,
        cartonNumber: `CTN-${linkCode}`.slice(0, 60),
        itemId: item.id,
        batchId: batch.id,
        quantity: item.unitsPerCarton || 1,
        originalQty: item.unitsPerCarton || 1,
        status: "AVAILABLE",
        isActive: true,
      },
      include: cartonInclude,
    })
  }

  await ensureVariantCartons(item.id, batch.id, variants, Number(item.unitsPerCarton) || 1)

  return { carton, matchedBy: "item_lookup" as const, code: carton.qrCode }
}

/** Create alias cartons so every scan form finds the same item */
export async function ensureVariantCartons(
  itemId: string,
  batchId: string,
  variants: string[],
  qty: number
) {
  const aliases = variants
    .map((v) => v.slice(0, 190))
    .filter((v) => v.length >= 3 && v.length <= 80)
    .slice(0, 8)

  for (const code of aliases) {
    try {
      const existing = await prisma.carton.findUnique({ where: { qrCode: code } })
      if (existing) {
        if (existing.itemId !== itemId || existing.isActive === false) {
          await prisma.carton.update({
            where: { id: existing.id },
            data: {
              itemId,
              batchId,
              isActive: true,
              status: "AVAILABLE",
            },
          })
        }
        continue
      }
      await prisma.carton.create({
        data: {
          qrCode: code,
          cartonNumber: `CTN-${code}`.slice(0, 60),
          itemId,
          batchId,
          quantity: qty,
          originalQty: qty,
          status: "AVAILABLE",
          isActive: true,
        },
      })
    } catch {
      /* unique race */
    }
  }
}
