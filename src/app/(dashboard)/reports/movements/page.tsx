import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"

export default async function MovementsReportPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  let movements: any[] = []
  try {
    movements = await prisma.stockMovement.findMany({
      include: { createdBy: true, items: { include: { item: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
  } catch {
    movements = []
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <Link href="/reports" className="text-sm text-blue-600 hover:underline">← التقارير</Link>
          <h1 className="text-xl font-bold mt-1">دفتر الحركات</h1>
        </div>
      </header>
      <main className="p-6 max-w-6xl mx-auto">
        <div className="bg-white rounded-xl border overflow-hidden">
          {movements.length === 0 ? (
            <p className="p-8 text-center text-slate-500">لا توجد حركات مسجلة بعد</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-right">رقم الحركة</th>
                  <th className="px-3 py-2 text-right">النوع</th>
                  <th className="px-3 py-2 text-right">الحالة</th>
                  <th className="px-3 py-2 text-right">الأصناف</th>
                  <th className="px-3 py-2 text-right">بواسطة</th>
                  <th className="px-3 py-2 text-right">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-2 font-mono text-xs">{m.movementNumber}</td>
                    <td className="px-3 py-2">{m.type}</td>
                    <td className="px-3 py-2">{m.status}</td>
                    <td className="px-3 py-2">{m.items?.length || 0}</td>
                    <td className="px-3 py-2">{m.createdBy?.nameAr || m.createdBy?.name}</td>
                    <td className="px-3 py-2">{new Date(m.createdAt).toLocaleDateString("ar-EG")}</td>
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
