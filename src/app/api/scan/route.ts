import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, hasPermission } from "@/lib/auth/options"
import prisma from "@/lib/prisma"
import { recordCount } from "@/lib/services/stocktake"
import { lookupExternalBarcode } from "@/lib/services/barcodeLookup"
import { resolveBarcode, normalizeBarcode } from "@/lib/services/resolveBarcode"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولاً", status: "UNAUTHORIZED" },
        { status: 401 }
      )
    }

    const user = session.user as any
    if (!hasPermission(user.role, "scan:perform") && !hasPermission(user.role, "*")) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية المسح", status: "FORBIDDEN" },
        { status: 403 }
      )
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: "طلب غير صالح", status: "BAD_REQUEST" },
        { status: 400 }
      )
    }

    const { qrCode, sessionId, countedQty, clientEventId, notes, isDamaged } = body

    if (!qrCode || typeof qrCode !== "string") {
      return NextResponse.json(
        { error: "رمز الباركود مطلوب", status: "BAD_REQUEST" },
        { status: 400 }
      )
    }

    const code = normalizeBarcode(qrCode) || qrCode.trim()

    if (!sessionId) {
      let carton: any = null
      try {
        const resolved = await resolveBarcode(code)
        carton = resolved?.carton ?? null
      } catch (dbErr: any) {
        console.error("DB error:", dbErr)
      }

      if (carton) {
        try {
          await prisma.scanEvent.create({
            data: {
              qrCode: code,
              cartonId: carton.id,
              userId: user.id,
              result: carton.isActive ? "SUCCESS" : "INACTIVE",
            },
          })
        } catch {
          /* non-critical */
        }

        return NextResponse.json({
          status: "FOUND",
          source: "inventory",
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

      const external = await lookupExternalBarcode(code)

      try {
        await prisma.scanEvent.create({
          data: {
            qrCode: code,
            userId: user.id,
            result: external ? "EXTERNAL" : "UNKNOWN",
          },
        })
      } catch {
        /* non-critical */
      }

      if (external) {
        return NextResponse.json({
          status: "EXTERNAL",
          source: external.source,
          product: {
            barcode: external.barcode,
            name: external.name,
            nameAr: external.nameAr || null,
            brand: external.brand || null,
            category: external.category || null,
            imageUrl: external.imageUrl || null,
          },
          message: "تم التعرف على المنتج من قاعدة بيانات خارجية (غير مسجل في مخزونك)",
        })
      }

      return NextResponse.json({
        status: "UNKNOWN",
        message: "الباركود غير موجود في المخزون ولا في قواعد البيانات الخارجية",
        qrCode: code,
      })
    }

    const result = await recordCount({
      sessionId,
      qrCode: code,
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
