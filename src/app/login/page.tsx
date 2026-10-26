"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
    })
    setLoading(false)
    if (res?.error) {
      setError("اسم المستخدم أو كلمة المرور غير صحيحة")
    } else {
      router.push("/dashboard")
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex" dir="rtl">
      <div className="hidden lg:flex lg:w-1/2 bg-[#9B1B1E] text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-white/20" />
          <div className="absolute bottom-10 -left-10 w-72 h-72 rounded-full bg-black/20" />
        </div>
        <div className="relative z-10">
          <Image
            src="/logo.svg"
            alt="ZMZM"
            width={220}
            height={220}
            className="rounded-2xl shadow-2xl border-4 border-white/20"
            priority
          />
        </div>
        <div className="relative z-10 space-y-3">
          <h1 className="text-3xl font-bold leading-tight">شركة زمزم للصناعات البلاستيكية</h1>
          <p className="text-white/80 text-lg">Zmzm For Plastic Industries</p>
          <p className="text-white/60 text-sm max-w-md leading-relaxed">
            نظام إدارة المخزون والجرد الفعلي — تتبع بالباركود، جرد دوري ومفاجئ، وتقارير احترافية.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-8">
            <Image src="/logo.svg" alt="ZMZM" width={120} height={120} className="rounded-xl shadow-lg" priority />
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900">تسجيل الدخول</h2>
              <p className="text-slate-500 text-sm mt-1">نظام إدارة المخزون — زمزم</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">اسم المستخدم</label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#9B1B1E]/40 focus:border-[#9B1B1E] outline-none transition"
                  required
                  dir="ltr"
                  autoComplete="username"
                  placeholder="InvZmzm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">كلمة المرور</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#9B1B1E]/40 focus:border-[#9B1B1E] outline-none transition"
                  required
                  dir="ltr"
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl text-center">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#9B1B1E] hover:bg-[#7f1518] text-white font-semibold py-3.5 rounded-xl transition disabled:opacity-50 shadow-lg shadow-red-900/20"
              >
                {loading ? "جاري الدخول..." : "دخول"}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            © {new Date().getFullYear()} شركة زمزم للصناعات البلاستيكية
          </p>
        </div>
      </div>
    </div>
  )
}
