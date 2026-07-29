export type OfflineMutationState = 'waiting' | 'sending' | 'failed'

export interface OfflineMutationIntent {
  id: string
  organizationId: string
  operation: string
  payload: string
  createdAt: number
  state: OfflineMutationState
}

export interface OfflineMutationQueue {
  enqueue: (intent: OfflineMutationIntent) => Promise<void>
  flush: () => Promise<void>
}

/**
 * Les mutations hors ligne sont volontairement désactivées dans ce sprint.
 * Cette frontière empêche les écrans métier d'écrire directement dans un
 * stockage local et permet d'ajouter plus tard une implémentation idempotente.
 */
export const offlineMutationsEnabled = false
