"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const items = [
  { href: "/dashboard", label: "الرئيسية", icon: "🏠" },
  { href: "/stocktake", label: "الجرد", icon: "📋" },
  { href: "/scan", label: "مسح", icon: "📷" },
  { href: "/items", label: "الأصناف", icon: "📦" },
  { href: "/reports", label: "التقارير", icon: "📊" },
]

export function MobileBottomNav() {
  const path = usePathname() || ""
  if (path.includes("/count") || path.includes("/print")) return null

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
    >
      <div className="grid grid-cols-5 gap-0">
        {items.map((it) => {
          const active =
            path === it.href || (it.href !== "/dashboard" && path.startsWith(it.href))
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex flex-col items-center justify-center py-2 min-h-[56px] text-[11px] font-medium transition ${
                active ? "text-[#9B1B1E]" : "text-slate-500"
              }`}
            >
              <span className="text-xl leading-none mb-0.5">{it.icon}</span>
              <span>{it.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
