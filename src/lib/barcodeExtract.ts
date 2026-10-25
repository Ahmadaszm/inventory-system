/**
 * Extract short product code from free-text QR (company labels).
 * Example: "... zmzm ابناء الاحمد 13-120144" -> "13-120144"
 */
export function extractProductCode(raw: string | null | undefined): string {
  if (!raw) return ""
  const t = raw.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim()
  if (!t) return ""

  const a = t.match(/\b(\d{1,3}-\d{5,8})\b/)
  if (a) return a[1]

  const all = Array.from(t.matchAll(/\b(\d{1,6}-\d{2,8})\b/g)).map((m) => m[1])
  if (all.length) {
    const preferred = all.find((c) => /^\d{1,3}-\d{5,}$/.test(c))
    if (preferred) return preferred
    all.sort((x, y) => y.replace(/\D/g, "").length - x.replace(/\D/g, "").length)
    return all[0]
  }

  const pref = t.match(/\b(?:mzm|zmzm)[-_]?(\d{4,}[-]?\d*)\b/i)
  if (pref) return pref[1]

  const num = t.match(/\b(\d{8,14})\b/)
  if (num) return num[1]

  if (t.length <= 24 && !/\s/.test(t)) return t
  return t
}

export function cleanQrText(raw: string | null | undefined): string {
  if (!raw) return ""
  return raw.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim()
}
