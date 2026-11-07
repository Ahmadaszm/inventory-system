"use client"

import { SessionProvider } from "next-auth/react"
import { useEffect } from "react"
import { InstallPrompt } from "@/components/InstallPrompt"

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
  }, [])

  return (
    <SessionProvider>
      {children}
      <InstallPrompt />
    </SessionProvider>
  )
}
