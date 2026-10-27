/** Normalize Arabic text for flexible search (hamza, taa marbuta, diacritics, etc.) */
export function arabicNormalize(input: string): string {
  if (!input) return ""
  return String(input)
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-\/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function arabicSearchVariants(q: string): string[] {
  const raw = String(q || "").trim()
  if (!raw) return []
  const norm = arabicNormalize(raw)
  const set = new Set<string>()
  set.add(raw)
  if (norm) set.add(norm)

  for (const base of [raw, norm]) {
    if (!base) continue
    set.add(base.replace(/ا/g, "أ"))
    set.add(base.replace(/ا/g, "إ"))
    set.add(base.replace(/ا/g, "آ"))
    set.add(base.replace(/ه/g, "ة"))
    set.add(base.replace(/ة/g, "ه"))
    set.add(base.replace(/ي/g, "ى"))
    set.add(base.replace(/ى/g, "ي"))
  }

  for (const token of norm.split(" ").filter((t) => t.length >= 1)) {
    set.add(token)
  }

  return [...set].filter((s) => s.length >= 1).slice(0, 32)
}

/** Match if full query or ANY word appears in the field */
export function matchesArabicSearch(
  haystack: string | null | undefined,
  queryNorm: string
): boolean {
  if (!queryNorm) return true
  if (!haystack) return false
  const h = arabicNormalize(haystack)
  if (!h) return false
  if (h.includes(queryNorm)) return true

  const qWords = queryNorm.split(" ").filter((w) => w.length >= 1)
  if (qWords.length === 0) return false
  return qWords.some((w) => h.includes(w))
}

export function itemSearchBlob(it: {
  sku?: string | null
  internalId?: string | null
  nameAr?: string | null
  nameEn?: string | null
  model?: string | null
  size?: string | null
  color?: string | null
  descriptionAr?: string | null
  description?: string | null
}): string {
  return [
    it.sku,
    it.internalId,
    it.nameAr,
    it.nameEn,
    it.model,
    it.size,
    it.color,
    it.descriptionAr,
    it.description,
  ]
    .filter(Boolean)
    .join(" ")
}
