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

/** Split query into tokens; also split letters glued to numbers (e.g. 131ماركس) */
export function searchTokens(q: string): string[] {
  const norm = arabicNormalize(q)
  if (!norm) return []
  const spaced = norm
    .replace(/(\d+)(\p{L})/gu, "$1 $2")
    .replace(/(\p{L})(\d+)/gu, "$1 $2")
  return spaced.split(" ").filter((t) => t.length >= 1)
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

  for (const token of searchTokens(q)) {
    set.add(token)
  }

  return [...set].filter((s) => s.length >= 1).slice(0, 40)
}

/**
 * Does the haystack contain this token as a whole token?
 * - Numbers must match as full tokens (60 matches "60" but not "600")
 * - Text tokens use whole-token first, then substring for partial Arabic words
 */
function tokenMatches(haystackNorm: string, haystackTokens: string[], token: string): boolean {
  if (!token) return true
  if (/^\d+$/.test(token)) {
    // Exact numeric token only — avoid 60 matching 600
    return haystackTokens.includes(token)
  }
  if (haystackTokens.includes(token)) return true
  return haystackNorm.includes(token)
}

/**
 * Match only if ALL query tokens appear in the field (AND logic).
 * Example: "رولات 60 سم" requires رولات + 60 + سم together.
 * Single-token queries stay flexible (substring / normalized).
 */
export function matchesArabicSearch(
  haystack: string | null | undefined,
  queryNorm: string
): boolean {
  if (!queryNorm) return true
  if (!haystack) return false
  const h = arabicNormalize(haystack)
  if (!h) return false

  // Full phrase match
  if (h.includes(queryNorm)) return true

  const qWords = searchTokens(queryNorm)
  if (qWords.length === 0) return false

  const hTokens = searchTokens(h)
  // AND: every query token must be present
  return qWords.every((w) => tokenMatches(h, hTokens, w))
}

/** Higher score = better match. Returns 0 if not all tokens match (strict). */
export function scoreArabicSearch(
  haystack: string | null | undefined,
  query: string
): number {
  if (!haystack || !query) return 0
  const h = arabicNormalize(haystack)
  const tokens = searchTokens(query)
  if (!h || tokens.length === 0) return 0

  const hTokens = searchTokens(h)

  // Strict: all tokens required
  let score = 0
  for (const t of tokens) {
    if (tokenMatches(h, hTokens, t)) {
      score += 10
      if (h.startsWith(t) || h.includes(" " + t)) score += 5
      if (hTokens.includes(t)) score += 3 // whole-token bonus
    } else {
      return 0
    }
  }

  const full = arabicNormalize(query)
  if (full && h.includes(full)) score += 20

  // Prefer closer token order / denser matches
  if (tokens.length > 1) {
    const positions = tokens
      .map((t) => h.indexOf(t))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b)
    if (positions.length === tokens.length) {
      const span = positions[positions.length - 1] - positions[0]
      // Smaller span = tokens closer together = better
      score += Math.max(0, 15 - Math.floor(span / 8))
    }
  }

  return score
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
