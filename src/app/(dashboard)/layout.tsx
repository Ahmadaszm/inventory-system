import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { MobileBottomNav } from "@/components/MobileBottomNav"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const user = session.user as any
  const isAr = user.locale !== "en"
  const isAdmin = user.role === "SYSTEM_ADMIN" || user.role === "INVENTORY_MANAGER"

  const nav = [
    { href: "/dashboard", labelAr: "لوحة التحكم", labelEn: "Dashboard" },
    { href: "/items", labelAr: "الأصناف", labelEn: "Items" },
    { href: "/scan", labelAr: "مسح QR", labelEn: "Scan QR" },
    { href: "/stocktake", labelAr: "الجرد", labelEn: "Stocktake" },
    { href: "/reports", labelAr: "التقارير", labelEn: "Reports" },
  ]
  if (isAdmin) {
    nav.push({ href: "/users", labelAr: "المستخدمون", labelEn: "Users" })
    nav.push({ href: "/backup", labelAr: "نسخة احتياطية", labelEn: "Backup" })
  }

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col" dir={isAr ? "rtl" : "ltr"}>
      <nav className="sticky top-0 z-40 bg-[#9B1B1E] text-white px-3 py-2.5 flex items-center justify-between gap-2 shadow-md safe-pt">
        <Link href="/dashboard" className="flex items-center gap-2 min-h-[44px]">
          <Image
            src="/logo.svg"
            alt="ZMZM"
            width={36}
            height={36}
            className="rounded-md border border-white/30"
          />
          <span className="font-bold text-sm tracking-tight">{isAr ? "زمزم" : "ZMZM"}</span>
        </Link>
        <div className="hidden md:flex gap-1 text-sm flex-1 justify-center">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-white/80 hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg transition"
            >
              {isAr ? item.labelAr : item.labelEn}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-white/70 hidden sm:inline max-w-[120px] truncate">
            {isAr ? user.nameAr || user.name : user.name}
          </span>
          <Link
            href="/api/auth/signout"
            className="bg-white/15 hover:bg-white/25 px-3 py-2 rounded-lg transition min-h-[40px] flex items-center"
          >
            {isAr ? "خروج" : "Logout"}
          </Link>
        </div>
      </nav>

      <div className="app-content flex-1 w-full">{children}</div>
      <MobileBottomNav />
    </div>
  )
}
