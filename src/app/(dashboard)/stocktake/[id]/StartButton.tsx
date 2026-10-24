"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function StartStocktakeButton({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleStart() {
    if (!confirm("هل تريد بدء الجرد وتثبيت رصيد الدفاتر الآن؟")) return
    setLoading(true)
    try {
      const res = await fetch(`/api/stocktake/${sessionId}/start`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "فشل البدء")
      router.refresh()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleStart}
      disabled={loading}
      className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium disabled:opacity-50"
    >
      {loading ? "جاري البدء..." : "بدء الجرد وتثبيت الرصيد"}
    </button>
  )
}
