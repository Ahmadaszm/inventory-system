import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateAuthenticationOptions } from "@simplewebauthn/server"
import { getWebAuthnConfig } from "@/lib/webauthn/config"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = String(body.email || "").trim()

  const { rpID } = getWebAuthnConfig()

  let allowCredentials: { id: string; transports?: any }[] | undefined
  let userId: string | null = null

  if (email) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { webauthnCredentials: true },
    })
    if (!user || !user.isActive || user.webauthnCredentials.length === 0) {
      return NextResponse.json(
        { error: "لا توجد بصمة مسجّلة لهذا المستخدم" },
        { status: 400 }
      )
    }
    userId = user.id
    allowCredentials = user.webauthnCredentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports ? JSON.parse(c.transports) : undefined,
    }))
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials,
  })

  await prisma.webAuthnChallenge.create({
    data: {
      id: options.challenge,
      userId,
      type: "auth",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  })

  return NextResponse.json(options)
}
