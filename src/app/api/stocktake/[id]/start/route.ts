import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, hasPermission } from "@/lib/auth/options"
import { captureBookSnapshot } from "@/lib/services/stocktake"
import prisma from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
  }

  const user = session.user as any
  if (!hasPermission(user.role, "stocktake:manage") && !hasPermission(user.role, "*")) {
    return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })
  }

  const { id } = await params

  try {
    const stocktake = await prisma.stocktakeSession.findUnique({ where: { id } })
    if (!stocktake) {
      return NextResponse.json({ error: "الجلسة غير موجودة" }, { status: 404 })
    }
    if (!["PLANNED", "DRAFT"].includes(stocktake.status)) {
      return NextResponse.json({ error: "لا يمكن بدء هذه الجلسة" }, { status: 400 })
    }

    const count = await captureBookSnapshot(id)

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "START_STOCKTAKE",
        entityType: "StocktakeSession",
        entityId: id,
        newValues: JSON.stringify({ snapshotCount: count }),
      },
    })

    return NextResponse.json({ success: true, snapshotCount: count })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
