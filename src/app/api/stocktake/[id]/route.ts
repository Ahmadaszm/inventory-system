import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import prisma from "@/lib/prisma"

function canManage(role: string) {
  return ["SYSTEM_ADMIN", "INVENTORY_MANAGER", "WAREHOUSE_SUPERVISOR"].includes(role)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const stocktake = await prisma.stocktakeSession.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true, nameAr: true } },
      warehouse: true,
      progress: true,
      _count: { select: { countRecords: true } },
    },
  })
  if (!stocktake) return NextResponse.json({ error: "غير موجود" }, { status: 404 })
  return NextResponse.json(stocktake)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as any
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "ليس لديك صلاحية التعديل" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const existing = await prisma.stocktakeSession.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  const data: any = {}
  if (body.title !== undefined) data.title = String(body.title).trim()
  if (body.titleAr !== undefined) data.titleAr = String(body.titleAr || "").trim()
  if (body.notes !== undefined) data.notes = body.notes
  if (body.countDate) data.countDate = new Date(body.countDate)
  if (body.isBlind !== undefined) data.isBlind = !!body.isBlind
  if (body.isSurprise !== undefined) {
    data.isSurprise = !!body.isSurprise
    data.isHidden = !!body.isSurprise
  }
  if (
    body.status &&
    [
      "DRAFT",
      "PLANNED",
      "IN_PROGRESS",
      "COUNTING_COMPLETE",
      "UNDER_REVIEW",
      "PENDING_APPROVAL",
      "APPROVED",
      "CLOSED",
      "CANCELLED",
    ].includes(body.status)
  ) {
    data.status = body.status
    if (body.status === "CANCELLED" || body.status === "CLOSED") {
      data.completedAt = new Date()
    }
  }

  const updated = await prisma.stocktakeSession.update({
    where: { id },
    data,
  })
  return NextResponse.json({ ok: true, session: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as any
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "ليس لديك صلاحية الحذف" }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.stocktakeSession.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

  if (["APPROVED", "CLOSED"].includes(existing.status)) {
    return NextResponse.json(
      { error: "لا يمكن حذف جلسة معتمدة أو مغلقة — يمكنك إلغاءها فقط" },
      { status: 400 }
    )
  }

  await prisma.stocktakeSession.delete({ where: { id } })
  return NextResponse.json({ ok: true, deletedId: id })
}
