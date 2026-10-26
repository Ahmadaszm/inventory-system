"use client"

import Link from "next/link"

export function PrintActions({ sessionId }: { sessionId: string }) {
  return (
    <div className="no-print sticky top-0 z-10 bg-slate-100 border-b px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
      <Link href={`/stocktake/${sessionId}`} className="text-sm text-blue-600 hover:underline">
        ← رجوع للجلسة
      </Link>
      <div className="flex gap-2">
        <a
          href={`/api/export/stocktake/${sessionId}`}
          className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm font-medium"
        >
          تصدير Excel
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-5 py-2 rounded-lg bg-[#9B1B1E] text-white text-sm font-bold"
        >
          🖨️ طباعة التقرير
        </button>
      </div>
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          @page {
            margin: 12mm;
          }
        }
      `}</style>
    </div>
  )
}
