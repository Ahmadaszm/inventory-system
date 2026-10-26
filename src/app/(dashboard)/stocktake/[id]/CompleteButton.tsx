"use client"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function CompleteSessionButton({ sessionId, status }: { sessionId: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  if (!["IN_PROGRESS", "COUNTING_COMPLETE", "UNDER_REVIEW"].includes(status)) return null

  async function complete() {
    if (!confirm("هل تريد إنهاء الجرد وترحيل النتائج؟ ستبقى السجلات ظاهرة في التقارير.")) return
    setLoading(true)
    try {
      const res = await fetch(`/api/stocktake/${sessionId}/complete`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "فشل")
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
      onClick={complete}
      disabled={loading}
      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
    >
      {loading ? "جاري..." : "إنهاء الجرد والترحيل"}
    </button>
  )
}
