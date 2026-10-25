import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"
import { extractProductCode, cleanQrText } from "@/lib/barcodeExtract"

export default async function UnknownQrReportPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const records = await prisma.countRecord.findMany({
    where: { isUnknownQr: true },
    include: { countedBy: true, session: true },
    orderBy: { countedAt: "desc" },
    take: 300,
  })

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <Link href="/reports" className="text-sm text-blue-600 hover:underline">← التقارير</Link>
          <h1 className="text-xl font-bold mt-1">رموز غير معروفة / غير معرّفة</h1>
          <p className="text-sm text-slate-500">{records.length} سجل</p>
        </div>
      </header>
      <main className="p-6 max-w-6xl mx-auto">
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-right">الوقت</th>
                <th className="px-3 py-2 text-right">الباركود</th>
                <th className="px-3 py-2 text-right">الاسم / النص</th>
                <th className="px-3 py-2 text-right">الكمية</th>
                <th className="px-3 py-2 text-right">الجلسة</th>
                <th className="px-3 py-2 text-right">القائم بالجرد</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.map((r) => {
                const full = r.qrCodeScanned || ""
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(r.countedAt).toLocaleString("ar-EG")}</td>
                    <td className="px-3 py-2 font-mono font-bold text-blue-800" dir="ltr">{extractProductCode(full) || "—"}</td>
                    <td className="px-3 py-2 max-w-[280px]">{cleanQrText(full)}</td>
                    <td className="px-3 py-2 font-bold">{Number(r.countedQty)}</td>
                    <td className="px-3 py-2 text-xs">
                      <Link href={`/stocktake/${r.sessionId}`} className="text-blue-600 hover:underline">{r.session.sessionNumber}</Link>
                    </td>
                    <td className="px-3 py-2">{r.countedBy?.nameAr || r.countedBy?.name}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {records.length === 0 && <p className="p-8 text-center text-slate-500">لا توجد سجلات</p>}
        </div>
      </main>
    </div>
  )
}
