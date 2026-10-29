import { useCallback, useSyncExternalStore } from 'react'

export type Page = 'map' | 'trips' | 'parks' | 'you'

/** (A Places page used to be here; old "#/places" links open the map.) */
const PAGES: Page[] = ['map', 'trips', 'parks', 'you']

/**
 * The page lives in the hash ("#/trips") so GitHub Pages needs no server rules, the installed app
 * opens on the map, and Back moves between pages.
 */
export function parseHash(hash: string): Page {
  const path = hash.replace(/^#\/?/, '').split('?')[0].replace(/\/+$/, '')
  return (PAGES as string[]).includes(path) ? (path as Page) : 'map'
}

export const pageHref = (page: Page) => (page === 'map' ? '#/' : `#/${page}`)

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener)
  window.addEventListener('popstate', listener)
  return () => {
    window.removeEventListener('hashchange', listener)
    window.removeEventListener('popstate', listener)
  }
}

export function usePage() {
  const page = parseHash(useSyncExternalStore(subscribe, () => window.location.hash))
  const goTo = useCallback((next: Page) => {
    if (parseHash(window.location.hash) !== next) window.location.hash = pageHref(next)
  }, [])
  return { page, goTo }
}
