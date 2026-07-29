import { describe, expect, it } from 'vitest'
import {
  assertMissionTransition,
  canTransitionMission,
  missionProgress,
  nextMissionStatuses,
} from '../shared/missionWorkflow'

describe('workflow des missions', () => {
  it('autorise le parcours nominal jusqu’à la clôture', () => {
    expect(canTransitionMission('CONFIRMED', 'MOBILIZING')).toBe(true)
    expect(canTransitionMission('MOBILIZING', 'LOADING')).toBe(true)
    expect(canTransitionMission('LOADING', 'IN_TRANSIT')).toBe(true)
    expect(canTransitionMission('IN_TRANSIT', 'DELIVERED')).toBe(true)
    expect(canTransitionMission('DELIVERED', 'COMPLETED')).toBe(true)
    expect(missionProgress('COMPLETED')).toBe(100)
  })

  it('interdit les sauts de statut et les transitions après clôture', () => {
    expect(() => assertMissionTransition('CONFIRMED', 'DELIVERED'))
      .toThrow('MISSION_TRANSITION_FORBIDDEN')
    expect(nextMissionStatuses('COMPLETED')).toEqual([])
  })

  it('n’autorise plus l’annulation après le départ', () => {
    expect(canTransitionMission('LOADING', 'CANCELLED')).toBe(true)
    expect(canTransitionMission('IN_TRANSIT', 'CANCELLED')).toBe(false)
  })
})
