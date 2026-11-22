/* ZMZM Inventory — resilient SW for slow/mobile networks */
const CACHE = "zmzm-shell-v4"
const PRECACHE = ["/", "/login", "/manifest.json", "/logo.svg", "/offline.html"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE.map((url) =>
            cache.add(url).catch(() => {
              /* ignore individual failures */
            })
          )
        )
      )
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

function networkWithTimeout(request, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer))
}

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  let url
  try {
    url = new URL(req.url)
  } catch {
    return
  }

  if (url.origin !== self.location.origin) return

  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    url.pathname.includes("auth")
  ) {
    return
  }

  const acceptsHtml = (req.headers.get("accept") || "").includes("text/html")
  if (req.mode === "navigate" || acceptsHtml) {
    event.respondWith(
      networkWithTimeout(req, 12000)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
          }
          return res
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("/offline.html") || caches.match("/login"))
        )
    )
    return
  }

  if (url.pathname.match(/\.(js|css|svg|png|jpg|jpeg|webp|woff2?|ico)$/) || url.pathname === "/manifest.json") {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
            }
            return res
          })
          .catch(() => cached)
        return cached || network
      })
    )
  }
})

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})
