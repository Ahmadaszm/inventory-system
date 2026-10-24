import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, hasPermission } from "@/lib/auth/options"
import prisma from "@/lib/prisma"
import { recordCount } from "@/lib/services/stocktake"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = session.user as any
  if (!hasPermission(user.role, "scan:perform") && !hasPermission(user.role, "*")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { qrCode, sessionId, countedQty, clientEventId, notes, isDamaged } = body

  if (!qrCode) {
    return NextResponse.json({ error: "qrCode required" }, { status: 400 })
  }

  if (!sessionId) {
    const carton = await prisma.carton.findUnique({
      where: { qrCode },
      include: {
        item: { include: { category: true, brand: true } },
        batch: true,
        location: { include: { warehouse: true } },
      },
    })

    if (!carton) {
      await prisma.scanEvent.create({
        data: { qrCode, userId: user.id, result: "UNKNOWN" },
      })
      return NextResponse.json({ status: "UNKNOWN", message: "QR code not found" })
    }

    await prisma.scanEvent.create({
      data: {
        qrCode,
        cartonId: carton.id,
        userId: user.id,
        result: carton.isActive ? "SUCCESS" : "INACTIVE",
      },
    })

    return NextResponse.json({
      status: "FOUND",
      carton: {
        id: carton.id,
        qrCode: carton.qrCode,
        cartonNumber: carton.cartonNumber,
        quantity: Number(carton.quantity),
        originalQty: Number(carton.originalQty),
        status: carton.status,
        item: {
          sku: carton.item.sku,
          nameEn: carton.item.nameEn,
          nameAr: carton.item.nameAr,
          uom: carton.item.uom,
        },
        batch: {
          batchNumber: carton.batch.batchNumber,
          sourceType: carton.batch.sourceType,
        },
        location: carton.location
          ? {
              code: carton.location.code,
              warehouse: carton.location.warehouse.name,
            }
          : null,
      },
    })
  }

  try {
    const result = await recordCount({
      sessionId,
      qrCode,
      countedQty: countedQty ?? 0,
      countedById: user.id,
      clientEventId,
      notes,
      isDamaged,
    })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
