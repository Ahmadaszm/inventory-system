import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"

export default async function ReconciliationReportPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const sessions = await prisma.stocktakeSession.findMany({
    where: { status: { in: ["IN_PROGRESS", "COUNTING_COMPLETE", "UNDER_REVIEW", "APPROVED", "CLOSED"] } },
    include: { progress: true, _count: { select: { countRecords: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/reports" className="text-sm text-blue-600 hover:underline">← التقارير</Link>
          <h1 className="text-xl font-bold mt-1">التسوية (دفاتر × فعلي)</h1>
          <p className="text-sm text-slate-500">اختر جلسة جرد لعرض التسوية</p>
        </div>
      </header>
      <main className="p-6 max-w-4xl mx-auto space-y-3">
        {sessions.map((s) => (
          <Link
            key={s.id}
            href={`/stocktake/${s.id}/reconciliation`}
            className="block bg-white rounded-xl border p-5 hover:border-blue-300 hover:shadow-sm transition"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{s.titleAr || s.title}</h3>
                <p className="text-xs font-mono text-slate-500 mt-1">{s.sessionNumber}</p>
              </div>
              <span className="text-sm bg-slate-100 px-2 py-1 rounded">{s._count.countRecords} سجل</span>
            </div>
          </Link>
        ))}
        {sessions.length === 0 && <p className="text-center text-slate-500 py-12">لا توجد جلسات جاهزة للتسوية</p>}
      </main>
    </div>
  )
}
