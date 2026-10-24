"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [email, setEmail] = useState("admin@inventory.local")
  const [password, setPassword] = useState("Admin@123")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })
    setLoading(false)
    if (res?.error) {
      setError("بيانات الدخول غير صحيحة أو الحساب غير نشط")
    } else {
      router.push("/dashboard")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200" dir="rtl">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-700 text-2xl font-bold mb-4">
            مخزون
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            نظام إدارة المخزون والجرد
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            QR Inventory & Physical Stocktaking
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              required
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              كلمة المرور
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              required
              dir="ltr"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
          </button>
        </form>

        <div className="mt-8 pt-5 border-t text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-600 mb-2">حسابات تجريبية:</p>
          <p><span className="font-mono">admin@inventory.local</span> / Admin@123</p>
          <p><span className="font-mono">manager@inventory.local</span> / Manager@123</p>
          <p><span className="font-mono">counter1@inventory.local</span> / Counter@123</p>
        </div>
      </div>
    </div>
  )
}
