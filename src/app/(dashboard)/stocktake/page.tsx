import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"

const statusLabels: Record<string, { ar: string; en: string; color: string }> = {
  DRAFT: { ar: "مسودة", en: "Draft", color: "bg-slate-100 text-slate-700" },
  PLANNED: { ar: "مخطط", en: "Planned", color: "bg-blue-100 text-blue-700" },
  IN_PROGRESS: { ar: "جاري", en: "In Progress", color: "bg-amber-100 text-amber-700" },
  COUNTING_COMPLETE: { ar: "اكتمل العد", en: "Counting Done", color: "bg-indigo-100 text-indigo-700" },
  UNDER_REVIEW: { ar: "قيد المراجعة", en: "Under Review", color: "bg-purple-100 text-purple-700" },
  PENDING_APPROVAL: { ar: "بانتظار الاعتماد", en: "Pending Approval", color: "bg-orange-100 text-orange-700" },
  APPROVED: { ar: "معتمد", en: "Approved", color: "bg-green-100 text-green-700" },
  CLOSED: { ar: "مغلق", en: "Closed", color: "bg-slate-200 text-slate-600" },
  CANCELLED: { ar: "ملغي", en: "Cancelled", color: "bg-red-100 text-red-700" },
}

export default async function StocktakeListPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const user = session.user as any
  const isAr = user.locale !== "en"

  const isManager =
    user.role === "SYSTEM_ADMIN" ||
    user.role === "INVENTORY_MANAGER" ||
    user.role === "WAREHOUSE_SUPERVISOR" ||
    user.role === "APPROVER_AUDITOR"

  // Managers see ALL sessions (including surprise/hidden).
  // Counters see public sessions + sessions they created.
  const sessions = await prisma.stocktakeSession.findMany({
    where: isManager
      ? undefined
      : {
          OR: [{ isHidden: false }, { createdById: user.id }],
        },
    include: {
      createdBy: { select: { name: true, nameAr: true } },
      warehouse: true,
      progress: true,
      _count: { select: { countRecords: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="min-h-screen bg-slate-50" dir={isAr ? "rtl" : "ltr"}>
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {isAr ? "عمليات الجرد" : "Stocktaking Sessions"}
          </h1>
          <p className="text-sm text-slate-500">
            {isAr ? "الجرد الدوري والمفاجئ" : "Periodic & Surprise counts"}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard" className="text-sm text-slate-600 hover:text-blue-600">
            {isAr ? "لوحة التحكم" : "Dashboard"}
          </Link>
          <Link
            href="/stocktake/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            {isAr ? "+ جرد جديد" : "+ New Stocktake"}
          </Link>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {sessions.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center text-slate-500">
            {isAr ? "لا توجد عمليات جرد بعد" : "No stocktake sessions yet"}
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => {
              const st = statusLabels[s.status] || statusLabels.DRAFT
              return (
                <Link
                  key={s.id}
                  href={`/stocktake/${s.id}`}
                  className="block bg-white rounded-xl border p-4 hover:border-blue-300 hover:shadow-sm transition"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-slate-500">{s.sessionNumber}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>
                          {isAr ? st.ar : st.en}
                        </span>
                        {s.isSurprise && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">
                            {isAr ? "مفاجئ" : "Surprise"}
                          </span>
                        )}
                        {s.isBlind && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {isAr ? "أعمى" : "Blind"}
                          </span>
                        )}
                      </div>
                      <h2 className="font-bold text-slate-800">{s.titleAr || s.title}</h2>
                      <p className="text-xs text-slate-500 mt-1">
                        {isAr ? "بواسطة" : "By"}:{" "}
                        {s.createdBy?.nameAr || s.createdBy?.name || "—"} ·{" "}
                        {new Date(s.countDate).toLocaleDateString(isAr ? "ar-EG" : "en-GB")}
                      </p>
                    </div>
                    <div className="text-sm text-slate-600 space-y-0.5 min-w-[100px]">
                      <div>
                        {isAr ? "المسجلات" : "Records"}:{" "}
                        <strong>{s._count.countRecords}</strong>
                      </div>
                      <div>
                        {isAr ? "متوقع" : "Expected"}:{" "}
                        {s.progress?.totalExpected ?? "—"}
                      </div>
                      <div>
                        {isAr ? "تم عده" : "Counted"}:{" "}
                        {s.progress?.totalCounted ?? 0}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
