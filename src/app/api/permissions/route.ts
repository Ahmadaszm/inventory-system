import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import prisma from "@/lib/prisma"
import {
  DEFAULT_ROLE_PERMISSIONS,
  getDefaultPermissions,
  setPermissionsCache,
  clearPermissionsCache,
  ALL_ROLES,
} from "@/lib/auth/permissions"

const SETTING_KEY = "role_permissions"

async function loadFromDb(): Promise<Record<string, string[]>> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } })
    if (row?.value) {
      const parsed = JSON.parse(row.value) as Record<string, string[]>
      if (parsed && typeof parsed === "object") {
        parsed.SYSTEM_ADMIN = ["*"]
        for (const r of ALL_ROLES) {
          if (!parsed[r]) parsed[r] = DEFAULT_ROLE_PERMISSIONS[r] || []
        }
        setPermissionsCache(parsed)
        return parsed
      }
    }
  } catch (e) {
    console.error("load role_permissions", e)
  }
  const defaults = getDefaultPermissions()
  setPermissionsCache(defaults)
  return defaults
}

function canEdit(role: string) {
  return role === "SYSTEM_ADMIN"
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const map = await loadFromDb()
  return NextResponse.json({
    permissions: map,
    roles: ALL_ROLES,
    source: "db_or_default",
  })
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const actor = session.user as any
    if (!canEdit(actor.role)) {
      return NextResponse.json(
        { error: "فقط مدير النظام يمكنه تعديل مصفوفة الصلاحيات" },
        { status: 403 }
      )
    }

    const body = await req.json()
    const permissions = body.permissions as Record<string, string[]>
    if (!permissions || typeof permissions !== "object") {
      return NextResponse.json({ error: "permissions مطلوب" }, { status: 400 })
    }

    const clean: Record<string, string[]> = {}
    for (const role of ALL_ROLES) {
      if (role === "SYSTEM_ADMIN") {
        clean[role] = ["*"]
        continue
      }
      const list = Array.isArray(permissions[role]) ? permissions[role] : []
      clean[role] = list
        .filter((p) => typeof p === "string" && p.length > 0 && p.length < 80)
        .slice(0, 100)
    }

    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY },
      create: {
        key: SETTING_KEY,
        value: JSON.stringify(clean),
        updatedBy: actor.id,
      },
      update: {
        value: JSON.stringify(clean),
        updatedBy: actor.id,
      },
    })

    clearPermissionsCache()
    setPermissionsCache(clean)

    return NextResponse.json({ ok: true, permissions: clean })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e?.message || "فشل الحفظ" }, { status: 500 })
  }
}
