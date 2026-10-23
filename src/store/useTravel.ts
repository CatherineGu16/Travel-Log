import { createContext, useContext, useSyncExternalStore } from 'react'
import { defaultBackend, requestPersistence } from './storage.ts'
import { createTravelStore, type TravelStore } from './travelStore.ts'

let storePromise: Promise<TravelStore> | null = null

/** Opens device storage once per page load. */
export function loadStore(): Promise<TravelStore> {
  return (storePromise ??= (async () => {
    const store = createTravelStore(await defaultBackend())
    await store.init()
    void requestPersistence()
    return store
  })())
}

export const StoreContext = createContext<TravelStore | null>(null)

export function useStore(): TravelStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore needs a StoreContext provider')
  return store
}

export function useTravelState() {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, store.getState)
}

export const newId = () => crypto.randomUUID()
