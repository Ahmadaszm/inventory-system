import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect } from "next/navigation"
import Link from "next/link"

const reports = [
  { href: "/reports/inventory", title: "قائمة المخزون الكاملة", desc: "كل الأصناف والكميات حسب الموقع والدفعات" },
  { href: "/reports/stocktake", title: "نتائج الجرد", desc: "نتائج جلسات الجرد الدوري والمفاجئ" },
  { href: "/reports/reconciliation", title: "التسوية (دفاتر × فعلي)", desc: "مقارنة الرصيد الدفتري بالعد الفعلي" },
  { href: "/reports/shortages", title: "العجز والزيادة", desc: "تقرير الفروقات والعجز والزيادات" },
  { href: "/reports/unknown-qr", title: "رموز QR غير معروفة", desc: "عمليات مسح لرموز غير مسجلة" },
  { href: "/reports/movements", title: "دفتر الحركات", desc: "سجل كامل لحركات المخزون" },
  { href: "/reports/valuation", title: "تقييم المخزون", desc: "القيمة المالية للمخزون والفروقات" },
  { href: "/reports/audit", title: "سجل التدقيق", desc: "كل العمليات الحساسة مع المستخدم والوقت" },
]

export default async function ReportsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">التقارير</h1>
        <p className="text-slate-500 mb-6">تقارير قابلة للبحث والتصدير إلى Excel</p>

        <div className="grid gap-3">
          {reports.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="block bg-white rounded-xl border p-5 hover:border-blue-300 hover:shadow-sm transition"
            >
              <h3 className="font-semibold text-lg">{r.title}</h3>
              <p className="text-sm text-slate-500 mt-1">{r.desc}</p>
            </Link>
          ))}
        </div>

        <div className="mt-8 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
          جميع التقارير متاحة للعرض. تصدير Excel متوفر من قائمة المخزون ومن كل جلسة جرد.
        </div>
      </main>
    </div>
  )
}
