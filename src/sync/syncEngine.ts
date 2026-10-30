import { ADDED_HIKES_PATH, parseAddedHikes, sameHikeName, unsharedHikes, withHikes } from '../lib/addedHikes.ts'
import { HIKE_EDITS_PATH, parsePublicHikeEdits, withHikeEdits } from '../lib/hikeEdits.ts'
import { mergeData, sameContent } from '../lib/travelData.ts'
import type { TravelData } from '../lib/types.ts'
import type { AvatarStore } from '../store/avatarStore.ts'
import type { TravelStore } from '../store/travelStore.ts'
import { avatarPath, SyncError, type RemoteApi, type SyncErrorKind, type SyncTarget } from './github.ts'

export interface SyncConfig extends SyncTarget {
  deviceName: string
}

/** Remembered per device: where to sync, and the last file version this device saw. */
export interface SyncMeta {
  config: SyncConfig | null
  sha: string | null
  /**
   * Edits made here that GitHub doesn't have yet. A flag rather than a timestamp comparison, so a
   * device whose clock runs fast can't hide another device's edits.
   */
  dirty: boolean
  lastSyncedAt: string | null
  /** Hikes this device has already added to the public list ("parkId|name"), so it doesn't ask again. */
  sharedHikes?: string[]
  /** Hike corrections already written to the public file ("id@updatedAt"). */
  sharedEdits?: string[]
}

/** Sharing the hikes you type in to the app's public repo, where they become suggestions. */
export interface ShareHikes {
  owner: string
  repo: string
  /** Every hike name already suggested for a park (NPS hikes and the shared list in this build). */
  known: () => Promise<(parkId: string) => string[]>
}

export interface MetaStore {
  load(): SyncMeta
  save(meta: SyncMeta): void
}

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'pending' | 'offline' | 'error'

export interface SyncState {
  status: SyncStatus
  lastSyncedAt: string | null
  error: string | null
  errorKind: SyncErrorKind | null
  config: Omit<SyncConfig, 'token'> | null
  /** Whether hikes you type in are shared to the public list (only for the public repo's owner). */
  sharesHikes: boolean
  /** Photos waiting to upload, for "Uploading 2 photos…". */
  uploading: number
  /** Why the hikes you added couldn't be shared to the public list (your own sync still worked). */
  shareError: string | null
}

const EMPTY_META: SyncMeta = { config: null, sha: null, dirty: false, lastSyncedAt: null }
const MAX_CONFLICT_RETRIES = 3

export function localStorageMeta(key = 'travel.sync.v1'): MetaStore {
  return {
    load() {
      try {
        return { ...EMPTY_META, ...JSON.parse(localStorage.getItem(key) ?? '{}') }
      } catch {
        return EMPTY_META
      }
    },
    save(meta) {
      try {
        localStorage.setItem(key, JSON.stringify(meta))
      } catch {
        // Sync still works for this visit; setup is asked again next time.
      }
    },
  }
}

export interface SyncEngine {
  getState(): SyncState
  subscribe(listener: () => void): () => void
  /** Checks the repo is private and reachable, then syncs for the first time. */
  connect(config: SyncConfig): Promise<void>
  /** Forgets the access key on this device. Local data stays. */
  disconnect(): void
  syncNow(): Promise<void>
  /** Downloads a person's photo avatar into this device's cache. False when it can't (offline, not set up, missing). */
  downloadAvatar(personId: string, photoUpdatedAt: string): Promise<boolean>
  /** Starts listening for edits, focus and reconnects. Returns a stop function. */
  start(): () => void
}

/**
 * Keeps this device's data and travel.json in the private repo in step, same design as
 * Watchlist-Tracker: edits save locally at once, then sync after a short pause; on a conflict it
 * re-reads, merges record by record, and retries. Photo avatars upload before the travel.json that
 * points to them, so another device never sees a photo record without its file.
 */
export function createSyncEngine(
  store: TravelStore,
  api: RemoteApi,
  metaStore: MetaStore,
  avatars: AvatarStore,
  opts: { debounceMs?: number; clock?: () => Date; isOnline?: () => boolean; shareHikes?: ShareHikes } = {},
): SyncEngine {
  const debounceMs = opts.debounceMs ?? 3000
  const clock = opts.clock ?? (() => new Date())
  const isOnline = opts.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  let meta = metaStore.load()
  /** Only the public repo's owner shares hikes there. */
  const canShare = (config: Pick<SyncConfig, 'owner'>) => !!opts.shareHikes && config.owner.toLowerCase() === opts.shareHikes.owner.toLowerCase()
  const publicConfig = (c: SyncConfig | null) => (c ? { owner: c.owner, repo: c.repo, path: c.path, deviceName: c.deviceName } : null)
  let state: SyncState = {
    status: meta.config ? (hasLocalChanges() ? 'pending' : 'synced') : 'off',
    lastSyncedAt: meta.lastSyncedAt,
    error: null,
    errorKind: null,
    config: publicConfig(meta.config),
    uploading: 0,
    shareError: null,
    sharesHikes: !!meta.config && canShare(meta.config),
  }
  const listeners = new Set<() => void>()
  const set = (patch: Partial<SyncState>) => {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  }
  const saveMeta = (patch: Partial<SyncMeta>) => {
    meta = { ...meta, ...patch }
    metaStore.save(meta)
  }

  function hasLocalChanges() {
    return meta.dirty || meta.sha === null
  }

  let running: Promise<void> | null = null
  let again = false
  /** Bumped on every local edit, so a sync knows whether edits landed while it was running. */
  let editSeq = 0
  let applyingSync = false
  let lastData = store.getState().data
  let onLocalEdit: (() => void) | undefined
  store.subscribe(() => {
    const data = store.getState().data
    if (data === lastData) return
    lastData = data
    if (applyingSync) return
    editSeq++
    if (meta.config && !meta.dirty) saveMeta({ dirty: true })
    onLocalEdit?.()
  })
  // A new photo is a local change too, even before the person record is saved.
  avatars.subscribe(() => onLocalEdit?.())

  /** Uploads photos picked on this device that are still current for their person (or your profile). */
  async function uploadAvatars(config: SyncConfig, data: TravelData) {
    const owners = [...data.people, ...(data.profile ? [data.profile] : [])]
    const queue = (await avatars.pending()).filter((r) => {
      const person = owners.find((p) => p.id === r.personId && !p.deleted)
      return person?.avatar.kind === 'photo' && person.avatar.photoUpdatedAt === r.photoUpdatedAt
    })
    set({ uploading: queue.length })
    for (const [i, record] of queue.entries()) {
      await api.putBlob(config, avatarPath(record.personId), record.blob, `Update photo from ${config.deviceName}`)
      await avatars.put({ ...record, pending: false })
      set({ uploading: queue.length - i - 1 })
    }
  }

  async function syncOnce(config: SyncConfig): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      const remote = await api.getFile(config)
      const local = store.getState().data
      const merged = remote ? mergeData(local, remote.data) : local

      if (!sameContent(merged, local)) {
        applyingSync = true
        try {
          store.applySynced(merged)
        } finally {
          applyingSync = false
        }
      }
      await uploadAvatars(config, merged)
      if (remote && sameContent(merged, remote.data)) {
        saveMeta({ sha: remote.sha })
        return
      }
      try {
        const sha = await api.putFile(config, merged, remote?.sha ?? null, `Update travel log from ${config.deviceName}`)
        saveMeta({ sha })
        return
      } catch (e) {
        // Someone else saved between our read and write: read again and re-merge.
        if (e instanceof SyncError && e.kind === 'conflict' && attempt < MAX_CONFLICT_RETRIES) continue
        throw e
      }
    }
  }

  /**
   * Adds the hikes you typed in yourself to the public list (name and park only), once each. Run
   * after your own data has synced, with the same access key, which needs write access to the
   * public repo too. Only the public repo's owner shares: anyone else's key can't write there
   * (GitHub refuses it), so for them this is skipped rather than reported as an error.
   */
  async function shareAddedHikes(config: SyncConfig) {
    const share = opts.shareHikes
    if (!share || !canShare(config)) return
    const known = await share.known()
    const shared = new Set(meta.sharedHikes ?? [])
    const keyOf = (h: { parkId: string; name: string }) => `${h.parkId}|${h.name.toLowerCase()}`
    const todo = unsharedHikes(store.getState().data, known).filter((h) => !shared.has(keyOf(h)))
    if (todo.length === 0) return
    const target: SyncTarget = { owner: share.owner, repo: share.repo, path: ADDED_HIKES_PATH, token: config.token }
    for (let attempt = 0; ; attempt++) {
      const file = await api.getJson(target, ADDED_HIKES_PATH)
      const list = parseAddedHikes(file?.value)
      const fresh = todo.filter((h) => !(list[h.parkId] ?? []).some((x) => sameHikeName(x.name, h.name)))
      if (fresh.length === 0) break
      const message = fresh.length === 1 ? `Add hike: ${fresh[0].name} (${fresh[0].parkId})` : `Add ${fresh.length} hikes from ${config.deviceName}`
      try {
        await api.putJson(target, ADDED_HIKES_PATH, withHikes(list, fresh, clock().toISOString()), file?.sha ?? null, message)
        break
      } catch (e) {
        if (e instanceof SyncError && e.kind === 'conflict' && attempt < MAX_CONFLICT_RETRIES) continue
        throw e
      }
    }
    saveMeta({ sharedHikes: [...shared, ...todo.map(keyOf)] })
  }

  /** Writes your corrections to the NPS hike suggestions (and resets) to the public file, once each. */
  async function shareHikeEdits(config: SyncConfig) {
    const share = opts.shareHikes
    if (!share || !canShare(config)) return
    const shared = new Set(meta.sharedEdits ?? [])
    const keyOf = (e: { id: string; updatedAt: string; deleted?: boolean }) => `${e.id}@${e.updatedAt}${e.deleted ? ' reset' : ''}`
    const todo = store.getState().data.hikeEdits.filter((e) => !shared.has(keyOf(e)))
    if (todo.length === 0) return
    const target: SyncTarget = { owner: share.owner, repo: share.repo, path: HIKE_EDITS_PATH, token: config.token }
    for (let attempt = 0; ; attempt++) {
      const file = await api.getJson(target, HIKE_EDITS_PATH)
      const current = parsePublicHikeEdits(file?.value)
      const next = withHikeEdits(current, todo)
      if (JSON.stringify(next) === JSON.stringify(current)) break
      const message = todo.length === 1 ? `${todo[0].deleted ? 'Reset' : 'Correct'} hike: ${todo[0].name} (${todo[0].parkId})` : `Correct ${todo.length} hikes`
      try {
        await api.putJson(target, HIKE_EDITS_PATH, next, file?.sha ?? null, message)
        break
      } catch (e) {
        if (e instanceof SyncError && e.kind === 'conflict' && attempt < MAX_CONFLICT_RETRIES) continue
        throw e
      }
    }
    saveMeta({ sharedEdits: [...shared, ...todo.map(keyOf)] })
  }

  async function syncNow(): Promise<void> {
    const config = meta.config
    if (!config) return
    if (running) {
      again = true
      return running
    }
    if (!isOnline()) {
      set({ status: 'offline' })
      return
    }
    set({ status: 'syncing', error: null, errorKind: null })
    const seqAtStart = editSeq
    running = (async () => {
      try {
        await syncOnce(config)
        if (editSeq === seqAtStart) saveMeta({ dirty: false })
        const now = clock().toISOString()
        saveMeta({ lastSyncedAt: now })
        set({ status: hasLocalChanges() ? 'pending' : 'synced', lastSyncedAt: now, uploading: 0 })
        try {
          await shareAddedHikes(config)
          await shareHikeEdits(config)
          if (state.shareError) set({ shareError: null })
        } catch (e) {
          const share = opts.shareHikes!
          set({ shareError: `Couldn't update the public hike list in ${share.owner}/${share.repo}: ${(e as Error).message}` })
        }
      } catch (e) {
        const err = e instanceof SyncError ? e : new SyncError('other', (e as Error).message)
        set({ status: err.kind === 'network' ? 'offline' : 'error', error: err.message, errorKind: err.kind })
      } finally {
        running = null
      }
      if (again) {
        again = false
        await syncNow()
      }
    })()
    return running
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async connect(config) {
      set({ status: 'syncing', error: null, errorKind: null })
      try {
        await api.checkRepo(config)
      } catch (e) {
        const err = e instanceof SyncError ? e : new SyncError('other', (e as Error).message)
        set({ status: meta.config ? state.status : 'off', error: err.message, errorKind: err.kind })
        throw err
      }
      // A new repo or file means this device hasn't seen any of it yet.
      saveMeta({ config, sha: null, dirty: true })
      set({ config: publicConfig(config), sharesHikes: canShare(config) })
      await syncNow()
    },
    disconnect() {
      saveMeta({ ...EMPTY_META })
      set({ status: 'off', config: null, error: null, errorKind: null, lastSyncedAt: null, shareError: null, sharesHikes: false })
    },
    syncNow,
    async downloadAvatar(personId, photoUpdatedAt) {
      const config = meta.config
      if (!config || !isOnline()) return false
      try {
        const blob = await api.getBlob(config, avatarPath(personId))
        if (!blob) return false
        await avatars.put({ personId, photoUpdatedAt, blob, pending: false })
        return true
      } catch {
        return false
      }
    },
    start() {
      let timer: ReturnType<typeof setTimeout> | undefined
      onLocalEdit = () => {
        if (!meta.config) return
        if (state.status !== 'syncing') set({ status: 'pending' })
        clearTimeout(timer)
        timer = setTimeout(() => void syncNow(), debounceMs)
      }
      const onVisible = () => document.visibilityState === 'visible' && void syncNow()
      const onOnline = () => void syncNow()
      if (typeof window !== 'undefined') {
        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('online', onOnline)
      }
      void syncNow()
      return () => {
        clearTimeout(timer)
        onLocalEdit = undefined
        if (typeof window !== 'undefined') {
          document.removeEventListener('visibilitychange', onVisible)
          window.removeEventListener('online', onOnline)
        }
      }
    },
  }
}
