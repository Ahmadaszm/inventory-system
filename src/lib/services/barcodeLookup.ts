/**
 * External barcode product lookup — Open Food Facts, Beauty Facts, UPCitemdb
 */

export type ExternalProduct = {
  barcode: string
  name: string
  nameAr?: string | null
  brand?: string | null
  category?: string | null
  imageUrl?: string | null
  source: string
}

function cleanName(s?: string | null) {
  if (!s) return null
  const t = String(s).trim()
  return t.length ? t : null
}

export function extractBarcodeCandidates(raw: string): string[] {
  const t = raw.trim()
  const out: string[] = []
  if (t) out.push(t)
  const digits = t.replace(/\D/g, "")
  if (digits.length >= 6 && digits.length <= 14) out.push(digits)
  const m1 = t.match(/(?:barcode|ean|upc|gtin|code)[=:\s]+(\d{6,14})/i)
  if (m1) out.push(m1[1])
  const m2 = t.match(/\b(\d{8,14})\b/)
  if (m2) out.push(m2[1])
  return Array.from(new Set(out))
}

async function lookupOpenFoodFacts(barcode: string): Promise<ExternalProduct | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
      { headers: { "User-Agent": "InventorySystem/1.0" }, signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 1 || !data.product) return null
    const p = data.product
    const name =
      cleanName(p.product_name_ar) ||
      cleanName(p.product_name_en) ||
      cleanName(p.product_name) ||
      cleanName(p.generic_name)
    if (!name) return null
    return {
      barcode,
      name,
      nameAr: cleanName(p.product_name_ar),
      brand: cleanName(p.brands)?.split(",")[0]?.trim() || null,
      category: cleanName(p.categories)?.split(",")[0]?.trim() || null,
      imageUrl: p.image_front_small_url || p.image_url || null,
      source: "Open Food Facts",
    }
  } catch {
    return null
  }
}

async function lookupOpenBeautyFacts(barcode: string): Promise<ExternalProduct | null> {
  try {
    const res = await fetch(
      `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
      { headers: { "User-Agent": "InventorySystem/1.0" }, signal: AbortSignal.timeout(4000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 1 || !data.product) return null
    const p = data.product
    const name = cleanName(p.product_name) || cleanName(p.generic_name)
    if (!name) return null
    return {
      barcode,
      name,
      brand: cleanName(p.brands)?.split(",")[0]?.trim() || null,
      category: cleanName(p.categories)?.split(",")[0]?.trim() || null,
      imageUrl: p.image_front_small_url || p.image_url || null,
      source: "Open Beauty Facts",
    }
  } catch {
    return null
  }
}

async function lookupUpcItemDb(barcode: string): Promise<ExternalProduct | null> {
  try {
    const res = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const item = data?.items?.[0]
    if (!item) return null
    const name = cleanName(item.title)
    if (!name) return null
    return {
      barcode,
      name,
      brand: cleanName(item.brand),
      category: cleanName(item.category),
      imageUrl: item.images?.[0] || null,
      source: "UPCitemdb",
    }
  } catch {
    return null
  }
}

export async function lookupExternalBarcode(rawCode: string): Promise<ExternalProduct | null> {
  const candidates = extractBarcodeCandidates(rawCode)
  const sources = [lookupOpenFoodFacts, lookupOpenBeautyFacts, lookupUpcItemDb]

  for (const code of candidates) {
    const numeric = code.replace(/\D/g, "")
    const tryCodes = numeric.length >= 6 ? [numeric, code] : [code]
    for (const c of tryCodes) {
      for (const fn of sources) {
        try {
          const result = await fn(c)
          if (result) return result
        } catch {
          /* next */
        }
      }
    }
  }
  return null
}
