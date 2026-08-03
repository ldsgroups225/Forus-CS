const organizationCacheKey = 'forus-cs:last-organization'

export function getCachedOrganizationSlug() {
  if (import.meta.server)
    return null

  return window.localStorage.getItem(organizationCacheKey)
}

export function cacheOrganizationSlug(slug: string) {
  if (import.meta.server || !slug)
    return

  window.localStorage.setItem(organizationCacheKey, slug)
}
