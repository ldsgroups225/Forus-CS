const storageKey = 'forus-cs-offline-access'
const maxAgeMs = 1000 * 60 * 60 * 24 * 7

interface OfflineAccessRecord {
  userId: string
  organizationSlugs: string[]
  expiresAt: number
}

function isOfflineAccessRecord(value: unknown): value is OfflineAccessRecord {
  if (!value || typeof value !== 'object')
    return false

  const record = value as Partial<OfflineAccessRecord>
  return typeof record.userId === 'string'
    && Array.isArray(record.organizationSlugs)
    && record.organizationSlugs.every(slug => typeof slug === 'string')
    && typeof record.expiresAt === 'number'
}

export function rememberOfflineAccess(input: { userId: string, organizationSlugs: string[] }) {
  if (!import.meta.client)
    return

  const record: OfflineAccessRecord = {
    userId: input.userId,
    organizationSlugs: [...new Set(input.organizationSlugs)],
    expiresAt: Date.now() + maxAgeMs,
  }
  localStorage.setItem(storageKey, JSON.stringify(record))
}

export function getOfflineAccess() {
  if (!import.meta.client)
    return undefined

  try {
    const record: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (!isOfflineAccessRecord(record) || record.expiresAt <= Date.now()) {
      localStorage.removeItem(storageKey)
      return undefined
    }
    return record
  }
  catch {
    localStorage.removeItem(storageKey)
    return undefined
  }
}

export function getOfflineOwnerId() {
  return getOfflineAccess()?.userId
}

export function canAccessOfflineRoute(path: string) {
  const organizationSlug = path.match(/^\/o\/([^/]+)(?:\/|$)/)?.[1]
  return Boolean(organizationSlug && getOfflineAccess()?.organizationSlugs.includes(organizationSlug))
}

export function clearOfflineAccess() {
  if (import.meta.client)
    localStorage.removeItem(storageKey)
}
