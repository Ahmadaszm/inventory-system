import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"

export default async function InventoryReportPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const items = await prisma.item.findMany({
    where: { isActive: true },
    include: {
      category: true,
      brand: true,
      balances: true,
      cartons: { where: { isActive: true }, select: { id: true, quantity: true } },
    },
    orderBy: { sku: "asc" },
  })

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <div>
            <Link href="/reports" className="text-sm text-blue-600 hover:underline">← التقارير</Link>
            <h1 className="text-xl font-bold mt-1">قائمة المخزون الكاملة</h1>
          </div>
          <a href="/api/export/items" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium">تصدير Excel</a>
        </div>
      </header>
      <main className="p-6 max-w-6xl mx-auto">
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-right">SKU</th>
                  <th className="px-3 py-2 text-right">الاسم</th>
                  <th className="px-3 py-2 text-right">المصدر</th>
                  <th className="px-3 py-2 text-right">الكراتين</th>
                  <th className="px-3 py-2 text-right">الكمية</th>
                  <th className="px-3 py-2 text-right">التكلفة</th>
                  <th className="px-3 py-2 text-right">القيمة</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => {
                  const qty = item.balances.reduce((s, b) => s + Number(b.quantity), 0)
                  const cost = Number(item.costPerUnit)
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono">{item.sku}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{item.nameAr}</div>
                        <div className="text-xs text-slate-400">{item.nameEn}</div>
                      </td>
                      <td className="px-3 py-2">{item.sourceType === "FACTORY" ? "مصنع" : "استيراد"}</td>
                      <td className="px-3 py-2">{item.cartons.length}</td>
                      <td className="px-3 py-2 font-bold">{qty} {item.uom}</td>
                      <td className="px-3 py-2">{item.currency} {cost.toFixed(2)}</td>
                      <td className="px-3 py-2 font-medium">{item.currency} {(qty * cost).toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {items.length === 0 && <p className="p-8 text-center text-slate-500">لا توجد أصناف</p>}
        </div>
      </main>
    </div>
  )
}
