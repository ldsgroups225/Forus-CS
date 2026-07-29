import type { IncidentStatus } from './domain'

const transitions: Record<IncidentStatus, readonly IncidentStatus[]> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: [],
}

export function canTransitionIncident(
  currentStatus: IncidentStatus,
  nextStatus: IncidentStatus,
) {
  return transitions[currentStatus].includes(nextStatus)
}

export function assertIncidentTransition(
  currentStatus: IncidentStatus,
  nextStatus: IncidentStatus,
) {
  if (!canTransitionIncident(currentStatus, nextStatus))
    throw new Error('INCIDENT_TRANSITION_FORBIDDEN')

  return nextStatus
}
