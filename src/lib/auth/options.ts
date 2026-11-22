import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"

export type Role =
  | "SYSTEM_ADMIN"
  | "INVENTORY_MANAGER"
  | "WAREHOUSE_SUPERVISOR"
  | "STOCK_COUNTER"
  | "INDEPENDENT_VERIFIER"
  | "APPROVER_AUDITOR"

export const authOptions: NextAuthOptions = {
  // Allow any production host (custom domain / vercel URL) — helps mobile carriers
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        biometricToken: { label: "Biometric", type: "text" },
      },
      async authorize(credentials) {
        if (credentials?.biometricToken) {
          const row = await prisma.webAuthnChallenge.findUnique({
            where: { id: `login:${credentials.biometricToken}` },
          })
          if (!row || row.type !== "login_token" || row.expiresAt < new Date() || !row.userId) {
            return null
          }
          await prisma.webAuthnChallenge.delete({ where: { id: row.id } }).catch(() => {})
          const user = await prisma.user.findUnique({ where: { id: row.userId } })
          if (!user || !user.isActive) return null
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            nameAr: user.nameAr,
            role: user.role,
            locale: user.locale,
          }
        }

        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.isActive) return null

        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          nameAr: user.nameAr,
          role: user.role,
          locale: user.locale,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.role = (user as any).role
        token.nameAr = (user as any).nameAr
        token.locale = (user as any).locale
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.userId as string
        ;(session.user as any).role = token.role as string
        ;(session.user as any).nameAr = token.nameAr as string
        ;(session.user as any).locale = token.locale as string
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
}

// Re-export from permissions module (supports DB overrides + defaults)
export { hasPermission, DEFAULT_ROLE_PERMISSIONS as ROLE_PERMISSIONS } from "@/lib/auth/permissions"
