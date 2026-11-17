/**
 * Extract likely product / grade codes from OCR text (dot-matrix labels, stamps).
 * Examples: NA321210, NA 321210, E92426E, PET 1234
 */

/** Fix common OCR misreads on dot-matrix / reflective labels */
export function fixOcrConfusions(s: string): string {
  return String(s || "")
    .toUpperCase()
    .replace(/[|]/g, "I")
    .replace(/[\u00D3\u00D2\u00D4\u00D6]/g, "O")
    .replace(/[\u00C1\u00C0\u00C2\u00C4]/g, "A")
    .replace(/[\u00C9\u00C8\u00CA\u00CB]/g, "E")
    .replace(/[^A-Z0-9\s\-\.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function extractOcrCodes(raw: string): string[] {
  if (!raw) return []
  const t = fixOcrConfusions(raw)
  const set = new Set<string>()

  const add = (c: string) => {
    const x = fixOcrConfusions(c).replace(/\s+/g, "")
    if (x.length >= 4) set.add(x)
    const spaced = x.replace(/^([A-Z]+)(\d)/, "$1 $2")
    if (spaced !== x) set.add(spaced)
  }

  for (const m of t.matchAll(/\b([A-Z]{1,5}\s*\d{3,10}[A-Z]{0,3})\b/g)) {
    add(m[1])
  }

  for (const m of t.matchAll(/\b([A-Z]{1,5})\s+(\d{3,10}[A-Z]{0,3})\b/g)) {
    add(`${m[1]}${m[2]}`)
    add(`${m[1]} ${m[2]}`)
  }

  for (const m of t.matchAll(/\b(\d{5,10})\b/g)) {
    add(m[1])
  }

  for (const m of t.matchAll(/\b(\d{1,6}-\d{2,10})\b/g)) {
    add(m[1])
  }

  const compact = t.replace(/\s+/g, "")
  if (/^[A-Z]{1,5}\d{4,10}[A-Z]{0,3}$/.test(compact)) {
    add(compact)
  }

  return [...set].sort((a, b) => b.replace(/\s/g, "").length - a.replace(/\s/g, "").length).slice(0, 16)
}

/** Build search queries from OCR codes (with/without spaces, digits-only) */
export function ocrSearchQueries(codes: string[]): string[] {
  const q = new Set<string>()
  for (const c of codes) {
    const compact = c.replace(/\s+/g, "")
    q.add(c)
    q.add(compact)
    const spaced = compact.replace(/^([A-Z]+)(\d)/, "$1 $2")
    if (spaced !== compact) q.add(spaced)
    const digits = compact.replace(/\D/g, "")
    if (digits.length >= 5) q.add(digits)
  }
  return [...q]
}
