import { convexClient, crossDomainClient } from '@convex-dev/better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

export function createForusAuthClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [
      convexClient(),
      crossDomainClient({
        storagePrefix: 'forus-cs',
      }),
    ],
  })
}

export type ForusAuthClient = ReturnType<typeof createForusAuthClient>
