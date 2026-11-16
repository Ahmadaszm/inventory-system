"use client"

import { useState, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { LinkBarcodePanel } from "./LinkBarcodePanel"
import { VoiceSearchButton } from "@/components/VoiceSearchButton"
import { OcrCodeReader } from "@/components/OcrCodeReader"

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
  const [qtyUnit, setQtyUnit] = useState<"PCS" | "KG">("PCS")
  const [countNote, setCountNote] = useState("")
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
  const [itemSearchQ, setItemSearchQ] = useState("")
  const [itemSearchResults, setItemSearchResults] = useState<any[]>([])
  const [itemSearching, setItemSearching] = useState(false)
  const itemSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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
        unit: r.unit || "PCS",
        mode: r.mode || "add",
        time: r.countedAt ? new Date(r.countedAt).toLocaleTimeString("ar-EG") : "",
        item: r.nameAr || r.sku || r.qr || "",
        sku: r.sku || "",
        countedBy: r.countedBy || "",
        totalForItem: r.totalForItem ?? r.qty,
        qtyPcs: r.qtyPcs ?? 0,
        qtyKg: r.qtyKg ?? 0,
      }))
      setHistory(rows)
    } catch {}
  }

  useEffect(() => {
    if (status === "authenticated" && sessionId) loadHistory()
  }, [status, sessionId])

  useEffect(() => {
    return () => { stopCamera() }
  }, [])

  function onItemSearch(q: string) {
    setItemSearchQ(q)
    if (itemSearchTimer.current) clearTimeout(itemSearchTimer.current)
    if (!q.trim()) {
      setItemSearchResults([])
      setItemSearching(false)
      return
    }
    setItemSearching(true)
    itemSearchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/items?q=${encodeURIComponent(q.trim())}`)
        const data = await res.json()
        setItemSearchResults(data.items || [])
      } catch {
        setItemSearchResults([])
      } finally {
        setItemSearching(false)
      }
    }, 200)
  }

  function pickItemFromSearch(it: any) {
    const code = String(it.sku || it.internalId || "").trim()
    setQrInput(code)
    setIdentifiedItem({ sku: it.sku, nameAr: it.nameAr, nameEn: it.nameEn, qrCode: code })
    setItemSearchQ("")
    setItemSearchResults([])
    setShowLinkPanel(false)
    if (it.uom && String(it.uom).toUpperCase().includes("KG")) setQtyUnit("KG")
    qtyRef.current?.focus()
  }

  async function handleOcrCodes(codes: string[]) {
    if (!codes.length) return
    for (const code of codes) {
      setQrInput(code)
      setIdentifying(true)
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrCode: code }),
        })
        const data = await res.json()
        if (data.status === "FOUND" && data.carton?.item) {
          setIdentifiedItem({
            sku: data.carton.item.sku,
            nameAr: data.carton.item.nameAr,
            nameEn: data.carton.item.nameEn,
            qrCode: data.carton.qrCode || code,
          })
          setIdentifying(false)
          qtyRef.current?.focus()
          return
        }
      } catch {}
      try {
        const res = await fetch(`/api/items?q=${encodeURIComponent(code)}`)
        const data = await res.json()
        const items = data.items || []
        if (items.length === 1) {
          const it = items[0]
          setIdentifiedItem({ sku: it.sku, nameAr: it.nameAr, nameEn: it.nameEn, qrCode: code })
          setQrInput(it.sku || code)
          setIdentifying(false)
          qtyRef.current?.focus()
          return
        }
        if (items.length > 1) {
          setItemSearchQ(code)
          setItemSearchResults(items)
          setIdentifying(false)
          return
        }
      } catch {}
    }
    setIdentifying(false)
    setIdentifiedItem(null)
    setQrInput(codes[0])
    setLinkBarcode(codes[0])
    setShowLinkPanel(true)
  }

  async function identifyBarcode(code: string) {
    const qrClean = code.replace(/[\r\n]+/g, " ").trim()
    if (!qrClean) { setIdentifiedItem(null); return }
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
      } else setIdentifiedItem(null)
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
    const notes = [countNote.trim(), qtyUnit === "KG" ? "وحدة: كجم" : ""].filter(Boolean).join(" | ")
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
          unit: qtyUnit,
          notes: notes || undefined,
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
      setCountNote("")
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
    if (h.unit === "KG") setQtyUnit("KG")
    setEditMode(true)
    identifyBarcode(h.qr)
    qtyRef.current?.focus()
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function deleteRecord(h: any) {
    const label = h.item || h.sku || h.qr || "هذا الصنف"
    if (!confirm(`هل تريد حذف «${label}» من الجرد؟`)) return
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
    const next = Math.max(0, Math.round(((isNaN(cur) ? 0 : cur) + delta) * 1000) / 1000)
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

  const quickQtys = qtyUnit === "KG" ? [0.5, 1, 2.5, 5, 10, 15, 25] : [1, 5, 10, 20, 50, 100]

  return (
    <div className="min-h-screen bg-slate-100 pb-28" dir="rtl">
      <header className="sticky top-0 z-20 bg-[#9B1B1E] text-white px-3 py-2.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2 min-w-0">
          <Link href={`/stocktake/${sessionId}`} className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/15 text-lg">→</Link>
          <div className="min-w-0">
            <h1 className="font-bold text-base leading-tight">شاشة العد</h1>
            <p className="text-[11px] text-white/70">{groups.length} صنف · {history.length} عملية</p>
          </div>
        </div>
        <button type="button" onClick={() => (cameraActive ? stopCamera() : startCamera())}
          className={`shrink-0 min-h-[44px] px-3 rounded-xl text-sm font-bold ${cameraActive ? "bg-white text-red-700" : "bg-emerald-500 text-white"}`}>
          {cameraActive ? "⏹ إيقاف" : "📷 كاميرا"}
        </button>
      </header>

      <main className="px-3 pt-3 max-w-lg mx-auto space-y-3">
        {(cameraActive || cameraError) && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {cameraError && <div className="bg-amber-50 text-amber-800 p-3 text-sm">{cameraError}</div>}
            <div id={scannerContainerId} className={cameraActive ? "block" : "hidden"} style={{ minHeight: cameraActive ? 240 : 0 }} />
            {cameraActive && (
              <div className="p-3 border-t bg-slate-50">
                <p className="text-xs text-slate-500 mb-2">للأرقام المطبوعة بالنقاط (مثل NA321210) استخدم القراءة البصرية</p>
                <OcrCodeReader onCodes={handleOcrCodes} />
              </div>
            )}
          </div>
        )}

        {!cameraActive && (
          <div className="bg-white rounded-2xl shadow-sm p-3">
            <OcrCodeReader onCodes={handleOcrCodes} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-3 space-y-3">
          {editMode && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm p-3 rounded-xl flex justify-between items-center">
              <span>وضع التعديل — استبدال الكمية</span>
              <button type="button" className="min-h-[40px] px-3 rounded-lg border border-amber-400 text-xs" onClick={() => { setEditMode(false); setQty("") }}>إلغاء</button>
            </div>
          )}

          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">بحث عن صنف (حرف أو رقم أو صوت)</label>
            <div className="flex items-start gap-2">
              <input value={itemSearchQ} onChange={(e) => onItemSearch(e.target.value)} placeholder="اكتب أو اضغط الميكروفون وتحدث..."
                className="flex-1 border-2 border-slate-300 rounded-xl px-3 py-2.5 text-base focus:border-[#9B1B1E] outline-none" dir="rtl" />
              <VoiceSearchButton onResult={(text) => onItemSearch(text)} lang="ar-SA" />
            </div>
            {itemSearching && <p className="text-xs text-slate-500 mt-1">جاري البحث...</p>}
            {itemSearchResults.length > 0 && (
              <ul className="mt-2 max-h-40 overflow-y-auto border rounded-xl divide-y bg-white">
                {itemSearchResults.map((it) => (
                  <li key={it.id}>
                    <button type="button" onClick={() => pickItemFromSearch(it)} className="w-full text-right px-3 py-2.5 hover:bg-emerald-50 text-sm min-h-[44px]">
                      <span className="font-medium block">{it.nameAr || it.nameEn}</span>
                      <span className="text-xs text-slate-500 font-mono" dir="ltr">{it.sku}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">الباركود / QR</label>
            <input ref={inputRef} type="text" value={qrInput}
              onChange={(e) => { setQrInput(e.target.value); setIdentifiedItem(null) }}
              onBlur={(e) => { if (e.target.value.trim()) identifyBarcode(e.target.value) }}
              placeholder="امسح أو اكتب الرمز..." className="w-full border-2 border-slate-200 rounded-xl px-3 py-3.5 text-base font-mono focus:border-[#9B1B1E] outline-none" dir="ltr" autoComplete="off" />
          </div>

          {identifying && <p className="text-xs text-slate-500">جاري التعرف...</p>}
          {identifiedItem && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3">
              <p className="text-xs font-bold text-emerald-700">✓ صنف معرّف</p>
              <p className="font-semibold text-emerald-950 mt-0.5">
                <span className="font-mono text-sm" dir="ltr">{identifiedItem.sku}</span>
                <span className="mx-1 text-emerald-600">—</span>
                {identifiedItem.nameAr}
              </p>
            </div>
          )}
          {!identifying && qrInput.trim() && !identifiedItem && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">غير معرّف — يمكنك الربط من الزر بالأسفل</p>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-blue-800">الكمية {!editMode && <span className="text-slate-400 font-normal">(إعادة المسح تجمع)</span>}</label>
              <div className="flex gap-1">
                <button type="button" onClick={() => setQtyUnit("PCS")} className={`text-xs px-2.5 py-1 rounded-full border ${qtyUnit === "PCS" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600"}`}>قطعة</button>
                <button type="button" onClick={() => setQtyUnit("KG")} className={`text-xs px-2.5 py-1 rounded-full border ${qtyUnit === "KG" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600"}`}>كجم / وزن</button>
              </div>
            </div>
            <div className="flex items-stretch gap-2">
              <button type="button" onClick={() => bumpQty(-1)} className="w-14 min-h-[52px] rounded-xl border-2 border-slate-200 bg-slate-50 text-2xl font-bold">−</button>
              <input ref={qtyRef} type="number" inputMode="decimal" step="any" min="0" value={qty} onChange={(e) => setQty(e.target.value)}
                placeholder={qtyUnit === "KG" ? "15.5" : "0"} className="flex-1 min-w-0 border-2 border-blue-300 rounded-xl px-2 py-3 text-center text-2xl font-bold outline-none" dir="ltr" required />
              <button type="button" onClick={() => bumpQty(1)} className="w-14 min-h-[52px] rounded-xl border-2 border-slate-200 bg-slate-50 text-2xl font-bold">+</button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quickQtys.map((n) => (
                <button key={n} type="button" onClick={() => setQty(String(n))} className="min-h-[36px] px-3 rounded-full border border-blue-200 bg-blue-50 text-blue-800 text-sm font-semibold">{n}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">ملاحظة: كرتون ناقص / شوال مفتوح...</label>
            <input value={countNote} onChange={(e) => setCountNote(e.target.value)} placeholder="للكرتون الناقص: أدخل عدد القطع الفعلي داخل الكرتونة" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
          </div>

          <button type="submit" disabled={loading} className="w-full min-h-[52px] rounded-xl bg-[#9B1B1E] text-white font-bold text-lg disabled:opacity-50">
            {loading ? "جاري التسجيل..." : "تسجيل العد"}
          </button>

          {qrInput.trim() && !identifiedItem && (
            <button type="button" onClick={() => { setLinkBarcode(qrInput.trim()); setShowLinkPanel(true) }}
              className="w-full min-h-[44px] rounded-xl border-2 border-[#9B1B1E] text-[#9B1B1E] font-semibold">
              تعريف / ربط هذا الباركود
            </button>
          )}

          {lastResult && (
            <div className={`rounded-xl p-3 text-sm font-medium ${okStatuses.includes(lastResult.status) ? "bg-emerald-50 text-emerald-900 border border-emerald-200" : lastResult.status === "ERROR" ? "bg-red-50 text-red-800 border border-red-200" : "bg-slate-50"}`}>
              {lastResult.status === "COUNTED" && "✓ تم التسجيل"}
              {lastResult.status === "UNKNOWN_COUNTED" && "✓ تم التسجيل (غير معرّف)"}
              {lastResult.status === "ACCUMULATED" && `✓ تم التجميع → ${lastResult.totalQty}`}
              {lastResult.status === "UPDATED" && (lastResult.message || `✓ تم التعديل → ${lastResult.totalQty}`)}
              {lastResult.status === "ERROR" && `خطأ: ${lastResult.message}`}
            </div>
          )}
        </form>

        {showLinkPanel && (
          <LinkBarcodePanel barcode={linkBarcode} onClose={() => setShowLinkPanel(false)}
            onLinked={(item) => {
              setShowLinkPanel(false)
              setIdentifiedItem({ sku: item.sku, nameAr: item.nameAr, nameEn: item.nameEn, qrCode: linkBarcode })
              setQrInput(item.sku || linkBarcode)
            }} />
        )}

        <div className="bg-white rounded-2xl shadow-sm p-3">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-bold text-slate-800">سجل الجرد</h2>
            <button type="button" onClick={loadHistory} className="text-sm text-[#9B1B1E]">تحديث</button>
          </div>
          {groups.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">لا توجد عمليات بعد</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {groups.map(([key, steps]) => {
                const h = steps[0]
                const totalLabel =
                  (h.qtyPcs > 0 && h.qtyKg > 0) ? `${h.qtyPcs} قطعة + ${h.qtyKg} كجم`
                  : h.qtyKg > 0 ? `${h.qtyKg} كجم`
                  : `${h.totalForItem ?? h.qty}`
                return (
                  <li key={key} className="border rounded-xl p-3 bg-slate-50">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{h.item}</p>
                        <p className="text-xs text-slate-500 font-mono" dir="ltr">{h.sku || h.qr}</p>
                        <p className="text-sm font-bold text-[#9B1B1E] mt-1">{totalLabel}</p>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button type="button" onClick={() => startEdit(h)} className="text-xs px-2 py-1 rounded-lg border bg-white">تعديل</button>
                        <button type="button" onClick={() => deleteRecord(h)} className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-700 bg-white">حذف</button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t shadow-lg px-3 py-2 flex gap-2 z-20" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        <button type="button" onClick={() => inputRef.current?.focus()} className="min-h-[48px] px-4 rounded-xl border-2 border-slate-200 font-semibold">مسح</button>
        <button type="button" disabled={loading} onClick={() => handleSubmit({ preventDefault() {} } as any)}
          className="flex-1 min-h-[48px] rounded-xl bg-[#9B1B1E] text-white font-bold disabled:opacity-50">تسجيل العد</button>
      </div>
    </div>
  )
}
