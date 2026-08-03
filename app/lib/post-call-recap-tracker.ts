export type CallPageVisibility = 'hidden' | 'visible'

/** Tracks an outbound native dialer session without inferring whether it connected. */
export function createPostCallRecapTracker(onReturn: () => void) {
  let awaitingReturn = false
  let appWasHidden = false

  function completeReturn() {
    if (!awaitingReturn || !appWasHidden)
      return

    awaitingReturn = false
    appWasHidden = false
    onReturn()
  }

  return {
    start() {
      awaitingReturn = true
      appWasHidden = false
    },
    cancel() {
      awaitingReturn = false
      appWasHidden = false
    },
    handleVisibilityChange(visibility: CallPageVisibility) {
      if (!awaitingReturn)
        return

      if (visibility === 'hidden') {
        appWasHidden = true
        return
      }

      completeReturn()
    },
    handleWindowFocus() {
      completeReturn()
    },
  }
}
