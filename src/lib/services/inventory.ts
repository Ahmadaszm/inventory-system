import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { generateMovementNumber } from "@/lib/utils"

export async function postMovement(params: {
  type: string
  reference?: string
  effectiveDate: Date
  createdById: string
  fromWarehouseId?: string
  toWarehouseId?: string
  fromLocationId?: string
  toLocationId?: string
  notes?: string
  items: Array<{
    itemId: string
    batchId?: string
    cartonId?: string
    quantity: number
    unitCost?: number
  }>
}) {
  return prisma.$transaction(async (tx) => {
    const movement = await tx.stockMovement.create({
      data: {
        movementNumber: generateMovementNumber(),
        type: params.type,
        reference: params.reference,
        effectiveDate: params.effectiveDate,
        status: "POSTED",
        createdById: params.createdById,
        approvedById: params.createdById,
        approvedAt: new Date(),
        fromWarehouseId: params.fromWarehouseId,
        toWarehouseId: params.toWarehouseId,
        fromLocationId: params.fromLocationId,
        toLocationId: params.toLocationId,
        notes: params.notes,
        items: {
          create: params.items.map((i) => ({
            itemId: i.itemId,
            batchId: i.batchId,
            cartonId: i.cartonId,
            quantity: i.quantity,
            unitCost: i.unitCost,
          })),
        },
      },
      include: { items: true },
    })

    for (const line of params.items) {
      if (params.fromLocationId && line.quantity > 0) {
        await updateBalance(tx, {
          itemId: line.itemId,
          batchId: line.batchId,
          locationId: params.fromLocationId,
          delta: -line.quantity,
        })
      }
      if (params.toLocationId && line.quantity > 0) {
        await updateBalance(tx, {
          itemId: line.itemId,
          batchId: line.batchId,
          locationId: params.toLocationId,
          delta: line.quantity,
        })
      }

      if (line.cartonId) {
        const carton = await tx.carton.findUnique({ where: { id: line.cartonId } })
        if (carton) {
          const newQty = Number(carton.quantity) + (params.toLocationId ? 0 : -line.quantity)
          await tx.carton.update({
            where: { id: line.cartonId },
            data: {
              quantity: Math.max(0, newQty),
              locationId: params.toLocationId || carton.locationId,
              status: newQty <= 0 ? "CONSUMED" : carton.status,
            },
          })
        }
      }
    }

    await tx.auditLog.create({
      data: {
        userId: params.createdById,
        action: "POST_MOVEMENT",
        entityType: "StockMovement",
        entityId: movement.id,
        newValues: JSON.stringify({ type: params.type, items: params.items.length }),
      },
    })

    return movement
  })
}

async function updateBalance(
  tx: Prisma.TransactionClient,
  opts: { itemId: string; batchId?: string; locationId: string; delta: number }
) {
  const existing = await tx.inventoryBalance.findUnique({
    where: {
      itemId_batchId_locationId: {
        itemId: opts.itemId,
        batchId: opts.batchId || (null as any),
        locationId: opts.locationId,
      },
    },
  })

  if (existing) {
    const newQty = Number(existing.quantity) + opts.delta
    if (newQty < 0) {
      throw new Error(`Insufficient stock for item ${opts.itemId} at location`)
    }
    await tx.inventoryBalance.update({
      where: { id: existing.id },
      data: { quantity: newQty, lastMovementAt: new Date() },
    })
  } else if (opts.delta > 0) {
    await tx.inventoryBalance.create({
      data: {
        itemId: opts.itemId,
        batchId: opts.batchId,
        locationId: opts.locationId,
        quantity: opts.delta,
        lastMovementAt: new Date(),
      },
    })
  } else {
    throw new Error(`No balance found to decrease`)
  }
}

export async function getItemTotalQuantity(itemId: string) {
  const result = await prisma.inventoryBalance.aggregate({
    where: { itemId },
    _sum: { quantity: true },
  })
  return Number(result._sum.quantity || 0)
}

export async function getItemBreakdown(itemId: string) {
  return prisma.inventoryBalance.findMany({
    where: { itemId, quantity: { gt: 0 } },
    include: {
      batch: true,
      location: { include: { warehouse: true } },
      item: true,
    },
  })
}
