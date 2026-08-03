import type { Id } from '../../convex/_generated/dataModel'
import { api } from '../../convex/_generated/api'

export function useTeamPresence(organizationId: MaybeRefOrGetter<Id<'organizations'> | undefined>) {
  const { $convex } = useNuxtApp()
  const sessionId = shallowRef('')
  const args = computed(() => {
    const id = toValue(organizationId)
    return id ? { organizationId: id } : null
  })
  const result = useConvexQuery(api.presence.listTeam, args)
  let timer: number | undefined

  async function heartbeat() {
    if (!import.meta.client || !args.value || !navigator.onLine)
      return
    if (!sessionId.value)
      sessionId.value = crypto.randomUUID()
    await $convex.mutation(api.presence.heartbeat, {
      organizationId: args.value.organizationId,
      sessionId: sessionId.value,
    })
  }

  onMounted(() => {
    void heartbeat()
    timer = window.setInterval(() => void heartbeat(), 30_000)
  })
  onUnmounted(() => {
    if (timer)
      window.clearInterval(timer)
  })

  return { members: result.data }
}
