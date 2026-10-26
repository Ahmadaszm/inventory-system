"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export function ApproveSessionButton({
  sessionId,
  status,
  recordsCount,
}: {
  sessionId: string
  status: string
  recordsCount: number
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  if (["APPROVED", "CLOSED", "CANCELLED"].includes(status)) return null
  if (!["COUNTING_COMPLETE", "UNDER_REVIEW", "PENDING_APPROVAL", "IN_PROGRESS"].includes(status)) {
    return null
  }

  async function approve() {
    if (
      !confirm(
        `اعتماد جلسة الجرد؟\nعدد السجلات: ${recordsCount}\nبعد الاعتماد تُقفل الجلسة رسمياً في التقارير.`
      )
    )
      return
    setLoading(true)
    try {
      const res = await fetch(`/api/stocktake/${sessionId}/approve`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "فشل الاعتماد")
      router.refresh()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={approve}
      disabled={loading}
      className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
    >
      {loading ? "جاري الاعتماد..." : "✓ اعتماد الجلسة"}
    </button>
  )
}
