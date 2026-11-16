"use client"

import { useRef, useState } from "react"
import { extractOcrCodes, ocrSearchQueries } from "@/lib/ocrCodes"

type Props = {
  /** CSS selector or element id of an active camera <video> to snapshot */
  videoSelector?: string
  onCodes: (codes: string[], rawText: string) => void
  disabled?: boolean
}

/**
 * Read printed alphanumeric codes (dot-matrix / stamped labels) via OCR.
 * Works from camera snapshot or gallery/camera file capture.
 */
export function OcrCodeReader({ videoSelector = "#qr-reader-count video", onCodes, disabled }: Props) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadTesseract() {
    try {
      return await import("tesseract.js")
    } catch {
      await new Promise<void>((resolve, reject) => {
        const id = "tesseract-cdn"
        if (document.getElementById(id)) {
          resolve()
          return
        }
        const s = document.createElement("script")
        s.id = id
        s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"
        s.async = true
        s.onload = () => resolve()
        s.onerror = () => reject(new Error("تعذر تحميل محرك القراءة"))
        document.body.appendChild(s)
      })
      return (window as any).Tesseract
    }
  }

  async function recognize(image: HTMLCanvasElement | string | File) {
    setBusy(true)
    setMsg("جاري قراءة الأرقام من الصورة...")
    try {
      const Tesseract = await loadTesseract()
      const worker = await Tesseract.createWorker("eng", 1, {
        logger: () => {},
      })
      await worker.setParameters({
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ",
      })
      const {
        data: { text },
      } = await worker.recognize(image)
      await worker.terminate()

      const codes = extractOcrCodes(text || "")
      if (codes.length === 0) {
        setMsg("لم يُتعرف على رقم واضح — قرّب الكاميرا من الرمز وحسّن الإضاءة")
        onCodes([], text || "")
        return
      }
      setMsg(`تم التعرف: ${codes.slice(0, 3).join(" · ")}`)
      onCodes(ocrSearchQueries(codes), text || "")
    } catch (e: any) {
      setMsg(e?.message || "فشلت قراءة الصورة")
    } finally {
      setBusy(false)
    }
  }

  async function snapFromCamera() {
    const video = document.querySelector(videoSelector) as HTMLVideoElement | null
    if (!video || video.videoWidth < 10) {
      setMsg("شغّل الكاميرا أولاً أو استخدم التقاط صورة")
      fileRef.current?.click()
      return
    }
    const canvas = document.createElement("canvas")
    const w = video.videoWidth
    const h = video.videoHeight
    const cropH = Math.floor(h * 0.45)
    const sy = Math.floor((h - cropH) / 2)
    canvas.width = w
    canvas.height = cropH
    const ctx = canvas.getContext("2d")!
    ctx.drawImage(video, 0, sy, w, cropH, 0, 0, w, cropH)
    await recognize(canvas)
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (f) recognize(f)
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={snapFromCamera}
          className="flex-1 min-h-[44px] rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50"
        >
          {busy ? "⏳ قراءة..." : "🔤 قراءة رقم مطبوع"}
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => fileRef.current?.click()}
          className="min-h-[44px] px-3 rounded-xl border-2 border-indigo-300 text-indigo-800 text-sm font-medium disabled:opacity-50"
        >
          صورة
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFile}
        />
      </div>
      {msg && <p className="text-xs text-slate-600 px-1">{msg}</p>}
    </div>
  )
}
