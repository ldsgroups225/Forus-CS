import { ConvexClient } from 'convex/browser'
import { createForusAuthClient } from '~/lib/auth-client'

export default defineNuxtPlugin(async (nuxtApp) => {
  const config = useRuntimeConfig()
  const convexUrl = config.public.convexUrl
  const convexSiteUrl = config.public.convexSiteUrl

  if (!convexUrl || !convexSiteUrl) {
    console.warn('Forus CS: les URLs publiques Convex ne sont pas configurées.')
  }

  const authClient = createForusAuthClient(convexSiteUrl || 'http://127.0.0.1:3211')
  const convex = new ConvexClient(convexUrl || 'http://127.0.0.1:3210', {
    disabled: !convexUrl,
  })

  const route = useRoute()
  const router = useRouter()
  const ott = typeof route.query.ott === 'string' ? route.query.ott : null

  if (ott) {
    await authClient.$fetch('/cross-domain/one-time-token/verify', {
      method: 'POST',
      body: { token: ott },
    })
    authClient.updateSession()

    const nextQuery = { ...route.query }
    delete nextQuery.ott
    await router.replace({ path: route.path, query: nextQuery, hash: route.hash })
  }

  const session = authClient.useSession()
  let convexAuthenticated = false
  let authInFlight: Promise<boolean> | null = null

  async function fetchConvexToken(): Promise<string | null> {
    const response = await authClient.convex.token()
    return response.data?.token ?? null
  }

  function registerAuthFetcher() {
    if (authInFlight)
      return authInFlight

    authInFlight = new Promise((resolve) => {
      let settled = false
      const timeout = window.setTimeout(() => {
        if (!settled) {
          settled = true
          authInFlight = null
          resolve(false)
        }
      }, 10_000)

      convex.setAuth(fetchConvexToken, (isAuthenticated) => {
        convexAuthenticated = isAuthenticated
        if (!settled) {
          settled = true
          window.clearTimeout(timeout)
          authInFlight = null
          resolve(isAuthenticated)
        }
      })
    })

    return authInFlight
  }

  async function ensureConvexAuth() {
    if (convexAuthenticated)
      return true

    return registerAuthFetcher()
  }

  watch(
    () => session.value.data?.session.id,
    () => {
      convexAuthenticated = false
      void registerAuthFetcher()
    },
  )

  nuxtApp.hook('app:error', error => console.error('Forus CS', error))
  nuxtApp.hook('app:mounted', () => {
    window.addEventListener('beforeunload', () => void convex.close(), { once: true })
  })
  nuxtApp.vueApp.onUnmount(() => void convex.close())

  return {
    provide: {
      authClient,
      convex,
      ensureConvexAuth,
    },
  }
})
