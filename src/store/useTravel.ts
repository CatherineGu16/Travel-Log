import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { loadAddedHikes } from '../lib/addedHikes.ts'
import { loadParkHikes } from '../lib/gazetteer.ts'
import type { Person } from '../lib/types.ts'
import { githubApi } from '../sync/github.ts'
import { createSyncEngine, localStorageMeta, type ShareHikes, type SyncEngine } from '../sync/syncEngine.ts'
import { defaultAvatarStore, type AvatarStore } from './avatarStore.ts'
import { defaultBackend, requestPersistence } from './storage.ts'
import { createTravelStore, type TravelStore } from './travelStore.ts'

export interface AppServices {
  store: TravelStore
  sync: SyncEngine
  avatars: AvatarStore
}

let servicesPromise: Promise<AppServices> | null = null

/** Opens device storage and starts GitHub sync (if set up) once per page load. */
export function loadServices(): Promise<AppServices> {
  return (servicesPromise ??= (async () => {
    const [backend, avatars] = await Promise.all([defaultBackend(), defaultAvatarStore()])
    const store = createTravelStore(backend)
    await store.init()
    void requestPersistence()
    const sync = createSyncEngine(store, githubApi(), localStorageMeta(), avatars, { shareHikes: shareHikesTo(PUBLIC_REPO) })
    sync.start()
    return { store, sync, avatars }
  })())
}

/** The app's own public repo, where hikes you type in are shared as suggestions ("owner/repo"). */
const PUBLIC_REPO = __PUBLIC_REPO__

function shareHikesTo(repo: string): ShareHikes {
  const [owner, name] = repo.split('/')
  return {
    owner,
    repo: name,
    known: async () => {
      const [nps, added] = await Promise.all([loadParkHikes(), loadAddedHikes()])
      return (parkId) => [...(nps[parkId] ?? []).map((h) => h.name), ...(added[parkId] ?? []).map((h) => h.name)]
    },
  }
}

export const ServicesContext = createContext<AppServices | null>(null)

function useServices(): AppServices {
  const services = useContext(ServicesContext)
  if (!services) throw new Error('Needs a ServicesContext provider')
  return services
}

export const useStore = () => useServices().store
export const useSync = () => useServices().sync
export const useAvatars = () => useServices().avatars

export function useTravelState() {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, store.getState)
}

export function useSyncState() {
  const sync = useSync()
  return useSyncExternalStore(sync.subscribe, sync.getState)
}

/**
 * A person's photo avatar as an image URL: from this device's cache, or downloaded once from the
 * private repo. Null while it isn't available (initials show instead).
 */
export function useAvatarPhoto(person: Pick<Person, 'id' | 'avatar'> | null): string | null {
  const services = useContext(ServicesContext)
  const id = person?.id
  const stamp = person?.avatar.kind === 'photo' ? person.avatar.photoUpdatedAt : null
  // Kept with the photo version it shows, so a replaced photo never shows the old image.
  const [shown, setShown] = useState<{ key: string; url: string } | null>(null)
  const key = `${id}|${stamp}`
  useEffect(() => {
    if (!services || !id || !stamp) return
    let cancelled = false
    let current: string | null = null
    const show = async (allowDownload: boolean) => {
      const record = await services.avatars.get(id)
      if (cancelled) return
      if (record && record.photoUpdatedAt === stamp) {
        if (current) URL.revokeObjectURL(current)
        current = URL.createObjectURL(record.blob)
        setShown({ key: `${id}|${stamp}`, url: current })
      } else if (allowDownload) await services.sync.downloadAvatar(id, stamp)
    }
    void show(true)
    const off = services.avatars.subscribe((changed) => changed === id && void show(false))
    return () => {
      cancelled = true
      off()
      if (current) URL.revokeObjectURL(current)
    }
  }, [services, id, stamp])
  return shown?.key === key ? shown.url : null
}

export const newId = () => crypto.randomUUID()
