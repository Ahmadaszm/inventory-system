"use client"

import { useState } from "react"
import { startRegistration } from "@simplewebauthn/browser"

export function EnableBiometricButton() {
  const [msg, setMsg] = useState("")
  const [loading, setLoading] = useState(false)

  async function enable() {
    setMsg("")
    setLoading(true)
    try {
      if (typeof window === "undefined" || !window.PublicKeyCredential) {
        setMsg("هذا الجهاز أو المتصفح لا يدعم البصمة")
        return
      }
      const optRes = await fetch("/api/webauthn/register-options", { method: "POST" })
      const options = await optRes.json()
      if (!optRes.ok) throw new Error(options.error || "فشل التحضير")

      const attResp = await startRegistration({ optionsJSON: options })
      const verRes = await fetch("/api/webauthn/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attResp),
      })
      const data = await verRes.json()
      if (!verRes.ok) throw new Error(data.error || "فشل التسجيل")
      setMsg("تم تفعيل الدخول بالبصمة بنجاح")
      try {
        localStorage.setItem("zmzm_biometric_enabled", "1")
      } catch {
        /* ignore */
      }
    } catch (e: any) {
      if (e?.name === "NotAllowedError") {
        setMsg("تم إلغاء العملية من الجهاز")
      } else {
        setMsg(e?.message || "تعذر تفعيل البصمة")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={enable}
        disabled={loading}
        className="w-full sm:w-auto min-h-[44px] px-5 rounded-xl bg-slate-800 text-white text-sm font-medium disabled:opacity-50"
      >
        {loading ? "جاري التفعيل..." : "تفعيل الدخول ببصمة الجهاز"}
      </button>
      {msg && (
        <p className={`text-sm ${msg.includes("نجاح") ? "text-emerald-700" : "text-amber-700"}`}>
          {msg}
        </p>
      )}
    </div>
  )
}
