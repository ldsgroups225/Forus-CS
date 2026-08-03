import { clearOfflineAccess } from '~/lib/offline-access'
import { offlineAudioQueue } from '~/lib/offline-audio-queue'
import { offlineMutationQueue } from '~/lib/offline-mutation-queue'
import { offlineQueryCache } from '~/lib/offline-query-cache'

export function useAuth() {
  const { $authClient } = useNuxtApp()
  const session = $authClient.useSession()

  const user = computed(() => session.value.data?.user ?? null)
  const isAuthenticated = computed(() => Boolean(user.value))
  const isPending = computed(() => session.value.isPending)
  const error = computed(() => session.value.error)

  async function signOut() {
    try {
      await $authClient.signOut()
    }
    finally {
      await Promise.all([
        offlineAudioQueue.clear(),
        offlineMutationQueue.clear(),
        offlineQueryCache.clear(),
      ])
      clearOfflineAccess()
    }
    await session.value.refetch()
    await navigateTo('/login')
  }

  return {
    authClient: $authClient,
    session,
    user,
    isAuthenticated,
    isPending,
    error,
    signOut,
  }
}
