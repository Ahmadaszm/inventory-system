/**
 * Role permissions — defaults + optional DB overrides (AppSetting key: role_permissions)
 */

export const ALL_ROLES = [
  "SYSTEM_ADMIN",
  "INVENTORY_MANAGER",
  "WAREHOUSE_SUPERVISOR",
  "STOCK_COUNTER",
  "INDEPENDENT_VERIFIER",
  "APPROVER_AUDITOR",
] as const

export type RoleName = (typeof ALL_ROLES)[number]

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  SYSTEM_ADMIN: ["*"],
  INVENTORY_MANAGER: [
    "items:read",
    "items:write",
    "cartons:read",
    "cartons:write",
    "qr:generate",
    "qr:print",
    "movements:read",
    "movements:write",
    "movements:approve",
    "stocktake:create",
    "stocktake:manage",
    "stocktake:count",
    "stocktake:view_expected",
    "scan:perform",
    "surprise:create",
    "surprise:view",
    "reconciliation:view",
    "adjustments:create",
    "adjustments:approve",
    "reports:all",
    "users:read",
    "audit:read",
  ],
  WAREHOUSE_SUPERVISOR: [
    "items:read",
    "cartons:read",
    "qr:print",
    "movements:read",
    "movements:write",
    "stocktake:create",
    "stocktake:manage",
    "stocktake:count",
    "stocktake:view_expected",
    "scan:perform",
    "reconciliation:view",
    "reports:inventory",
    "reports:stocktake",
  ],
  STOCK_COUNTER: [
    "items:read",
    "cartons:read",
    "stocktake:count",
    "scan:perform",
    "reports:own_tasks",
  ],
  INDEPENDENT_VERIFIER: [
    "items:read",
    "cartons:read",
    "stocktake:verify",
    "stocktake:view_expected",
    "reconciliation:view",
    "reports:stocktake",
  ],
  APPROVER_AUDITOR: [
    "items:read",
    "cartons:read",
    "movements:read",
    "stocktake:view",
    "reconciliation:view",
    "adjustments:approve",
    "reports:all",
    "audit:read",
  ],
}

/** In-memory cache of effective permissions (refreshed from DB) */
let cached: Record<string, string[]> | null = null
let cacheLoadedAt = 0
const CACHE_TTL_MS = 30_000

export function getDefaultPermissions(): Record<string, string[]> {
  return JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS))
}

export function setPermissionsCache(map: Record<string, string[]>) {
  cached = map
  cacheLoadedAt = Date.now()
}

export function getPermissionsCache(): Record<string, string[]> | null {
  if (cached && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return cached
  return cached
}

export function clearPermissionsCache() {
  cached = null
  cacheLoadedAt = 0
}

/** Sync check — uses cache if available, else defaults. SYSTEM_ADMIN always has *. */
export function hasPermission(role: string, permission: string): boolean {
  if (role === "SYSTEM_ADMIN") return true
  const map = getPermissionsCache() || DEFAULT_ROLE_PERMISSIONS
  const perms = map[role] || DEFAULT_ROLE_PERMISSIONS[role] || []
  return perms.includes("*") || perms.includes(permission)
}

/**
 * Ensure DB permissions are loaded into cache (call at start of API handlers).
 * Safe to call often; uses short TTL cache.
 */
export async function ensurePermissionsLoaded(prisma: {
  appSetting: { findUnique: (args: any) => Promise<{ value: string } | null> }
}): Promise<void> {
  if (getPermissionsCache() && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: "role_permissions" } })
    if (row?.value) {
      const parsed = JSON.parse(row.value) as Record<string, string[]>
      if (parsed && typeof parsed === "object") {
        parsed.SYSTEM_ADMIN = ["*"]
        for (const r of ALL_ROLES) {
          if (!parsed[r]) parsed[r] = DEFAULT_ROLE_PERMISSIONS[r] || []
        }
        setPermissionsCache(parsed)
        return
      }
    }
  } catch {
    /* ignore */
  }
  setPermissionsCache(getDefaultPermissions())
}

export function roleHasPerm(map: Record<string, string[]>, role: string, perm: string): boolean {
  if (role === "SYSTEM_ADMIN") return true
  const list = map[role] || []
  return list.includes("*") || list.includes(perm)
}

export function togglePermInMap(
  map: Record<string, string[]>,
  role: string,
  perm: string,
  enabled: boolean
): Record<string, string[]> {
  const next = JSON.parse(JSON.stringify(map)) as Record<string, string[]>
  if (role === "SYSTEM_ADMIN") {
    next.SYSTEM_ADMIN = ["*"]
    return next
  }
  if (perm === "*") {
    next[role] = enabled ? ["*"] : []
    return next
  }
  let list = Array.isArray(next[role]) ? [...next[role]] : []
  list = list.filter((p) => p !== "*")
  if (enabled) {
    if (!list.includes(perm)) list.push(perm)
  } else {
    list = list.filter((p) => p !== perm)
  }
  next[role] = list
  return next
}
