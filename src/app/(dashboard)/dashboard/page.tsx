import { EnableBiometricButton } from "@/components/EnableBiometric"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const user = session.user as any
  const isAr = user.locale !== "en"

  let itemCount = 0
  let cartonCount = 0
  let totalQty = 0
  let factoryQty = 0
  let importQty = 0
  let openSessions = 0
  let pendingAdjustments = 0

  try {
    const results = await Promise.all([
      prisma.item.count({ where: { isActive: true } }),
      prisma.carton.count({ where: { isActive: true } }),
      prisma.inventoryBalance.aggregate({ _sum: { quantity: true } }),
      prisma.inventoryBalance.aggregate({
        where: { batch: { sourceType: "FACTORY" } },
        _sum: { quantity: true },
      }),
      prisma.inventoryBalance.aggregate({
        where: { batch: { sourceType: "IMPORT" } },
        _sum: { quantity: true },
      }),
      prisma.stocktakeSession.count({
        where: {
          status: { in: ["IN_PROGRESS", "COUNTING_COMPLETE", "UNDER_REVIEW"] },
        },
      }),
      prisma.stockAdjustment.count({ where: { status: "PENDING" } }),
    ])
    itemCount = results[0]
    cartonCount = results[1]
    totalQty = Number(results[2]._sum.quantity || 0)
    factoryQty = Number(results[3]._sum.quantity || 0)
    importQty = Number(results[4]._sum.quantity || 0)
    openSessions = results[5]
    pendingAdjustments = results[6]
  } catch {
    // DB not ready yet
  }

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          {isAr ? "لوحة التحكم" : "Dashboard"}
        </h1>
        <p className="text-slate-500">
          {isAr ? `مرحباً ${user.nameAr || user.name}` : `Welcome ${user.name}`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={isAr ? "الأصناف النشطة" : "Active SKUs"} value={itemCount} color="blue" />
        <StatCard
          title={isAr ? "الكراتين / الوحدات" : "Cartons / Units"}
          value={cartonCount}
          color="blue"
        />
        <StatCard title={isAr ? "إجمالي الكمية" : "Total Qty"} value={totalQty} color="blue" />
        <StatCard
          title={isAr ? "جلسات مفتوحة" : "Open Sessions"}
          value={openSessions}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={isAr ? "مخزون المصنع" : "Factory Stock"}
          value={factoryQty}
          color="emerald"
        />
        <StatCard
          title={isAr ? "المخزون المستورد" : "Imported Stock"}
          value={importQty}
          color="amber"
        />
        <StatCard
          title={isAr ? "بانتظار الاعتماد" : "Pending Approvals"}
          value={pendingAdjustments}
          color="rose"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">{isAr ? "إجراءات سريعة" : "Quick Actions"}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ActionLink href="/scan" label={isAr ? "مسح QR" : "Scan QR"} />
          <ActionLink href="/stocktake/new" label={isAr ? "جرد جديد" : "New Stocktake"} />
          <ActionLink href="/items" label={isAr ? "الأصناف" : "Items"} />
          <ActionLink href="/backup" label={isAr ? "نسخة احتياطية" : "Backup"} />
          <ActionLink href="/stocktake" label={isAr ? "عمليات الجرد" : "Stocktakes"} />
          <ActionLink
            href="/settings/security"
            label={isAr ? "تفعيل البصمة" : "Enable Fingerprint"}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#9B1B1E]/30 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#9B1B1E] mb-1">
          {isAr ? "👆 تفعيل الدخول بالبصمة" : "Enable biometric login"}
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          {isAr
            ? "فعّل بصمة الإصبع أو Face ID على هذا الجهاز لتسجيل الدخول بدون كلمة مرور في المرات القادمة."
            : "Register fingerprint or Face ID on this device for passwordless login next time."}
        </p>
        <EnableBiometricButton />
      </div>
    </main>
  )
}

function StatCard({
  title,
  value,
  color = "blue",
}: {
  title: string
  value: number
  color?: string
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-800 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-100",
    amber: "bg-amber-50 text-amber-800 border-amber-100",
    rose: "bg-rose-50 text-rose-800 border-rose-100",
  }
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-sm opacity-80">{title}</p>
      <p className="text-3xl font-bold mt-2">{value.toLocaleString("ar-EG")}</p>
    </div>
  )
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block text-center bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-3 px-4 rounded-lg transition text-sm"
    >
      {label}
    </Link>
  )
}
