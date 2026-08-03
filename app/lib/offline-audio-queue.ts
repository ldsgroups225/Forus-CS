export interface OfflineAudioIntent {
  id: string
  ownerId: string
  organizationId: string
  audioHash: string
  mimeType: string
  audio?: Blob
  createdAt: number
  attempts: number
  retryAfter?: number
  jobId?: string
  state: 'waiting' | 'uploading' | 'submitted' | 'failed'
  lastError?: string
}

const databaseName = 'forus-cs-offline-audio'
const storeName = 'audio-queue'

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

class OfflineAudioQueue {
  private databasePromise?: Promise<IDBDatabase>

  private openDatabase() {
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1)
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
    const items = await requestResult(transaction.objectStore(storeName).getAll() as IDBRequest<OfflineAudioIntent[]>)
    await transactionDone(transaction)
    return items
      .filter(intent => !ownerId || intent.ownerId === ownerId)
      .sort((left, right) => left.createdAt - right.createdAt)
  }

  async enqueue(input: Omit<OfflineAudioIntent, 'id' | 'createdAt' | 'attempts' | 'state'>) {
    const intent: OfflineAudioIntent = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      attempts: 0,
      state: 'waiting',
    }
    await this.put(intent)
    return intent
  }

  async put(intent: OfflineAudioIntent) {
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
}

export const offlineAudioQueue = new OfflineAudioQueue()

export async function sha256(blob: Blob) {
  const bytes = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}
