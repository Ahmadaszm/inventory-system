import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"

export default async function AuditReportPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  let logs: any[] = []
  try {
    logs = await prisma.auditLog.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
  } catch {
    logs = []
  }

  const scans = await prisma.scanEvent.findMany({
    include: { user: true },
    orderBy: { scannedAt: "desc" },
    take: 100,
  })

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <Link href="/reports" className="text-sm text-blue-600 hover:underline">← التقارير</Link>
          <h1 className="text-xl font-bold mt-1">سجل التدقيق والنشاط</h1>
        </div>
      </header>
      <main className="p-6 max-w-6xl mx-auto space-y-6">
        {logs.length > 0 && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b font-semibold">سجل التدقيق</div>
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-right">الوقت</th>
                  <th className="px-3 py-2 text-right">المستخدم</th>
                  <th className="px-3 py-2 text-right">الإجراء</th>
                  <th className="px-3 py-2 text-right">الكيان</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2">{new Date(l.createdAt).toLocaleString("ar-EG")}</td>
                    <td className="px-3 py-2">{l.user?.nameAr || l.user?.name || "—"}</td>
                    <td className="px-3 py-2">{l.action}</td>
                    <td className="px-3 py-2">{l.entityType} {l.entityId || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold">آخر عمليات المسح</div>
          {scans.length === 0 ? (
            <p className="p-8 text-center text-slate-500">لا يوجد نشاط</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-right">الوقت</th>
                  <th className="px-3 py-2 text-right">المستخدم</th>
                  <th className="px-3 py-2 text-right">الرمز</th>
                  <th className="px-3 py-2 text-right">النتيجة</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {scans.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2">{new Date(s.scannedAt).toLocaleString("ar-EG")}</td>
                    <td className="px-3 py-2">{s.user?.nameAr || s.user?.name}</td>
                    <td className="px-3 py-2 font-mono text-xs max-w-[200px] truncate" dir="ltr">{s.qrCode}</td>
                    <td className="px-3 py-2">{s.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
