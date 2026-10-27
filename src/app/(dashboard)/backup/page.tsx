"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useEffect, useState, useRef } from "react"

export default function BackupPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [preview, setPreview] = useState<any>(null)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const user = session?.user as any
  const canBackup =
    user?.role === "SYSTEM_ADMIN" || user?.role === "INVENTORY_MANAGER"
  const canRestore = user?.role === "SYSTEM_ADMIN"

  async function downloadBackup() {
    setExporting(true)
    setMessage(null)
    try {
      const res = await fetch("/api/backup?format=download")
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "فشل التصدير")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `zmzm-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMessage({ type: "ok", text: "تم تنزيل النسخة الاحتياطية بنجاح. احفظ الملف في مكان آمن." })
    } catch (e: any) {
      setMessage({ type: "err", text: e.message })
    } finally {
      setExporting(false)
    }
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMessage(null)
    setPreview(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const meta = json.meta || {}
      const data = json.data || json
      setPreview({
        fileName: file.name,
        exportedAt: meta.exportedAt,
        tables:
          meta.tables ||
          Object.fromEntries(
            Object.keys(data).map((k) => [k, Array.isArray(data[k]) ? data[k].length : 0])
          ),
        raw: json,
      })
    } catch {
      setMessage({ type: "err", text: "الملف ليس JSON صالحاً" })
    }
  }

  async function restoreBackup() {
    if (!preview?.raw) return
    if (
      !confirm(
        "تحذير: الاستعادة ستدمج البيانات مع القاعدة الحالية.\nتأكد أنك رفعت النسخة الصحيحة.\nهل تريد المتابعة؟"
      )
    )
      return
    setRestoring(true)
    setMessage(null)
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview.raw),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "فشلت الاستعادة")
      setMessage({
        type: "ok",
        text: `تمت الاستعادة: ${Object.entries(data.stats || {})
          .map(([k, v]) => `${k}=${v}`)
          .join(" · ")}`,
      })
    } catch (e: any) {
      setMessage({ type: "err", text: e.message })
    } finally {
      setRestoring(false)
    }
  }

  if (status === "loading") {
    return <div className="p-8 text-center text-slate-500">جاري التحميل...</div>
  }

  if (!canBackup) {
    return (
      <div className="min-h-screen bg-slate-50 p-8" dir="rtl">
        <p className="text-red-600">ليس لديك صلاحية الوصول للنسخ الاحتياطي.</p>
        <Link href="/dashboard" className="text-blue-600 text-sm mt-2 inline-block">
          ← لوحة التحكم
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            ← لوحة التحكم
          </Link>
          <h1 className="text-xl font-bold mt-1">التخزين الاحتياطي</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            تصدير واستعادة بيانات الجرد والأصناف والمستخدمين
          </p>
        </div>
      </header>

      <main className="p-6 max-w-3xl mx-auto space-y-6">
        {message && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              message.type === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <section className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-lg">تنزيل نسخة احتياطية</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            تصدير الأصناف، الباركودات، جلسات الجرد وسجلات العد، المستودعات،
            المستخدمين، والأرصدة إلى ملف JSON. احفظ الملف على جهازك أو قرص خارجي.
          </p>
          <ul className="text-sm text-slate-600 list-disc pr-5 space-y-1">
            <li>يُفضّل أخذ نسخة أسبوعياً أو بعد كل جرد كبير</li>
            <li>الملف يحتوي بيانات حساسة — لا تشاركه علناً</li>
          </ul>
          <button
            type="button"
            onClick={downloadBackup}
            disabled={exporting}
            className="w-full sm:w-auto min-h-[48px] px-6 rounded-xl bg-[#9B1B1E] text-white font-bold disabled:opacity-50"
          >
            {exporting ? "جاري التصدير..." : "تنزيل النسخة الاحتياطية الآن"}
          </button>
        </section>

        <section className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-lg">استعادة من نسخة احتياطية</h2>
          {!canRestore ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              الاستعادة متاحة لمدير النظام فقط.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                ارفع ملف JSON الذي نزلته سابقاً. سيتم دمج السجلات مع القاعدة الحالية.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                onChange={onFileSelected}
                className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 file:font-medium"
              />
              {preview && (
                <div className="bg-slate-50 rounded-xl border p-4 text-sm space-y-2">
                  <p>
                    <strong>الملف:</strong> {preview.fileName}
                  </p>
                  {preview.exportedAt && (
                    <p>
                      <strong>تاريخ التصدير:</strong>{" "}
                      {new Date(preview.exportedAt).toLocaleString("ar-EG")}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(preview.tables || {}).map(([k, v]) => (
                      <span key={k} className="text-xs bg-white border rounded-full px-2.5 py-1">
                        {k}: <strong>{String(v)}</strong>
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={restoreBackup}
                    disabled={restoring}
                    className="mt-3 min-h-[44px] px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold disabled:opacity-50"
                  >
                    {restoring ? "جاري الاستعادة..." : "تأكيد الاستعادة"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <p className="text-xs text-slate-400 text-center">
          يُنصح أيضاً بتفعيل النسخ الاحتياطي التلقائي من لوحة Supabase.
        </p>
      </main>
    </div>
  )
}
