import { live } from './travelActions.ts'
import type { TravelData } from './types.ts'

/**
 * Hikes people typed in themselves, shared in the public repo (src/data/added-hikes.json) so they
 * become suggestions everywhere: park id → hikes, name only. No dates, trips or people.
 */
export type AddedHikes = Record<string, { name: string; addedAt: string }[]>

/** Where the shared list lives in the app's public repo. */
export const ADDED_HIKES_PATH = 'src/data/added-hikes.json'

let bundled: Promise<AddedHikes> | null = null
/** The shared list as of this build of the app. */
export const loadAddedHikes = () => (bundled ??= import('../data/added-hikes.json').then((m) => m.default as AddedHikes))

/** Hike names compare without case or extra spaces. */
export const sameHikeName = (a: string, b: string) => a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * Hikes you typed in (not picked from a suggestion) that the shared list doesn't have yet:
 * [{ parkId, name }]. `known` is every name already suggested for each park.
 */
export function unsharedHikes(data: TravelData, known: (parkId: string) => string[]): { parkId: string; name: string }[] {
  const out: { parkId: string; name: string }[] = []
  for (const trip of live(data.trips))
    for (const h of trip.hikes) {
      if (h.hikeId !== null) continue
      const name = h.name.trim().replace(/\s+/g, ' ')
      if (!name || known(h.parkId).some((k) => sameHikeName(k, name))) continue
      if (out.some((o) => o.parkId === h.parkId && sameHikeName(o.name, name))) continue
      out.push({ parkId: h.parkId, name })
    }
  return out
}

/** The shared list with these hikes added (ones already on it are skipped), sorted by park and name. */
export function withHikes(list: AddedHikes, hikes: { parkId: string; name: string }[], now: string): AddedHikes {
  const next: AddedHikes = Object.fromEntries(Object.entries(list).map(([k, v]) => [k, [...v]]))
  for (const { parkId, name } of hikes) {
    const park = (next[parkId] ??= [])
    if (!park.some((h) => sameHikeName(h.name, name))) park.push({ name, addedAt: now })
  }
  for (const park of Object.values(next)) park.sort((a, b) => a.name.localeCompare(b.name))
  return Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)))
}

/** Reads a shared list from JSON, dropping anything malformed. */
export function parseAddedHikes(value: unknown): AddedHikes {
  const out: AddedHikes = {}
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return out
  for (const [parkId, hikes] of Object.entries(value)) {
    if (!Array.isArray(hikes)) continue
    out[parkId] = hikes
      .filter((h): h is { name: string; addedAt?: unknown } => typeof h === 'object' && h !== null && typeof h.name === 'string' && h.name.trim() !== '')
      .map((h) => ({ name: h.name.trim(), addedAt: typeof h.addedAt === 'string' ? h.addedAt : '' }))
  }
  return out
}
