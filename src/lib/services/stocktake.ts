import prisma from "@/lib/prisma"
import { resolveBarcode, normalizeBarcode } from "@/lib/services/resolveBarcode"
import { generateSessionNumber } from "@/lib/utils"

/** Append a structured scan line so the UI can show each count step */
function appendScanLine(prevNotes: string | null | undefined, qty: number, mode: "add" | "replace") {
  const line = `SCAN|${mode === "replace" ? "=" : "+"}${qty}|${new Date().toISOString()}`
  if (mode === "replace") return line
  const scans = (prevNotes || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("SCAN|"))
  scans.push(line)
  return scans.slice(-50).join("\n")
}

export async function createStocktakeSession(params: {
  type: string
  title: string
  titleAr?: string
  scopeType: string
  scopeJson?: any
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
      ...(session.warehouseId ? { location: { warehouseId: session.warehouseId } } : {}),
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
      data: { status: "IN_PROGRESS", startedAt: new Date(), freezeCutoffAt: new Date() },
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
  mode?: "add" | "replace"
}) {
  const mode = params.mode === "replace" ? "replace" : "add"

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

  const resolved = await resolveBarcode(params.qrCode)
  const carton = resolved?.carton ?? null
  const qrClean =
    normalizeBarcode(params.qrCode).slice(0, 500) ||
    params.qrCode.replace(/[\r\n]+/g, " ").trim().slice(0, 500)

  await prisma.scanEvent.create({
    data: {
      qrCode: qrClean,
      cartonId: carton?.id,
      userId: params.countedById,
      sessionId: params.sessionId,
      clientEventId: params.clientEventId,
      result: carton ? (carton.isActive ? "SUCCESS" : "INACTIVE") : "UNKNOWN",
      deviceInfo: params.deviceInfo,
    },
  })

  if (!carton || !carton.isActive) {
    const existingUnknown = await prisma.countRecord.findFirst({
      where: {
        sessionId: params.sessionId,
        qrCodeScanned: qrClean,
        isUnknownQr: true,
      },
      orderBy: { countedAt: "desc" },
    })

    if (existingUnknown) {
      const prev = Number(existingUnknown.countedQty)
      const nextQty = mode === "replace" ? params.countedQty : prev + params.countedQty
      const record = await prisma.countRecord.update({
        where: { id: existingUnknown.id },
        data: {
          countedQty: nextQty,
          notes: appendScanLine(existingUnknown.notes, params.countedQty, mode),
          countedAt: new Date(),
          isDuplicate: false,
        },
        include: { item: true },
      })
      return {
        status: mode === "replace" ? "UPDATED" : "ACCUMULATED",
        record,
        previousQty: prev,
        addedQty: mode === "replace" ? null : params.countedQty,
        totalQty: nextQty,
      }
    }

    const record = await prisma.countRecord.create({
      data: {
        session: { connect: { id: params.sessionId } },
        qrCodeScanned: qrClean,
        countedQty: params.countedQty,
        status: "COUNTED",
        isUnknownQr: !carton,
        isUnexpected: true,
        notes: appendScanLine(null, params.countedQty, "add"),
        countedBy: { connect: { id: params.countedById } },
        clientEventId: params.clientEventId,
        ...(params.taskId ? { task: { connect: { id: params.taskId } } } : {}),
        ...(carton?.itemId ? { item: { connect: { id: carton.itemId } } } : {}),
      },
    })

    await prisma.sessionProgress
      .update({
        where: { sessionId: params.sessionId },
        data: {
          totalCounted: { increment: 1 },
          unknownCount: { increment: !carton ? 1 : 0 },
        },
      })
      .catch(() => {})

    return { status: carton ? "INACTIVE" : "UNKNOWN_COUNTED", record }
  }

  const existingCount = await prisma.countRecord.findUnique({
    where: {
      sessionId_cartonId: {
        sessionId: params.sessionId,
        cartonId: carton.id,
      },
    },
    include: { item: true, carton: true },
  })

  if (existingCount) {
    const prev = Number(existingCount.countedQty)
    const nextQty = mode === "replace" ? params.countedQty : prev + params.countedQty
    let bookQty = existingCount.bookQty != null ? Number(existingCount.bookQty) : null
    const variance = bookQty !== null ? nextQty - bookQty : null
    const record = await prisma.countRecord.update({
      where: { id: existingCount.id },
      data: {
        countedQty: nextQty,
        varianceQty: variance,
        status: variance !== null && variance !== 0 ? "DISCREPANCY" : "COUNTED",
        isDuplicate: false,
        notes: appendScanLine(existingCount.notes, params.countedQty, mode),
        countedAt: new Date(),
      },
      include: { item: true, carton: true, batch: true, location: true },
    })
    return {
      status: mode === "replace" ? "UPDATED" : "ACCUMULATED",
      record,
      previousQty: prev,
      addedQty: mode === "replace" ? null : params.countedQty,
      totalQty: nextQty,
    }
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
      qrCodeScanned: qrClean,
      countedQty: params.countedQty,
      bookQty,
      varianceQty: variance,
      status: variance !== null && variance !== 0 ? "DISCREPANCY" : "COUNTED",
      isPartial: Number(carton.quantity) !== params.countedQty,
      isDamaged: params.isDamaged || false,
      notes: appendScanLine(null, params.countedQty, "add"),
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
  const snapshots = await prisma.bookSnapshot.findMany({ where: { sessionId } })
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
