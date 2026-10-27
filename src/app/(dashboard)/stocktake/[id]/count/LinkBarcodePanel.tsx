"use client"

import { useEffect, useRef, useState } from "react"

export function LinkBarcodePanel({
  barcode,
  onClose,
  onLinked,
}: {
  barcode: string
  onClose: () => void
  onLinked: (item: any) => void
}) {
  const [searchQ, setSearchQ] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [newNameAr, setNewNameAr] = useState("")
  const [newSku, setNewSku] = useState("")
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkMsg, setLinkMsg] = useState("")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  function onSearchChange(q: string) {
    setSearchQ(q)
    if (timer.current) clearTimeout(timer.current)
    if (!q.trim()) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/items?q=${encodeURIComponent(q.trim())}`)
        const data = await res.json()
        setSearchResults(data.items || [])
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
  }

  async function linkToItem(itemId: string) {
    setLinkLoading(true)
    setLinkMsg("")
    try {
      const res = await fetch("/api/items/link-barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCode: barcode, itemId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "فشل الربط")
      onLinked(data.item)
    } catch (e: any) {
      setLinkMsg(e.message)
    } finally {
      setLinkLoading(false)
    }
  }

  async function createAndLink() {
    if (!newNameAr.trim()) {
      setLinkMsg("أدخل اسم الصنف")
      return
    }
    setLinkLoading(true)
    setLinkMsg("")
    try {
      const res = await fetch("/api/items/link-barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrCode: barcode,
          nameAr: newNameAr.trim(),
          sku: newSku.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "فشل الإضافة")
      onLinked(data.item)
    } catch (e: any) {
      setLinkMsg(e.message)
    } finally {
      setLinkLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow border-2 border-amber-300 p-4 space-y-4">
      <div className="flex justify-between items-start gap-2">
        <div>
          <h3 className="font-bold text-amber-900">باركود غير موجود في النظام</h3>
          <p className="text-xs font-mono text-amber-800 mt-0.5 break-all" dir="ltr">
            {barcode}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            ابحث عن صنف لربط الباركود به، أو أضف اسماً جديداً يدوياً
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-slate-500 text-sm hover:text-slate-800">
          إغلاق
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">بحث عن صنف موجود</label>
        <input
          value={searchQ}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="اكتب الاسم أو رقم الصنف..."
          className="w-full border rounded-lg px-3 py-2.5 text-base"
          autoFocus
          dir="rtl"
        />
        {searching && <p className="text-xs text-slate-500 mt-1">جاري البحث...</p>}
        {searchResults.length > 0 && (
          <ul className="mt-2 max-h-48 overflow-y-auto border rounded-lg divide-y bg-slate-50">
            {searchResults.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  disabled={linkLoading}
                  onClick={() => linkToItem(it.id)}
                  className="w-full text-right px-3 py-2.5 hover:bg-emerald-50 text-sm"
                >
                  <span className="font-medium">{it.nameAr || it.nameEn}</span>
                  <span className="text-slate-500 mr-2 font-mono text-xs" dir="ltr">
                    {it.sku}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!searching && searchQ.trim() && searchResults.length === 0 && (
          <p className="text-xs text-amber-700 mt-1">لا نتائج — جرّب كلمات أقل أو أضف صنفاً جديداً</p>
        )}
      </div>

      <div className="border-t pt-3 space-y-2">
        <p className="text-sm font-medium">أو إضافة صنف جديد يدوياً</p>
        <input
          value={newNameAr}
          onChange={(e) => setNewNameAr(e.target.value)}
          placeholder="اسم الصنف *"
          className="w-full border rounded-lg px-3 py-2.5"
        />
        <input
          value={newSku}
          onChange={(e) => setNewSku(e.target.value)}
          placeholder="رقم الصنف (اختياري)"
          className="w-full border rounded-lg px-3 py-2.5"
          dir="ltr"
        />
        <button
          type="button"
          onClick={createAndLink}
          disabled={linkLoading}
          className="w-full min-h-[44px] rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold disabled:opacity-50"
        >
          {linkLoading ? "جاري..." : "حفظ الصنف وربط الباركود"}
        </button>
      </div>

      {linkMsg && <p className="text-sm text-red-600">{linkMsg}</p>}
    </div>
  )
}
