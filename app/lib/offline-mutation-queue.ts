export const offlineOperations = [
  'clients.create',
  'carriers.create',
  'calls.log',
  'calls.createFollowUp',
  'incidents.create',
] as const

export type OfflineOperation = typeof offlineOperations[number]
export type OfflineMutationState = 'waiting' | 'sending' | 'failed'

export interface OfflineMutationIntent {
  id: string
  ownerId: string
  organizationId: string
  operation: OfflineOperation
  payload: string
  createdAt: number
  attempts: number
  state: OfflineMutationState
  retryAfter?: number
  lastError?: string
}

const databaseName = 'forus-cs-offline'
const storeName = 'mutation-queue'
const databaseVersion = 1

function retryAfter(attempts: number) {
  const delay = Math.min(1000 * 60 * 5, 1000 * 5 * 2 ** Math.min(attempts, 6))
  return Date.now() + delay + Math.round(Math.random() * 1000)
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true })
    request.addEventListener('error', () => reject(request.error), { once: true })
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true })
    transaction.addEventListener('abort', () => reject(transaction.error), { once: true })
    transaction.addEventListener('error', () => reject(transaction.error), { once: true })
  })
}

class IndexedDbOfflineMutationQueue {
  private databasePromise?: Promise<IDBDatabase>

  private openDatabase() {
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, databaseVersion)
        request.addEventListener('upgradeneeded', () => {
          if (!request.result.objectStoreNames.contains(storeName))
            request.result.createObjectStore(storeName, { keyPath: 'id' })
        })
        request.addEventListener('success', () => resolve(request.result), { once: true })
        request.addEventListener('error', () => reject(request.error), { once: true })
      })
    }
    return this.databasePromise
  }

  async list(ownerId?: string) {
    const database = await this.openDatabase()
    const transaction = database.transaction(storeName, 'readonly')
    const result = await requestResult(
      transaction.objectStore(storeName).getAll() as IDBRequest<OfflineMutationIntent[]>,
    )
    await transactionDone(transaction)
    return result
      .filter(intent => !ownerId || intent.ownerId === ownerId)
      .sort((left, right) => left.createdAt - right.createdAt)
  }

  async enqueue(input: {
    ownerId: string
    organizationId: string
    operation: OfflineOperation
    payload: unknown
    id?: string
  }) {
    const intent: OfflineMutationIntent = {
      id: input.id ?? crypto.randomUUID(),
      ownerId: input.ownerId,
      organizationId: input.organizationId,
      operation: input.operation,
      payload: JSON.stringify(input.payload),
      createdAt: Date.now(),
      attempts: 0,
      state: 'waiting',
    }
    await this.put(intent)
    return intent.id
  }

  async put(intent: OfflineMutationIntent) {
    const database = await this.openDatabase()
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(intent)
    await transactionDone(transaction)
  }

  async remove(id: string) {
    const database = await this.openDatabase()
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).delete(id)
    await transactionDone(transaction)
  }

  async clear() {
    const database = await this.openDatabase()
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).clear()
    await transactionDone(transaction)
  }

  async flush(ownerId: string, sender: (intent: OfflineMutationIntent) => Promise<void>) {
    const intents = await this.list(ownerId)
    for (const intent of intents) {
      if (intent.retryAfter && intent.retryAfter > Date.now())
        continue
      const sending = {
        ...intent,
        attempts: intent.attempts + 1,
        state: 'sending' as const,
        lastError: undefined,
      }
      await this.put(sending)
      try {
        await sender(sending)
        await this.remove(sending.id)
      }
      catch (cause) {
        await this.put({
          ...sending,
          state: 'waiting',
          retryAfter: retryAfter(sending.attempts),
          lastError: cause instanceof Error ? cause.message : 'OFFLINE_SYNC_FAILED',
        })
        if (!navigator.onLine)
          break
      }
    }
  }
}

export const offlineMutationQueue = new IndexedDbOfflineMutationQueue()
export const offlineMutationsEnabled = true
