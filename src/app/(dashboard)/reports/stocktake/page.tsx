import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"

const statusLabels: Record<string, string> = {
  DRAFT: "مسودة",
  PLANNED: "مخطط",
  IN_PROGRESS: "جاري العد",
  COUNTING_COMPLETE: "اكتمل العد",
  UNDER_REVIEW: "قيد المراجعة",
  PENDING_APPROVAL: "بانتظار الاعتماد",
  APPROVED: "معتمد",
  CLOSED: "مغلق",
  CANCELLED: "ملغي",
}

export default async function StocktakeReportPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const sessions = await prisma.stocktakeSession.findMany({
    include: {
      progress: true,
      createdBy: true,
      _count: { select: { countRecords: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <Link href="/reports" className="text-sm text-blue-600 hover:underline">
            ← التقارير
          </Link>
          <h1 className="text-xl font-bold mt-1">نتائج الجرد</h1>
        </div>
      </header>
      <main className="p-6 max-w-6xl mx-auto">
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-right">رقم الجلسة</th>
                <th className="px-3 py-2 text-right">العنوان</th>
                <th className="px-3 py-2 text-right">النوع</th>
                <th className="px-3 py-2 text-right">الحالة</th>
                <th className="px-3 py-2 text-right">المسجلات</th>
                <th className="px-3 py-2 text-right">التاريخ</th>
                <th className="px-3 py-2 text-right">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{s.sessionNumber}</td>
                  <td className="px-3 py-2">{s.titleAr || s.title}</td>
                  <td className="px-3 py-2">{s.isSurprise ? "مفاجئ" : s.type}</td>
                  <td className="px-3 py-2">{statusLabels[s.status] || s.status}</td>
                  <td className="px-3 py-2 font-bold">{s._count.countRecords}</td>
                  <td className="px-3 py-2">
                    {new Date(s.countDate).toLocaleDateString("ar-EG")}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/stocktake/${s.id}`} className="text-blue-600 hover:underline">
                      عرض
                    </Link>
                    {" · "}
                    <Link
                      href={`/stocktake/${s.id}/reconciliation`}
                      className="text-indigo-600 hover:underline"
                    >
                      تسوية
                    </Link>
                    {" · "}
                    <a
                      href={`/api/export/stocktake/${s.id}`}
                      className="text-emerald-600 hover:underline"
                    >
                      Excel
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sessions.length === 0 && (
            <p className="p-8 text-center text-slate-500">لا توجد جلسات جرد</p>
          )}
        </div>
      </main>
    </div>
  )
}
