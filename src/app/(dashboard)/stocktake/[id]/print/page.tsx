import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect, notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import { extractProductCode, cleanQrText } from "@/lib/barcodeExtract"
import { PrintActions } from "./PrintActions"

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

export default async function StocktakePrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const { id } = await params
  const stocktake = await prisma.stocktakeSession.findUnique({
    where: { id },
    include: {
      createdBy: true,
      warehouse: true,
      countRecords: {
        include: {
          item: true,
          carton: true,
          countedBy: true,
        },
        orderBy: { countedAt: "asc" },
      },
    },
  })
  if (!stocktake) notFound()

  const totalQty = stocktake.countRecords.reduce((s, r) => s + Number(r.countedQty), 0)
  const unknown = stocktake.countRecords.filter((r) => r.isUnknownQr || !r.itemId).length
  const printedAt = new Date().toLocaleString("ar-EG")

  return (
    <div className="min-h-screen bg-white text-black" dir="rtl">
      <PrintActions sessionId={stocktake.id} />

      <div className="print-area max-w-4xl mx-auto px-6 py-6">
        <div className="flex justify-between items-start border-b-2 border-[#9B1B1E] pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#9B1B1E]">زمزم للصناعات البلاستيكية</h1>
            <p className="text-sm text-slate-600 mt-1">تقرير جرد المخزون</p>
          </div>
          <div className="text-left text-sm">
            <p className="font-mono font-bold">{stocktake.sessionNumber}</p>
            <p>{statusLabels[stocktake.status] || stocktake.status}</p>
            <p className="text-slate-500">طُبع: {printedAt}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6">
          <div>
            <span className="text-slate-500">العنوان: </span>
            <strong>{stocktake.titleAr || stocktake.title}</strong>
          </div>
          <div>
            <span className="text-slate-500">تاريخ الجرد: </span>
            <strong>{new Date(stocktake.countDate).toLocaleDateString("ar-EG")}</strong>
          </div>
          <div>
            <span className="text-slate-500">بواسطة: </span>
            <strong>{stocktake.createdBy?.nameAr || stocktake.createdBy?.name || "—"}</strong>
          </div>
          <div>
            <span className="text-slate-500">النوع: </span>
            <strong>{stocktake.isSurprise ? "مفاجئ" : stocktake.type}</strong>
            {stocktake.isBlind && " · أعمى"}
          </div>
          <div>
            <span className="text-slate-500">عدد السجلات: </span>
            <strong>{stocktake.countRecords.length}</strong>
          </div>
          <div>
            <span className="text-slate-500">إجمالي الكمية: </span>
            <strong>{totalQty}</strong>
          </div>
          {unknown > 0 && (
            <div>
              <span className="text-slate-500">غير معرّف: </span>
              <strong>{unknown}</strong>
            </div>
          )}
          {stocktake.approvedAt && (
            <div>
              <span className="text-slate-500">تاريخ الاعتماد: </span>
              <strong>{new Date(stocktake.approvedAt).toLocaleString("ar-EG")}</strong>
            </div>
          )}
        </div>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#9B1B1E] text-white">
              <th className="border border-slate-300 px-2 py-2 text-right w-10">#</th>
              <th className="border border-slate-300 px-2 py-2 text-right">الباركود</th>
              <th className="border border-slate-300 px-2 py-2 text-right">اسم الصنف</th>
              <th className="border border-slate-300 px-2 py-2 text-right w-20">الكمية</th>
              <th className="border border-slate-300 px-2 py-2 text-right">القائم بالجرد</th>
              <th className="border border-slate-300 px-2 py-2 text-right w-24">الوقت</th>
            </tr>
          </thead>
          <tbody>
            {stocktake.countRecords.map((r, idx) => {
              const full = r.qrCodeScanned || r.carton?.qrCode || ""
              const code = r.item?.sku || extractProductCode(full) || full || "—"
              const name =
                r.item?.nameAr ||
                r.item?.nameEn ||
                (r.isUnknownQr ? "غير معرّف" : cleanQrText(full)) ||
                "—"
              return (
                <tr key={r.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="border border-slate-300 px-2 py-1.5 text-center">{idx + 1}</td>
                  <td className="border border-slate-300 px-2 py-1.5 font-mono" dir="ltr">
                    {code}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5">{name}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center font-bold">
                    {Number(r.countedQty)}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5">
                    {r.countedBy?.nameAr || r.countedBy?.name || "—"}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 whitespace-nowrap text-xs">
                    {new Date(r.countedAt).toLocaleString("ar-EG")}
                  </td>
                </tr>
              )
            })}
            {stocktake.countRecords.length === 0 && (
              <tr>
                <td colSpan={6} className="border border-slate-300 px-4 py-8 text-center text-slate-500">
                  لا توجد سجلات
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold">
              <td className="border border-slate-300 px-2 py-2" colSpan={3}>
                المجموع
              </td>
              <td className="border border-slate-300 px-2 py-2 text-center">{totalQty}</td>
              <td className="border border-slate-300 px-2 py-2" colSpan={2}>
                {stocktake.countRecords.length} سجل
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="grid grid-cols-3 gap-8 mt-12 pt-6 text-sm">
          <div className="text-center">
            <p className="text-slate-500 mb-12">القائم بالجرد</p>
            <div className="border-t border-slate-400 pt-1">التوقيع</div>
          </div>
          <div className="text-center">
            <p className="text-slate-500 mb-12">المراجع</p>
            <div className="border-t border-slate-400 pt-1">التوقيع</div>
          </div>
          <div className="text-center">
            <p className="text-slate-500 mb-12">الاعتماد</p>
            <div className="border-t border-slate-400 pt-1">التوقيع</div>
          </div>
        </div>
      </div>
    </div>
  )
}
