import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect, notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"
import { StartStocktakeButton } from "./StartButton"

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

export default async function StocktakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const { id } = await params
  const user = session.user as any

  const stocktake = await prisma.stocktakeSession.findUnique({
    where: { id },
    include: {
      createdBy: true,
      warehouse: true,
      progress: true,
      countRecords: {
        include: {
          item: true,
          carton: true,
          countedBy: true,
        },
        orderBy: { countedAt: "desc" },
        take: 200,
      },
      _count: { select: { countRecords: true, tasks: true } },
    },
  })

  if (!stocktake) notFound()

  const canStart =
    ["PLANNED", "DRAFT"].includes(stocktake.status) &&
    (user.role === "SYSTEM_ADMIN" ||
      user.role === "INVENTORY_MANAGER" ||
      user.role === "WAREHOUSE_SUPERVISOR")

  const canCount = stocktake.status === "IN_PROGRESS"

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b px-6 py-4">
        <div className="flex justify-between items-start max-w-6xl mx-auto">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/stocktake" className="text-sm text-blue-600 hover:underline">
                ← عمليات الجرد
              </Link>
            </div>
            <h1 className="text-xl font-bold">{stocktake.titleAr || stocktake.title}</h1>
            <p className="text-sm text-slate-500 font-mono mt-1">{stocktake.sessionNumber}</p>
          </div>
          <div className="text-left">
            <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-slate-100">
              {statusLabels[stocktake.status] || stocktake.status}
            </span>
            {stocktake.isSurprise && (
              <span className="mr-2 inline-block px-3 py-1 rounded-full text-sm font-medium bg-rose-100 text-rose-700">
                مفاجئ
              </span>
            )}
            {stocktake.isBlind && (
              <span className="mr-2 inline-block px-3 py-1 rounded-full text-sm font-medium bg-slate-200">
                أعمى
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoCard
            label="تاريخ الجرد"
            value={new Date(stocktake.countDate).toLocaleDateString("ar-EG")}
          />
          <InfoCard label="المسجلات" value={String(stocktake._count.countRecords)} />
          <InfoCard label="المتوقع" value={String(stocktake.progress?.totalExpected || "—")} />
          <InfoCard label="تم عده" value={String(stocktake.progress?.totalCounted || 0)} />
        </div>

        <div className="bg-white rounded-xl border p-5 flex flex-wrap gap-3">
          {canStart && <StartStocktakeButton sessionId={stocktake.id} />}
          {canCount && (
            <Link
              href={`/stocktake/${stocktake.id}/count`}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium"
            >
              بدء المسح والعد
            </Link>
          )}
          <a
            href={`/api/export/stocktake/${stocktake.id}`}
            className="bg-slate-700 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-medium"
          >
            تصدير Excel
          </a>
          {["COUNTING_COMPLETE", "UNDER_REVIEW", "IN_PROGRESS"].includes(stocktake.status) && (
            <Link
              href={`/stocktake/${stocktake.id}/reconciliation`}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium"
            >
              عرض التسوية والفروقات
            </Link>
          )}
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b font-semibold">تقرير عمليات المسح</div>
          {stocktake.countRecords.length === 0 ? (
            <div className="p-8 text-center text-slate-500">لا توجد سجلات عد بعد</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-right">الوقت</th>
                    <th className="px-4 py-2 text-right">الباركود</th>
                    <th className="px-4 py-2 text-right">اسم الصنف</th>
                    <th className="px-4 py-2 text-right">الكمية</th>
                    <th className="px-4 py-2 text-right">الحالة</th>
                    <th className="px-4 py-2 text-right">القائم بالجرد</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stocktake.countRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                        {new Date(r.countedAt).toLocaleString("ar-EG")}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs max-w-[200px] break-all" dir="ltr">
                        {r.qrCodeScanned || r.carton?.qrCode || "—"}
                      </td>
                      <td className="px-4 py-2">
                        {r.item?.nameAr || r.item?.nameEn || r.qrCodeScanned || "—"}
                        {r.item?.sku ? (
                          <span className="block text-xs text-slate-400 font-mono">{r.item.sku}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 font-bold text-blue-700">{Number(r.countedQty)}</td>
                      <td className="px-4 py-2">
                        {r.isUnknownQr ? (
                          <span className="text-amber-600">غير معرّف</span>
                        ) : r.isDuplicate ? (
                          <span className="text-red-600">مكرر</span>
                        ) : r.varianceQty && Number(r.varianceQty) !== 0 ? (
                          <span className="text-orange-600">فرق</span>
                        ) : (
                          <span className="text-green-600">تم</span>
                        )}
                      </td>
                      <td className="px-4 py-2">{r.countedBy?.nameAr || r.countedBy?.name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  )
}
