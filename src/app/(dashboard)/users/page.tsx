"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"

const ROLES = [
  { value: "SYSTEM_ADMIN", label: "مدير النظام", desc: "صلاحيات كاملة", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "INVENTORY_MANAGER", label: "مدير المخزون", desc: "إدارة الأصناف والجرد", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "WAREHOUSE_SUPERVISOR", label: "مشرف مستودع", desc: "إشراف المواقع", color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  { value: "STOCK_COUNTER", label: "عداد مخزون", desc: "تنفيذ الجرد والمسح", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "INDEPENDENT_VERIFIER", label: "مدقق مستقل", desc: "مراجعة العد", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "APPROVER_AUDITOR", label: "معتمد / مراجع", desc: "اعتماد التسويات", color: "bg-rose-100 text-rose-800 border-rose-200" },
]

const PERMISSION_GROUPS: { group: string; items: { key: string; label: string }[] }[] = [
  { group: "الأصناف والباركود", items: [
    { key: "items:read", label: "عرض الأصناف" }, { key: "items:write", label: "إضافة/تعديل أصناف" },
    { key: "cartons:read", label: "عرض الكراتين" }, { key: "cartons:write", label: "إدارة الكراتين" },
    { key: "qr:generate", label: "توليد QR" }, { key: "qr:print", label: "طباعة QR" },
  ]},
  { group: "الجرد والعد", items: [
    { key: "stocktake:create", label: "إنشاء جلسة جرد" }, { key: "stocktake:manage", label: "إدارة الجلسات" },
    { key: "stocktake:count", label: "تنفيذ العد" }, { key: "stocktake:view", label: "عرض الجرد" },
    { key: "stocktake:view_expected", label: "عرض المتوقع" }, { key: "stocktake:verify", label: "التحقق من العد" },
    { key: "scan:perform", label: "المسح بالكاميرا" }, { key: "surprise:create", label: "جرد مفاجئ" },
    { key: "surprise:view", label: "عرض الجرد المفاجئ" },
  ]},
  { group: "الحركات والتسويات", items: [
    { key: "movements:read", label: "عرض الحركات" }, { key: "movements:write", label: "تسجيل حركات" },
    { key: "movements:approve", label: "اعتماد حركات" }, { key: "reconciliation:view", label: "عرض التسوية" },
    { key: "adjustments:create", label: "إنشاء تسوية" }, { key: "adjustments:approve", label: "اعتماد التسويات" },
  ]},
  { group: "التقارير والمستخدمون", items: [
    { key: "reports:all", label: "كل التقارير" }, { key: "reports:inventory", label: "تقارير المخزون" },
    { key: "reports:stocktake", label: "تقارير الجرد" }, { key: "reports:own_tasks", label: "مهامي فقط" },
    { key: "audit:read", label: "سجل التدقيق" }, { key: "users:read", label: "عرض المستخدمين" },
    { key: "users:write", label: "إدارة المستخدمين" }, { key: "*", label: "صلاحية كاملة (*)" },
  ]},
]

const DEFAULTS: Record<string, string[]> = {
  SYSTEM_ADMIN: ["*"],
  INVENTORY_MANAGER: ["items:read","items:write","cartons:read","cartons:write","qr:generate","qr:print","movements:read","movements:write","movements:approve","stocktake:create","stocktake:manage","stocktake:view_expected","surprise:create","surprise:view","reconciliation:view","adjustments:create","adjustments:approve","reports:all","users:read","audit:read"],
  WAREHOUSE_SUPERVISOR: ["items:read","cartons:read","qr:print","movements:read","movements:write","stocktake:create","stocktake:manage","stocktake:view_expected","reconciliation:view","reports:inventory","reports:stocktake"],
  STOCK_COUNTER: ["items:read","cartons:read","stocktake:count","scan:perform","reports:own_tasks"],
  INDEPENDENT_VERIFIER: ["items:read","cartons:read","stocktake:verify","stocktake:view_expected","reconciliation:view","reports:stocktake"],
  APPROVER_AUDITOR: ["items:read","cartons:read","movements:read","stocktake:view","reconciliation:view","adjustments:approve","reports:all","audit:read"],
}

function has(map: Record<string, string[]>, role: string, perm: string) {
  if (role === "SYSTEM_ADMIN") return true
  const list = map[role] || []
  return list.includes("*") || list.includes(perm)
}

function toggle(map: Record<string, string[]>, role: string, perm: string, on: boolean) {
  const next = JSON.parse(JSON.stringify(map))
  if (role === "SYSTEM_ADMIN") { next.SYSTEM_ADMIN = ["*"]; return next }
  if (perm === "*") { next[role] = on ? ["*"] : []; return next }
  let list = (next[role] || []).filter((p: string) => p !== "*")
  if (on) { if (!list.includes(perm)) list.push(perm) } else { list = list.filter((p: string) => p !== perm) }
  next[role] = list
  return next
}

const emptyForm = { email: "", password: "", name: "", nameAr: "", role: "STOCK_COUNTER" }

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [mode, setMode] = useState<"none" | "create" | "edit">("none")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showMatrix, setShowMatrix] = useState(true)
  const [rolePerms, setRolePerms] = useState<Record<string, string[]>>(DEFAULTS)
  const [dirty, setDirty] = useState(false)
  const [matrixSaving, setMatrixSaving] = useState(false)

  const loadPerms = useCallback(async () => {
    try {
      const res = await fetch("/api/permissions")
      const data = await res.json()
      if (res.ok && data.permissions) { setRolePerms(data.permissions); setDirty(false) }
    } catch { /* keep defaults */ }
  }, [])

  async function loadUsers() {
    setLoading(true)
    try {
      const res = await fetch("/api/users")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "فشل التحميل")
      setUsers(data.users || [])
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadUsers(); loadPerms() }, [loadPerms])

  async function saveUser(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(""); setSuccess("")
    try {
      if (mode === "create") {
        const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "فشل الحفظ")
        setSuccess("تم إنشاء المستخدم")
      } else if (editingId) {
        const payload: any = { id: editingId, email: form.email, name: form.name, nameAr: form.nameAr, role: form.role }
        if (form.password.trim()) payload.password = form.password
        const res = await fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "فشل التحديث")
        setSuccess("تم تحديث المستخدم")
      }
      setMode("none"); setEditingId(null); setForm(emptyForm)
      await loadUsers()
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function changeRole(u: any, role: string) {
    const res = await fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, role }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error || "فشل"); return }
    setSuccess("تم تحديث الدور"); await loadUsers()
  }

  async function toggleActive(u: any) {
    const res = await fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, isActive: !u.isActive }) })
    if (!res.ok) { const d = await res.json(); setError(d.error || "فشل"); return }
    await loadUsers()
  }

  async function deleteUser(u: any) {
    if (!confirm(`حذف ${u.email}؟`)) return
    const res = await fetch(`/api/users?id=${encodeURIComponent(u.id)}`, { method: "DELETE" })
    const data = await res.json()
    if (!res.ok) { setError(data.error || "فشل"); return }
    setSuccess(data.message || "تم"); await loadUsers()
  }

  async function saveMatrix() {
    setMatrixSaving(true); setError(""); setSuccess("")
    try {
      const res = await fetch("/api/permissions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissions: rolePerms }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "فشل حفظ الصلاحيات")
      setRolePerms(data.permissions || rolePerms); setDirty(false)
      setSuccess("تم حفظ مصفوفة الصلاحيات")
    } catch (e: any) { setError(e.message) }
    finally { setMatrixSaving(false) }
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <div>
            <Link href="/dashboard" className="text-sm text-[#9B1B1E] hover:underline">← لوحة التحكم</Link>
            <h1 className="text-xl font-bold mt-1">إدارة المستخدمين والصلاحيات</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowMatrix((v) => !v)} className="border px-4 py-2 rounded-lg text-sm">
              {showMatrix ? "إخفاء المصفوفة" : "مصفوفة الصلاحيات"}
            </button>
            <button onClick={() => { setMode(mode === "create" ? "none" : "create"); setForm(emptyForm); setEditingId(null) }}
              className="bg-[#9B1B1E] text-white px-4 py-2 rounded-lg text-sm">
              {mode === "create" ? "إغلاق" : "+ مستخدم جديد"}
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-sm">{success}</div>}

        {showMatrix && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50 flex flex-wrap justify-between items-center gap-2">
              <div>
                <h2 className="font-semibold">مصفوفة الصلاحيات (قابلة للتعديل)</h2>
                <p className="text-xs text-slate-500">اضغط ✓ أو – لتفعيل/إلغاء صلاحية لدور معين، ثم احفظ</p>
              </div>
              <div className="flex gap-2 items-center">
                {dirty && <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">غير محفوظ</span>}
                <button type="button" onClick={() => { setRolePerms(JSON.parse(JSON.stringify(DEFAULTS))); setDirty(true) }}
                  className="text-xs border px-3 py-1.5 rounded-lg">استعادة الافتراضي</button>
                <button type="button" onClick={saveMatrix} disabled={matrixSaving || !dirty}
                  className="text-xs bg-[#9B1B1E] text-white px-4 py-1.5 rounded-lg disabled:opacity-40 font-medium">
                  {matrixSaving ? "جاري الحفظ..." : "حفظ الصلاحيات"}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[800px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="sticky right-0 bg-slate-100 px-3 py-2 text-right border-l z-10">الصلاحية</th>
                    {ROLES.map((r) => (
                      <th key={r.value} className="px-2 py-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded border text-[11px] ${r.color}`}>{r.label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_GROUPS.map((g) => (
                    <>
                      <tr key={g.group} className="bg-slate-50">
                        <td colSpan={ROLES.length + 1} className="px-3 py-1.5 font-semibold border-t">{g.group}</td>
                      </tr>
                      {g.items.map((item) => (
                        <tr key={item.key} className="border-t border-slate-100">
                          <td className="sticky right-0 bg-white px-3 py-1.5 text-right border-l z-10">
                            {item.label}
                            <span className="block text-[10px] text-slate-400 font-mono" dir="ltr">{item.key}</span>
                          </td>
                          {ROLES.map((r) => {
                            const ok = has(rolePerms, r.value, item.key)
                            const locked = r.value === "SYSTEM_ADMIN"
                            return (
                              <td key={r.value} className="px-2 py-1.5 text-center">
                                <button type="button" disabled={locked}
                                  onClick={() => { setRolePerms((p) => toggle(p, r.value, item.key, !ok)); setDirty(true) }}
                                  title={locked ? "مدير النظام دائماً كامل الصلاحيات" : ok ? "إلغاء" : "منح"}
                                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                                    ok ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                                  } ${locked ? "cursor-default" : ""}`}>
                                  {ok ? "✓" : "–"}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(mode === "create" || mode === "edit") && (
          <form onSubmit={saveUser} className="bg-white rounded-xl border p-6 space-y-4 shadow-sm">
            <h2 className="font-semibold text-lg border-b pb-2">{mode === "create" ? "إضافة مستخدم" : "تعديل مستخدم"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">اسم المستخدم *</label>
                <input className="w-full border rounded-lg px-3 py-2" dir="ltr" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm mb-1">كلمة المرور {mode === "edit" ? "(فارغة = بدون تغيير)" : "*"}</label>
                <input type="password" className="w-full border rounded-lg px-3 py-2" dir="ltr" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} required={mode === "create"} minLength={mode === "create" ? 6 : undefined} />
              </div>
              <div>
                <label className="block text-sm mb-1">الاسم *</label>
                <input className="w-full border rounded-lg px-3 py-2" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm mb-1">الاسم بالعربي</label>
                <input className="w-full border rounded-lg px-3 py-2" value={form.nameAr}
                  onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">الدور</label>
                <select className="w-full border rounded-lg px-3 py-2" value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setMode("none"); setEditingId(null) }} className="px-4 py-2 border rounded-lg text-sm">إلغاء</button>
              <button type="submit" disabled={saving} className="bg-[#9B1B1E] text-white px-6 py-2 rounded-lg disabled:opacity-50">
                {saving ? "..." : "حفظ"}
              </button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl border overflow-x-auto shadow-sm">
          {loading ? <p className="p-8 text-center text-slate-500">جاري التحميل...</p> : (
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-right">المستخدم</th>
                  <th className="px-3 py-2 text-right">الاسم</th>
                  <th className="px-3 py-2 text-right">الدور</th>
                  <th className="px-3 py-2 text-right">الحالة</th>
                  <th className="px-3 py-2 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono" dir="ltr">{u.email}</td>
                    <td className="px-3 py-2">{u.nameAr || u.name}</td>
                    <td className="px-3 py-2">
                      <select className="border rounded px-2 py-1 text-xs" value={u.role} onChange={(e) => changeRole(u, e.target.value)}>
                        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">{u.isActive ? <span className="text-green-600">نشط</span> : <span className="text-slate-400">معطّل</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => { setMode("edit"); setEditingId(u.id); setForm({ email: u.email, password: "", name: u.name || "", nameAr: u.nameAr || "", role: u.role }) }}
                          className="text-xs text-blue-700 border border-blue-200 px-2 py-1 rounded">تعديل</button>
                        <button onClick={() => toggleActive(u)} className="text-xs border px-2 py-1 rounded">{u.isActive ? "تعطيل" : "تفعيل"}</button>
                        <button onClick={() => deleteUser(u)} className="text-xs text-red-700 border border-red-200 px-2 py-1 rounded">حذف</button>
                      </div>
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
