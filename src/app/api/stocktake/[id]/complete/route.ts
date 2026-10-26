import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import prisma from "@/lib/prisma"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as any
  if (
    !["SYSTEM_ADMIN", "INVENTORY_MANAGER", "WAREHOUSE_SUPERVISOR"].includes(user.role)
  ) {
    return NextResponse.json({ error: "ليس لديك صلاحية إنهاء الجرد" }, { status: 403 })
  }

  const { id } = await params
  const st = await prisma.stocktakeSession.findUnique({ where: { id } })
  if (!st) return NextResponse.json({ error: "الجلسة غير موجودة" }, { status: 404 })

  if (["CLOSED", "CANCELLED", "APPROVED"].includes(st.status)) {
    return NextResponse.json({ error: "الجلسة منتهية مسبقاً" }, { status: 400 })
  }

  const updated = await prisma.stocktakeSession.update({
    where: { id },
    data: {
      status: "COUNTING_COMPLETE",
      completedAt: new Date(),
    },
  })

  return NextResponse.json({ ok: true, status: updated.status })
}
