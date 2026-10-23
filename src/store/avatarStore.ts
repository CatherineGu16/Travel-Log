/**
 * Photo avatars on this device: photos you picked (waiting to upload) and photos downloaded from
 * your private repo, cached so each one downloads once. Keyed by person; a newer photo replaces it.
 */
export interface AvatarRecord {
  personId: string
  /** Matches the person's avatar.photoUpdatedAt, so a replaced photo is never shown stale. */
  photoUpdatedAt: string
  blob: Blob
  /** True until it's uploaded to GitHub. */
  pending: boolean
}

export interface AvatarStore {
  get(personId: string): Promise<AvatarRecord | null>
  put(record: AvatarRecord): Promise<void>
  pending(): Promise<AvatarRecord[]>
  /** Notifies when a photo is added or downloaded, so avatars on screen refresh. */
  subscribe(listener: (personId: string) => void): () => void
}

const DB_NAME = 'travel-log-avatars'
const STORE = 'avatars'

function withListeners(base: Omit<AvatarStore, 'subscribe'>): AvatarStore {
  const listeners = new Set<(personId: string) => void>()
  return {
    ...base,
    async put(record) {
      await base.put(record)
      listeners.forEach((l) => l(record.personId))
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/**
 * What IndexedDB holds: the photo as bytes plus its type. Safari refuses to store Blobs in
 * IndexedDB in private browsing, but stores ArrayBuffers anywhere.
 */
type StoredAvatar = Omit<AvatarRecord, 'blob'> & { bytes: ArrayBuffer; type: string }

const toStored = async ({ blob, ...rest }: AvatarRecord): Promise<StoredAvatar> => ({ ...rest, bytes: await blob.arrayBuffer(), type: blob.type })
const fromStored = ({ bytes, type, ...rest }: StoredAvatar): AvatarRecord => ({ ...rest, blob: new Blob([bytes], { type }) })

export function indexedDbAvatars(factory: IDBFactory = indexedDB): AvatarStore {
  let db: Promise<IDBDatabase> | null = null
  const open = () =>
    (db ??= new Promise((resolve, reject) => {
      const req = factory.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'personId' })
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
  return withListeners({
    get: async (personId) => {
      const stored = await run<StoredAvatar | undefined>('readonly', (s) => s.get(personId))
      return stored ? fromStored(stored) : null
    },
    put: async (record) => {
      const stored = await toStored(record)
      await run('readwrite', (s) => s.put(stored))
    },
    pending: async () => (await run<StoredAvatar[]>('readonly', (s) => s.getAll())).filter((r) => r.pending).map(fromStored),
  })
}

/** When the browser blocks storage: photos last until the tab closes. */
export function memoryAvatars(): AvatarStore {
  const records = new Map<string, AvatarRecord>()
  return withListeners({
    get: async (id) => records.get(id) ?? null,
    put: async (r) => {
      records.set(r.personId, r)
    },
    pending: async () => [...records.values()].filter((r) => r.pending),
  })
}

export async function defaultAvatarStore(): Promise<AvatarStore> {
  try {
    const store = indexedDbAvatars()
    await store.get('probe')
    return store
  } catch {
    return memoryAvatars()
  }
}
