import type { NeedStatus } from './domain'

export interface NeedProgress {
  remainingTruckCount: number
  status: Exclude<NeedStatus, 'DRAFT'>
}

export function deriveNeedProgress(
  requestedTruckCount: number,
  approvedTruckCount: number,
  cancelled: boolean,
): NeedProgress {
  if (!Number.isInteger(requestedTruckCount) || requestedTruckCount <= 0)
    throw new Error('La quantité demandée doit être un entier strictement positif.')

  if (!Number.isInteger(approvedTruckCount) || approvedTruckCount < 0)
    throw new Error('Le nombre de camions OK doit être un entier positif ou nul.')

  const remainingTruckCount = Math.max(0, requestedTruckCount - approvedTruckCount)

  if (cancelled)
    return { remainingTruckCount, status: 'CANCELLED' }

  if (remainingTruckCount === 0)
    return { remainingTruckCount, status: 'SATISFIED' }

  if (approvedTruckCount > 0)
    return { remainingTruckCount, status: 'PARTIAL' }

  return { remainingTruckCount, status: 'OPEN' }
}
