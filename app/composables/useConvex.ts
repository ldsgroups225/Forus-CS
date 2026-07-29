import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from 'convex/server'

export function useConvexClient() {
  return useNuxtApp().$convex
}

export function useConvexQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: MaybeRefOrGetter<FunctionArgs<Query> | null>,
) {
  const convex = useConvexClient()
  const data = shallowRef<FunctionReturnType<Query>>()
  const error = shallowRef<Error>()
  const isPending = ref(true)
  let unsubscribe: (() => void) | undefined

  function stop() {
    unsubscribe?.()
    unsubscribe = undefined
  }

  watch(
    () => toValue(args),
    (nextArgs) => {
      stop()
      error.value = undefined

      if (nextArgs === null) {
        data.value = undefined
        isPending.value = false
        return
      }

      isPending.value = true
      unsubscribe = convex.onUpdate(
        query,
        nextArgs,
        (value) => {
          data.value = value
          isPending.value = false
        },
        (cause) => {
          error.value = cause
          isPending.value = false
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
  }
}
