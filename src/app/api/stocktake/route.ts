import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, hasPermission } from "@/lib/auth/options"
import { createStocktakeSession } from "@/lib/services/stocktake"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
  }

  const user = session.user as any
  if (!hasPermission(user.role, "stocktake:create") && !hasPermission(user.role, "*")) {
    return NextResponse.json({ error: "ليس لديك صلاحية إنشاء جرد" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      type,
      title,
      titleAr,
      scopeType,
      scopeJson,
      countDate,
      isBlind,
      isSurprise,
      warehouseId,
      notes,
    } = body

    if (!title || !countDate) {
      return NextResponse.json({ error: "العنوان وتاريخ الجرد مطلوبان" }, { status: 400 })
    }

    const stocktake = await createStocktakeSession({
      type: type || "PERIODIC",
      title,
      titleAr,
      scopeType: scopeType || "ALL",
      scopeJson,
      countDate: new Date(countDate),
      isBlind: isBlind ?? true,
      isSurprise: isSurprise ?? false,
      warehouseId,
      createdById: user.id,
      notes,
    })

    return NextResponse.json(stocktake)
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message || "خطأ في الخادم" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: "Use the page" })
}
