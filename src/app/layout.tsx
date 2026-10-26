import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Providers } from "@/components/Providers"

export const metadata: Metadata = {
  title: "نظام مخزون زمزم",
  description: "شركة زمزم للصناعات البلاستيكية — إدارة المخزون والجرد",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "مخزون زمزم",
  },
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
}

export const viewport: Viewport = {
  themeColor: "#9B1B1E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
