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
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
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
        token.id = user.id
        token.role = user.role
        token.nameAr = user.nameAr
        token.locale = user.locale
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.nameAr = token.nameAr
        session.user.locale = token.locale
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

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SYSTEM_ADMIN: ["*"],
  INVENTORY_MANAGER: [
    "items:read", "items:write",
    "cartons:read", "cartons:write", "qr:generate", "qr:print",
    "movements:read", "movements:write", "movements:approve",
    "stocktake:create", "stocktake:manage", "stocktake:view_expected",
    "surprise:create", "surprise:view",
    "reconciliation:view", "adjustments:create", "adjustments:approve",
    "reports:all", "users:read", "audit:read",
  ],
  WAREHOUSE_SUPERVISOR: [
    "items:read", "cartons:read", "qr:print",
    "movements:read", "movements:write",
    "stocktake:create", "stocktake:manage", "stocktake:view_expected",
    "reconciliation:view", "reports:inventory", "reports:stocktake",
  ],
  STOCK_COUNTER: [
    "items:read", "cartons:read",
    "stocktake:count", "scan:perform",
    "reports:own_tasks",
  ],
  INDEPENDENT_VERIFIER: [
    "items:read", "cartons:read",
    "stocktake:verify", "stocktake:view_expected",
    "reconciliation:view", "reports:stocktake",
  ],
  APPROVER_AUDITOR: [
    "items:read", "cartons:read", "movements:read",
    "stocktake:view", "reconciliation:view",
    "adjustments:approve", "reports:all", "audit:read",
  ],
}

export function hasPermission(role: string, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role] || []
  return perms.includes("*") || perms.includes(permission)
}
