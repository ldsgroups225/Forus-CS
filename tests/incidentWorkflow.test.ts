import { describe, expect, it } from 'vitest'
import {
  assertIncidentTransition,
  canTransitionIncident,
} from '../shared/incidentWorkflow'

describe('workflow des incidents', () => {
  it('permet la prise en charge et la résolution', () => {
    expect(canTransitionIncident('OPEN', 'IN_PROGRESS')).toBe(true)
    expect(canTransitionIncident('IN_PROGRESS', 'RESOLVED')).toBe(true)
    expect(canTransitionIncident('RESOLVED', 'CLOSED')).toBe(true)
  })

  it('empêche la réouverture d’un incident clôturé', () => {
    expect(() => assertIncidentTransition('CLOSED', 'OPEN'))
      .toThrow('INCIDENT_TRANSITION_FORBIDDEN')
  })
})
