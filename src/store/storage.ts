import type { TravelData } from '../lib/types.ts'

/** Where the device keeps its working copy of your data. */
export interface StorageBackend {
  kind: 'indexeddb' | 'memory'
  load(): Promise<TravelData | null>
  save(data: TravelData): Promise<void>
}

const DB_NAME = 'travel-log'
const STORE = 'kv'
const KEY = 'travel'

export function indexedDbBackend(factory: IDBFactory = indexedDB): StorageBackend {
  let db: Promise<IDBDatabase> | null = null
  const open = () =>
    (db ??= new Promise((resolve, reject) => {
      const req = factory.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    }))

  const run = <T,>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>) =>
    open().then(
      (d) =>
        new Promise<T>((resolve, reject) => {
          const tx = d.transaction(STORE, mode)
          const req = op(tx.objectStore(STORE))
          tx.oncomplete = () => resolve(req.result)
          tx.onerror = () => reject(tx.error)
          tx.onabort = () => reject(tx.error)
        }),
    )

  return {
    kind: 'indexeddb',
    load: async () => (await run<TravelData | undefined>('readonly', (s) => s.get(KEY))) ?? null,
    save: async (data) => {
      await run('readwrite', (s) => s.put(data, KEY))
    },
  }
}

/** Used when the browser blocks storage (some private-browsing modes). Data lasts until the tab closes. */
export function memoryBackend(initial: TravelData | null = null): StorageBackend {
  let saved = initial
  return {
    kind: 'memory',
    load: async () => saved,
    save: async (data) => {
      saved = structuredClone(data)
    },
  }
}

/** Picks IndexedDB when it works, otherwise memory. */
export async function defaultBackend(): Promise<StorageBackend> {
  try {
    const idb = indexedDbBackend()
    await idb.load()
    return idb
  } catch {
    return memoryBackend()
  }
}

/** Asks the browser not to clear this site's data under storage pressure (helps on iOS). */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
