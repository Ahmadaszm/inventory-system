import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"

const statusLabels: Record<string, string> = {
  DRAFT: "مسودة",
  PLANNED: "مخطط",
  IN_PROGRESS: "جاري",
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
      createdBy: { select: { name: true, nameAr: true } },
      progress: true,
      _count: { select: { countRecords: true } },
      countRecords: {
        select: { countedQty: true, isUnknownQr: true, itemId: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  const totals = {
    sessions: sessions.length,
    approved: sessions.filter((s) => s.status === "APPROVED").length,
    inProgress: sessions.filter((s) => s.status === "IN_PROGRESS").length,
    records: sessions.reduce((a, s) => a + s._count.countRecords, 0),
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <Link href="/reports" className="text-sm text-blue-600 hover:underline">
            ← التقارير
          </Link>
          <h1 className="text-xl font-bold mt-1">تقرير نتائج الجرد</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            ملخص الجلسات والكميات — تصدير Excel من كل جلسة
          </p>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="إجمالي الجلسات" value={totals.sessions} />
          <Stat label="جاري" value={totals.inProgress} color="text-amber-700" />
          <Stat label="معتمد" value={totals.approved} color="text-emerald-700" />
          <Stat label="إجمالي السجلات" value={totals.records} />
        </div>

        <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#9B1B1E] text-white">
                <tr>
                  <th className="px-3 py-2.5 text-right font-medium">رقم الجلسة</th>
                  <th className="px-3 py-2.5 text-right font-medium">العنوان</th>
                  <th className="px-3 py-2.5 text-right font-medium">الحالة</th>
                  <th className="px-3 py-2.5 text-right font-medium">السجلات</th>
                  <th className="px-3 py-2.5 text-right font-medium">إجمالي الكمية</th>
                  <th className="px-3 py-2.5 text-right font-medium">غير معرّف</th>
                  <th className="px-3 py-2.5 text-right font-medium">بواسطة</th>
                  <th className="px-3 py-2.5 text-right font-medium">التاريخ</th>
                  <th className="px-3 py-2.5 text-right font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sessions.map((s) => {
                  const qty = s.countRecords.reduce((a, r) => a + Number(r.countedQty), 0)
                  const unknown = s.countRecords.filter((r) => r.isUnknownQr || !r.itemId).length
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs text-blue-700">{s.sessionNumber}</td>
                      <td className="px-3 py-2 font-medium">{s.titleAr || s.title}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            s.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : s.status === "IN_PROGRESS"
                              ? "bg-amber-100 text-amber-800"
                              : s.status === "COUNTING_COMPLETE"
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {statusLabels[s.status] || s.status}
                        </span>
                        {s.isSurprise && <span className="mr-1 text-xs text-rose-600">مفاجئ</span>}
                      </td>
                      <td className="px-3 py-2 font-bold">{s._count.countRecords}</td>
                      <td className="px-3 py-2 font-bold text-blue-800">{qty}</td>
                      <td className="px-3 py-2">
                        {unknown > 0 ? <span className="text-amber-700">{unknown}</span> : 0}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {s.createdBy?.nameAr || s.createdBy?.name || "—"}
                      </td>
                      <td className="px-3 py-2">{new Date(s.countDate).toLocaleDateString("ar-EG")}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link href={`/stocktake/${s.id}`} className="text-blue-600 hover:underline">
                          عرض
                        </Link>
                        {" · "}
                        <a
                          href={`/api/export/stocktake/${s.id}`}
                          className="text-emerald-700 hover:underline font-medium"
                        >
                          Excel
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {sessions.length === 0 && (
            <p className="p-8 text-center text-slate-500">لا توجد جلسات جرد</p>
          )}
        </div>

        <p className="text-xs text-slate-500">
          ملف Excel: ملخص الجلسة + الباركود · اسم الصنف · الكمية · القائم بالجرد
        </p>
      </main>
    </div>
  )
}

function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color || "text-slate-800"}`}>{value}</p>
    </div>
  )
}
