"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

const ROLES = [
  { value: "SYSTEM_ADMIN", label: "مدير النظام" },
  { value: "INVENTORY_MANAGER", label: "مدير المخزون" },
  { value: "WAREHOUSE_SUPERVISOR", label: "مشرف مستودع" },
  { value: "STOCK_COUNTER", label: "عداد مخزون" },
  { value: "INDEPENDENT_VERIFIER", label: "مدقق مستقل" },
  { value: "APPROVER_AUDITOR", label: "معتمد / مراجع" },
]

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    nameAr: "",
    role: "STOCK_COUNTER",
  })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/users")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "فشل التحميل")
      setUsers(data.users || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "فشل الحفظ")
      setShowForm(false)
      setForm({ email: "", password: "", name: "", nameAr: "", role: "STOCK_COUNTER" })
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(u: any) {
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, isActive: !u.isActive }),
    })
    await load()
  }

  const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label || r

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <div>
            <Link href="/dashboard" className="text-sm text-[#9B1B1E] hover:underline">
              ← لوحة التحكم
            </Link>
            <h1 className="text-xl font-bold mt-1">إدارة المستخدمين والصلاحيات</h1>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-[#9B1B1E] hover:bg-[#7f1518] text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {showForm ? "إغلاق" : "+ مستخدم جديد"}
          </button>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>
        )}

        {showForm && (
          <form onSubmit={createUser} className="bg-white rounded-xl border p-6 space-y-4 shadow-sm">
            <h2 className="font-semibold text-lg border-b pb-2">إضافة مستخدم</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">اسم المستخدم *</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  dir="ltr"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  placeholder="username"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">كلمة المرور *</label>
                <input
                  type="password"
                  className="w-full border rounded-lg px-3 py-2"
                  dir="ltr"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">الاسم (إنجليزي) *</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">الاسم (عربي)</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={form.nameAr}
                  onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">الصلاحية / الدور *</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-[#9B1B1E] text-white px-6 py-2 rounded-lg disabled:opacity-50"
              >
                {saving ? "جاري الحفظ..." : "حفظ المستخدم"}
              </button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
          {loading ? (
            <p className="p-8 text-center text-slate-500">جاري التحميل...</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-right">اسم المستخدم</th>
                  <th className="px-3 py-2 text-right">الاسم</th>
                  <th className="px-3 py-2 text-right">الدور</th>
                  <th className="px-3 py-2 text-right">الحالة</th>
                  <th className="px-3 py-2 text-right">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono" dir="ltr">
                      {u.email}
                    </td>
                    <td className="px-3 py-2">{u.nameAr || u.name}</td>
                    <td className="px-3 py-2">{roleLabel(u.role)}</td>
                    <td className="px-3 py-2">
                      {u.isActive ? (
                        <span className="text-green-600">نشط</span>
                      ) : (
                        <span className="text-slate-400">معطّل</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleActive(u)}
                        className="text-[#9B1B1E] hover:underline text-xs"
                      >
                        {u.isActive ? "تعطيل" : "تفعيل"}
                      </button>
                    </td>
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
