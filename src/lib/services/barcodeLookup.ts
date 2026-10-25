/**
 * External barcode product lookup
 * Sources: Open Food Facts (free), UPCitemdb trial
 */

export type ExternalProduct = {
  barcode: string
  name: string
  nameAr?: string | null
  brand?: string | null
  category?: string | null
  imageUrl?: string | null
  source: string
  raw?: unknown
}

function cleanName(s?: string | null) {
  if (!s) return null
  const t = s.trim()
  return t.length ? t : null
}

async function lookupOpenFoodFacts(barcode: string): Promise<ExternalProduct | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
      {
        headers: { "User-Agent": "InventorySystem/1.0 (inventory-management)" },
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 1 || !data.product) return null
    const p = data.product
    const name =
      cleanName(p.product_name_ar) ||
      cleanName(p.product_name_en) ||
      cleanName(p.product_name) ||
      cleanName(p.generic_name) ||
      null
    if (!name) return null
    return {
      barcode,
      name,
      nameAr: cleanName(p.product_name_ar),
      brand: cleanName(p.brands)?.split(",")[0]?.trim() || null,
      category: cleanName(p.categories)?.split(",")[0]?.trim() || null,
      imageUrl: p.image_front_small_url || p.image_url || null,
      source: "Open Food Facts",
      raw: { code: data.code },
    }
  } catch {
    return null
  }
}

async function lookupOpenBeautyFacts(barcode: string): Promise<ExternalProduct | null> {
  try {
    const res = await fetch(
      `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
      { headers: { "User-Agent": "InventorySystem/1.0" } }
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
      { headers: { Accept: "application/json" } }
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

async function lookupGoUpc(barcode: string): Promise<ExternalProduct | null> {
  try {
    const res = await fetch(`https://go-upc.com/api/v1/code/${encodeURIComponent(barcode)}`, {
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return null
    const data = await res.json()
    const name = cleanName(data?.product?.name) || cleanName(data?.name)
    if (!name) return null
    return {
      barcode,
      name,
      brand: cleanName(data?.product?.brand) || cleanName(data?.brand),
      category: cleanName(data?.product?.category),
      imageUrl: data?.product?.imageUrl || null,
      source: "Go-UPC",
    }
  } catch {
    return null
  }
}

export async function lookupExternalBarcode(barcode: string): Promise<ExternalProduct | null> {
  const code = barcode.trim()
  if (!code || code.length < 6) return null

  const isNumericBarcode = /^\d{6,14}$/.test(code)
  if (!isNumericBarcode) return null

  const sources = [lookupOpenFoodFacts, lookupOpenBeautyFacts, lookupUpcItemDb, lookupGoUpc]

  for (const fn of sources) {
    try {
      const result = await Promise.race([
        fn(code),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
      ])
      if (result) return result
    } catch {
      // try next
    }
  }
  return null
}
