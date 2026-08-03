import { describe, expect, it } from 'vitest'
import { navigationFallbackDenylist, pwa } from '../app/config/pwa'

const publicPaths = [
  '/api/health',
  '/invite/abc123',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
]

describe('configuration PWA', () => {
  it('exclut les routes publiques sensibles du fallback offline', () => {
    for (const path of publicPaths) {
      expect(navigationFallbackDenylist.some(pattern => pattern.test(path)), path)
        .toBe(true)
    }
  })

  it('ne cache pas les navigations des invitations et de l’auth', () => {
    const pagesRoute = pwa.workbox?.runtimeCaching?.find(
      route => typeof route.urlPattern === 'function' && route.options?.cacheName === 'forus-pages',
    )
    expect(pagesRoute).toBeTruthy()

    const urlPattern = pagesRoute?.urlPattern as (input: { request: { mode: string }, url: URL }) => boolean

    for (const path of publicPaths) {
      expect(urlPattern({ request: { mode: 'navigate' }, url: new URL(path, 'https://forus-cs.vercel.app') }), path)
        .toBe(false)
    }

    expect(urlPattern({ request: { mode: 'navigate' }, url: new URL('/o/forus-group/operations', 'https://forus-cs.vercel.app') }))
      .toBe(true)
  })
})
