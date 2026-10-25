"use client"

import { useState, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export default function CountPage() {
  const { status } = useSession()
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string

  const [qrInput, setQrInput] = useState("")
  const [qty, setQty] = useState("")
  const [lastResult, setLastResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const scannerRef = useRef<any>(null)
  const scannerContainerId = "qr-reader-count"

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    inputRef.current?.focus()
  }, [lastResult])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  async function submitCount(code: string, countedQty?: number) {
    if (!code.trim() || loading) return
    setLoading(true)
    setLastResult(null)

    const clientEventId = uuid()

    try {
      let finalQty = countedQty
      if (finalQty === undefined && qty) {
        finalQty = parseFloat(qty)
      }

      if (finalQty === undefined) {
        const lookup = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrCode: code.trim() }),
        })
        const lookupData = await lookup.json()
        finalQty = lookupData.status === "FOUND" ? lookupData.carton.quantity : 0
      }

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrCode: code.trim(),
          sessionId,
          countedQty: finalQty,
          clientEventId,
        }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "فشل التسجيل")

      setLastResult(data)
      setHistory((h) => [
        {
          qr: code.trim(),
          status: data.status,
          qty: finalQty,
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submitCount(qrInput)
  }

  async function startCamera() {
    setCameraError("")
    setCameraActive(true)
    try {
      const { Html5Qrcode } = await import("html5-qrcode")
      const scanner = new Html5Qrcode(scannerContainerId)
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        async (decodedText) => {
          setQrInput(decodedText)
          await submitCount(decodedText)
        },
        () => {}
      )
    } catch (err: any) {
      setCameraError(
        err?.name === "NotAllowedError"
          ? "يرجى السماح بالوصول إلى الكاميرا من إعدادات المتصفح"
          : "تعذر تشغيل الكاميرا. تأكد من وجود كاميرا وأن الصفحة على HTTPS"
      )
      setCameraActive(false)
    }
  }

  async function stopCamera() {
    try {
      if (scannerRef.current) {
        const state = scannerRef.current.getState?.()
        if (state === 2 || state === 3) await scannerRef.current.stop()
        scannerRef.current.clear?.()
        scannerRef.current = null
      }
    } catch {}
    setCameraActive(false)
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
        <div className="text-sm text-slate-400">{history.length} عملية</div>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-4">
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          {!cameraActive ? (
            <button
              type="button"
              onClick={startCamera}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg"
            >
              📷 تشغيل الكاميرا
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-lg"
            >
              ⏹ إيقاف الكاميرا
            </button>
          )}

          {cameraError && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm">
              {cameraError}
            </div>
          )}

          <div
            id={scannerContainerId}
            className={`overflow-hidden rounded-xl ${cameraActive ? "block" : "hidden"}`}
            style={{ minHeight: cameraActive ? 260 : 0 }}
          />

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">رمز QR / الباركود</label>
              <input
                ref={inputRef}
                type="text"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="امسح بالكاميرا أو اكتب الرمز..."
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
        </div>

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
                <li key={i} className="px-4 py-2 text-sm flex justify-between gap-2">
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
