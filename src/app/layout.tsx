import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/Providers"

export const metadata: Metadata = {
  title: "QR Inventory & Stocktaking System",
  description: "Complete inventory and physical stocktaking management for manufacturing & importing",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased bg-slate-50 text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
