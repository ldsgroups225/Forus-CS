import { getOfflineOwnerId } from '~/lib/offline-access'
import { offlineAudioQueue } from '~/lib/offline-audio-queue'
import { api } from '../../convex/_generated/api'

export default defineNuxtPlugin((nuxtApp) => {
  const session = nuxtApp.$authClient.useSession()
  let flushing = false

  function ownerId() {
    return session.value.data?.user?.id ?? getOfflineOwnerId()
  }

  async function notifyWhenCompleted(intentId: string, jobId: string) {
    for (let attempt = 0; attempt < 45; attempt += 1) {
      const job = await nuxtApp.$convex.query(api.transcriptions.get, { jobId: jobId as never })
      if (job?.status === 'COMPLETED') {
        window.dispatchEvent(new CustomEvent('forus:transcription-complete', {
          detail: { intentId, text: job.text ?? '' },
        }))
        await offlineAudioQueue.remove(intentId)
        return
      }
      if (job?.status === 'FAILED') {
        await offlineAudioQueue.remove(intentId)
        return
      }
      await new Promise(resolve => window.setTimeout(resolve, 1_000))
    }
  }

  async function flush() {
    if (flushing || !navigator.onLine || !await nuxtApp.$ensureConvexAuth())
      return
    const currentOwnerId = ownerId()
    if (!currentOwnerId)
      return
    flushing = true
    try {
      for (const intent of await offlineAudioQueue.list(currentOwnerId)) {
        if (intent.retryAfter && intent.retryAfter > Date.now())
          continue
        if (intent.state === 'submitted' && intent.jobId) {
          void notifyWhenCompleted(intent.id, intent.jobId)
          continue
        }
        if (!intent.audio) {
          await offlineAudioQueue.remove(intent.id)
          continue
        }
        try {
          await offlineAudioQueue.put({ ...intent, state: 'uploading', attempts: intent.attempts + 1, lastError: undefined })
          const requested = await nuxtApp.$convex.mutation(api.transcriptions.requestUpload, {
            organizationId: intent.organizationId as never,
            audioHash: intent.audioHash,
            mimeType: intent.mimeType,
          })
          if (requested.text) {
            window.dispatchEvent(new CustomEvent('forus:transcription-complete', { detail: { intentId: intent.id, text: requested.text } }))
            await offlineAudioQueue.remove(intent.id)
            continue
          }
          if (!requested.jobId || !requested.uploadUrl) {
            await offlineAudioQueue.put({ ...intent, state: 'waiting', retryAfter: requested.retryAfter })
            continue
          }
          const uploaded = await fetch(requested.uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': intent.mimeType },
            body: intent.audio,
          })
          if (!uploaded.ok)
            throw new Error('TRANSCRIPTION_UPLOAD_FAILED')
          const { storageId } = await uploaded.json() as { storageId: string }
          await nuxtApp.$convex.mutation(api.transcriptions.finalizeUpload, {
            jobId: requested.jobId,
            storageId: storageId as never,
          })
          await offlineAudioQueue.put({
            ...intent,
            audio: undefined,
            jobId: requested.jobId,
            retryAfter: undefined,
            state: 'submitted',
          })
          void notifyWhenCompleted(intent.id, requested.jobId)
        }
        catch (cause) {
          await offlineAudioQueue.put({
            ...intent,
            state: 'waiting',
            attempts: intent.attempts + 1,
            retryAfter: Date.now() + Math.min(1000 * 60 * 5, 1000 * 5 * 2 ** Math.min(intent.attempts + 1, 6)),
            lastError: cause instanceof Error ? cause.message : 'TRANSCRIPTION_QUEUE_FAILED',
          })
          if (!navigator.onLine)
            break
        }
      }
    }
    finally {
      flushing = false
    }
  }

  window.addEventListener('online', () => void flush())
  window.addEventListener('forus:flush-audio', () => void flush())
  nuxtApp.hook('app:mounted', () => void flush())
})
