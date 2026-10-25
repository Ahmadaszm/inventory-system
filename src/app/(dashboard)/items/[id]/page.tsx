import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect, notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const { id } = await params
  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      category: true,
      brand: true,
      batches: { orderBy: { createdAt: "desc" }, take: 20 },
      cartons: {
        include: { location: { include: { warehouse: true } }, batch: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      balances: true,
    },
  })
  if (!item) notFound()

  const totalQty = item.balances.reduce((s, b) => s + Number(b.quantity), 0)

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <Link href="/items" className="text-sm text-blue-600 hover:underline">
            ← الأصناف
          </Link>
          <div className="flex flex-wrap justify-between items-start gap-3 mt-1">
            <div>
              <h1 className="text-xl font-bold">{item.nameAr}</h1>
              <p className="text-slate-500">{item.nameEn}</p>
              <p className="font-mono text-sm mt-1 text-blue-800">{item.sku}</p>
            </div>
            <span className="px-3 py-1 rounded-full text-sm bg-slate-100">
              {item.sourceType === "FACTORY" ? "مصنع" : "استيراد"}
            </span>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card label="الكمية الإجمالية" value={`${totalQty} ${item.uom}`} />
          <Card label="الكراتين" value={String(item.cartons.length)} />
          <Card
            label="التكلفة"
            value={`${item.currency} ${Number(item.costPerUnit).toFixed(2)}`}
          />
          <Card label="وحدات/كرتون" value={String(item.unitsPerCarton)} />
        </div>

        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold mb-3">الكراتين والرموز</h2>
          {item.cartons.length === 0 ? (
            <p className="text-slate-500 text-sm">لا توجد كراتين مربوطة بعد</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-right">QR / باركود</th>
                    <th className="px-3 py-2 text-right">الكمية</th>
                    <th className="px-3 py-2 text-right">الدفعة</th>
                    <th className="px-3 py-2 text-right">الموقع</th>
                    <th className="px-3 py-2 text-right">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {item.cartons.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 font-mono text-xs" dir="ltr">
                        {c.qrCode}
                      </td>
                      <td className="px-3 py-2 font-bold">{Number(c.quantity)}</td>
                      <td className="px-3 py-2">{c.batch.batchNumber}</td>
                      <td className="px-3 py-2">
                        {c.location
                          ? `${c.location.warehouse?.name || ""} / ${c.location.code}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2">{c.status}</td>
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

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  )
}
