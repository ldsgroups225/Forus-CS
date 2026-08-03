import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from 'convex/server'
import { getOfflineOwnerId } from '~/lib/offline-access'
import { offlineQueryCache, offlineQueryKey } from '~/lib/offline-query-cache'

export function useConvexClient() {
  return useNuxtApp().$convex
}

export function useConvexQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: MaybeRefOrGetter<FunctionArgs<Query> | null>,
) {
  const convex = useConvexClient()
  const { user } = useAuth()
  const data = shallowRef<FunctionReturnType<Query>>()
  const error = shallowRef<Error>()
  const isPending = ref(true)
  const isStale = shallowRef(false)
  let unsubscribe: (() => void) | undefined
  let queryGeneration = 0

  function stop() {
    unsubscribe?.()
    unsubscribe = undefined
  }

  watch(
    () => ({
      args: toValue(args),
      ownerId: user.value?.id ?? getOfflineOwnerId(),
    }),
    ({ args: nextArgs, ownerId }) => {
      const generation = ++queryGeneration
      stop()
      error.value = undefined

      if (nextArgs === null) {
        data.value = undefined
        isPending.value = false
        return
      }

      const cacheKey = ownerId ? offlineQueryKey(ownerId, query, nextArgs) : undefined
      isPending.value = true
      isStale.value = false
      data.value = undefined
      if (import.meta.client && cacheKey) {
        void offlineQueryCache.get<FunctionReturnType<Query>>(cacheKey).then((snapshot) => {
          if (generation === queryGeneration && snapshot) {
            data.value = snapshot.value
            isStale.value = true
            isPending.value = false
          }
        }).catch(() => undefined)
      }
      unsubscribe = convex.onUpdate(
        query,
        nextArgs,
        (value) => {
          data.value = value
          isStale.value = false
          isPending.value = false
          if (import.meta.client && cacheKey)
            void offlineQueryCache.set(cacheKey, value).catch(() => undefined)
        },
        (cause) => {
          error.value = cause
          isPending.value = false
          isStale.value = data.value !== undefined
        },
      )
    },
    { immediate: true, deep: true },
  )

  onUnmounted(stop)

  return {
    data: readonly(data),
    error: readonly(error),
    isPending: readonly(isPending),
    isStale: readonly(isStale),
  }
}
