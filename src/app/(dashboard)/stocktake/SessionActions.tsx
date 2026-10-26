"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export function SessionActions({
  sessionId,
  title,
  titleAr,
  status,
  recordsCount,
}: {
  sessionId: string
  title: string
  titleAr?: string | null
  status: string
  recordsCount: number
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [titleValue, setTitleValue] = useState(titleAr || title)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/stocktake/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleValue, titleAr: titleValue }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "فشل التعديل")
      setEditing(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function cancelSession(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm("هل تريد إلغاء هذه الجلسة؟")) return
    setSaving(true)
    try {
      const res = await fetch(`/api/stocktake/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "فشل الإلغاء")
      router.refresh()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteSession(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const msg =
      recordsCount > 0
        ? `هذه الجلسة تحتوي على ${recordsCount} سجل عد.\nهل تريد حذف الجلسة وكل سجلاتها نهائياً؟`
        : "هل تريد حذف هذه الجلسة نهائياً؟"
    if (!confirm(msg)) return
    setSaving(true)
    try {
      const res = await fetch(`/api/stocktake/${sessionId}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "فشل الحذف")
      router.refresh()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={saveEdit}
        className="flex flex-wrap items-center gap-2 mt-2"
      >
        <input
          className="border rounded px-2 py-1 text-sm min-w-[180px]"
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={saving}
          className="text-xs bg-[#9B1B1E] text-white px-2 py-1 rounded"
        >
          حفظ
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs border px-2 py-1 rounded"
        >
          إلغاء
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </form>
    )
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled={saving}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setEditing(true)
        }}
        className="text-xs text-blue-700 border border-blue-200 px-2 py-1 rounded hover:bg-blue-50"
      >
        تعديل
      </button>
      {!["CANCELLED", "CLOSED", "APPROVED"].includes(status) && (
        <button
          type="button"
          disabled={saving}
          onClick={cancelSession}
          className="text-xs text-amber-700 border border-amber-200 px-2 py-1 rounded hover:bg-amber-50"
        >
          إلغاء الجلسة
        </button>
      )}
      {!["APPROVED", "CLOSED"].includes(status) && (
        <button
          type="button"
          disabled={saving}
          onClick={deleteSession}
          className="text-xs text-red-700 border border-red-200 px-2 py-1 rounded hover:bg-red-50"
        >
          حذف
        </button>
      )}
    </div>
  )
}
