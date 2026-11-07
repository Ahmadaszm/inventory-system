"use client"

import { useEffect, useState } from "react"

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const standalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches
    setIos(isIos && !standalone)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e)
      if (!standalone) setShow(true)
    }
    window.addEventListener("beforeinstallprompt", handler)
    if (isIos && !standalone) setShow(true)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  if (!show) return null

  async function install() {
    if (deferred) {
      deferred.prompt()
      await deferred.userChoice
      setDeferred(null)
      setShow(false)
    }
  }

  return (
    <div className="md:hidden fixed bottom-[4.5rem] inset-x-3 z-40 bg-[#9B1B1E] text-white rounded-xl p-3 shadow-lg flex items-start gap-3">
      <div className="flex-1 text-sm">
        <p className="font-bold">تثبيت التطبيق على الهاتف</p>
        {ios ? (
          <p className="text-white/85 text-xs mt-1 leading-relaxed">
            في Safari: اضغط مشاركة ثم «إضافة إلى الشاشة الرئيسية»
          </p>
        ) : (
          <p className="text-white/85 text-xs mt-1">ثبّته للوصول السريع مثل تطبيق عادي</p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {!ios && deferred && (
          <button
            type="button"
            onClick={install}
            className="bg-white text-[#9B1B1E] text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap"
          >
            تثبيت
          </button>
        )}
        <button type="button" onClick={() => setShow(false)} className="text-white/70 text-xs px-2 py-1">
          إغلاق
        </button>
      </div>
    </div>
  )
}
