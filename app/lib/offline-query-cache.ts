import { getFunctionName } from 'convex/server'

const databaseName = 'forus-cs-query-cache'
const storeName = 'query-cache'
const databaseVersion = 1
const maxAgeMs = 1000 * 60 * 60 * 24 * 7
const maxEntries = 250

export interface OfflineQuerySnapshot<T = unknown> {
  key: string
  value: T
  savedAt: number
  expiresAt: number
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

class OfflineQueryCache {
  private databasePromise?: Promise<IDBDatabase>

  private openDatabase() {
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, databaseVersion)
        request.addEventListener('upgradeneeded', () => {
          const database = request.result
          if (!database.objectStoreNames.contains(storeName))
            database.createObjectStore(storeName, { keyPath: 'key' })
        })
        request.addEventListener('success', () => resolve(request.result), { once: true })
        request.addEventListener('error', () => reject(request.error), { once: true })
      })
    }
    return this.databasePromise
  }

  async get<T>(key: string): Promise<OfflineQuerySnapshot<T> | undefined> {
    const database = await this.openDatabase()
    const transaction = database.transaction(storeName, 'readonly')
    const snapshot = await requestResult(
      transaction.objectStore(storeName).get(key) as IDBRequest<OfflineQuerySnapshot<T> | undefined>,
    )
    await transactionDone(transaction)
    if (snapshot && snapshot.expiresAt <= Date.now()) {
      await this.remove(key)
      return undefined
    }
    return snapshot
  }

  async set<T>(key: string, value: T) {
    const database = await this.openDatabase()
    const transaction = database.transaction(storeName, 'readwrite')
    const savedAt = Date.now()
    transaction.objectStore(storeName).put({
      key,
      value,
      savedAt,
      expiresAt: savedAt + maxAgeMs,
    } satisfies OfflineQuerySnapshot<T>)
    await transactionDone(transaction)
    await this.trim()
  }

  async remove(key: string) {
    const database = await this.openDatabase()
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).delete(key)
    await transactionDone(transaction)
  }

  async clear() {
    const database = await this.openDatabase()
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).clear()
    await transactionDone(transaction)
  }

  private async trim() {
    const database = await this.openDatabase()
    const transaction = database.transaction(storeName, 'readonly')
    const snapshots = await requestResult(
      transaction.objectStore(storeName).getAll() as IDBRequest<OfflineQuerySnapshot[]>,
    )
    await transactionDone(transaction)
    const removable = snapshots
      .filter(snapshot => snapshot.expiresAt <= Date.now())
      .sort((left, right) => left.savedAt - right.savedAt)
    const overflow = Math.max(0, snapshots.length - maxEntries)
    const oldest = snapshots
      .filter(snapshot => snapshot.expiresAt > Date.now())
      .sort((left, right) => left.savedAt - right.savedAt)
      .slice(0, overflow)
    await Promise.all([...removable, ...oldest].map(snapshot => this.remove(snapshot.key)))
  }
}

export const offlineQueryCache = new OfflineQueryCache()

export function offlineQueryKey(ownerId: string, query: Parameters<typeof getFunctionName>[0], args: unknown) {
  return JSON.stringify([ownerId, getFunctionName(query), args])
}
