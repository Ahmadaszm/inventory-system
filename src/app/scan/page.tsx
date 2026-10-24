"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function ScanPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [qrInput, setQrInput] = useState("")
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleScan(e?: React.FormEvent) {
    e?.preventDefault()
    if (!qrInput.trim()) return
    setLoading(true)
    setError("")
    setResult(null)
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCode: qrInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Scan failed")
      setResult(data)
      setQrInput("")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  if (status === "loading") return <div className="p-8 text-center">Loading...</div>

  return (
    <div className="min-h-screen bg-slate-100 p-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-4">
          <h1 className="text-xl font-bold mb-1">محطة مسح QR / QR Scanning Station</h1>
          <p className="text-sm text-slate-500 mb-4">
            استخدم الماسح الضوئي أو الكاميرا أو أدخل الرمز يدوياً
          </p>

          <form onSubmit={handleScan} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              placeholder="Scan or type QR code..."
              className="flex-1 border border-slate-300 rounded-lg px-4 py-3 text-lg font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              dir="ltr"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={loading || !qrInput.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? "..." : "Scan"}
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-4">
            {error}
          </div>
        )}

        {result?.status === "UNKNOWN" && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl mb-4">
            <p className="font-bold">Unknown QR Code</p>
            <p>رمز QR غير معروف — غير مسجل في النظام</p>
          </div>
        )}

        {result?.status === "FOUND" && result.carton && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm text-slate-500">SKU</p>
                <p className="text-2xl font-bold font-mono">{result.carton.item.sku}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                result.carton.status === "AVAILABLE" ? "bg-green-100 text-green-800" : "bg-slate-100"
              }`}>
                {result.carton.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">الاسم (EN)</p>
                <p className="font-medium">{result.carton.item.nameEn}</p>
              </div>
              <div>
                <p className="text-slate-500">الاسم (AR)</p>
                <p className="font-medium">{result.carton.item.nameAr}</p>
              </div>
              <div>
                <p className="text-slate-500">Carton #</p>
                <p className="font-mono">{result.carton.cartonNumber}</p>
              </div>
              <div>
                <p className="text-slate-500">QR</p>
                <p className="font-mono text-xs break-all">{result.carton.qrCode}</p>
              </div>
              <div>
                <p className="text-slate-500">Quantity</p>
                <p className="text-xl font-bold text-blue-700">
                  {result.carton.quantity} / {result.carton.originalQty} {result.carton.item.uom}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Batch / Source</p>
                <p className="font-medium">
                  {result.carton.batch.batchNumber} ({result.carton.batch.sourceType})
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-500">Location</p>
                <p className="font-medium">
                  {result.carton.location
                    ? `${result.carton.location.warehouse} → ${result.carton.location.code}`
                    : "Unassigned"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
