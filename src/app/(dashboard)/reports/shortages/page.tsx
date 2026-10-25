import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"

export default async function ShortagesReportPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const records = await prisma.countRecord.findMany({
    where: {
      OR: [{ varianceQty: { not: null } }, { isUnknownQr: true }, { status: "DISCREPANCY" }],
    },
    include: { item: true, countedBy: true, session: true },
    orderBy: { countedAt: "desc" },
    take: 300,
  })

  const withVar = records.filter((r) => r.varianceQty != null && Number(r.varianceQty) !== 0)
  const list = withVar.length ? withVar : records

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <Link href="/reports" className="text-sm text-blue-600 hover:underline">← التقارير</Link>
          <h1 className="text-xl font-bold mt-1">العجز والزيادة والفروقات</h1>
        </div>
      </header>
      <main className="p-6 max-w-6xl mx-auto">
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-right">الصنف / الباركود</th>
                <th className="px-3 py-2 text-right">دفتري</th>
                <th className="px-3 py-2 text-right">فعلي</th>
                <th className="px-3 py-2 text-right">الفرق</th>
                <th className="px-3 py-2 text-right">النوع</th>
                <th className="px-3 py-2 text-right">الجلسة</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((r) => {
                const v = r.varianceQty != null ? Number(r.varianceQty) : null
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      {r.item?.nameAr || r.qrCodeScanned || "—"}
                      {r.item?.sku && <span className="block text-xs font-mono text-slate-400">{r.item.sku}</span>}
                    </td>
                    <td className="px-3 py-2">{r.bookQty != null ? Number(r.bookQty) : "—"}</td>
                    <td className="px-3 py-2 font-bold">{Number(r.countedQty)}</td>
                    <td className={`px-3 py-2 font-bold ${v != null && v < 0 ? "text-red-600" : v != null && v > 0 ? "text-green-600" : ""}`}>
                      {v != null ? v : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.isUnknownQr ? "غير معرّف" : v != null && v < 0 ? "عجز" : v != null && v > 0 ? "زيادة" : r.status}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.session.sessionNumber}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {records.length === 0 && <p className="p-8 text-center text-slate-500">لا توجد فروقات مسجلة</p>}
        </div>
      </main>
    </div>
  )
}
