"use client"

import { useState, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { LinkBarcodePanel } from "./LinkBarcodePanel"

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
  const [editMode, setEditMode] = useState(false)
  const [showLinkPanel, setShowLinkPanel] = useState(false)
  const [linkBarcode, setLinkBarcode] = useState("")
  const [identifiedItem, setIdentifiedItem] = useState<any>(null)
  const [identifying, setIdentifying] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)
  const scannerRef = useRef<any>(null)
  const scannerContainerId = "qr-reader-count"

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  async function loadHistory() {
    try {
      const res = await fetch(`/api/stocktake/${sessionId}/records`)
      if (!res.ok) return
      const data = await res.json()
      const rows = (data.records || []).map((r: any) => ({
        id: r.id,
        recordId: r.recordId,
        qr: r.qr || "",
        status: r.isUnknown ? "UNKNOWN_COUNTED" : "COUNTED",
        qty: r.qty,
        mode: r.mode || "add",
        time: r.countedAt ? new Date(r.countedAt).toLocaleTimeString("ar-EG") : "",
        item: r.nameAr || r.sku || r.qr || "",
        sku: r.sku || "",
        countedBy: r.countedBy || "",
        totalForItem: r.totalForItem ?? r.qty,
      }))
      setHistory(rows)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (status === "authenticated" && sessionId) loadHistory()
  }, [status, sessionId])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  async function identifyBarcode(code: string) {
    const qrClean = code.replace(/[\r\n]+/g, " ").trim()
    if (!qrClean) {
      setIdentifiedItem(null)
      return
    }
    setIdentifying(true)
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCode: qrClean }),
      })
      const data = await res.json()
      if (data.status === "FOUND" && data.carton?.item) {
        setIdentifiedItem({
          sku: data.carton.item.sku,
          nameAr: data.carton.item.nameAr,
          nameEn: data.carton.item.nameEn,
          qrCode: data.carton.qrCode || qrClean,
        })
      } else {
        setIdentifiedItem(null)
      }
    } catch {
      setIdentifiedItem(null)
    } finally {
      setIdentifying(false)
    }
  }

  async function submitCount(code: string, countedQty: number, mode: "add" | "replace" = "add") {
    if (!code.trim() || loading) return
    setLoading(true)
    setLastResult(null)
    const clientEventId = uuid()
    const qrClean = code.replace(/[\r\n]+/g, " ").trim()
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrCode: qrClean,
          sessionId,
          countedQty,
          clientEventId,
          mode,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "فشل التسجيل")
      setLastResult(data)
      if (data.status === "UNKNOWN_COUNTED" || data.record?.isUnknownQr) {
        setLinkBarcode(qrClean)
        setShowLinkPanel(true)
        setIdentifiedItem(null)
      }
      if (data.record?.item) {
        setIdentifiedItem({
          sku: data.record.item.sku,
          nameAr: data.record.item.nameAr,
          nameEn: data.record.item.nameEn,
          qrCode: qrClean,
        })
      }
      setQrInput("")
      setQty("")
      setEditMode(false)
      inputRef.current?.focus()
      await loadHistory()
    } catch (err: any) {
      setLastResult({ status: "ERROR", message: err.message })
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!qrInput.trim()) {
      setLastResult({ status: "ERROR", message: "امسح أو أدخل الباركود أولاً" })
      return
    }
    if (qty === "" || isNaN(parseFloat(qty)) || parseFloat(qty) < 0) {
      setLastResult({ status: "ERROR", message: "أدخل الكمية يدوياً قبل تسجيل العد" })
      qtyRef.current?.focus()
      return
    }
    await submitCount(qrInput, parseFloat(qty), editMode ? "replace" : "add")
  }

  function startEdit(h: any) {
    setQrInput(h.qr)
    setQty(String(h.totalForItem ?? h.qty))
    setEditMode(true)
    identifyBarcode(h.qr)
    qtyRef.current?.focus()
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function deleteRecord(h: any) {
    const label = h.item || h.sku || h.qr || "هذا الصنف"
    if (!confirm(`هل تريد حذف «${label}» من الجرد؟\nالكمية المحذوفة: ${h.totalForItem ?? h.qty}`)) return
    try {
      const res = await fetch(
        `/api/stocktake/${sessionId}/records?recordId=${encodeURIComponent(h.recordId || h.id)}`,
        { method: "DELETE" }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "فشل الحذف")
      setLastResult({ status: "UPDATED", message: "تم الحذف" })
      await loadHistory()
    } catch (e: any) {
      setLastResult({ status: "ERROR", message: e.message })
    }
  }

  function bumpQty(delta: number) {
    const cur = parseFloat(qty || "0")
    const next = Math.max(0, (isNaN(cur) ? 0 : cur) + delta)
    setQty(String(next))
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
        { fps: 8, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        (decodedText) => {
          const code = decodedText.replace(/[\r\n]+/g, " ").trim()
          setQrInput(code)
          identifyBarcode(code)
          if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(80)
          qtyRef.current?.focus()
        },
        () => {}
      )
    } catch (err: any) {
      setCameraError(
        err?.name === "NotAllowedError"
          ? "يرجى السماح بالوصول إلى الكاميرا من إعدادات المتصفح"
          : "تعذر تشغيل الكاميرا"
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

  const okStatuses = ["COUNTED", "UNKNOWN_COUNTED", "ACCUMULATED", "UPDATED"]

  const groups = (() => {
    const map = new Map<string, any[]>()
    for (const h of history) {
      const key = h.recordId || h.qr || h.sku || h.id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(h)
    }
    return Array.from(map.entries())
  })()

  return (
    <div className="min-h-screen bg-slate-100 pb-28" dir="rtl">
      {/* Compact sticky header */}
      <header className="sticky top-0 z-20 bg-[#9B1B1E] text-white px-3 py-2.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href={`/stocktake/${sessionId}`}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/15 active:bg-white/25 text-lg"
            aria-label="رجوع"
          >
            →
          </Link>
          <div className="min-w-0">
            <h1 className="font-bold text-base leading-tight truncate">شاشة العد</h1>
            <p className="text-[11px] text-white/70">{groups.length} صنف · {history.length} عملية</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => (cameraActive ? stopCamera() : startCamera())}
          className={`shrink-0 min-h-[44px] px-3 rounded-xl text-sm font-bold ${
            cameraActive
              ? "bg-white text-red-700"
              : "bg-emerald-500 text-white active:bg-emerald-600"
          }`}
        >
          {cameraActive ? "⏹ إيقاف" : "📷 كاميرا"}
        </button>
      </header>

      <main className="px-3 pt-3 max-w-lg mx-auto space-y-3">
        {/* Camera preview */}
        {(cameraActive || cameraError) && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {cameraError && (
              <div className="bg-amber-50 text-amber-800 p-3 text-sm">{cameraError}</div>
            )}
            <div
              id={scannerContainerId}
              className={cameraActive ? "block" : "hidden"}
              style={{ minHeight: cameraActive ? 240 : 0 }}
            />
          </div>
        )}

        {/* Scan form card */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-3 space-y-3">
          {editMode && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm p-3 rounded-xl flex justify-between items-center gap-2">
              <span>وضع التعديل — استبدال الكمية الإجمالية</span>
              <button
                type="button"
                className="min-h-[40px] px-3 rounded-lg border border-amber-400 text-xs font-medium"
                onClick={() => {
                  setEditMode(false)
                  setQty("")
                }}
              >
                إلغاء
              </button>
            </div>
          )}

          {/* Barcode */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">الباركود / QR</label>
            <input
              ref={inputRef}
              type="text"
              inputMode="text"
              value={qrInput}
              onChange={(e) => {
                setQrInput(e.target.value)
                setIdentifiedItem(null)
              }}
              onBlur={(e) => {
                if (e.target.value.trim()) identifyBarcode(e.target.value)
              }}
              placeholder="امسح أو اكتب الرمز..."
              className="w-full border-2 border-slate-200 rounded-xl px-3 py-3.5 text-base font-mono focus:border-[#9B1B1E] outline-none"
              dir="ltr"
              autoComplete="off"
            />
          </div>

          {/* Item identity */}
          {identifying && <p className="text-xs text-slate-500">جاري التعرف...</p>}
          {identifiedItem && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3">
              <p className="text-xs font-bold text-emerald-700">✓ صنف معرّف</p>
              <p className="font-semibold text-emerald-950 mt-0.5 leading-snug">
                <span className="font-mono text-sm" dir="ltr">
                  {identifiedItem.sku}
                </span>
                <span className="mx-1 text-emerald-600">—</span>
                {identifiedItem.nameAr}
              </p>
            </div>
          )}
          {!identifying && qrInput.trim() && !identifiedItem && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              غير معرّف — يمكنك الربط من الزر بالأسفل
            </p>
          )}

          {/* Quantity with stepper */}
          <div>
            <label className="block text-xs font-semibold text-blue-800 mb-1.5">
              الكمية {!editMode && <span className="text-slate-400 font-normal">(إعادة المسح تجمع)</span>}
            </label>
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => bumpQty(-1)}
                className="w-14 min-h-[52px] rounded-xl border-2 border-slate-200 bg-slate-50 text-2xl font-bold text-slate-700 active:bg-slate-200"
                aria-label="إنقاص"
              >
                −
              </button>
              <input
                ref={qtyRef}
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0"
                className="flex-1 min-w-0 border-2 border-blue-300 rounded-xl px-2 py-3 text-center text-2xl font-bold focus:ring-2 focus:ring-blue-400 outline-none"
                dir="ltr"
                required
              />
              <button
                type="button"
                onClick={() => bumpQty(1)}
                className="w-14 min-h-[52px] rounded-xl border-2 border-slate-200 bg-slate-50 text-2xl font-bold text-slate-700 active:bg-slate-200"
                aria-label="زيادة"
              >
                +
              </button>
            </div>
            {/* Quick qty chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[1, 5, 10, 20, 50].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQty(String(n))}
                  className="min-h-[36px] px-3 rounded-full border border-blue-200 bg-blue-50 text-blue-800 text-sm font-semibold active:bg-blue-100"
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {qrInput.trim() && (
            <button
              type="button"
              onClick={() => {
                setLinkBarcode(qrInput.trim())
                setShowLinkPanel(true)
              }}
              className="w-full min-h-[44px] border border-[#9B1B1E]/40 text-[#9B1B1E] font-medium rounded-xl text-sm active:bg-red-50"
            >
              تعريف / ربط هذا الباركود
            </button>
          )}
        </form>

        {/* Result toast */}
        {lastResult && (
          <div
            className={`rounded-2xl p-3.5 border-2 ${
              okStatuses.includes(lastResult.status)
                ? "bg-green-50 border-green-300"
                : lastResult.status === "ERROR"
                ? "bg-red-50 border-red-300"
                : "bg-slate-50 border-slate-300"
            }`}
          >
            <p className="font-bold text-base">
              {lastResult.status === "COUNTED" && "✓ تم التسجيل"}
              {lastResult.status === "UNKNOWN_COUNTED" && "✓ تم التسجيل (غير معرّف)"}
              {lastResult.status === "ACCUMULATED" &&
                `✓ تجميع: ${lastResult.previousQty} + ${lastResult.addedQty} = ${lastResult.totalQty}`}
              {lastResult.status === "UPDATED" &&
                (lastResult.message || `✓ تم التعديل → ${lastResult.totalQty}`)}
              {lastResult.status === "ERROR" && `خطأ: ${lastResult.message}`}
            </p>
            {lastResult.record?.item && (
              <p className="mt-1 text-sm text-slate-700">
                {lastResult.record.item.sku} — {lastResult.record.item.nameAr}
              </p>
            )}
          </div>
        )}

        {showLinkPanel && linkBarcode && (
          <LinkBarcodePanel
            barcode={linkBarcode}
            onClose={() => setShowLinkPanel(false)}
            onLinked={(item) => {
              setShowLinkPanel(false)
              setIdentifiedItem({
                sku: item.sku,
                nameAr: item.nameAr,
                nameEn: item.nameEn,
                qrCode: linkBarcode,
              })
              setLastResult({ status: "COUNTED", record: { qrCodeScanned: linkBarcode, item } })
              loadHistory()
            }}
          />
        )}

        {/* History */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-3 py-2.5 bg-slate-50 font-semibold text-sm border-b flex justify-between items-center">
            <span>سجل الجرد</span>
            <button type="button" onClick={loadHistory} className="text-xs text-blue-600 min-h-[36px] px-2">
              تحديث
            </button>
          </div>
          {groups.length === 0 ? (
            <p className="p-8 text-center text-slate-400 text-sm">لا توجد سجلات بعد</p>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto">
              {groups.map(([key, rows]) => {
                const total =
                  rows[0].totalForItem ??
                  rows.reduce((s: number, r: any) => s + Number(r.qty || 0), 0)
                const title = rows[0].item || rows[0].sku || rows[0].qr || key
                const sku = rows[0].sku || rows[0].qr || ""
                const ordered = [...rows].reverse()
                return (
                  <div key={key} className="border-b last:border-0">
                    <div className="px-3 py-2.5 bg-slate-50/80 flex items-start justify-between gap-2 sticky top-0">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug">{title}</p>
                        <p className="text-[11px] font-mono text-slate-500" dir="ltr">
                          {sku}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-left">
                          <p className="text-[10px] text-slate-500">المجموع</p>
                          <p className="text-lg font-bold text-blue-800 leading-none">{total}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteRecord(rows[0])}
                          className="min-h-[40px] min-w-[40px] text-xs text-red-700 border border-red-200 rounded-lg px-2 active:bg-red-50"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                    <ul>
                      {ordered.map((h: any, i: number) => (
                        <li
                          key={h.id || i}
                          className="px-3 py-2.5 flex items-center justify-between gap-2 border-t border-slate-100"
                        >
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
                            <span className="text-slate-400">#{i + 1}</span>
                            <span>{h.time}</span>
                            <span
                              className={
                                h.status === "UNKNOWN_COUNTED" ? "text-amber-600" : "text-green-600"
                              }
                            >
                              {h.mode === "replace"
                                ? "تعديل"
                                : h.status === "UNKNOWN_COUNTED"
                                ? "غير معرّف"
                                : "عدّ"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-blue-700 text-sm">
                              {h.mode === "replace" ? "=" : "+"}
                              {h.qty}
                            </span>
                            {i === ordered.length - 1 && (
                              <button
                                type="button"
                                onClick={() => startEdit(h)}
                                className="min-h-[36px] text-[11px] text-[#9B1B1E] border border-[#9B1B1E]/30 px-2 rounded-lg active:bg-red-50"
                              >
                                تعديل
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto flex gap-2">
          <button
            type="button"
            onClick={() => {
              setQrInput("")
              setQty("")
              setEditMode(false)
              setIdentifiedItem(null)
              setLastResult(null)
              inputRef.current?.focus()
            }}
            className="min-h-[52px] px-4 rounded-xl border-2 border-slate-200 text-slate-700 font-semibold text-sm active:bg-slate-50"
          >
            مسح
          </button>
          <button
            type="button"
            disabled={loading || !qrInput.trim() || qty === ""}
            onClick={(e) => handleSubmit(e as any)}
            className="flex-1 min-h-[52px] rounded-xl bg-[#9B1B1E] text-white font-bold text-lg disabled:opacity-40 active:bg-[#7f1518]"
          >
            {loading ? "جاري..." : editMode ? "حفظ التعديل" : "تسجيل العد"}
          </button>
        </div>
      </div>
    </div>
  )
}
