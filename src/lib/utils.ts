import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number | string, decimals = 2) {
  const num = typeof n === 'string' ? parseFloat(n) : n
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(num)
}

export function generateCartonQR(sku: string, batch: string, seq: number): string {
  return `QR-${sku}-${batch}-C${String(seq).padStart(6, '0')}`
}

export function generateSessionNumber(type: string): string {
  const prefix = type === 'SURPRISE' ? 'SS' : 'PS'
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `${prefix}-${date}-${rand}`
}

export function generateMovementNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.floor(Math.random() * 90000) + 10000
  return `MV-${date}-${rand}`
}
