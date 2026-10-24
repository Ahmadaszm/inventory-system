import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const user = session.user as any
  const isAr = user.locale !== "en"

  const nav = [
    { href: "/dashboard", labelAr: "لوحة التحكم", labelEn: "Dashboard" },
    { href: "/items", labelAr: "الأصناف", labelEn: "Items" },
    { href: "/scan", labelAr: "مسح QR", labelEn: "Scan QR" },
    { href: "/stocktake", labelAr: "الجرد", labelEn: "Stocktake" },
    { href: "/reports", labelAr: "التقارير", labelEn: "Reports" },
  ]

  return (
    <div className="min-h-screen bg-slate-50" dir={isAr ? "rtl" : "ltr"}>
      <nav className="bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-bold text-lg tracking-tight">
            {isAr ? "نظام المخزون" : "Inventory System"}
          </Link>
          <div className="hidden md:flex gap-4 text-sm">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-slate-300 hover:text-white transition"
              >
                {isAr ? item.labelAr : item.labelEn}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400">
            {isAr ? user.nameAr || user.name : user.name}
          </span>
          <Link
            href="/api/auth/signout"
            className="text-red-400 hover:text-red-300"
          >
            {isAr ? "خروج" : "Logout"}
          </Link>
        </div>
      </nav>
      {/* Mobile nav */}
      <div className="md:hidden bg-slate-800 text-white px-4 py-2 flex gap-4 overflow-x-auto text-sm">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className="whitespace-nowrap text-slate-300">
            {isAr ? item.labelAr : item.labelEn}
          </Link>
        ))}
      </div>
      {children}
    </div>
  )
}
