import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect } from "next/navigation"
import Link from "next/link"
import { EnableBiometricButton } from "@/components/EnableBiometric"

export default async function SecuritySettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-xl mx-auto">
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            ← لوحة التحكم
          </Link>
          <h1 className="text-xl font-bold mt-1">الأمان والبصمة</h1>
        </div>
      </header>
      <main className="p-6 max-w-xl mx-auto">
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h2 className="font-bold text-lg">تفعيل الدخول ببصمة الجهاز</h2>
          <ol className="text-sm text-slate-600 list-decimal pr-5 space-y-1">
            <li>اضغط الزر بالأسفل</li>
            <li>وافق على طلب البصمة أو Face ID من الجهاز</li>
            <li>
              في المرة القادمة من شاشة الدخول: اكتب اسم المستخدم ثم «دخول ببصمة الجهاز»
            </li>
          </ol>
          <EnableBiometricButton />
          <p className="text-xs text-slate-400">
            يعمل على الهاتف والكمبيوتر الذي يدعم البصمة، وعلى اتصال HTTPS فقط.
          </p>
        </div>
      </main>
    </div>
  )
}
