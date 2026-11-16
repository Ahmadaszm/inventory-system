/**
 * Extract likely product / grade codes from OCR text (dot-matrix labels, stamps).
 * Examples: NA321210, NA 321210, E92426E, PET 1234
 */

export function extractOcrCodes(raw: string): string[] {
  if (!raw) return []
  // Normalize common OCR confusions
  let t = String(raw)
    .toUpperCase()
    .replace(/[|]/g, "I")
    .replace(/[^\w\s\-./]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const set = new Set<string>()

  // Letter(s) + digits, optional trailing letters: NA321210, E92426E
  for (const m of t.matchAll(/\b([A-Z]{1,4}\d{3,8}[A-Z]{0,3})\b/g)) {
    set.add(m[1])
  }

  // Letters space digits: NA 321210 → NA321210 and NA 321210
  for (const m of t.matchAll(/\b([A-Z]{1,4})\s+(\d{3,8}[A-Z]{0,3})\b/g)) {
    set.add(`${m[1]}${m[2]}`)
    set.add(`${m[1]} ${m[2]}`)
  }

  // Pure digit runs 5–10 (catalog numbers)
  for (const m of t.matchAll(/\b(\d{5,10})\b/g)) {
    set.add(m[1])
  }

  // Dash codes already handled elsewhere
  for (const m of t.matchAll(/\b(\d{1,6}-\d{2,10})\b/g)) {
    set.add(m[1])
  }

  // Prefer longer codes first
  return [...set].sort((a, b) => b.length - a.length).slice(0, 12)
}

/** Build search queries from OCR codes (with/without spaces) */
export function ocrSearchQueries(codes: string[]): string[] {
  const q = new Set<string>()
  for (const c of codes) {
    q.add(c)
    q.add(c.replace(/\s+/g, ""))
    // NA321210 → "NA 321210"
    const spaced = c.replace(/^([A-Z]+)(\d)/, "$1 $2")
    if (spaced !== c) q.add(spaced)
  }
  return [...q]
}
