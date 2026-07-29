import type { FunctionReference } from 'convex/server'
import type { OfflineMutationIntent } from '~/lib/offline-mutation-queue'
import { offlineMutationQueue } from '~/lib/offline-mutation-queue'
import { api } from '../../convex/_generated/api'

const mutations = {
  'clients.create': api.clients.create,
  'carriers.create': api.carriers.create,
  'calls.log': api.calls.log,
  'calls.createFollowUp': api.calls.createFollowUp,
  'incidents.create': api.incidents.create,
} satisfies Record<string, FunctionReference<'mutation'>>

export default defineNuxtPlugin((nuxtApp) => {
  const pendingCount = useState('offline-mutation-count', () => 0)
  let flushing = false

  async function refreshCount() {
    pendingCount.value = (await offlineMutationQueue.list()).length
  }

  async function send(intent: OfflineMutationIntent) {
    const mutation = mutations[intent.operation]
    const payload: unknown = JSON.parse(intent.payload)
    await nuxtApp.$convex.mutation(mutation, payload as never)
  }

  async function flush() {
    if (flushing || !navigator.onLine)
      return
    flushing = true
    try {
      if (await nuxtApp.$ensureConvexAuth())
        await offlineMutationQueue.flush(send)
    }
    finally {
      flushing = false
      await refreshCount()
    }
  }

  window.addEventListener('online', flush)
  nuxtApp.hook('app:mounted', async () => {
    await refreshCount()
    await flush()
  })
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      window.removeEventListener('online', flush)
    })
  }
})
