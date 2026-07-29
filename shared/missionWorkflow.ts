import type { MissionStatus } from './domain'

const allowedTransitions: Record<MissionStatus, readonly MissionStatus[]> = {
  CONFIRMED: ['MOBILIZING', 'CANCELLED'],
  MOBILIZING: ['LOADING', 'CANCELLED'],
  LOADING: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}

export function canTransitionMission(
  currentStatus: MissionStatus,
  nextStatus: MissionStatus,
) {
  return allowedTransitions[currentStatus].includes(nextStatus)
}

export function nextMissionStatuses(status: MissionStatus) {
  return [...allowedTransitions[status]]
}

export function assertMissionTransition(
  currentStatus: MissionStatus,
  nextStatus: MissionStatus,
) {
  if (!canTransitionMission(currentStatus, nextStatus))
    throw new Error('MISSION_TRANSITION_FORBIDDEN')

  return nextStatus
}

export function missionProgress(status: MissionStatus) {
  const progress = {
    CONFIRMED: 10,
    MOBILIZING: 25,
    LOADING: 45,
    IN_TRANSIT: 70,
    DELIVERED: 90,
    COMPLETED: 100,
    CANCELLED: 0,
  } satisfies Record<MissionStatus, number>

  return progress[status]
}
