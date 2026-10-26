import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, hasPermission } from "@/lib/auth/options"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"

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

    const allowed = [
      "SYSTEM_ADMIN",
      "INVENTORY_MANAGER",
      "WAREHOUSE_SUPERVISOR",
      "STOCK_COUNTER",
      "INDEPENDENT_VERIFIER",
      "APPROVER_AUDITOR",
    ]
    if (!allowed.includes(role)) {
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

    const data: any = {}
    if (typeof body.isActive === "boolean") data.isActive = body.isActive
    if (body.role) data.role = body.role
    if (body.name) data.name = body.name
    if (body.nameAr) data.nameAr = body.nameAr
    if (body.password && String(body.password).length >= 6) {
      data.passwordHash = await bcrypt.hash(String(body.password), 10)
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
