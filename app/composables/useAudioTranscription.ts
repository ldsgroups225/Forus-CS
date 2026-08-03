import type { Id } from '../../convex/_generated/dataModel'
import { getOfflineOwnerId } from '~/lib/offline-access'
import { offlineAudioQueue, sha256 } from '~/lib/offline-audio-queue'

export function useAudioTranscription() {
  const { user } = useAuth()

  async function enqueue(organizationId: Id<'organizations'>, audio: Blob) {
    const ownerId = user.value?.id ?? getOfflineOwnerId()
    if (!ownerId)
      throw new Error('OFFLINE_OWNER_MISSING')
    const intent = await offlineAudioQueue.enqueue({
      ownerId,
      organizationId,
      audioHash: await sha256(audio),
      mimeType: audio.type || 'audio/webm',
      audio,
    })
    window.dispatchEvent(new Event('forus:flush-audio'))
    return intent.id
  }

  return { enqueue }
}
