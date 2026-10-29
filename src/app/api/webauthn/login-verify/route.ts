import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { verifyAuthenticationResponse } from "@simplewebauthn/server"
import { getWebAuthnConfig } from "@/lib/webauthn/config"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { rpID, origins } = getWebAuthnConfig()

  const challengeRow = await prisma.webAuthnChallenge.findFirst({
    where: { type: "auth", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  })
  if (!challengeRow) {
    return NextResponse.json({ error: "لا يوجد تحدٍ صالح" }, { status: 400 })
  }

  const credId =
    typeof body.id === "string"
      ? body.id
      : Buffer.from(body.rawId || []).toString("base64url")

  const credential = await prisma.webAuthnCredential.findUnique({
    where: { credentialId: credId },
  })
  if (!credential) {
    return NextResponse.json({ error: "البصمة غير معروفة" }, { status: 400 })
  }

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challengeRow.id,
      expectedOrigin: origins,
      expectedRPID: rpID,
      credential: {
        id: credential.credentialId,
        publicKey: Buffer.from(credential.publicKey, "base64url"),
        counter: credential.counter,
        transports: credential.transports ? JSON.parse(credential.transports) : undefined,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "فشل التحقق من البصمة" }, { status: 400 })
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "لم يتم التحقق من البصمة" }, { status: 400 })
  }

  await prisma.webAuthnCredential.update({
    where: { id: credential.id },
    data: { counter: verification.authenticationInfo.newCounter },
  })
  await prisma.webAuthnChallenge.delete({ where: { id: challengeRow.id } }).catch(() => {})

  const user = await prisma.user.findUnique({ where: { id: credential.userId } })
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "المستخدم غير نشط" }, { status: 403 })
  }

  const token = crypto.randomBytes(32).toString("hex")
  await prisma.webAuthnChallenge.create({
    data: {
      id: `login:${token}`,
      userId: user.id,
      type: "login_token",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  })

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  return NextResponse.json({ ok: true, token, email: user.email })
}
