import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, hasPermission } from "@/lib/auth/options"
import prisma from "@/lib/prisma"
import { recordCount } from "@/lib/services/stocktake"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول أولاً", status: "UNAUTHORIZED" }, { status: 401 })
    }

    const user = session.user as any
    if (!hasPermission(user.role, "scan:perform") && !hasPermission(user.role, "*")) {
      return NextResponse.json({ error: "ليس لديك صلاحية المسح", status: "FORBIDDEN" }, { status: 403 })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "طلب غير صالح", status: "BAD_REQUEST" }, { status: 400 })
    }

    const { qrCode, sessionId, countedQty, clientEventId, notes, isDamaged } = body

    if (!qrCode || typeof qrCode !== "string") {
      return NextResponse.json({ error: "رمز QR مطلوب", status: "BAD_REQUEST" }, { status: 400 })
    }

    if (!sessionId) {
      let carton
      try {
        carton = await prisma.carton.findUnique({
          where: { qrCode: qrCode.trim() },
          include: {
            item: { include: { category: true, brand: true } },
            batch: true,
            location: { include: { warehouse: true } },
          },
        })
      } catch (dbErr: any) {
        console.error("DB error:", dbErr)
        return NextResponse.json(
          {
            error: "خطأ في قاعدة البيانات. تأكد من إعداد DATABASE_URL (PostgreSQL) على Vercel",
            status: "DB_ERROR",
            detail: dbErr?.message || String(dbErr),
          },
          { status: 500 }
        )
      }

      try {
        await prisma.scanEvent.create({
          data: {
            qrCode: qrCode.trim(),
            cartonId: carton?.id,
            userId: user.id,
            result: !carton ? "UNKNOWN" : carton.isActive ? "SUCCESS" : "INACTIVE",
          },
        })
      } catch {
        // non-critical
      }

      if (!carton) {
        return NextResponse.json({
          status: "UNKNOWN",
          message: "رمز QR غير مسجل في النظام",
          qrCode: qrCode.trim(),
        })
      }

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

    const result = await recordCount({
      sessionId,
      qrCode: qrCode.trim(),
      countedQty: countedQty ?? 0,
      countedById: user.id,
      clientEventId,
      notes,
      isDamaged,
    })
    return NextResponse.json(result)
  } catch (e: any) {
    console.error("Scan API error:", e)
    return NextResponse.json(
      {
        error: e?.message || "حدث خطأ أثناء المسح",
        status: "ERROR",
      },
      { status: 500 }
    )
  }
}
