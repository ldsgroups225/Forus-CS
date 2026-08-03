import { describe, expect, it, vi } from 'vitest'
import { createPostCallRecapTracker } from '../app/lib/post-call-recap-tracker'

describe('suivi de retour d\'appel', () => {
  it('n’ouvre le récapitulatif qu’après le retour depuis le dialer', () => {
    const onReturn = vi.fn()
    const tracker = createPostCallRecapTracker(onReturn)

    tracker.start()
    tracker.handleVisibilityChange('hidden')

    expect(onReturn).not.toHaveBeenCalled()

    tracker.handleVisibilityChange('visible')

    expect(onReturn).toHaveBeenCalledTimes(1)
  })

  it('n’ouvre pas de récapitulatif si le dialer n’a pas fait quitter l’application', () => {
    const onReturn = vi.fn()
    const tracker = createPostCallRecapTracker(onReturn)

    tracker.start()
    tracker.handleVisibilityChange('visible')
    tracker.handleWindowFocus()

    expect(onReturn).not.toHaveBeenCalled()
  })

  it('ignore les événements supplémentaires après le retour d’appel', () => {
    const onReturn = vi.fn()
    const tracker = createPostCallRecapTracker(onReturn)

    tracker.start()
    tracker.handleVisibilityChange('hidden')
    tracker.handleWindowFocus()
    tracker.handleVisibilityChange('visible')

    expect(onReturn).toHaveBeenCalledTimes(1)
  })
})
