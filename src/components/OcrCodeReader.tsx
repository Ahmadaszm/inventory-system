"use client"

import { useRef, useState } from "react"
import { extractOcrCodes, ocrSearchQueries, fixOcrConfusions } from "@/lib/ocrCodes"

type Props = {
  videoSelector?: string
  onCodes: (codes: string[], rawText: string) => void
  disabled?: boolean
}

/**
 * Read printed alphanumeric codes (dot-matrix / stamped labels) via OCR.
 * Preprocesses image (contrast / binarize) and runs multiple OCR passes.
 */
export function OcrCodeReader({ videoSelector = "#qr-reader-count video", onCodes, disabled }: Props) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  const [candidates, setCandidates] = useState<string[]>([])
  const [rawPreview, setRawPreview] = useState("")
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

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error("تعذر فتح الصورة"))
      img.src = src
    })
  }

  function preprocessVariants(source: HTMLCanvasElement | HTMLImageElement): HTMLCanvasElement[] {
    const sw = "naturalWidth" in source ? source.naturalWidth || source.width : source.width
    const sh = "naturalHeight" in source ? source.naturalHeight || source.height : source.height
    if (!sw || !sh) return []

    const cropTop = Math.floor(sh * 0.15)
    const cropH = Math.floor(sh * 0.7)
    const scale = sw < 800 ? 3 : sw < 1200 ? 2 : 1.5
    const dw = Math.floor(sw * scale)
    const dh = Math.floor(cropH * scale)

    const base = document.createElement("canvas")
    base.width = dw
    base.height = dh
    const ctx = base.getContext("2d")!
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(source as CanvasImageSource, 0, cropTop, sw, cropH, 0, 0, dw, dh)

    const imgData = ctx.getImageData(0, 0, dw, dh)
    const d = imgData.data
    const contrast = 1.6
    const intercept = 128 * (1 - contrast)
    for (let i = 0; i < d.length; i += 4) {
      let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      g = contrast * g + intercept
      g = Math.max(0, Math.min(255, g))
      d[i] = d[i + 1] = d[i + 2] = g
    }
    ctx.putImageData(imgData, 0, 0)

    const variants: HTMLCanvasElement[] = []

    const v1 = document.createElement("canvas")
    v1.width = dw
    v1.height = dh
    v1.getContext("2d")!.drawImage(base, 0, 0)
    variants.push(v1)

    const v2 = document.createElement("canvas")
    v2.width = dw
    v2.height = dh
    const c2 = v2.getContext("2d")!
    c2.drawImage(base, 0, 0)
    const id2 = c2.getImageData(0, 0, dw, dh)
    const p2 = id2.data
    let sum = 0
    for (let i = 0; i < p2.length; i += 4) sum += p2[i]
    const mean = sum / (p2.length / 4)
    const thr = mean * 0.9
    for (let i = 0; i < p2.length; i += 4) {
      const v = p2[i] > thr ? 255 : 0
      p2[i] = p2[i + 1] = p2[i + 2] = v
    }
    c2.putImageData(id2, 0, 0)
    variants.push(v2)

    const v3 = document.createElement("canvas")
    v3.width = dw
    v3.height = dh
    const c3 = v3.getContext("2d")!
    c3.drawImage(base, 0, 0)
    const id3 = c3.getImageData(0, 0, dw, dh)
    const p3 = id3.data
    for (let i = 0; i < p3.length; i += 4) {
      const v = p3[i] < thr ? 255 : 0
      p3[i] = p3[i + 1] = p3[i + 2] = v
    }
    c3.putImageData(id3, 0, 0)
    variants.push(v3)

    return variants
  }

  async function canvasFromFile(file: File): Promise<HTMLImageElement> {
    const url = URL.createObjectURL(file)
    try {
      return await loadImage(url)
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }
  }

  async function recognize(input: HTMLCanvasElement | HTMLImageElement | File) {
    setBusy(true)
    setMsg("جاري تحسين الصورة وقراءة الرقم...")
    setCandidates([])
    setRawPreview("")
    try {
      let source: HTMLCanvasElement | HTMLImageElement
      if (input instanceof File) {
        source = await canvasFromFile(input)
      } else {
        source = input
      }

      const variants = preprocessVariants(source)
      if (variants.length === 0) {
        setMsg("تعذر معالجة الصورة")
        return
      }

      const Tesseract = await loadTesseract()
      const worker = await Tesseract.createWorker("eng", 1, { logger: () => {} })

      const allText: string[] = []
      const allCodes = new Set<string>()

      await worker.setParameters({
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ",
        tessedit_pageseg_mode: "7",
      })

      for (const canvas of variants) {
        try {
          const { data } = await worker.recognize(canvas)
          if (data?.text) {
            allText.push(data.text)
            for (const c of extractOcrCodes(data.text)) allCodes.add(c)
          }
        } catch {}
      }

      try {
        await worker.setParameters({
          tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
          tessedit_pageseg_mode: "8",
        })
        const { data } = await worker.recognize(variants[1] || variants[0])
        if (data?.text) {
          allText.push(data.text)
          for (const c of extractOcrCodes(data.text)) allCodes.add(c)
        }
      } catch {}

      await worker.terminate()

      const raw = fixOcrConfusions(allText.join(" "))
      setRawPreview(raw)

      const codes = ocrSearchQueries([...allCodes])
      const ranked = codes.sort((a, b) => {
        const score = (x: string) => {
          const c = x.replace(/\s/g, "")
          let s = c.length
          if (/^[A-Z]{1,4}\d{4,}/.test(c)) s += 20
          if (/^\d+$/.test(c)) s += 5
          return s
        }
        return score(b) - score(a)
      })

      if (ranked.length === 0) {
        setMsg(
          raw
            ? `قرأت: «${raw.slice(0, 40)}» — لم يُستخرج رقم واضح. أعد التصوير بزاوية أقل لمعاناً.`
            : "لم يُتعرف على رقم — قرّب الكاميرا وقلّل الانعكاس على البلاستيك"
        )
        onCodes([], raw)
        return
      }

      setCandidates(ranked.slice(0, 8))
      setMsg(`مرشّحات: اختر الرقم الصحيح من الأزرار بالأسفل`)
      onCodes(ranked.slice(0, 4), raw)
    } catch (e: any) {
      setMsg(e?.message || "فشلت قراءة الصورة")
    } finally {
      setBusy(false)
    }
  }

  async function snapFromCamera() {
    const video = document.querySelector(videoSelector) as HTMLVideoElement | null
    if (!video || video.videoWidth < 10) {
      setMsg("شغّل الكاميرا أو استخدم زر «صورة»")
      fileRef.current?.click()
      return
    }
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")!
    ctx.drawImage(video, 0, 0)
    await recognize(canvas)
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (f) recognize(f)
  }

  function pickCandidate(code: string) {
    setMsg(`تم اختيار: ${code}`)
    onCodes(ocrSearchQueries([code]), code)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={snapFromCamera}
          className="flex-1 min-h-[44px] rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50"
        >
          {busy ? "⏳ جاري القراءة..." : "🔤 قراءة رقم مطبوع"}
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
      {rawPreview && (
        <p className="text-[11px] text-slate-400 font-mono px-1 break-all" dir="ltr">
          OCR: {rawPreview.slice(0, 80)}
        </p>
      )}
      {candidates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {candidates.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pickCandidate(c)}
              className="min-h-[36px] px-3 rounded-full border-2 border-indigo-200 bg-indigo-50 text-indigo-900 text-sm font-mono font-semibold"
              dir="ltr"
            >
              {c}
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-slate-400 px-1">
        نصيحة: صوّر من فوق بدون فلاش، والرقم يملأ وسط الصورة، وتجنّب لمعان البلاستيك
      </p>
    </div>
  )
}
