import { onMounted, onUnmounted } from 'vue'
import { createPostCallRecapTracker } from '~/lib/post-call-recap-tracker'

interface UsePostCallRecapOptions {
  onReturn: () => void
}

/** Opens the post-call recap only once the user returns from the native dialer. */
export function usePostCallRecap({ onReturn }: UsePostCallRecapOptions) {
  const tracker = createPostCallRecapTracker(onReturn)

  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden' || document.visibilityState === 'visible')
      tracker.handleVisibilityChange(document.visibilityState)
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', tracker.handleWindowFocus)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('focus', tracker.handleWindowFocus)
    tracker.cancel()
  })

  return {
    start: tracker.start,
    cancel: tracker.cancel,
  }
}
