import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect, notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"
import { runReconciliation } from "@/lib/services/stocktake"

export default async function ReconciliationPage({
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
      progress: true,
      warehouse: true,
      _count: { select: { countRecords: true, snapshots: true } },
    },
  })
  if (!stocktake) notFound()

  const counts = await prisma.countRecord.findMany({
    where: { sessionId: id },
    include: {
      item: true,
      countedBy: true,
    },
    orderBy: { countedAt: "desc" },
  })

  const physicalMap = new Map<
    string,
    {
      qr: string
      sku: string
      nameAr: string
      qty: number
      isUnknown: boolean
      counters: Set<string>
    }
  >()

  for (const c of counts) {
    const key = c.itemId || c.qrCodeScanned || c.id
    const prev = physicalMap.get(key)
    const who = c.countedBy?.nameAr || c.countedBy?.name || ""
    if (prev) {
      prev.qty += Number(c.countedQty)
      if (who) prev.counters.add(who)
    } else {
      physicalMap.set(key, {
        qr: c.qrCodeScanned || "",
        sku: c.item?.sku || "",
        nameAr: c.item?.nameAr || c.item?.nameEn || "(غير معرّف)",
        qty: Number(c.countedQty),
        isUnknown: !!c.isUnknownQr || !c.itemId,
        counters: new Set(who ? [who] : []),
      })
    }
  }

  const physicalRows = Array.from(physicalMap.values()).sort((a, b) =>
    a.nameAr.localeCompare(b.nameAr, "ar")
  )

  let recon: Awaited<ReturnType<typeof runReconciliation>> = []
  let reconError = ""
  try {
    if (stocktake._count.snapshots > 0) {
      recon = await runReconciliation(id)
    }
  } catch (e: any) {
    reconError = e?.message || "تعذر حساب التسوية"
  }

  const shortages = recon.filter((r) => r.status === "SHORTAGE")
  const surplus = recon.filter((r) => r.status === "SURPLUS")
  const matched = recon.filter((r) => r.status === "MATCHED")
  const unexpected = recon.filter((r) => r.status === "UNEXPECTED")

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <Link href={`/stocktake/${id}`} className="text-sm text-[#9B1B1E] hover:underline">
            ← رجوع لجلسة الجرد
          </Link>
          <h1 className="text-xl font-bold mt-1">التسوية والفروقات</h1>
          <p className="text-sm text-slate-500">
            {stocktake.titleAr || stocktake.title} — {stocktake.sessionNumber}
          </p>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="سجلات العد" value={counts.length} />
          <Stat label="أصناف مجمّعة" value={physicalRows.length} />
          <Stat label="نواقص" value={shortages.length} color="text-red-600" />
          <Stat
            label="زيادات"
            value={surplus.length + unexpected.length}
            color="text-amber-600"
          />
        </div>

        {reconError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
            {reconError}
          </div>
        )}

        <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50 font-medium flex justify-between">
            <span>الجرد الفعلي (مجمّع حسب الصنف / الباركود)</span>
            <span className="text-sm text-slate-500">{physicalRows.length} بند</span>
          </div>
          {physicalRows.length === 0 ? (
            <p className="p-8 text-center text-slate-400">
              لا توجد سجلات عد بعد. ابدأ المسح والعد أولاً.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-right">الباركود</th>
                    <th className="px-3 py-2 text-right">SKU</th>
                    <th className="px-3 py-2 text-right">اسم الصنف</th>
                    <th className="px-3 py-2 text-right">الكمية الفعلية</th>
                    <th className="px-3 py-2 text-right">الحالة</th>
                    <th className="px-3 py-2 text-right">القائمون بالعد</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {physicalRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs" dir="ltr">
                        {r.qr || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs" dir="ltr">
                        {r.sku || "—"}
                      </td>
                      <td className="px-3 py-2">{r.nameAr}</td>
                      <td className="px-3 py-2 font-bold text-blue-700">{r.qty}</td>
                      <td className="px-3 py-2">
                        {r.isUnknown ? (
                          <span className="text-amber-600">غير معرّف</span>
                        ) : (
                          <span className="text-green-600">معرّف</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {Array.from(r.counters).join("، ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50 font-medium">
            مقارنة الرصيد الدفتري × الفعلي
            {stocktake._count.snapshots === 0 && (
              <span className="block text-xs font-normal text-amber-700 mt-1">
                لا توجد لقطة رصيد دفتري لهذه الجلسة (جرد أعمى / مفاجئ). تظهر فقط الكميات
                الفعلية أعلاه.
              </span>
            )}
          </div>
          {recon.length === 0 ? (
            <p className="p-6 text-center text-slate-400 text-sm">
              {stocktake._count.snapshots === 0
                ? "التسوية الدفترية غير متاحة بدون رصيد افتتاحي."
                : "لا توجد فروقات محسوبة."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-right">SKU</th>
                    <th className="px-3 py-2 text-right">الصنف</th>
                    <th className="px-3 py-2 text-right">دفتري</th>
                    <th className="px-3 py-2 text-right">فعلي</th>
                    <th className="px-3 py-2 text-right">الفرق</th>
                    <th className="px-3 py-2 text-right">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recon.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs" dir="ltr">
                        {r.sku}
                      </td>
                      <td className="px-3 py-2">{r.nameAr || r.nameEn}</td>
                      <td className="px-3 py-2">{r.bookQty}</td>
                      <td className="px-3 py-2 font-bold">{r.physicalQty}</td>
                      <td
                        className={`px-3 py-2 font-bold ${
                          r.varianceQty < 0
                            ? "text-red-600"
                            : r.varianceQty > 0
                            ? "text-amber-600"
                            : "text-green-600"
                        }`}
                      >
                        {r.varianceQty > 0 ? `+${r.varianceQty}` : r.varianceQty}
                      </td>
                      <td className="px-3 py-2">
                        {r.status === "MATCHED" && (
                          <span className="text-green-600">مطابق</span>
                        )}
                        {r.status === "SHORTAGE" && (
                          <span className="text-red-600">نقص</span>
                        )}
                        {r.status === "SURPLUS" && (
                          <span className="text-amber-600">زيادة</span>
                        )}
                        {r.status === "UNEXPECTED" && (
                          <span className="text-purple-600">غير متوقع</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {recon.length > 0 && (
          <div className="text-xs text-slate-500">
            مطابق: {matched.length} · نقص: {shortages.length} · زيادة: {surplus.length} · غير
            متوقع: {unexpected.length}
          </div>
        )}
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
      <p className={`text-2xl font-bold mt-1 ${color || ""}`}>{value}</p>
    </div>
  )
}
