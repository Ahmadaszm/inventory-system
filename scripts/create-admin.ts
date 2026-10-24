import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password || password.length < 16) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 16 characters) before running db:admin.')
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    if (existing.role !== 'SYSTEM_ADMIN') throw new Error('That email already belongs to a non-admin user.')
    console.log('Administrator already exists; credentials were left unchanged.')
    return
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      name: 'System Administrator',
      nameAr: 'مسؤول النظام',
      role: 'SYSTEM_ADMIN',
      locale: 'ar',
    },
  })
  console.log('Administrator created. No inventory or existing users were changed.')
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Failed to create administrator.')
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
