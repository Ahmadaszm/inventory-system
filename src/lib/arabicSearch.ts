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
    .replace(/[^\p{L}\p{N}\s\-\/\.]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Inventory-oriented synonyms (normalized forms) */
const SYNONYM_GROUPS: string[][] = [
  ["رول", "روله", "رولات", "رولز", "roll", "rolls"],
  ["كرتون", "كرتونه", "كراتين", "صندوق", "صناديق", "carton", "box"],
  ["كيس", "اكياس", "شكارة", "شكاره", "شكاير", "sack", "bag"],
  ["سم", "سنتيمتر", "cm", "سانتي"],
  ["مم", "مليمتر", "mm"],
  ["كجم", "كيلو", "كيلوجرام", "kg", "kgs"],
  ["جرام", "غرام", "جم", "g", "gram"],
  ["متر", "م", "m", "meter", "metre"],
  ["قطعه", "قطع", "حبه", "حبات", "pcs", "pc", "piece"],
  ["شفاف", "شفافه", "transparent", "clear"],
  ["معتم", "معتمه", "غير شفاف", "opaque"],
]

const SYNONYM_MAP = new Map<string, string[]>()
for (const group of SYNONYM_GROUPS) {
  const normGroup = group.map((g) => arabicNormalize(g)).filter(Boolean)
  for (const g of normGroup) {
    SYNONYM_MAP.set(g, normGroup)
  }
}

function expandToken(token: string): string[] {
  const n = arabicNormalize(token)
  if (!n) return []
  const syn = SYNONYM_MAP.get(n)
  if (syn) return [...new Set([n, ...syn])]
  return [n]
}

/** Split query into tokens; also split letters glued to numbers (e.g. 131ماركس / رولات60سم) */
export function searchTokens(q: string): string[] {
  const norm = arabicNormalize(q)
  if (!norm) return []
  const spaced = norm
    .replace(/(\d+)(\p{L})/gu, "$1 $2")
    .replace(/(\p{L})(\d+)/gu, "$1 $2")
    .replace(/(\d+)[\/\-](\d+)/g, "$1 $2") // 24/17 → 24 17
  return spaced.split(" ").filter((t) => t.length >= 1)
}

/** Unique tokens with synonym expansion (for matching, not display) */
export function expandedSearchTokens(q: string): string[][] {
  return searchTokens(q).map((t) => expandToken(t))
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
    for (const e of expandToken(token)) set.add(e)
  }

  return [...set].filter((s) => s.length >= 1).slice(0, 48)
}

/**
 * Does the haystack contain this token?
 * - Numbers: exact whole-token only (60 ≠ 600)
 * - Text: whole token, synonym, or substring (≥2 chars)
 */
function tokenMatches(
  haystackNorm: string,
  haystackTokens: string[],
  token: string
): boolean {
  if (!token) return true
  const variants = expandToken(token)

  if (/^\d+$/.test(token)) {
    return variants.some((v) => haystackTokens.includes(v))
  }

  for (const v of variants) {
    if (haystackTokens.includes(v)) return true
  }
  // Substring only for longer tokens to avoid noise from 1-char
  for (const v of variants) {
    if (v.length >= 2 && haystackNorm.includes(v)) return true
  }
  return false
}

/**
 * Match only if ALL query tokens appear (AND logic + synonyms).
 * Example: "رولات 60 سم" requires رول/رولات + 60 + سم/cm together.
 */
export function matchesArabicSearch(
  haystack: string | null | undefined,
  queryNorm: string
): boolean {
  if (!queryNorm) return true
  if (!haystack) return false
  const h = arabicNormalize(haystack)
  if (!h) return false
  if (h.includes(queryNorm)) return true

  const qWords = searchTokens(queryNorm)
  if (qWords.length === 0) return false
  const hTokens = searchTokens(h)
  return qWords.every((w) => tokenMatches(h, hTokens, w))
}

/** Score a single text field. Returns 0 if not all tokens match. */
export function scoreArabicSearch(
  haystack: string | null | undefined,
  query: string
): number {
  if (!haystack || !query) return 0
  const h = arabicNormalize(haystack)
  const tokens = searchTokens(query)
  if (!h || tokens.length === 0) return 0

  const hTokens = searchTokens(h)
  let score = 0

  for (const t of tokens) {
    if (!tokenMatches(h, hTokens, t)) return 0

    const variants = expandToken(t)
    const whole = variants.some((v) => hTokens.includes(v))
    score += whole ? 14 : 8

    if (variants.some((v) => h.startsWith(v) || h.includes(" " + v))) score += 4
  }

  const full = arabicNormalize(query)
  if (full && h.includes(full)) score += 25

  // Exact equality (SKU / short names)
  if (full && h === full) score += 40

  // Proximity: tokens close together score higher
  if (tokens.length > 1) {
    const positions = tokens
      .map((t) => {
        for (const v of expandToken(t)) {
          const i = h.indexOf(v)
          if (i >= 0) return i
        }
        return -1
      })
      .filter((i) => i >= 0)
      .sort((a, b) => a - b)
    if (positions.length === tokens.length) {
      const span = positions[positions.length - 1] - positions[0]
      score += Math.max(0, 18 - Math.floor(span / 6))
    }
  }

  return score
}

export type ItemSearchFields = {
  sku?: string | null
  internalId?: string | null
  nameAr?: string | null
  nameEn?: string | null
  model?: string | null
  size?: string | null
  color?: string | null
  descriptionAr?: string | null
  description?: string | null
}

export function itemSearchBlob(it: ItemSearchFields): string {
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

/**
 * Field-weighted item score.
 * Priority: exact SKU/internalId → nameAr → size/model → other fields.
 * Returns 0 if the item does not satisfy AND across the combined blob.
 */
export function scoreItemSearch(it: ItemSearchFields, query: string): number {
  const q = String(query || "").trim()
  if (!q) return 0

  const blob = itemSearchBlob(it)
  // Global AND gate — must match somewhere as a whole
  const base = scoreArabicSearch(blob, q)
  if (base <= 0) return 0

  const qNorm = arabicNormalize(q)
  let score = base

  const sku = arabicNormalize(it.sku || "")
  const internal = arabicNormalize(it.internalId || "")
  const nameAr = arabicNormalize(it.nameAr || "")
  const nameEn = arabicNormalize(it.nameEn || "")
  const size = arabicNormalize(it.size || "")
  const model = arabicNormalize(it.model || "")

  // Exact code hits
  if (sku && (sku === qNorm || sku === q.toLowerCase())) score += 120
  else if (internal && (internal === qNorm || internal === q.toLowerCase())) score += 110
  else if (sku && sku.startsWith(qNorm) && qNorm.length >= 2) score += 50
  else if (internal && internal.startsWith(qNorm) && qNorm.length >= 2) score += 45

  // Name quality
  if (nameAr) {
    if (nameAr === qNorm) score += 80
    else if (nameAr.startsWith(qNorm)) score += 35
    else {
      const ns = scoreArabicSearch(nameAr, q)
      if (ns > 0) score += Math.min(40, Math.floor(ns * 0.6))
    }
  }
  if (nameEn) {
    const ns = scoreArabicSearch(nameEn, q)
    if (ns > 0) score += Math.min(20, Math.floor(ns * 0.35))
  }

  // Size / model are high-signal for queries like "60 سم"
  if (size) {
    const ss = scoreArabicSearch(size, q)
    if (ss > 0) score += Math.min(30, Math.floor(ss * 0.5))
  }
  if (model) {
    const ms = scoreArabicSearch(model, q)
    if (ms > 0) score += Math.min(20, Math.floor(ms * 0.4))
  }

  // Prefer shorter names when scores are close (more precise product title)
  if (nameAr) {
    const len = nameAr.length
    if (len > 0 && len < 40) score += 3
    if (len > 80) score -= 2
  }

  return score
}
