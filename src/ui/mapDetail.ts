import { useSyncExternalStore } from 'react'

/**
 * Settings → Map detail. "outline" (default) uses only the app's bundled map data. "detailed" adds
 * OpenFreeMap tiles (streets, terrain, labels) and Photon place search, which are outside services.
 */
export type MapDetail = 'outline' | 'detailed'

const KEY = 'travel.mapDetail'
const listeners = new Set<() => void>()

function read(): MapDetail {
  try {
    return localStorage.getItem(KEY) === '"detailed"' ? 'detailed' : 'outline'
  } catch {
    return 'outline'
  }
}

let current = read()

export function setMapDetail(value: MapDetail) {
  current = value
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    // Not remembered on this device; still applies for this visit.
  }
  listeners.forEach((l) => l())
}

export function useMapDetail(): MapDetail {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}
