"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

const ROLES = [
  {
    value: "SYSTEM_ADMIN",
    label: "مدير النظام",
    desc: "صلاحيات كاملة على كل شيء",
    color: "bg-purple-100 text-purple-800 border-purple-200",
  },
  {
    value: "INVENTORY_MANAGER",
    label: "مدير المخزون",
    desc: "إدارة الأصناف والجرد والتقارير والمستخدمين",
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    value: "WAREHOUSE_SUPERVISOR",
    label: "مشرف مستودع",
    desc: "إشراف المواقع والعد والحركات",
    color: "bg-cyan-100 text-cyan-800 border-cyan-200",
  },
  {
    value: "STOCK_COUNTER",
    label: "عداد مخزون",
    desc: "تنفيذ الجرد والمسح فقط",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  {
    value: "INDEPENDENT_VERIFIER",
    label: "مدقق مستقل",
    desc: "مراجعة العد دون تعديل",
    color: "bg-amber-100 text-amber-800 border-amber-200",
  },
  {
    value: "APPROVER_AUDITOR",
    label: "معتمد / مراجع",
    desc: "اعتماد التسويات والتقارير",
    color: "bg-rose-100 text-rose-800 border-rose-200",
  },
]

/** All known permissions grouped for the matrix UI */
const PERMISSION_GROUPS: { group: string; items: { key: string; label: string }[] }[] = [
  {
    group: "الأصناف والباركود",
    items: [
      { key: "items:read", label: "عرض الأصناف" },
      { key: "items:write", label: "إضافة/تعديل أصناف" },
      { key: "cartons:read", label: "عرض الكراتين" },
      { key: "cartons:write", label: "إدارة الكراتين" },
      { key: "qr:generate", label: "توليد QR" },
      { key: "qr:print", label: "طباعة QR" },
    ],
  },
  {
    group: "الجرد والعد",
    items: [
      { key: "stocktake:create", label: "إنشاء جلسة جرد" },
      { key: "stocktake:manage", label: "إدارة الجلسات" },
      { key: "stocktake:count", label: "تنفيذ العد" },
      { key: "stocktake:view", label: "عرض الجرد" },
      { key: "stocktake:view_expected", label: "عرض المتوقع" },
      { key: "stocktake:verify", label: "التحقق من العد" },
      { key: "scan:perform", label: "المسح بالكاميرا" },
      { key: "surprise:create", label: "جرد مفاجئ" },
      { key: "surprise:view", label: "عرض الجرد المفاجئ" },
    ],
  },
  {
    group: "الحركات والتسويات",
    items: [
      { key: "movements:read", label: "عرض الحركات" },
      { key: "movements:write", label: "تسجيل حركات" },
      { key: "movements:approve", label: "اعتماد حركات" },
      { key: "reconciliation:view", label: "عرض التسوية" },
      { key: "adjustments:create", label: "إنشاء تسوية" },
      { key: "adjustments:approve", label: "اعتماد التسويات" },
    ],
  },
  {
    group: "التقارير والتدقيق",
    items: [
      { key: "reports:all", label: "كل التقارير" },
      { key: "reports:inventory", label: "تقارير المخزون" },
      { key: "reports:stocktake", label: "تقارير الجرد" },
      { key: "reports:own_tasks", label: "مهامي فقط" },
      { key: "audit:read", label: "سجل التدقيق" },
    ],
  },
  {
    group: "المستخدمون والنظام",
    items: [
      { key: "users:read", label: "عرض المستخدمين" },
      { key: "users:write", label: "إدارة المستخدمين" },
      { key: "*", label: "صلاحية كاملة (*)" },
    ],
  },
]

/** Mirror of ROLE_PERMISSIONS from auth/options (kept in sync manually) */
const ROLE_PERMS: Record<string, string[]> = {
  SYSTEM_ADMIN: ["*"],
  INVENTORY_MANAGER: [
    "items:read", "items:write",
    "cartons:read", "cartons:write", "qr:generate", "qr:print",
    "movements:read", "movements:write", "movements:approve",
    "stocktake:create", "stocktake:manage", "stocktake:view_expected",
    "surprise:create", "surprise:view",
    "reconciliation:view", "adjustments:create", "adjustments:approve",
    "reports:all", "users:read", "audit:read",
  ],
  WAREHOUSE_SUPERVISOR: [
    "items:read", "cartons:read", "qr:print",
    "movements:read", "movements:write",
    "stocktake:create", "stocktake:manage", "stocktake:view_expected",
    "reconciliation:view", "reports:inventory", "reports:stocktake",
  ],
  STOCK_COUNTER: [
    "items:read", "cartons:read",
    "stocktake:count", "scan:perform",
    "reports:own_tasks",
  ],
  INDEPENDENT_VERIFIER: [
    "items:read", "cartons:read",
    "stocktake:verify", "stocktake:view_expected",
    "reconciliation:view", "reports:stocktake",
  ],
  APPROVER_AUDITOR: [
    "items:read", "cartons:read", "movements:read",
    "stocktake:view", "reconciliation:view",
    "adjustments:approve", "reports:all", "audit:read",
  ],
}

function roleHas(role: string, perm: string): boolean {
  const list = ROLE_PERMS[role] || []
  return list.includes("*") || list.includes(perm)
}

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
  const [showMatrix, setShowMatrix] = useState(false)
  const [selectedRoleForDetails, setSelectedRoleForDetails] = useState<string | null>(null)

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
    if (!confirm(`هل تريد حذف المستخدم «${u.email}»؟\nلا يمكن التراجع بسهولة.`)) return
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

  const roleMeta = (r: string) => ROLES.find((x) => x.value === r) || { label: r, color: "bg-slate-100 text-slate-700", desc: "" }

  const currentRolePerms = ROLE_PERMS[form.role] || []

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <div>
            <Link href="/dashboard" className="text-sm text-[#9B1B1E] hover:underline">
              ← لوحة التحكم
            </Link>
            <h1 className="text-xl font-bold mt-1">إدارة المستخدمين والصلاحيات</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowMatrix((v) => !v)}
              className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium"
            >
              {showMatrix ? "إخفاء مصفوفة الصلاحيات" : "مصفوفة الصلاحيات"}
            </button>
            <button
              onClick={() => (mode === "create" ? closeForm() : openCreate())}
              className="bg-[#9B1B1E] hover:bg-[#7f1518] text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {mode === "create" ? "إغلاق" : "+ مستخدم جديد"}
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        {showMatrix && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="font-semibold text-base">مصفوفة الصلاحيات حسب الدور</h2>
              <p className="text-xs text-slate-500">اضغط على اسم الدور لعرض تفاصيله</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[900px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="sticky right-0 bg-slate-100 px-3 py-2 text-right font-semibold border-l z-10 min-w-[140px]">
                      الصلاحية
                    </th>
                    {ROLES.map((r) => (
                      <th
                        key={r.value}
                        className={`px-2 py-2 text-center font-medium cursor-pointer hover:bg-slate-200 transition ${
                          selectedRoleForDetails === r.value ? "bg-blue-100" : ""
                        }`}
                        onClick={() =>
                          setSelectedRoleForDetails((prev) => (prev === r.value ? null : r.value))
                        }
                        title={r.desc}
                      >
                        <span className={`inline-block px-2 py-0.5 rounded border text-[11px] ${r.color}`}>
                          {r.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_GROUPS.map((g) => (
                    <>
                      <tr key={`g-${g.group}`} className="bg-slate-50">
                        <td
                          colSpan={ROLES.length + 1}
                          className="px-3 py-1.5 font-semibold text-slate-700 border-t"
                        >
                          {g.group}
                        </td>
                      </tr>
                      {g.items.map((item) => (
                        <tr key={item.key} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="sticky right-0 bg-white px-3 py-1.5 text-right border-l z-10">
                            {item.label}
                            <span className="block text-[10px] text-slate-400 font-mono" dir="ltr">
                              {item.key}
                            </span>
                          </td>
                          {ROLES.map((r) => {
                            const ok = roleHas(r.value, item.key)
                            return (
                              <td key={r.value} className="px-2 py-1.5 text-center">
                                {ok ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold">
                                    ✓
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-300 text-sm">
                                    –
                                  </span>
                                )}
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

            {selectedRoleForDetails && (
              <div className="border-t p-4 bg-blue-50/50">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded border text-sm ${roleMeta(selectedRoleForDetails).color}`}>
                    {roleMeta(selectedRoleForDetails).label}
                  </span>
                  <span className="text-sm text-slate-600 font-normal">
                    — {roleMeta(selectedRoleForDetails).desc}
                  </span>
                </h3>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(ROLE_PERMS[selectedRoleForDetails] || []).includes("*") ? (
                    <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-medium">
                      جميع الصلاحيات (*)
                    </span>
                  ) : (
                    (ROLE_PERMS[selectedRoleForDetails] || []).map((p) => {
                      const label =
                        PERMISSION_GROUPS.flatMap((g) => g.items).find((i) => i.key === p)?.label || p
                      return (
                        <span
                          key={p}
                          className="px-2 py-1 rounded-full bg-white border border-slate-200 text-xs"
                        >
                          {label}
                        </span>
                      )
                    })
                  )}
                </div>
              </div>
            )}
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
            </div>

            <div>
              <label className="block text-sm mb-2 font-medium">الصلاحية / الدور *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {ROLES.map((r) => {
                  const selected = form.role === r.value
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setForm({ ...form, role: r.value })}
                      className={`text-right p-3 rounded-xl border-2 transition ${
                        selected
                          ? "border-[#9B1B1E] bg-red-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded border ${r.color}`}>{r.label}</span>
                        {selected && (
                          <span className="text-[#9B1B1E] text-sm font-bold">✓</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">{r.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl border p-4">
              <p className="text-sm font-medium mb-2">
                الصلاحيات الممنوحة لـ «{roleMeta(form.role).label}»:
              </p>
              {currentRolePerms.includes("*") ? (
                <p className="text-sm text-purple-700 font-medium">★ صلاحيات كاملة على كل أجزاء النظام</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {currentRolePerms.map((p) => {
                    const label =
                      PERMISSION_GROUPS.flatMap((g) => g.items).find((i) => i.key === p)?.label || p
                    return (
                      <span
                        key={p}
                        className="px-2 py-1 rounded-full bg-white border border-slate-200 text-xs"
                      >
                        {label}
                      </span>
                    )
                  })}
                  {currentRolePerms.length === 0 && (
                    <span className="text-xs text-slate-400">لا توجد صلاحيات محددة</span>
                  )}
                </div>
              )}
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
                {users.map((u) => {
                  const meta = roleMeta(u.role)
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono" dir="ltr">
                        {u.email}
                      </td>
                      <td className="px-3 py-2">{u.nameAr || u.name}</td>
                      <td className="px-3 py-2">
                        <select
                          className="border rounded-lg px-2 py-1.5 text-xs max-w-[180px] bg-white"
                          value={u.role}
                          onChange={(e) => changeRole(u, e.target.value)}
                          title={meta.desc}
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                        <span className={`mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded border ${meta.color}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <span className="w-2 h-2 rounded-full bg-green-500" /> نشط
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <span className="w-2 h-2 rounded-full bg-slate-300" /> معطّل
                          </span>
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
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="font-medium text-slate-800 mb-3">دليل الأدوار السريع:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ROLES.map((r) => (
              <div
                key={r.value}
                className="flex items-start gap-2 p-2 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer"
                onClick={() => {
                  setShowMatrix(true)
                  setSelectedRoleForDetails(r.value)
                }}
              >
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded border ${r.color}`}>{r.label}</span>
                <p className="text-[11px] text-slate-500 leading-snug">{r.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            اضغط على أي دور لعرض مصفوفة الصلاحيات التفصيلية.
          </p>
        </div>
      </main>
    </div>
  )
}
