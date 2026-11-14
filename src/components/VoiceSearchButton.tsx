"use client"

import { useEffect, useRef, useState } from "react"

type Props = {
  onResult: (text: string) => void
  lang?: string
  className?: string
  title?: string
}

export function VoiceSearchButton({
  onResult,
  lang = "ar-SA",
  className = "",
  title = "بحث صوتي",
}: Props) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const [error, setError] = useState("")
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const SR =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null
    if (!SR) {
      setSupported(false)
      return
    }
    const rec = new SR()
    rec.lang = lang
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 1

    rec.onresult = (event: any) => {
      const text = event?.results?.[0]?.[0]?.transcript || ""
      if (text.trim()) onResult(text.trim())
      setListening(false)
      setError("")
    }
    rec.onerror = (event: any) => {
      setListening(false)
      const code = event?.error || ""
      if (code === "not-allowed") setError("اسمح باستخدام الميكروفون")
      else if (code === "no-speech") setError("لم يُسمع كلام — أعد المحاولة")
      else if (code === "aborted") setError("")
      else setError("تعذر التعرف على الصوت")
    }
    rec.onend = () => setListening(false)

    recognitionRef.current = rec
    return () => {
      try {
        rec.abort?.()
      } catch {
        /* ignore */
      }
      recognitionRef.current = null
    }
  }, [lang, onResult])

  function toggle() {
    setError("")
    if (!recognitionRef.current) {
      setSupported(false)
      return
    }
    try {
      if (listening) {
        recognitionRef.current.stop()
        setListening(false)
      } else {
        recognitionRef.current.start()
        setListening(true)
      }
    } catch {
      setListening(false)
      setError("تعذر تشغيل الميكروفون")
    }
  }

  if (!supported) {
    return (
      <span className="text-[10px] text-slate-400 px-1" title="المتصفح لا يدعم البحث الصوتي">
        🎤 غير مدعوم
      </span>
    )
  }

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <button
        type="button"
        onClick={toggle}
        title={title}
        aria-label={title}
        className={`min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-lg transition active:scale-95 ${
          listening
            ? "bg-red-600 text-white animate-pulse shadow-lg shadow-red-300"
            : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"
        }`}
      >
        {listening ? "⏹" : "🎤"}
      </button>
      {listening && (
        <span className="text-[10px] text-red-600 mt-0.5 font-medium">تحدث الآن...</span>
      )}
      {error && !listening && (
        <span className="text-[10px] text-amber-700 mt-0.5 max-w-[90px] text-center leading-tight">
          {error}
        </span>
      )}
    </div>
  )
}
