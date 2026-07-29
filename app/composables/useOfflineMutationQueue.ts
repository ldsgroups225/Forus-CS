import type { OfflineOperation } from '~/lib/offline-mutation-queue'
import { offlineMutationQueue } from '~/lib/offline-mutation-queue'

export function useOfflineMutationQueue() {
  const pendingCount = useState('offline-mutation-count', () => 0)

  async function refreshCount() {
    if (!import.meta.client)
      return
    pendingCount.value = (await offlineMutationQueue.list()).length
  }

  async function enqueue(
    organizationId: string,
    operation: OfflineOperation,
    payload: Record<string, unknown>,
  ) {
    const idempotencyKey = typeof payload.idempotencyKey === 'string'
      ? payload.idempotencyKey
      : crypto.randomUUID()
    const id = await offlineMutationQueue.enqueue({
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
