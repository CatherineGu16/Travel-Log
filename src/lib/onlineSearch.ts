import type { SearchResult } from './placeSearch.ts'
import { STATE_NAMES } from './states.ts'

const STATE_CODES = new Map(Object.entries(STATE_NAMES).map(([code, name]) => [name.toLowerCase(), code]))
// Phase 1 covers the US and its territories.
const US_BBOX = '-171,17,-64,72'

interface PhotonFeature {
  properties: { name?: string; city?: string; county?: string; state?: string; countrycode?: string; osm_value?: string }
  geometry: { coordinates: [number, number] }
}

/**
 * Landmarks, businesses and addresses from Photon (OpenStreetMap data). Only used when the
 * detailed map is turned on; it sees what you typed, never your token or trips.
 */
export async function searchOnline(query: string, signal?: AbortSignal, fetchFn: typeof fetch = fetch): Promise<SearchResult[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lang=en&bbox=${US_BBOX}`
  const res = await fetchFn(url, { signal })
  if (!res.ok) return []
  const body = (await res.json()) as { features?: PhotonFeature[] }
  return (body.features ?? [])
    .filter((f) => f.properties.name)
    .map((f) => {
      const p = f.properties
      const [lng, lat] = f.geometry.coordinates
      const state = p.state ? STATE_CODES.get(p.state.toLowerCase()) : undefined
      const where = [p.city ?? p.county, state ?? p.state].filter(Boolean).join(', ')
      return {
        key: `online:${p.name}|${lat}|${lng}`,
        kind: 'online' as const,
        label: p.name!,
        detail: where,
        isPark: false,
        ref: {
          place: {
            name: p.name!,
            lat,
            lng,
            city: p.city ?? null,
            countryCode: (p.countrycode ?? 'US').toUpperCase(),
            regionCode: state ? `US-${state}` : null,
            parkId: null,
          },
        },
      }
    })
}
