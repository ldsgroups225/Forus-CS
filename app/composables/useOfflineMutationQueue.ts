import type { OfflineOperation } from '~/lib/offline-mutation-queue'
import { getOfflineOwnerId } from '~/lib/offline-access'
import { offlineMutationQueue } from '~/lib/offline-mutation-queue'

export function useOfflineMutationQueue() {
  const pendingCount = useState('offline-mutation-count', () => 0)
  const { user } = useAuth()

  function ownerId() {
    return user.value?.id ?? getOfflineOwnerId()
  }

  async function refreshCount() {
    if (!import.meta.client)
      return
    pendingCount.value = (await offlineMutationQueue.list(ownerId())).length
  }

  async function enqueue(
    organizationId: string,
    operation: OfflineOperation,
    payload: Record<string, unknown>,
  ) {
    const idempotencyKey = typeof payload.idempotencyKey === 'string'
      ? payload.idempotencyKey
      : crypto.randomUUID()
    const currentOwnerId = ownerId()
    if (!currentOwnerId)
      throw new Error('OFFLINE_OWNER_MISSING')
    const id = await offlineMutationQueue.enqueue({
      ownerId: currentOwnerId,
      organizationId,
      operation,
      payload: { ...payload, idempotencyKey },
      id: idempotencyKey,
    })
    await refreshCount()
    return id
  }

  return {
    enqueue,
    pendingCount: readonly(pendingCount),
    refreshCount,
  }
}
