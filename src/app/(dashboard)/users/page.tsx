"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

const ROLES = [
  { value: "SYSTEM_ADMIN", label: "مدير النظام", desc: "صلاحيات كاملة" },
  { value: "INVENTORY_MANAGER", label: "مدير المخزون", desc: "إدارة أصناف وجرد وتقارير" },
  { value: "WAREHOUSE_SUPERVISOR", label: "مشرف مستودع", desc: "إشراف مواقع وعدّ" },
  { value: "STOCK_COUNTER", label: "عداد مخزون", desc: "تنفيذ الجرد والمسح فقط" },
  { value: "INDEPENDENT_VERIFIER", label: "مدقق مستقل", desc: "مراجعة العد دون تعديل" },
  { value: "APPROVER_AUDITOR", label: "معتمد / مراجع", desc: "اعتماد التسويات" },
]

const emptyForm = {
  email: "",
  password: "",
  name: "",
  nameAr: "",
  role: "STOCK_COUNTER",
}

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [mode, setMode] = useState<"none" | "create" | "edit">("none")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
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

  function openCreate() {
    setMode("create")
    setEditingId(null)
    setForm(emptyForm)
    setError("")
    setSuccess("")
  }

  function openEdit(u: any) {
    setMode("edit")
    setEditingId(u.id)
    setForm({
      email: u.email,
      password: "",
      name: u.name || "",
      nameAr: u.nameAr || "",
      role: u.role,
    })
    setError("")
    setSuccess("")
  }

  function closeForm() {
    setMode("none")
    setEditingId(null)
    setForm(emptyForm)
  }

  async function saveUser(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      if (mode === "create") {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "فشل الحفظ")
        setSuccess("تم إنشاء المستخدم بنجاح")
      } else if (mode === "edit" && editingId) {
        const payload: any = {
          id: editingId,
          email: form.email,
          name: form.name,
          nameAr: form.nameAr,
          role: form.role,
        }
        if (form.password.trim()) payload.password = form.password
        const res = await fetch("/api/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "فشل التحديث")
        setSuccess("تم تحديث المستخدم بنجاح")
      }
      closeForm()
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(u: any) {
    setError("")
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, isActive: !u.isActive }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "فشل تغيير الحالة")
      return
    }
    await load()
  }

  async function changeRole(u: any, role: string) {
    setError("")
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, role }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "فشل تغيير الصلاحية")
      return
    }
    setSuccess(`تم تحديث صلاحية ${u.email}`)
    await load()
  }

  async function deleteUser(u: any) {
    if (!confirm(`هل تريد حذف المستخدم «${u.email}»؟`)) return
    setError("")
    setSuccess("")
    const res = await fetch(`/api/users?id=${encodeURIComponent(u.id)}`, {
      method: "DELETE",
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "فشل الحذف")
      return
    }
    setSuccess(data.message || "تم حذف / تعطيل المستخدم")
    await load()
  }

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
            onClick={() => (mode === "create" ? closeForm() : openCreate())}
            className="bg-[#9B1B1E] hover:bg-[#7f1518] text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {mode === "create" ? "إغلاق" : "+ مستخدم جديد"}
          </button>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        {(mode === "create" || mode === "edit") && (
          <form onSubmit={saveUser} className="bg-white rounded-xl border p-6 space-y-4 shadow-sm">
            <h2 className="font-semibold text-lg border-b pb-2">
              {mode === "create" ? "إضافة مستخدم" : "تعديل مستخدم"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">اسم المستخدم *</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  dir="ltr"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">
                  كلمة المرور {mode === "edit" ? "(اتركها فارغة للإبقاء)" : "*"}
                </label>
                <input
                  type="password"
                  className="w-full border rounded-lg px-3 py-2"
                  dir="ltr"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={mode === "create"}
                  minLength={mode === "create" ? 6 : undefined}
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
                      {r.label} — {r.desc}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg border text-sm">
                إلغاء
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-[#9B1B1E] text-white px-6 py-2 rounded-lg disabled:opacity-50"
              >
                {saving ? "جاري الحفظ..." : mode === "create" ? "حفظ المستخدم" : "حفظ التعديلات"}
              </button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl border overflow-x-auto shadow-sm">
          {loading ? (
            <p className="p-8 text-center text-slate-500">جاري التحميل...</p>
          ) : (
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-right">اسم المستخدم</th>
                  <th className="px-3 py-2 text-right">الاسم</th>
                  <th className="px-3 py-2 text-right">الدور / الصلاحية</th>
                  <th className="px-3 py-2 text-right">الحالة</th>
                  <th className="px-3 py-2 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono" dir="ltr">
                      {u.email}
                    </td>
                    <td className="px-3 py-2">{u.nameAr || u.name}</td>
                    <td className="px-3 py-2">
                      <select
                        className="border rounded px-2 py-1 text-xs max-w-[160px]"
                        value={u.role}
                        onChange={(e) => changeRole(u, e.target.value)}
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {u.isActive ? (
                        <span className="text-green-600">نشط</span>
                      ) : (
                        <span className="text-slate-400">معطّل</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openEdit(u)}
                          className="text-xs text-blue-700 border border-blue-200 px-2 py-1 rounded hover:bg-blue-50"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
                          className="text-xs text-[#9B1B1E] border border-[#9B1B1E]/30 px-2 py-1 rounded hover:bg-red-50"
                        >
                          {u.isActive ? "تعطيل" : "تفعيل"}
                        </button>
                        <button
                          onClick={() => deleteUser(u)}
                          className="text-xs text-red-700 border border-red-200 px-2 py-1 rounded hover:bg-red-50"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl border p-4 text-sm text-slate-600 space-y-1">
          <p className="font-medium text-slate-800">دليل الصلاحيات:</p>
          {ROLES.map((r) => (
            <p key={r.value}>
              <span className="font-medium">{r.label}:</span> {r.desc}
            </p>
          ))}
        </div>
      </main>
    </div>
  )
}
