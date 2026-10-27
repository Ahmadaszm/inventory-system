import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import prisma from "@/lib/prisma"

function canBackup(role: string) {
  return ["SYSTEM_ADMIN", "INVENTORY_MANAGER"].includes(role)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as any
  if (!canBackup(user.role)) {
    return NextResponse.json({ error: "ليس لديك صلاحية النسخ الاحتياطي" }, { status: 403 })
  }

  const format = new URL(req.url).searchParams.get("format") || "json"

  const [
    users,
    categories,
    brands,
    warehouses,
    locations,
    items,
    batches,
    cartons,
    balances,
    stocktakeSessions,
    sessionProgress,
    countRecords,
    bookSnapshots,
    scanEvents,
    auditLogs,
  ] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        passwordHash: true,
        name: true,
        nameAr: true,
        role: true,
        isActive: true,
        locale: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.category.findMany(),
    prisma.brand.findMany(),
    prisma.warehouse.findMany(),
    prisma.location.findMany(),
    prisma.item.findMany(),
    prisma.batch.findMany(),
    prisma.carton.findMany(),
    prisma.inventoryBalance.findMany(),
    prisma.stocktakeSession.findMany(),
    prisma.sessionProgress.findMany(),
    prisma.countRecord.findMany(),
    prisma.bookSnapshot.findMany(),
    prisma.scanEvent.findMany({ take: 50000, orderBy: { scannedAt: "desc" } }),
    prisma.auditLog.findMany({ take: 20000, orderBy: { createdAt: "desc" } }),
  ])

  const payload = {
    meta: {
      app: "ZMZM Inventory",
      version: 1,
      exportedAt: new Date().toISOString(),
      exportedBy: user.email || user.name,
      tables: {
        users: users.length,
        categories: categories.length,
        brands: brands.length,
        warehouses: warehouses.length,
        locations: locations.length,
        items: items.length,
        batches: batches.length,
        cartons: cartons.length,
        balances: balances.length,
        stocktakeSessions: stocktakeSessions.length,
        sessionProgress: sessionProgress.length,
        countRecords: countRecords.length,
        bookSnapshots: bookSnapshots.length,
        scanEvents: scanEvents.length,
        auditLogs: auditLogs.length,
      },
    },
    data: {
      users,
      categories,
      brands,
      warehouses,
      locations,
      items,
      batches,
      cartons,
      balances,
      stocktakeSessions,
      sessionProgress,
      countRecords,
      bookSnapshots,
      scanEvents,
      auditLogs,
    },
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
  const filename = `zmzm-backup-${stamp}.json`

  try {
    await prisma.auditLog.create({
      data: {
        action: "BACKUP_EXPORT",
        entityType: "System",
        userId: user.id,
        newValues: JSON.stringify(payload.meta.tables),
      },
    })
  } catch {
    /* ignore */
  }

  if (format === "download" || format === "json") {
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  }

  return NextResponse.json({
    ok: true,
    meta: payload.meta,
    downloadUrl: "/api/backup?format=download",
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as any
  if (user.role !== "SYSTEM_ADMIN") {
    return NextResponse.json({ error: "الاستعادة للمدير العام فقط" }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "ملف غير صالح" }, { status: 400 })
  }

  const data = body?.data || body
  if (!data || typeof data !== "object") {
    return NextResponse.json({ error: "بنية النسخة الاحتياطية غير صحيحة" }, { status: 400 })
  }

  const stats: Record<string, number> = {}

  async function upsertMany(name: string, rows: any[] | undefined, model: { upsert: Function }) {
    if (!Array.isArray(rows) || rows.length === 0) {
      stats[name] = 0
      return
    }
    let n = 0
    for (const row of rows) {
      if (!row?.id) continue
      const { id, ...rest } = row
      for (const k of Object.keys(rest)) {
        if (typeof rest[k] === "string" && /^\d{4}-\d{2}-\d{2}T/.test(rest[k])) {
          rest[k] = new Date(rest[k])
        }
      }
      try {
        await model.upsert({
          where: { id },
          create: { id, ...rest },
          update: rest,
        })
        n++
      } catch {
        /* skip */
      }
    }
    stats[name] = n
  }

  await upsertMany("categories", data.categories, prisma.category)
  await upsertMany("brands", data.brands, prisma.brand)
  await upsertMany("warehouses", data.warehouses, prisma.warehouse)
  await upsertMany("locations", data.locations, prisma.location)

  if (Array.isArray(data.users)) {
    let n = 0
    for (const u of data.users) {
      if (!u?.id || !u?.email) continue
      try {
        await prisma.user.upsert({
          where: { id: u.id },
          create: {
            id: u.id,
            email: u.email,
            passwordHash: u.passwordHash || "",
            name: u.name || u.email,
            nameAr: u.nameAr,
            role: u.role || "STOCK_COUNTER",
            isActive: u.isActive ?? true,
            locale: u.locale || "ar",
          },
          update: {
            email: u.email,
            name: u.name,
            nameAr: u.nameAr,
            role: u.role,
            isActive: u.isActive,
            locale: u.locale,
            ...(u.passwordHash ? { passwordHash: u.passwordHash } : {}),
          },
        })
        n++
      } catch {
        /* skip */
      }
    }
    stats.users = n
  }

  await upsertMany("items", data.items, prisma.item)
  await upsertMany("batches", data.batches, prisma.batch)
  await upsertMany("cartons", data.cartons, prisma.carton)

  if (Array.isArray(data.balances)) {
    let n = 0
    for (const b of data.balances) {
      try {
        if (b.id) {
          await prisma.inventoryBalance.upsert({
            where: { id: b.id },
            create: {
              id: b.id,
              itemId: b.itemId,
              batchId: b.batchId,
              locationId: b.locationId,
              quantity: b.quantity ?? 0,
              reservedQty: b.reservedQty ?? 0,
              damagedQty: b.damagedQty ?? 0,
              quarantinedQty: b.quarantinedQty ?? 0,
            },
            update: {
              quantity: b.quantity ?? 0,
              reservedQty: b.reservedQty ?? 0,
              damagedQty: b.damagedQty ?? 0,
              quarantinedQty: b.quarantinedQty ?? 0,
            },
          })
          n++
        }
      } catch {
        /* skip */
      }
    }
    stats.balances = n
  }

  await upsertMany("stocktakeSessions", data.stocktakeSessions, prisma.stocktakeSession)
  await upsertMany("sessionProgress", data.sessionProgress, prisma.sessionProgress)
  await upsertMany("countRecords", data.countRecords, prisma.countRecord)
  await upsertMany("bookSnapshots", data.bookSnapshots, prisma.bookSnapshot)

  try {
    await prisma.auditLog.create({
      data: {
        action: "BACKUP_RESTORE",
        entityType: "System",
        userId: user.id,
        newValues: JSON.stringify(stats),
        reason: "استعادة من نسخة احتياطية",
      },
    })
  } catch {
    /* ignore */
  }

  return NextResponse.json({ ok: true, message: "تمت الاستعادة", stats })
}
