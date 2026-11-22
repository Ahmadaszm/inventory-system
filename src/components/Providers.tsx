"use client"

import { SessionProvider } from "next-auth/react"
import { useEffect } from "react"
import { InstallPrompt } from "@/components/InstallPrompt"

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        reg.update().catch(() => {})
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" })
        }
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing
          if (!nw) return
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              try {
                if (!sessionStorage.getItem("sw-reloaded")) {
                  sessionStorage.setItem("sw-reloaded", "1")
                  window.location.reload()
                }
              } catch {
                /* ignore */
              }
            }
          })
        })
      })
      .catch(() => {})

    let refreshing = false
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  }, [])

  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      {children}
      <InstallPrompt />
    </SessionProvider>
  )
}
