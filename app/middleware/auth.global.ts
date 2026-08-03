import { api } from '../../convex/_generated/api'

const publicRoutes = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/offline',
])

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server)
    return

  if (to.path === '/offline')
    return

  const { $authClient, $convex, $ensureConvexAuth } = useNuxtApp()
  const isInvitationRoute = to.path.startsWith('/invite/')
  const isPublic = publicRoutes.has(to.path) || isInvitationRoute
  let response: Awaited<ReturnType<typeof $authClient.getSession>>

  try {
    response = await $authClient.getSession()
  }
  catch {
    if (isPublic)
      return

    return navigateTo({ path: '/offline', query: { redirect: to.fullPath } })
  }

  const isAuthenticated = Boolean(response.data?.user)

  if (!isAuthenticated && !isPublic)
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })

  if (!isAuthenticated)
    return

  if (!await $ensureConvexAuth())
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })

  if (isInvitationRoute)
    return

  if (to.path === '/login' || to.path === '/register')
    return navigateTo(await destinationAfterAuthentication($convex))

  const organizations = await $convex.query(api.organizations.listForCurrentUser, {})

  if (to.path === '/') {
    const first = organizations[0]
    return navigateTo(first ? `/o/${first.slug}/operations` : '/onboarding/organization')
  }

  if (to.path === '/onboarding/organization') {
    const first = organizations[0]
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
})
