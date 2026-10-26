import type { NpsHike } from './gazetteer.ts'
import type { DistanceKind, HikeDifficulty, HikeEdit } from './types.ts'

/**
 * The public repo's corrections to the NPS hike suggestions (src/data/hike-edits.json): park id →
 * hike id → the values to show instead, or hidden. Written by the repo's owner from the app.
 */
export type PublicHikeEdits = Record<string, Record<string, PublicHikeEdit>>
export interface PublicHikeEdit {
  name: string
  distanceMi: number | null
  distanceKind: DistanceKind | null
  duration: string | null
  difficulty: HikeDifficulty | null
  hidden: boolean
  editedAt: string
}

export const HIKE_EDITS_PATH = 'src/data/hike-edits.json'

let bundled: Promise<PublicHikeEdits> | null = null
/** The corrections as of this build of the app. */
export const loadPublicHikeEdits = () => (bundled ??= import('../data/hike-edits.json').then((m) => parsePublicHikeEdits(m.default)))

/** A suggested hike as shown: NPS's values with any correction applied. */
export type ShownHike = NpsHike & {
  hidden: boolean
  /** NPS's own values, when a correction changed them. */
  original: NpsHike | null
}

const DIFFICULTIES = new Set(['Easy', 'Moderate', 'Strenuous'])

/**
 * A park's NPS hikes with corrections applied. Per hike, the newest of the published correction
 * and your own (which may be a reset) wins, so your edits show at once, before the next deploy.
 */
export function shownHikes(nps: NpsHike[], published: Record<string, PublicHikeEdit> | undefined, mine: HikeEdit[]): ShownHike[] {
  return nps.map((h) => {
    const pub = published?.[h.id]
    const own = mine.find((e) => e.hikeId === h.id)
    const ownWins = own && (!pub || own.updatedAt >= pub.editedAt)
    const fix = ownWins ? (own.deleted ? null : own) : (pub ?? null)
    if (!fix) return { ...h, hidden: false, original: null }
    return {
      ...h,
      name: fix.name,
      distanceMi: fix.distanceMi,
      distanceKind: fix.distanceKind,
      distanceSource: fix.distanceMi === null ? null : 'nps',
      duration: fix.duration,
      difficulty: fix.difficulty,
      hidden: fix.hidden,
      original: h,
    }
  })
}

/**
 * The public file with your corrections applied: each one newer than what's there replaces it, and
 * a reset removes it.
 */
export function withHikeEdits(file: PublicHikeEdits, edits: HikeEdit[]): PublicHikeEdits {
  const next: PublicHikeEdits = Object.fromEntries(Object.entries(file).map(([k, v]) => [k, { ...v }]))
  for (const e of edits) {
    const park = (next[e.parkId] ??= {})
    const have = park[e.hikeId]
    if (have && have.editedAt > e.updatedAt) continue
    if (e.deleted) delete park[e.hikeId]
    else park[e.hikeId] = { name: e.name, distanceMi: e.distanceMi, distanceKind: e.distanceKind, duration: e.duration, difficulty: e.difficulty, hidden: e.hidden, editedAt: e.updatedAt }
    if (Object.keys(park).length === 0) delete next[e.parkId]
  }
  const sorted = (o: Record<string, PublicHikeEdit>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))
  return Object.fromEntries(
    Object.entries(next)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, sorted(v)]),
  )
}

/** Reads the public file, dropping anything malformed. */
export function parsePublicHikeEdits(value: unknown): PublicHikeEdits {
  const out: PublicHikeEdits = {}
  const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
  if (!isObj(value)) return out
  for (const [parkId, hikes] of Object.entries(value)) {
    if (!isObj(hikes)) continue
    for (const [hikeId, e] of Object.entries(hikes)) {
      if (!isObj(e) || typeof e.name !== 'string' || !e.name.trim() || typeof e.editedAt !== 'string') continue
      ;(out[parkId] ??= {})[hikeId] = {
        name: e.name,
        distanceMi: typeof e.distanceMi === 'number' && Number.isFinite(e.distanceMi) ? e.distanceMi : null,
        distanceKind: e.distanceKind === 'round trip' || e.distanceKind === 'one way' || e.distanceKind === 'loop' ? e.distanceKind : null,
        duration: typeof e.duration === 'string' && e.duration ? e.duration : null,
        difficulty: typeof e.difficulty === 'string' && DIFFICULTIES.has(e.difficulty) ? (e.difficulty as HikeDifficulty) : null,
        hidden: e.hidden === true,
        editedAt: e.editedAt,
      }
    }
  }
  return out
}
