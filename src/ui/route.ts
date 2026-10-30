import { useCallback, useMemo, useSyncExternalStore } from 'react'

export type Page = 'map' | 'trips' | 'parks' | 'you'

/** The parts of the You page, each with its own address ("#/you/settings"). */
export type YouSection = 'profile' | 'achievements' | 'people' | 'settings'

/** Where you are: the page, plus the place and trip open on Trips or the section of You. */
export type Route = { page: Page; placeId: string | null; tripId: string | null; section: YouSection }

/** (A Places page used to be here; old "#/places" links open the map.) */
const PAGES: Page[] = ['map', 'trips', 'parks', 'you']
const SECTIONS: YouSection[] = ['profile', 'achievements', 'people', 'settings']

/**
 * The page lives in the hash ("#/trips", "#/trips/<trip>", "#/trips/at/<place>/<trip>",
 * "#/you/settings") so GitHub Pages needs no server rules, the installed app opens on the map, and
 * Back moves between pages and views.
 * Anything unknown falls back to the nearest page it names, else the map.
 */
export function parseHash(hash: string): Route {
  const [first = '', ...parts] = hash.replace(/^#\/?/, '').split('?')[0].replace(/\/+$/, '').split('/')
  const page = (PAGES as string[]).includes(first) ? (first as Page) : 'map'
  const [second = '', third = '', fourth = ''] = parts.map(decodeURIComponent)
  const atPlace = page === 'trips' && second === 'at' && third !== ''
  return {
    page,
    placeId: atPlace ? third : null,
    tripId: page !== 'trips' ? null : atPlace ? fourth || null : second || null,
    section: page === 'you' && (SECTIONS as string[]).includes(second) ? (second as YouSection) : 'profile',
  }
}

export const pageHref = (page: Page) => (page === 'map' ? '#/' : `#/${page}`)
/** A trip's own address, for its details. */
export const tripHref = (tripId: string) => `#/trips/${encodeURIComponent(tripId)}`
/** A place's trips (a map pin), or one of them reached from the place. */
export const placeHref = (placeId: string, tripId?: string | null) =>
  `#/trips/at/${encodeURIComponent(placeId)}${tripId ? `/${encodeURIComponent(tripId)}` : ''}`
/** A section of the You page; the profile is the page itself. */
export const youHref = (section: YouSection) => (section === 'profile' ? '#/you' : `#/you/${section}`)

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener)
  window.addEventListener('popstate', listener)
  return () => {
    window.removeEventListener('hashchange', listener)
    window.removeEventListener('popstate', listener)
  }
}

/** Goes to an address. Marks the new history entry as opened from inside the app, so closing it can go Back. */
function navigate(href: string, { replace = false } = {}) {
  if (window.location.hash === href || (href === '#/' && window.location.hash === '')) return
  if (replace) {
    const inApp = Boolean(window.history.state?.inApp)
    window.location.replace(href)
    window.history.replaceState({ inApp }, '')
  } else {
    window.location.hash = href
    window.history.replaceState({ inApp: true }, '')
  }
}

/**
 * Closes a view: Back if the app opened it (so Forward reopens it), otherwise, for a link opened
 * straight to it, swaps in the address of the view it sits on.
 */
function close(fallbackHref: string) {
  if (window.history.state?.inApp) window.history.back()
  else navigate(fallbackHref, { replace: true })
}

/** The current address, and ways to move between pages and views. */
export function useRoute() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  const route = useMemo(() => parseHash(hash), [hash])
  const goTo = useCallback((page: Page) => navigate(pageHref(page)), [])
  return { ...route, goTo, navigate, close }
}
