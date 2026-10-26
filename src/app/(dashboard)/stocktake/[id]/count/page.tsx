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

  // Group history by recordId for display
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
    <div className="min-h-screen bg-slate-100" dir="rtl">
      <header className="bg-[#9B1B1E] text-white px-4 py-3 flex justify-between items-center">
        <div>
          <Link href={`/stocktake/${sessionId}`} className="text-sm text-white/80 hover:text-white">
            ← رجوع للجلسة
          </Link>
          <h1 className="font-bold">شاشة العد والمسح</h1>
        </div>
        <div className="text-sm text-white/70">{groups.length} صنف</div>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-4">
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          {!cameraActive ? (
            <button type="button" onClick={startCamera} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg">
              📷 تشغيل الكاميرا
            </button>
          ) : (
            <button type="button" onClick={stopCamera} className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-lg">
              ⏹ إيقاف الكاميرا
            </button>
          )}

          {cameraError && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm">{cameraError}</div>
          )}

          <div id={scannerContainerId} className={`overflow-hidden rounded-xl ${cameraActive ? "block" : "hidden"}`} style={{ minHeight: cameraActive ? 260 : 0 }} />

          {editMode && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm p-3 rounded-lg flex justify-between items-center">
              <span>وضع التعديل: سيتم استبدال الكمية الإجمالية</span>
              <button type="button" className="text-xs underline" onClick={() => { setEditMode(false); setQty("") }}>إلغاء</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">الباركود / QR</label>
              <input
                ref={inputRef}
                type="text"
                value={qrInput}
                onChange={(e) => { setQrInput(e.target.value); setIdentifiedItem(null) }}
                onBlur={(e) => { if (e.target.value.trim()) identifyBarcode(e.target.value) }}
                placeholder="امسح بالكاميرا أو اكتب الرمز..."
                className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-lg font-mono focus:border-[#9B1B1E] outline-none"
                dir="ltr"
                autoComplete="off"
              />
            </div>

            {identifying && <p className="text-xs text-slate-500">جاري التعرف على الصنف...</p>}
            {identifiedItem && (
              <div className="bg-emerald-50 border-2 border-emerald-400 rounded-lg p-3">
                <p className="font-bold text-emerald-800 text-sm">✓ صنف معرّف</p>
                <p className="text-emerald-950 mt-1 font-medium">
                  <span className="font-mono text-sm" dir="ltr">{identifiedItem.sku}</span>
                  <span className="mx-1">—</span>
                  {identifiedItem.nameAr}
                </p>
              </div>
            )}
            {!identifying && qrInput.trim() && !identifiedItem && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                لم يُعثر على صنف مرتبط — استخدم «تعريف / ربط» أدناه
              </p>
            )}

            <div>
              <label className="block text-sm font-medium mb-1 text-blue-800">
                الكمية (يدوياً — إلزامي)
                {!editMode && <span className="text-xs text-slate-500 font-normal mr-2">— إعادة المسح تجمع الكميات</span>}
              </label>
              <input
                ref={qtyRef}
                type="number"
                step="any"
                min="0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="مثال: 20"
                className="w-full border-2 border-blue-300 rounded-lg px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                dir="ltr"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !qrInput.trim() || qty === ""}
              className="w-full bg-[#9B1B1E] hover:bg-[#7f1518] text-white font-bold py-3 rounded-lg disabled:opacity-50 text-lg"
            >
              {loading ? "جاري التسجيل..." : editMode ? "حفظ الكمية المعدّلة" : "تسجيل العد"}
            </button>
            {qrInput.trim() && (
              <button
                type="button"
                onClick={() => { setLinkBarcode(qrInput.trim()); setShowLinkPanel(true) }}
                className="w-full border border-[#9B1B1E] text-[#9B1B1E] font-medium py-2.5 rounded-lg text-sm"
              >
                تعريف / ربط هذا الباركود بصنف
              </button>
            )}
          </form>
        </div>

        {lastResult && (
          <div className={`rounded-xl p-4 border-2 ${
            okStatuses.includes(lastResult.status)
              ? "bg-green-50 border-green-300"
              : lastResult.status === "ERROR"
              ? "bg-red-50 border-red-300"
              : "bg-slate-50 border-slate-300"
          }`}>
            <p className="font-bold text-lg">
              {lastResult.status === "COUNTED" && "✓ تم التسجيل بنجاح"}
              {lastResult.status === "UNKNOWN_COUNTED" && "✓ تم تسجيل العد (صنف غير معرّف)"}
              {lastResult.status === "ACCUMULATED" && `✓ تم التجميع: ${lastResult.previousQty} + ${lastResult.addedQty} = ${lastResult.totalQty}`}
              {lastResult.status === "UPDATED" && `✓ تم تعديل الكمية إلى ${lastResult.totalQty}`}
              {lastResult.status === "ERROR" && `خطأ: ${lastResult.message}`}
            </p>
            {lastResult.record?.item && (
              <p className="mt-1 text-sm">{lastResult.record.item.sku} — {lastResult.record.item.nameAr}</p>
            )}
          </div>
        )}

        {showLinkPanel && linkBarcode && (
          <LinkBarcodePanel
            barcode={linkBarcode}
            onClose={() => setShowLinkPanel(false)}
            onLinked={(item) => {
              setShowLinkPanel(false)
              setIdentifiedItem({ sku: item.sku, nameAr: item.nameAr, nameEn: item.nameEn, qrCode: linkBarcode })
              setLastResult({ status: "COUNTED", record: { qrCodeScanned: linkBarcode, item } })
              loadHistory()
            }}
          />
        )}

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 font-medium text-sm border-b flex justify-between items-center">
            <span>تفاصيل عمليات الجرد — كل عملية + المجموع</span>
            <button type="button" onClick={loadHistory} className="text-xs text-blue-600">تحديث</button>
          </div>
          {groups.length === 0 ? (
            <p className="p-6 text-center text-slate-400 text-sm">لا توجد سجلات بعد</p>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto">
              {groups.map(([key, rows]) => {
                const total = rows[0].totalForItem ?? rows.reduce((s: number, r: any) => s + Number(r.qty || 0), 0)
                const title = rows[0].item || rows[0].sku || rows[0].qr || key
                const sku = rows[0].sku || rows[0].qr || ""
                const ordered = [...rows].reverse()
                return (
                  <div key={key} className="border-b last:border-0">
                    <div className="px-4 py-2 bg-slate-100 flex items-center justify-between gap-2 sticky top-0">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug">{title}</p>
                        <p className="text-xs font-mono text-slate-500" dir="ltr">{sku}</p>
                      </div>
                      <div className="text-left shrink-0">
                        <p className="text-[11px] text-slate-500">المجموع</p>
                        <p className="text-lg font-bold text-blue-800">{total}</p>
                      </div>
                    </div>
                    <ul>
                      {ordered.map((h: any, i: number) => (
                        <li key={h.id || i} className="px-4 py-2 text-sm flex items-center justify-between gap-2 border-t border-slate-50 bg-white">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <span className="text-slate-400">عملية {i + 1}</span>
                            <span>{h.time}</span>
                            {h.countedBy && <span>{h.countedBy}</span>}
                            <span className={h.status === "UNKNOWN_COUNTED" ? "text-amber-600" : "text-green-600"}>
                              {h.mode === "replace" ? "تعديل" : h.status === "UNKNOWN_COUNTED" ? "غير معرّف" : "عدّ"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-blue-700">
                              {h.mode === "replace" ? "=" : "+"}{h.qty}
                            </span>
                            {i === ordered.length - 1 && (
                              <button
                                type="button"
                                onClick={() => startEdit(h)}
                                className="text-[11px] text-[#9B1B1E] border border-[#9B1B1E]/40 px-2 py-0.5 rounded hover:bg-red-50"
                              >
                                تعديل المجموع
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
    </div>
  )
}
