"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function NewStocktakePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const user = session?.user as any
  const isAr = user?.locale !== "en"

  const [form, setForm] = useState({
    type: "PERIODIC",
    title: "",
    titleAr: "",
    scopeType: "ALL",
    countDate: new Date().toISOString().slice(0, 10),
    isBlind: true,
    isSurprise: false,
    notes: "",
  })

  if (status === "unauthenticated") {
    router.push("/login")
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/stocktake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          isSurprise: form.type === "SURPRISE" || form.isSurprise,
          countDate: new Date(form.countDate),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "فشل الإنشاء")

      router.push(`/stocktake/${data.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50" dir={isAr ? "rtl" : "ltr"}>
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">
          {isAr ? "إنشاء عملية جرد جديدة" : "Create New Stocktake"}
        </h1>
        <Link href="/stocktake" className="text-sm text-slate-600 hover:text-blue-600">
          {isAr ? "رجوع" : "Back"}
        </Link>
      </header>

      <main className="p-6 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
          {/* Type */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {isAr ? "نوع الجرد" : "Stocktake Type"}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, type: "PERIODIC", isSurprise: false })}
                className={`p-4 rounded-lg border-2 text-center transition ${
                  form.type === "PERIODIC"
                    ? "border-blue-600 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="font-bold text-lg">{isAr ? "دوري" : "Periodic"}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {isAr ? "جرد مخطط مسبقاً" : "Planned inventory count"}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, type: "SURPRISE", isSurprise: true, isBlind: true })}
                className={`p-4 rounded-lg border-2 text-center transition ${
                  form.type === "SURPRISE"
                    ? "border-rose-600 bg-rose-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="font-bold text-lg">{isAr ? "مفاجئ" : "Surprise"}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {isAr ? "تدقيق غير معلن" : "Unannounced audit"}
                </div>
              </button>
            </div>
          </div>

          {/* Titles */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {isAr ? "عنوان العملية (عربي)" : "Title (Arabic)"}
            </label>
            <input
              type="text"
              value={form.titleAr}
              onChange={(e) => setForm({ ...form, titleAr: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder={isAr ? "مثال: جرد المستودع الرئيسي - أكتوبر 2026" : ""}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {isAr ? "العنوان (إنجليزي)" : "Title (English)"}
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              dir="ltr"
              required
            />
          </div>

          {/* Scope */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {isAr ? "نطاق الجرد" : "Scope"}
            </label>
            <select
              value={form.scopeType}
              onChange={(e) => setForm({ ...form, scopeType: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">{isAr ? "كل الشركة" : "Entire Company"}</option>
              <option value="WAREHOUSE">{isAr ? "مستودع محدد" : "Specific Warehouse"}</option>
              <option value="LOCATION">{isAr ? "مواقع محددة" : "Specific Locations"}</option>
              <option value="CATEGORY">{isAr ? "تصنيف" : "Category"}</option>
              <option value="SKU_LIST">{isAr ? "أصناف محددة" : "Selected SKUs"}</option>
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {isAr ? "تاريخ الجرد" : "Count Date"}
            </label>
            <input
              type="date"
              value={form.countDate}
              onChange={(e) => setForm({ ...form, countDate: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              dir="ltr"
              required
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isBlind}
                onChange={(e) => setForm({ ...form, isBlind: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm">
                {isAr
                  ? "جرد أعمى (العداد لا يرى الكمية المتوقعة)"
                  : "Blind count (counter cannot see expected qty)"}
              </span>
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {isAr ? "ملاحظات" : "Notes"}
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              rows={3}
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading
              ? isAr
                ? "جاري الإنشاء..."
                : "Creating..."
              : isAr
              ? "إنشاء عملية الجرد"
              : "Create Stocktake Session"}
          </button>
        </form>
      </main>
    </div>
  )
}
