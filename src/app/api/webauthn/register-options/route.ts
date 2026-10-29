import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import prisma from "@/lib/prisma"
import { generateRegistrationOptions } from "@simplewebauthn/server"
import { getWebAuthnConfig } from "@/lib/webauthn/config"

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = session.user as any

  const existing = await prisma.webAuthnCredential.findMany({
    where: { userId: user.id },
  })

  const { rpName, rpID } = getWebAuthnConfig()

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email || user.id,
    userDisplayName: user.nameAr || user.name || user.email,
    attestationType: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "preferred",
      requireResidentKey: false,
    },
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports ? JSON.parse(c.transports) : undefined,
    })),
  })

  await prisma.webAuthnChallenge.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  await prisma.webAuthnChallenge.create({
    data: {
      id: options.challenge,
      userId: user.id,
      type: "reg",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  })

  return NextResponse.json(options)
}
