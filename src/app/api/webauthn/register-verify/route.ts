import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import prisma from "@/lib/prisma"
import { verifyRegistrationResponse } from "@simplewebauthn/server"
import { getWebAuthnConfig } from "@/lib/webauthn/config"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as any
  const body = await req.json()

  const challengeRow = await prisma.webAuthnChallenge.findFirst({
    where: { userId: user.id, type: "reg", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  })
  if (!challengeRow) {
    return NextResponse.json({ error: "انتهت صلاحية التحقق، أعد المحاولة" }, { status: 400 })
  }

  const { rpID, origins } = getWebAuthnConfig()

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challengeRow.id,
      expectedOrigin: origins,
      expectedRPID: rpID,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "فشل التحقق" }, { status: 400 })
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "لم يتم التحقق" }, { status: 400 })
  }

  const info = verification.registrationInfo as any
  const credential = info.credential
  const credentialID =
    typeof credential.id === "string"
      ? credential.id
      : Buffer.from(credential.id).toString("base64url")
  const publicKey =
    typeof credential.publicKey === "string"
      ? credential.publicKey
      : Buffer.from(credential.publicKey).toString("base64url")

  await prisma.webAuthnCredential.create({
    data: {
      userId: user.id,
      credentialId: credentialID,
      publicKey,
      counter: credential.counter ?? 0,
      deviceType: info.credentialDeviceType || "platform",
      backedUp: !!info.credentialBackedUp,
      transports: body.response?.transports
        ? JSON.stringify(body.response.transports)
        : null,
    },
  })

  await prisma.webAuthnChallenge.delete({ where: { id: challengeRow.id } }).catch(() => {})

  return NextResponse.json({ ok: true })
}
