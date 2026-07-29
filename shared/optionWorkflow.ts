import { deriveNeedProgress } from './needProgress'

export interface OptionAcceptanceResult {
  approvedTruckCount: number
  remainingTruckCount: number
  status: 'PARTIAL' | 'SATISFIED'
}

export function applyOptionAcceptance(
  requestedTruckCount: number,
  approvedTruckCount: number,
  proposedTruckCount: number,
  acceptedTruckCount: number,
): OptionAcceptanceResult {
  if (!Number.isInteger(proposedTruckCount) || proposedTruckCount <= 0)
    throw new Error('OPTION_PROPOSED_COUNT_INVALID')

  if (!Number.isInteger(acceptedTruckCount) || acceptedTruckCount <= 0)
    throw new Error('OPTION_ACCEPTED_COUNT_INVALID')

  if (acceptedTruckCount > proposedTruckCount)
    throw new Error('OPTION_ACCEPTED_COUNT_EXCEEDS_PROPOSAL')

  const currentProgress = deriveNeedProgress(requestedTruckCount, approvedTruckCount, false)
  if (acceptedTruckCount > currentProgress.remainingTruckCount)
    throw new Error('OPTION_ACCEPTED_COUNT_EXCEEDS_REMAINING')

  const nextProgress = deriveNeedProgress(
    requestedTruckCount,
    approvedTruckCount + acceptedTruckCount,
    false,
  )

  if (nextProgress.status !== 'PARTIAL' && nextProgress.status !== 'SATISFIED')
    throw new Error('OPTION_ACCEPTANCE_PROGRESS_INVALID')

  return {
    approvedTruckCount: approvedTruckCount + acceptedTruckCount,
    remainingTruckCount: nextProgress.remainingTruckCount,
    status: nextProgress.status,
  }
}
