"use client"

import { useState, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { v4 as uuidv4 } from "uuid"

export default function CountPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string

  const [qrInput, setQrInput] = useState("")
  const [qty, setQty] = useState("")
  const [lastResult, setLastResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    inputRef.current?.focus()
  }, [lastResult])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!qrInput.trim()) return
    setLoading(true)
    setLastResult(null)

    const clientEventId = uuidv4()

    try {
      // First lookup the carton to get suggested qty
      let countedQty = qty ? parseFloat(qty) : undefined

      if (countedQty === undefined) {
        const lookup = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrCode: qrInput.trim() }),
        })
        const lookupData = await lookup.json()
        if (lookupData.status === "FOUND") {
          countedQty = lookupData.carton.quantity
        } else {
          countedQty = 0
        }
      }

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrCode: qrInput.trim(),
          sessionId,
          countedQty,
          clientEventId,
        }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "فشل التسجيل")

      setLastResult(data)
      setHistory((h) => [
        {
          qr: qrInput.trim(),
          status: data.status,
          qty: countedQty,
          time: new Date().toLocaleTimeString("ar-EG"),
          item: data.record?.item?.sku || data.record?.qrCodeScanned,
        },
        ...h.slice(0, 19),
      ])
      setQrInput("")
      setQty("")
    } catch (err: any) {
      setLastResult({ status: "ERROR", message: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100" dir="rtl">
      <header className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center">
        <div>
          <Link href={`/stocktake/${sessionId}`} className="text-sm text-slate-300 hover:text-white">
            ← رجوع للجلسة
          </Link>
          <h1 className="font-bold">شاشة العد والمسح</h1>
        </div>
        <div className="text-sm text-slate-400">
          {history.length} عملية
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-4">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">رمز QR</label>
            <input
              ref={inputRef}
              type="text"
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              placeholder="امسح أو اكتب الرمز..."
              className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-lg font-mono focus:border-blue-500 outline-none"
              dir="ltr"
              autoComplete="off"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              الكمية (اتركه فارغاً لاستخدام كمية الكرتون)
            </label>
            <input
              type="number"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              dir="ltr"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !qrInput.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 text-lg"
          >
            {loading ? "جاري التسجيل..." : "تسجيل العد"}
          </button>
        </form>

        {lastResult && (
          <div
            className={`rounded-xl p-4 border-2 ${
              lastResult.status === "COUNTED"
                ? "bg-green-50 border-green-300"
                : lastResult.status === "DUPLICATE"
                ? "bg-red-50 border-red-300"
                : lastResult.status === "UNKNOWN_OR_INACTIVE"
                ? "bg-amber-50 border-amber-300"
                : "bg-slate-50 border-slate-300"
            }`}
          >
            <p className="font-bold text-lg">
              {lastResult.status === "COUNTED" && "✓ تم التسجيل بنجاح"}
              {lastResult.status === "DUPLICATE" && "⚠ مكرر — لم يتم العد مرتين"}
              {lastResult.status === "UNKNOWN_OR_INACTIVE" && "⚠ رمز غير معروف أو غير نشط"}
              {lastResult.status === "ERROR" && `خطأ: ${lastResult.message}`}
              {lastResult.status === "ALREADY_SYNCED" && "تم مزامنته مسبقاً"}
            </p>
            {lastResult.record?.item && (
              <p className="mt-1 text-sm">
                {lastResult.record.item.sku} — {lastResult.record.item.nameAr}
              </p>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 font-medium text-sm border-b">
              سجل الجلسة الحالية
            </div>
            <ul className="divide-y max-h-64 overflow-y-auto">
              {history.map((h, i) => (
                <li key={i} className="px-4 py-2 text-sm flex justify-between">
                  <span className="font-mono truncate max-w-[140px]">{h.item || h.qr}</span>
                  <span className="font-bold">{h.qty}</span>
                  <span
                    className={
                      h.status === "COUNTED"
                        ? "text-green-600"
                        : h.status === "DUPLICATE"
                        ? "text-red-600"
                        : "text-amber-600"
                    }
                  >
                    {h.status === "COUNTED" ? "تم" : h.status === "DUPLICATE" ? "مكرر" : "؟"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}
