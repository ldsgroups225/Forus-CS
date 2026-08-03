import { canAccessOfflineRoute, getOfflineAccess, rememberOfflineAccess } from '~/lib/offline-access'
import { api } from '../../convex/_generated/api'

const publicRoutes = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/offline',
  '/loading',
])

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server)
    return

  if (to.path === '/offline')
    return

  const { $authClient, $convex, $ensureConvexAuth } = useNuxtApp()
  const isInvitationRoute = to.path.startsWith('/invite/')
  const isPublic = publicRoutes.has(to.path) || isInvitationRoute
  const offlineHome = () => {
    const offlineAccess = getOfflineAccess()
    if (!offlineAccess || to.path !== '/')
      return
    const cachedSlug = getCachedOrganizationSlug()
    const organizationSlug = cachedSlug && offlineAccess.organizationSlugs.includes(cachedSlug)
      ? cachedSlug
      : offlineAccess.organizationSlugs[0]
    return organizationSlug ? navigateTo(`/o/${organizationSlug}/operations`) : undefined
  }
  let response: Awaited<ReturnType<typeof $authClient.getSession>>

  try {
    response = await $authClient.getSession()
  }
  catch {
    if (isPublic)
      return

    if (!navigator.onLine) {
      const offlineHomeDestination = offlineHome()
      if (offlineHomeDestination)
        return offlineHomeDestination
      if (canAccessOfflineRoute(to.path))
        return
      return navigateTo({ path: '/offline', query: { redirect: to.fullPath } })
    }

    return navigateTo({ path: '/loading', query: { redirect: to.fullPath } })
  }

  const isAuthenticated = Boolean(response.data?.user)

  if (!isAuthenticated && !isPublic) {
    if (!navigator.onLine && canAccessOfflineRoute(to.path))
      return
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  if (!isAuthenticated)
    return

  if (!await $ensureConvexAuth()) {
    if (!navigator.onLine && canAccessOfflineRoute(to.path))
      return
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  if (isInvitationRoute)
    return

  if (to.path === '/login' || to.path === '/register')
    return navigateTo(await destinationAfterAuthentication($convex))

  const organizations = await $convex.query(api.organizations.listForCurrentUser, {})
  rememberOfflineAccess({
    userId: response.data!.user.id,
    organizationSlugs: organizations.map(organization => organization.slug),
  })

  if (to.path === '/') {
    const cachedSlug = getCachedOrganizationSlug()
    const first = organizations.find(organization => organization.slug === cachedSlug)
      ?? organizations[0]
    return navigateTo(first ? `/o/${first.slug}/operations` : '/onboarding/organization')
  }

  if (to.path === '/onboarding/organization') {
    const cachedSlug = getCachedOrganizationSlug()
    const first = organizations.find(organization => organization.slug === cachedSlug)
      ?? organizations[0]
    if (first)
      return navigateTo(`/o/${first.slug}/operations`)
    return
  }

  if (organizations.length === 0)
    return navigateTo('/onboarding/organization')

  const params = to.params as Record<string, string | string[] | undefined>
  const requestedSlug = typeof params.organizationSlug === 'string'
    ? params.organizationSlug
    : null

  if (requestedSlug && !organizations.some(organization => organization.slug === requestedSlug))
    return navigateTo(`/o/${organizations[0]?.slug}/operations`)

  const requestedOrganization = organizations.find(organization => organization.slug === requestedSlug)
  if (requestedOrganization?.role === 'AGENT'
    && to.path === `/o/${requestedSlug}/operations`) {
    return navigateTo(`/o/${requestedSlug}/operations/calling`)
  }
})
