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
    !["SYSTEM_ADMIN", "INVENTORY_MANAGER", "WAREHOUSE_SUPERVISOR", "APPROVER_AUDITOR"].includes(
      user.role
    )
  ) {
    return NextResponse.json({ error: "ليس لديك صلاحية اعتماد الجرد" }, { status: 403 })
  }

  const { id } = await params
  const st = await prisma.stocktakeSession.findUnique({
    where: { id },
    include: { _count: { select: { countRecords: true } } },
  })
  if (!st) return NextResponse.json({ error: "الجلسة غير موجودة" }, { status: 404 })

  if (["APPROVED", "CLOSED", "CANCELLED"].includes(st.status)) {
    return NextResponse.json({ error: "الجلسة معتمدة أو مغلقة مسبقاً" }, { status: 400 })
  }

  if (!["COUNTING_COMPLETE", "UNDER_REVIEW", "PENDING_APPROVAL", "IN_PROGRESS"].includes(st.status)) {
    return NextResponse.json(
      { error: "يجب إنهاء العد أولاً قبل الاعتماد" },
      { status: 400 }
    )
  }

  const updated = await prisma.stocktakeSession.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      completedAt: st.completedAt || new Date(),
    },
  })

  try {
    await prisma.auditLog.create({
      data: {
        action: "STOCKTAKE_APPROVED",
        entityType: "StocktakeSession",
        entityId: id,
        userId: user.id,
        newValues: JSON.stringify({
          sessionNumber: st.sessionNumber,
          records: st._count.countRecords,
          status: "APPROVED",
        }),
      },
    })
  } catch {
    /* ignore */
  }

  return NextResponse.json({ ok: true, status: updated.status, approvedAt: updated.approvedAt })
}
