export function getWebAuthnConfig() {
  const raw =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  const origin = raw.replace(/\/$/, "")
  let rpID = "localhost"
  try {
    rpID = new URL(origin).hostname
  } catch {
    /* keep */
  }
  const extra = (process.env.WEBAUTHN_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const origins = [
    ...new Set([origin, ...extra, "https://inventory-system-ahmadaszm.vercel.app"]),
  ]
  return {
    rpName: "ZMZM Inventory",
    rpID,
    origin,
    origins,
  }
}
