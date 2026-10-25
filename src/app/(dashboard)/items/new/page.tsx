"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function NewItemPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    sku: "",
    internalId: "",
    nameAr: "",
    nameEn: "",
    sourceType: "FACTORY",
    uom: "PCS",
    unitsPerCarton: "1",
    costPerUnit: "0",
    currency: "USD",
    model: "",
    size: "",
    color: "",
    descriptionAr: "",
    notes: "",
    qrCode: "",
    quantity: "",
  })

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          unitsPerCarton: parseInt(form.unitsPerCarton) || 1,
          costPerUnit: parseFloat(form.costPerUnit) || 0,
          quantity: form.quantity ? parseFloat(form.quantity) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "فشل الحفظ")
      router.push("/items")
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto">
          <Link href="/items" className="text-sm text-blue-600 hover:underline">
            ← الأصناف
          </Link>
          <h1 className="text-xl font-bold text-slate-800 mt-1">إضافة صنف جديد</h1>
        </div>
      </header>

      <main className="p-6 max-w-3xl mx-auto">
        <form onSubmit={onSubmit} className="bg-white rounded-xl border shadow-sm p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <section>
            <h2 className="font-semibold text-slate-800 mb-3 border-b pb-2">البيانات الأساسية</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="SKU" required dir="ltr" value={form.sku} onChange={(v) => set("sku", v)} placeholder="SKU-002" />
              <Field label="الرقم الداخلي" dir="ltr" value={form.internalId} onChange={(v) => set("internalId", v)} placeholder="اختياري" />
              <Field label="الاسم بالعربي" required value={form.nameAr} onChange={(v) => set("nameAr", v)} />
              <Field label="الاسم بالإنجليزي" value={form.nameEn} onChange={(v) => set("nameEn", v)} />
            </div>
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 mb-3 border-b pb-2">المصدر والوحدة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">المصدر</label>
                <select
                  value={form.sourceType}
                  onChange={(e) => set("sourceType", e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="FACTORY">مصنع / إنتاج</option>
                  <option value="IMPORT">استيراد</option>
                </select>
              </div>
              <Field label="وحدة القياس" dir="ltr" value={form.uom} onChange={(v) => set("uom", v)} />
              <Field label="وحدات لكل كرتون" type="number" dir="ltr" value={form.unitsPerCarton} onChange={(v) => set("unitsPerCarton", v)} />
              <Field label="التكلفة للوحدة" type="number" dir="ltr" value={form.costPerUnit} onChange={(v) => set("costPerUnit", v)} />
              <Field label="العملة" dir="ltr" value={form.currency} onChange={(v) => set("currency", v)} />
            </div>
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 mb-3 border-b pb-2">تفاصيل إضافية</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="الموديل" value={form.model} onChange={(v) => set("model", v)} />
              <Field label="المقاس" value={form.size} onChange={(v) => set("size", v)} />
              <Field label="اللون" value={form.color} onChange={(v) => set("color", v)} />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">الوصف</label>
              <textarea
                value={form.descriptionAr}
                onChange={(e) => set("descriptionAr", e.target.value)}
                rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </section>

          <section className="bg-slate-50 rounded-lg p-4 border">
            <h2 className="font-semibold text-slate-800 mb-1">ربط باركود / QR (اختياري)</h2>
            <p className="text-xs text-slate-500 mb-3">
              إذا أدخلت باركوداً هنا سيُنشأ كرتون مرتبط بهذا الصنف تلقائياً
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="باركود / QR" dir="ltr" value={form.qrCode} onChange={(v) => set("qrCode", v)} placeholder="13-120144" />
              <Field label="الكمية الابتدائية" type="number" dir="ltr" value={form.quantity} onChange={(v) => set("quantity", v)} />
            </div>
          </section>

          <div className="flex gap-3 justify-end pt-2">
            <Link href="/items" className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
              إلغاء
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
            >
              {loading ? "جاري الحفظ..." : "حفظ الصنف"}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  dir,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  type?: string
  dir?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        dir={dir}
        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      />
    </div>
  )
}
