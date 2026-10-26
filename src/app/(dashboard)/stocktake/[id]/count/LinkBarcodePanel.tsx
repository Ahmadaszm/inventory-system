"use client"

import { useState } from "react"

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

  async function searchItems(q: string) {
    setSearchQ(q)
    if (!q.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/items?q=${encodeURIComponent(q.trim())}`)
      const data = await res.json()
      setSearchResults(data.items || [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
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
          <p className="text-xs font-mono text-slate-600 mt-1" dir="ltr">
            {barcode}
          </p>
          <p className="text-sm text-slate-600 mt-1">
            ابحث عن صنف لربط الباركود به، أو أضف اسماً جديداً يدوياً
          </p>
        </div>
        <button type="button" className="text-slate-400 text-sm" onClick={onClose}>
          إغلاق
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">بحث عن صنف موجود</label>
        <input
          type="text"
          value={searchQ}
          onChange={(e) => searchItems(e.target.value)}
          placeholder="اكتب الاسم أو رقم الصنف..."
          className="w-full border rounded-lg px-3 py-2"
        />
        {searching && <p className="text-xs text-slate-400 mt-1">جاري البحث...</p>}
        {searchResults.length > 0 && (
          <ul className="mt-2 border rounded-lg divide-y max-h-40 overflow-y-auto">
            {searchResults.map((it) => (
              <li
                key={it.id}
                className="px-3 py-2 flex justify-between items-center gap-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{it.nameAr}</div>
                  <div className="text-xs font-mono text-slate-500" dir="ltr">
                    {it.sku}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={linkLoading}
                  onClick={() => linkToItem(it.id)}
                  className="shrink-0 text-xs bg-[#9B1B1E] text-white px-2 py-1 rounded"
                >
                  ربط
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t pt-3 space-y-2">
        <p className="text-sm font-medium">أو إضافة صنف جديد يدوياً</p>
        <input
          type="text"
          value={newNameAr}
          onChange={(e) => setNewNameAr(e.target.value)}
          placeholder="اسم الصنف *"
          className="w-full border rounded-lg px-3 py-2"
        />
        <input
          type="text"
          value={newSku}
          onChange={(e) => setNewSku(e.target.value)}
          placeholder="رقم الصنف (اختياري)"
          className="w-full border rounded-lg px-3 py-2"
          dir="ltr"
        />
        <button
          type="button"
          disabled={linkLoading || !newNameAr.trim()}
          onClick={createAndLink}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-50"
        >
          {linkLoading ? "جاري الحفظ..." : "حفظ الصنف وربط الباركود"}
        </button>
      </div>

      {linkMsg && (
        <p className="text-sm text-center text-red-600 bg-red-50 p-2 rounded">{linkMsg}</p>
      )}
    </div>
  )
}
