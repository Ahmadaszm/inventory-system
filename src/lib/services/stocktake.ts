import prisma from "@/lib/prisma"
import { generateSessionNumber } from "@/lib/utils"

export async function createStocktakeSession(params: {
  type: string
  title: string
  titleAr?: string
  scopeType: string
  scopeJson?: unknown
  countDate: Date
  isBlind?: boolean
  isSurprise?: boolean
  warehouseId?: string
  createdById: string
  notes?: string
}) {
  const isSurprise = params.isSurprise || params.type === "SURPRISE"
  return prisma.stocktakeSession.create({
    data: {
      sessionNumber: generateSessionNumber(params.type),
      type: params.type,
      status: "PLANNED",
      title: params.title,
      titleAr: params.titleAr,
      scopeType: params.scopeType,
      scopeJson: params.scopeJson ? JSON.stringify(params.scopeJson) : null,
      countDate: params.countDate,
      isBlind: params.isBlind ?? true,
      isSurprise,
      isHidden: isSurprise,
      warehouseId: params.warehouseId,
      createdById: params.createdById,
      notes: params.notes,
      progress: { create: {} },
    },
    include: { progress: true },
  })
}

export async function captureBookSnapshot(sessionId: string) {
  const session = await prisma.stocktakeSession.findUniqueOrThrow({
    where: { id: sessionId },
  })

  const balances = await prisma.inventoryBalance.findMany({
    where: {
      quantity: { gt: 0 },
      ...(session.warehouseId
        ? { location: { warehouseId: session.warehouseId } }
        : {}),
    },
    include: { item: true },
  })

  await prisma.$transaction(async (tx) => {
    await tx.bookSnapshot.deleteMany({ where: { sessionId } })

    for (const bal of balances) {
      await tx.bookSnapshot.create({
        data: {
          sessionId,
          itemId: bal.itemId,
          batchId: bal.batchId,
          locationId: bal.locationId,
          bookQuantity: bal.quantity,
          unitCost: bal.item.costPerUnit,
        },
      })
    }

    await tx.stocktakeSession.update({
      where: { id: sessionId },
      data: {
        status: "IN_PROGRESS",
        startedAt: new Date(),
        freezeCutoffAt: new Date(),
      },
    })

    await tx.sessionProgress.update({
      where: { sessionId },
      data: { totalExpected: balances.length },
    })
  })

  return balances.length
}

export async function recordCount(params: {
  sessionId: string
  qrCode: string
  countedQty: number
  countedById: string
  taskId?: string
  clientEventId?: string
  notes?: string
  isDamaged?: boolean
  deviceInfo?: string
}) {
  if (params.clientEventId) {
    const existing = await prisma.countRecord.findFirst({
      where: { clientEventId: params.clientEventId },
    })
    if (existing) return { status: "ALREADY_SYNCED", record: existing }
  }

  const session = await prisma.stocktakeSession.findUniqueOrThrow({
    where: { id: params.sessionId },
  })

  if (session.status !== "IN_PROGRESS" && session.status !== "COUNTING_COMPLETE") {
    throw new Error("Session is not open for counting")
  }

  const carton = await prisma.carton.findUnique({
    where: { qrCode: params.qrCode },
    include: { item: true, batch: true, location: true },
  })

  await prisma.scanEvent.create({
    data: {
      qrCode: params.qrCode,
      cartonId: carton?.id,
      userId: params.countedById,
      sessionId: params.sessionId,
      clientEventId: params.clientEventId,
      result: carton ? (carton.isActive ? "SUCCESS" : "INACTIVE") : "UNKNOWN",
      deviceInfo: params.deviceInfo,
    },
  })

  if (!carton || !carton.isActive) {
    const record = await prisma.countRecord.create({
      data: {
        sessionId: params.sessionId,
        taskId: params.taskId,
        qrCodeScanned: params.qrCode,
        itemId: carton?.itemId ?? null,
        countedQty: params.countedQty,
        status: "DISCREPANCY",
        isUnknownQr: !carton,
        isUnexpected: true,
        notes: params.notes || (carton ? "Inactive carton" : "Unknown QR code"),
        countedById: params.countedById,
        clientEventId: params.clientEventId,
      },
    })
    return { status: "UNKNOWN_OR_INACTIVE", record }
  }

  const existingCount = await prisma.countRecord.findUnique({
    where: {
      sessionId_cartonId: {
        sessionId: params.sessionId,
        cartonId: carton.id,
      },
    },
  })

  if (existingCount) {
    await prisma.countRecord.update({
      where: { id: existingCount.id },
      data: { isDuplicate: true },
    })
    return { status: "DUPLICATE", record: existingCount }
  }

  let bookQty: number | null = null
  if (!session.isBlind) {
    const snap = await prisma.bookSnapshot.findFirst({
      where: {
        sessionId: params.sessionId,
        itemId: carton.itemId,
        batchId: carton.batchId,
        locationId: carton.locationId,
      },
    })
    bookQty = snap ? Number(snap.bookQuantity) : null
  }

  const variance = bookQty !== null ? params.countedQty - bookQty : null

  const record = await prisma.countRecord.create({
    data: {
      sessionId: params.sessionId,
      taskId: params.taskId,
      cartonId: carton.id,
      itemId: carton.itemId,
      batchId: carton.batchId,
      locationId: carton.locationId,
      qrCodeScanned: params.qrCode,
      countedQty: params.countedQty,
      bookQty,
      varianceQty: variance,
      status: variance !== null && variance !== 0 ? "DISCREPANCY" : "COUNTED",
      isPartial: Number(carton.quantity) !== params.countedQty,
      isDamaged: params.isDamaged || false,
      notes: params.notes,
      countedById: params.countedById,
      clientEventId: params.clientEventId,
    },
    include: { item: true, carton: true, batch: true, location: true },
  })

  await prisma.sessionProgress.update({
    where: { sessionId: params.sessionId },
    data: {
      totalCounted: { increment: 1 },
      countedTasks: { increment: 1 },
    },
  })

  return { status: "COUNTED", record }
}

export async function runReconciliation(sessionId: string) {
  const snapshots = await prisma.bookSnapshot.findMany({
    where: { sessionId },
  })

  const itemIds = Array.from(new Set(snapshots.map((s) => s.itemId)))
  const items = itemIds.length
    ? await prisma.item.findMany({ where: { id: { in: itemIds } } })
    : []
  const itemMap = new Map(items.map((i) => [i.id, i]))

  const counts = await prisma.countRecord.findMany({
    where: { sessionId },
    include: { item: true, carton: true },
  })

  const physicalMap = new Map<string, number>()
  for (const c of counts) {
    if (c.isUnknownQr) continue
    const key = `${c.itemId}|${c.batchId || ""}|${c.locationId || ""}`
    physicalMap.set(key, (physicalMap.get(key) || 0) + Number(c.countedQty))
  }

  const results = []

  for (const snap of snapshots) {
    const key = `${snap.itemId}|${snap.batchId || ""}|${snap.locationId || ""}`
    const physical = physicalMap.get(key) || 0
    const book = Number(snap.bookQuantity)
    const variance = physical - book
    const item = itemMap.get(snap.itemId)

    results.push({
      itemId: snap.itemId,
      sku: item?.sku,
      nameEn: item?.nameEn,
      nameAr: item?.nameAr,
      batchId: snap.batchId,
      locationId: snap.locationId,
      bookQty: book,
      physicalQty: physical,
      varianceQty: variance,
      variancePct: book !== 0 ? (variance / book) * 100 : null,
      unitCost: Number(snap.unitCost || item?.costPerUnit || 0),
      financialVariance: variance * Number(snap.unitCost || item?.costPerUnit || 0),
      status: variance === 0 ? "MATCHED" : variance < 0 ? "SHORTAGE" : "SURPLUS",
    })
    physicalMap.delete(key)
  }

  for (const [key, physical] of physicalMap) {
    const [itemId, batchId, locationId] = key.split("|")
    const item = await prisma.item.findUnique({ where: { id: itemId } })
    if (item) {
      results.push({
        itemId,
        sku: item.sku,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        batchId: batchId || null,
        locationId: locationId || null,
        bookQty: 0,
        physicalQty: physical,
        varianceQty: physical,
        variancePct: null,
        unitCost: Number(item.costPerUnit),
        financialVariance: physical * Number(item.costPerUnit),
        status: "UNEXPECTED",
      })
    }
  }

  return results
}
