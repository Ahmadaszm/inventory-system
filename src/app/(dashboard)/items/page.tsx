import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"

export default async function ItemsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const items = await prisma.item.findMany({
    where: { isActive: true },
    include: {
      category: true,
      brand: true,
      _count: { select: { cartons: true, batches: true } },
      balances: {
        select: { quantity: true },
      },
    },
    orderBy: { sku: "asc" },
  })

  const user = session.user as any
  const isAr = user.locale !== "en"

  return (
    <div className="min-h-screen bg-slate-50" dir={isAr ? "rtl" : "ltr"}>
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {isAr ? "إدارة الأصناف" : "Item Master"}
          </h1>
          <p className="text-sm text-slate-500">
            {isAr ? `${items.length} صنف نشط` : `${items.length} active items`}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard" className="text-sm text-slate-600 hover:text-blue-600">
            {isAr ? "لوحة التحكم" : "Dashboard"}
          </Link>
          <Link
            href="/items/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            {isAr ? "+ صنف جديد" : "+ New Item"}
          </Link>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">SKU</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">
                    {isAr ? "الاسم" : "Name"}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">
                    {isAr ? "التصنيف" : "Category"}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">
                    {isAr ? "المصدر" : "Source"}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">
                    {isAr ? "الكراتين" : "Cartons"}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">
                    {isAr ? "الكمية الإجمالية" : "Total Qty"}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">
                    {isAr ? "التكلفة" : "Cost"}
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">
                    {isAr ? "إجراءات" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => {
                  const totalQty = item.balances.reduce(
                    (sum, b) => sum + Number(b.quantity),
                    0
                  )
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-medium text-blue-700">
                        {item.sku}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.nameAr}</div>
                        <div className="text-xs text-slate-500">{item.nameEn}</div>
                      </td>
                      <td className="px-4 py-3">
                        {item.category?.nameAr || item.category?.name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            item.sourceType === "FACTORY"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.sourceType === "FACTORY"
                            ? isAr
                              ? "مصنع"
                              : "Factory"
                            : isAr
                            ? "استيراد"
                            : "Import"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{item._count.cartons}</td>
                      <td className="px-4 py-3 font-medium">
                        {totalQty.toLocaleString()} {item.uom}
                      </td>
                      <td className="px-4 py-3">
                        {Number(item.costPerUnit).toFixed(2)} {item.currency}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/items/${item.id}`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          {isAr ? "تفاصيل" : "Details"}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {items.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              {isAr ? "لا توجد أصناف بعد. أضف صنفاً جديداً." : "No items yet."}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
