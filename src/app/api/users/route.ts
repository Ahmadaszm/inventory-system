import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, hasPermission } from "@/lib/auth/options"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"

const ALLOWED_ROLES = [
  "SYSTEM_ADMIN",
  "INVENTORY_MANAGER",
  "WAREHOUSE_SUPERVISOR",
  "STOCK_COUNTER",
  "INDEPENDENT_VERIFIER",
  "APPROVER_AUDITOR",
]

function canManageUsers(role: string) {
  return role === "SYSTEM_ADMIN" || hasPermission(role, "*") || hasPermission(role, "users:write")
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as any
  if (!canManageUsers(user.role) && user.role !== "INVENTORY_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      nameAr: true,
      role: true,
      isActive: true,
      locale: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const actor = session.user as any
    if (!canManageUsers(actor.role)) {
      return NextResponse.json({ error: "ليس لديك صلاحية إدارة المستخدمين" }, { status: 403 })
    }

    const body = await req.json()
    const email = String(body.email || body.username || "").trim()
    const password = String(body.password || "")
    const name = String(body.name || "").trim()
    const nameAr = String(body.nameAr || name).trim()
    const role = String(body.role || "STOCK_COUNTER")

    if (!email || !password || !name) {
      return NextResponse.json({ error: "اسم المستخدم والاسم وكلمة المرور مطلوبة" }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "كلمة المرور قصيرة جداً (6 أحرف على الأقل)" }, { status: 400 })
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "دور غير صالح" }, { status: 400 })
    }
    if (role === "SYSTEM_ADMIN" && actor.role !== "SYSTEM_ADMIN") {
      return NextResponse.json({ error: "فقط مدير النظام يمكنه إنشاء مدير نظام" }, { status: 403 })
    }

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) {
      return NextResponse.json({ error: "اسم المستخدم مستخدم مسبقاً" }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        nameAr,
        role,
        isActive: true,
        locale: "ar",
      },
      select: {
        id: true,
        email: true,
        name: true,
        nameAr: true,
        role: true,
        isActive: true,
      },
    })

    return NextResponse.json({ ok: true, user: created })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e?.message || "فشل الإنشاء" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const actor = session.user as any
    if (!canManageUsers(actor.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const id = body.id
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 })

    if (body.role === "SYSTEM_ADMIN" && actor.role !== "SYSTEM_ADMIN") {
      return NextResponse.json({ error: "فقط مدير النظام يمكنه منح صلاحية مدير نظام" }, { status: 403 })
    }
    if (
      target.role === "SYSTEM_ADMIN" &&
      ((body.role && body.role !== "SYSTEM_ADMIN") || body.isActive === false)
    ) {
      const adminCount = await prisma.user.count({
        where: { role: "SYSTEM_ADMIN", isActive: true },
      })
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "لا يمكن تعطيل أو تغيير دور آخر مدير نظام نشط" },
          { status: 400 }
        )
      }
    }

    const data: any = {}
    if (typeof body.isActive === "boolean") data.isActive = body.isActive
    if (body.role && ALLOWED_ROLES.includes(body.role)) data.role = body.role
    if (body.name) data.name = String(body.name).trim()
    if (body.nameAr !== undefined) data.nameAr = String(body.nameAr || "").trim()
    if (body.email) {
      const newEmail = String(body.email).trim()
      if (newEmail !== target.email) {
        const taken = await prisma.user.findUnique({ where: { email: newEmail } })
        if (taken) {
          return NextResponse.json({ error: "اسم المستخدم مستخدم مسبقاً" }, { status: 400 })
        }
        data.email = newEmail
      }
    }
    if (body.password && String(body.password).length >= 6) {
      data.passwordHash = await bcrypt.hash(String(body.password), 10)
    } else if (body.password && String(body.password).length > 0) {
      return NextResponse.json({ error: "كلمة المرور قصيرة جداً (6 أحرف على الأقل)" }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        nameAr: true,
        role: true,
        isActive: true,
      },
    })
    return NextResponse.json({ ok: true, user: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "فشل التحديث" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const actor = session.user as any
    if (actor.role !== "SYSTEM_ADMIN" && !hasPermission(actor.role, "*")) {
      return NextResponse.json({ error: "فقط مدير النظام يمكنه حذف مستخدم" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    let id = searchParams.get("id")
    if (!id) {
      try {
        const body = await req.json()
        id = body.id
      } catch {
        /* empty */
      }
    }
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    if (id === actor.id) {
      return NextResponse.json({ error: "لا يمكنك حذف حسابك الحالي" }, { status: 400 })
    }

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 })

    if (target.role === "SYSTEM_ADMIN") {
      const adminCount = await prisma.user.count({
        where: { role: "SYSTEM_ADMIN", isActive: true },
      })
      if (adminCount <= 1) {
        return NextResponse.json({ error: "لا يمكن حذف آخر مدير نظام" }, { status: 400 })
      }
    }

    try {
      await prisma.user.delete({ where: { id } })
      return NextResponse.json({ ok: true, deleted: true })
    } catch {
      await prisma.user.update({
        where: { id },
        data: {
          isActive: false,
          email: `deleted_${Date.now()}_${target.email}`.slice(0, 120),
        },
      })
      return NextResponse.json({
        ok: true,
        deleted: false,
        deactivated: true,
        message: "تم تعطيل المستخدم (لا يمكن حذفه لوجود سجلات مرتبطة)",
      })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "فشل الحذف" }, { status: 500 })
  }
}
