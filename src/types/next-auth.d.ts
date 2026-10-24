import "next-auth"
import type { Role } from "@/lib/auth/options"

declare module "next-auth" {
  interface User {
    id: string
    role: Role | string
    nameAr?: string | null
    locale?: string
  }
  interface Session {
    user: {
      id: string
      email?: string | null
      name?: string | null
      role: Role | string
      nameAr?: string | null
      locale?: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: Role | string
    nameAr?: string | null
    locale?: string
  }
}
