import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, hasPermission } from "@/lib/auth/options"
import { ensurePermissionsLoaded } from "@/lib/auth/permissions"
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

    // Load DB permission overrides before checking
    await ensurePermissionsLoaded(prisma as any)

    const user = session.user as any
    const role = String(user?.role || "")
    const canScan =
      role === "SYSTEM_ADMIN" ||
      hasPermission(role, "*") ||
      hasPermission(role, "scan:perform") ||
      hasPermission(role, "stocktake:count") ||
      hasPermission(role, "stocktake:manage")

    if (!canScan) {
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

    const { qrCode, sessionId, countedQty, clientEventId, notes, isDamaged, mode, unit } = body

    if (!qrCode || typeof qrCode !== "string") {
      return NextResponse.json(
        { error: "رمز QR مطلوب", status: "BAD_REQUEST" },
        { status: 400 }
      )
    }

    const code = normalizeBarcode(qrCode) || qrCode.trim()

    // Lookup mode (no stocktake session) — inventory first, then external barcode DB
    if (!sessionId) {
      const resolved = await resolveBarcode(code)
      if (resolved?.item) {
        try {
          await prisma.scanEvent.create({
            data: {
              qrCode: code,
              userId: user.id,
              result: "FOUND",
              itemId: resolved.item.id,
              cartonId: resolved.carton?.id || null,
            },
          })
        } catch {}
        return NextResponse.json({
          status: "FOUND",
          item: resolved.item,
          carton: resolved.carton || null,
          source: resolved.source || "inventory",
        })
      }

      const external = await lookupExternalBarcode(code)
      if (external) {
        try {
          await prisma.scanEvent.create({
            data: {
              qrCode: code,
              userId: user.id,
              result: "EXTERNAL",
            },
          })
        } catch {}
        return NextResponse.json({
          status: "EXTERNAL",
          external,
        })
      }

      try {
        await prisma.scanEvent.create({
          data: {
            qrCode: code,
            userId: user.id,
            result: "NOT_FOUND",
          },
        })
      } catch {}
      return NextResponse.json({
        status: "NOT_FOUND",
        error: "الصنف غير موجود",
      })
    }

    // Stocktake counting mode
    const qty = Number(countedQty)
    if (!Number.isFinite(qty) || qty < 0) {
      return NextResponse.json(
        { error: "الكمية غير صالحة", status: "BAD_REQUEST" },
        { status: 400 }
      )
    }

    const result = await recordCount({
      sessionId,
      qrCode: code,
      countedQty: qty,
      userId: user.id,
      clientEventId: clientEventId || null,
      notes: notes || null,
      isDamaged: !!isDamaged,
      mode: mode === "replace" ? "replace" : "add",
      unit: unit === "KG" ? "KG" : "PCS",
    })

    return NextResponse.json(result)
  } catch (e: any) {
    console.error("scan error", e)
    return NextResponse.json(
      { error: e?.message || "فشل المسح", status: "ERROR" },
      { status: 500 }
    )
  }
}
