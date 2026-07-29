import type { ConvexClient } from 'convex/browser'
import type { ForusAuthClient } from '../lib/auth-client'

declare module '#app' {
  interface NuxtApp {
    $authClient: ForusAuthClient
    $convex: ConvexClient
    $ensureConvexAuth: () => Promise<boolean>
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $authClient: ForusAuthClient
    $convex: ConvexClient
    $ensureConvexAuth: () => Promise<boolean>
  }
}

export {}
