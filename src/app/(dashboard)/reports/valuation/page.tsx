import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"

export default async function ValuationReportPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const items = await prisma.item.findMany({
    where: { isActive: true },
    include: { balances: true },
    orderBy: { sku: "asc" },
  })

  let totalValue = 0
  const rows = items.map((item) => {
    const qty = item.balances.reduce((s, b) => s + Number(b.quantity), 0)
    const cost = Number(item.costPerUnit)
    const value = qty * cost
    totalValue += value
    return { item, qty, cost, value }
  })

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <Link href="/reports" className="text-sm text-blue-600 hover:underline">← التقارير</Link>
          <h1 className="text-xl font-bold mt-1">تقييم المخزون</h1>
          <p className="text-lg font-bold text-blue-800 mt-2">
            إجمالي القيمة: {totalValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </p>
        </div>
      </header>
      <main className="p-6 max-w-6xl mx-auto">
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-right">SKU</th>
                <th className="px-3 py-2 text-right">الاسم</th>
                <th className="px-3 py-2 text-right">الكمية</th>
                <th className="px-3 py-2 text-right">تكلفة الوحدة</th>
                <th className="px-3 py-2 text-right">القيمة</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ item, qty, cost, value }) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono">{item.sku}</td>
                  <td className="px-3 py-2">{item.nameAr}</td>
                  <td className="px-3 py-2">{qty} {item.uom}</td>
                  <td className="px-3 py-2">{item.currency} {cost.toFixed(2)}</td>
                  <td className="px-3 py-2 font-bold">{item.currency} {value.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
