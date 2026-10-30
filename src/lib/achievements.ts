import { familyGroup, parksVisited, statesVisited, tripsPerRegion } from './derive.ts'
import { legMemory, legsOf, tripKind, type Leg } from './legs.ts'
import { comparePartialDates, yearOf } from './partialDate.ts'
import { distancesByMode, routeOf } from './route.ts'
import type { TravelData, Trip } from './types.ts'

/**
 * Achievements, worked out from your trips every time (nothing is stored or synced), so editing or
 * deleting a trip keeps them right. Most have Bronze / Silver / Gold tiers; one-offs have one.
 */

export type TierLevel = 'bronze' | 'silver' | 'gold'
export interface Tier {
  level: TierLevel
  goal: number
}
export type AchievementCategory = 'States' | 'Parks' | 'Hikes' | 'Road & air' | 'World' | 'People & habits'

export interface Achievement {
  id: string
  category: AchievementCategory
  name: string
  description: string
  /** What the number counts ("states", "mi"), for "41 / 64 parks". */
  unit: string
  tiers: Tier[]
  /** The parks that count toward it (park ids, or every national park), listed in its details. */
  parks?: string[] | 'all'
  /** How far you've got, from these trips (a prefix of your trips when finding when a tier was earned). */
  progress: (trips: Trip[], ctx: Context) => number
}

/** Extra data some achievements need: continent codes by country (from world-cities.json). */
export interface AchievementExtras {
  continents?: Record<string, string>
}

/** Your data plus per-trip answers worked out once and reused (legs and distances are the slow part). */
interface Context {
  data: TravelData
  extras: AchievementExtras
  legs: (t: Trip) => Leg[]
  driveMiles: (t: Trip) => number
  places: (t: Trip) => TravelData['places']
}

const three = (bronze: number, silver: number, gold: number): Tier[] => [
  { level: 'bronze', goal: bronze },
  { level: 'silver', goal: silver },
  { level: 'gold', goal: gold },
]
/** A one-off: earned once, when its goal is reached. */
const once = (goal = 1): Tier[] => [{ level: 'gold', goal }]

const PACIFIC = ['US-CA', 'US-OR', 'US-WA']
const ATLANTIC = ['US-ME', 'US-NH', 'US-MA', 'US-RI', 'US-CT', 'US-NY', 'US-NJ', 'US-DE', 'US-MD', 'US-VA', 'US-NC', 'US-SC', 'US-GA', 'US-FL']
const REGIONS: { id: string; name: string; states: string[] }[] = [
  { id: 'new-england', name: 'New England', states: ['US-CT', 'US-ME', 'US-MA', 'US-NH', 'US-RI', 'US-VT'] },
  { id: 'four-corners', name: 'Four Corners', states: ['US-AZ', 'US-CO', 'US-NM', 'US-UT'] },
  { id: 'pacific-coast', name: 'Pacific Coast', states: ['US-CA', 'US-OR', 'US-WA', 'US-AK', 'US-HI'] },
  { id: 'great-lakes', name: 'Great Lakes', states: ['US-IL', 'US-IN', 'US-MI', 'US-MN', 'US-NY', 'US-OH', 'US-PA', 'US-WI'] },
  { id: 'deep-south', name: 'Deep South', states: ['US-AL', 'US-GA', 'US-LA', 'US-MS', 'US-SC'] },
]
const PARK_SETS: { id: string; name: string; parks: string[] }[] = [
  { id: 'mighty-5', name: "Utah's Mighty 5", parks: ['zion', 'bryce-canyon', 'arches', 'canyonlands', 'capitol-reef'] },
  {
    id: 'california-9',
    name: "California's 9",
    parks: ['yosemite', 'sequoia', 'kings-canyon', 'joshua-tree', 'death-valley', 'redwood', 'lassen-volcanic', 'pinnacles', 'channel-islands'],
  },
]
/** Parks with no roads in, or a long boat or plane ride away. */
const REMOTE_PARKS = ['gates-of-the-arctic', 'kobuk-valley', 'lake-clark', 'katmai', 'wrangell-st-elias', 'isle-royale', 'dry-tortugas', 'american-samoa', 'north-cascades', 'channel-islands']
const ICONIC_TRAILS = ['angels landing', 'half dome', 'the narrows', 'delicate arch', 'highline', 'skyline', 'navajo loop', 'grinnell glacier', 'precipice', 'harding icefield', 'mist trail', 'emerald lake']

const countParks = (trips: Trip[], ctx: Context) => parksVisited({ ...ctx.data, trips })
const regionsVisited = (trips: Trip[], ctx: Context) => new Set(tripsPerRegion({ ...ctx.data, trips }).keys())

export const ACHIEVEMENTS: Achievement[] = [
  // ---- States
  {
    id: 'states',
    category: 'States',
    name: 'States visited',
    description: 'Visit states (and DC) on your trips.',
    unit: 'states',
    tiers: three(10, 25, 50),
    progress: (trips, ctx) => statesVisited(tripsPerRegion({ ...ctx.data, trips })),
  },
  {
    id: 'coast-to-coast',
    category: 'States',
    name: 'Coast to Coast',
    description: 'One trip with stops on both the Pacific and the Atlantic coast.',
    unit: 'trip',
    tiers: once(),
    progress: (trips, ctx) =>
      trips.some((t) => {
        const regions = ctx.places(t).map((p) => p.regionCode)
        return regions.some((r) => r && PACIFIC.includes(r)) && regions.some((r) => r && ATLANTIC.includes(r))
      })
        ? 1
        : 0,
  },
  ...REGIONS.map(
    (r): Achievement => ({
      id: `region-${r.id}`,
      category: 'States',
      name: r.name,
      description: `Every state in ${r.name}.`,
      unit: 'states',
      tiers: once(r.states.length),
      progress: (trips, ctx) => {
        const seen = regionsVisited(trips, ctx)
        return r.states.filter((s) => seen.has(s)).length
      },
    }),
  ),
  // ---- Parks
  {
    id: 'parks',
    category: 'Parks',
    name: 'National parks',
    description: 'Visit US national parks.',
    unit: 'parks',
    tiers: three(10, 30, 64),
    parks: 'all',
    progress: (trips, ctx) => countParks(trips, ctx).size,
  },
  {
    id: 'park-hopper',
    category: 'Parks',
    name: 'Park Hopper',
    description: 'National parks on one trip.',
    unit: 'parks',
    tiers: three(2, 3, 5),
    progress: (trips, ctx) => Math.max(0, ...trips.map((t) => new Set(ctx.places(t).flatMap((p) => (p.parkId ? [p.parkId] : []))).size)),
  },
  ...PARK_SETS.map(
    (set): Achievement => ({
      id: `parks-${set.id}`,
      category: 'Parks',
      name: set.name,
      description: `Every park in ${set.name}.`,
      unit: 'parks',
      tiers: once(set.parks.length),
      parks: set.parks,
      progress: (trips, ctx) => {
        const seen = countParks(trips, ctx)
        return set.parks.filter((p) => seen.has(p)).length
      },
    }),
  ),
  {
    id: 'off-the-grid',
    category: 'Parks',
    name: 'Off the Grid',
    description: 'Remote parks: no roads in, or a long boat or plane ride away.',
    unit: 'parks',
    tiers: three(1, 3, 5),
    parks: REMOTE_PARKS,
    progress: (trips, ctx) => {
      const seen = countParks(trips, ctx)
      return REMOTE_PARKS.filter((p) => seen.has(p)).length
    },
  },
  // ---- Hikes
  {
    id: 'hikes',
    category: 'Hikes',
    name: 'Hikes logged',
    description: 'Hikes checked off on your trips.',
    unit: 'hikes',
    tiers: three(10, 50, 100),
    progress: (trips) => trips.reduce((n, t) => n + t.hikes.length, 0),
  },
  {
    id: 'iconic-trails',
    category: 'Hikes',
    name: 'Iconic trails',
    description: 'Famous hikes like Angels Landing, Half Dome and The Narrows.',
    unit: 'trails',
    tiers: three(1, 3, 5),
    progress: (trips) => new Set(trips.flatMap((t) => t.hikes.flatMap((h) => ICONIC_TRAILS.filter((name) => h.name.toLowerCase().includes(name))))).size,
  },
  // ---- Road & air
  {
    id: 'longest-road-trip',
    category: 'Road & air',
    name: 'Longest road trip',
    description: 'Miles driven on one road trip (every leg a drive).',
    unit: 'mi',
    tiers: three(500, 1000, 2500),
    progress: (trips, ctx) => Math.round(Math.max(0, ...trips.filter((t) => tripKind(ctx.legs(t)) === 'road-trip').map((t) => ctx.driveMiles(t)))),
  },
  {
    id: 'flights',
    category: 'Road & air',
    name: 'Frequent flyer',
    description: 'Trips with a flight.',
    unit: 'trips',
    tiers: three(5, 10, 25),
    progress: (trips, ctx) => trips.filter((t) => ctx.legs(t).some((l) => l.mode === 'flight')).length,
  },
  {
    id: 'ways-to-travel',
    category: 'Road & air',
    name: 'Every way there',
    description: 'Different ways of traveling: drive, flight, train, cruise, ferry, walk.',
    unit: 'ways',
    tiers: three(3, 4, 5),
    progress: (trips, ctx) => new Set(trips.flatMap((t) => ctx.legs(t).map((l) => l.mode)).filter((m) => m !== 'unknown')).size,
  },
  // ---- World
  {
    id: 'countries',
    category: 'World',
    name: 'Countries',
    description: 'Countries you have been to, the US included.',
    unit: 'countries',
    tiers: three(2, 5, 10),
    progress: (trips, ctx) => new Set(trips.flatMap((t) => ctx.places(t).map((p) => p.countryCode))).size,
  },
  {
    id: 'continents',
    category: 'World',
    name: 'Continents',
    description: 'Continents you have been to.',
    unit: 'continents',
    tiers: three(2, 3, 4),
    progress: (trips, ctx) =>
      new Set(trips.flatMap((t) => ctx.places(t).map((p) => ctx.extras.continents?.[p.countryCode] ?? (p.countryCode === 'US' ? 'NA' : p.countryCode)))).size,
  },
  // ---- People & habits
  {
    id: 'travel-buddy',
    category: 'People & habits',
    name: 'Travel buddy',
    description: 'Trips with the same person.',
    unit: 'trips',
    tiers: three(3, 5, 10),
    progress: (trips) => {
      const count = new Map<string, number>()
      for (const t of trips) for (const id of new Set(t.companions)) count.set(id, (count.get(id) ?? 0) + 1)
      return Math.max(0, ...count.values())
    },
  },
  {
    id: 'family-trips',
    category: 'People & habits',
    name: 'Family trips',
    description: 'Trips with everyone in Family.',
    unit: 'trips',
    tiers: three(1, 5, 10),
    progress: (trips, ctx) => {
      const members = (familyGroup(ctx.data)?.memberIds ?? []).filter((id) => ctx.data.people.some((p) => p.id === id && !p.deleted))
      return members.length ? trips.filter((t) => members.every((id) => t.companions.includes(id))).length : 0
    },
  },
  {
    id: 'year-streak',
    category: 'People & habits',
    name: 'Year streak',
    description: 'A trip every year, years in a row.',
    unit: 'years',
    tiers: three(3, 5, 10),
    progress: (trips) => {
      const years = [...new Set(trips.map((t) => Number(yearOf(t.startDate))))].sort((a, b) => a - b)
      let best = 0
      let run = 0
      years.forEach((y, i) => {
        run = i > 0 && y === years[i - 1] + 1 ? run + 1 : 1
        best = Math.max(best, run)
      })
      return best
    },
  },
  {
    id: 'storyteller',
    category: 'People & habits',
    name: 'Storyteller',
    description: 'Trips with a description or highlights.',
    unit: 'trips',
    tiers: three(5, 10, 25),
    progress: (trips) => trips.filter((t) => t.description.trim() || t.highlights.trim()).length,
  },
  {
    id: 'trips',
    category: 'People & habits',
    name: 'Trips logged',
    description: 'Trips in your log.',
    unit: 'trips',
    tiers: three(10, 25, 50),
    progress: (trips) => trips.length,
  },
]

export interface EarnedTier extends Tier {
  /** The trip that crossed the goal (trips counted in date order). */
  trip: Trip
}

export interface AchievementStatus {
  achievement: Achievement
  progress: number
  /** The highest tier reached, if any. */
  reached: Tier | null
  /** The next tier to reach, if any. */
  next: Tier | null
  earned: EarnedTier[]
}

/** Your live trips, oldest first: the order tiers are earned in. */
const inDateOrder = (data: TravelData) =>
  data.trips.filter((t) => !t.deleted).sort((a, b) => comparePartialDates(a.startDate, b.startDate) || a.createdAt.localeCompare(b.createdAt))

/** Where every achievement stands, and when each reached tier was earned. */
export function achievementStatus(data: TravelData, extras: AchievementExtras = {}): AchievementStatus[] {
  const memory = legMemory(data)
  const byId = new Map(data.places.map((p) => [p.id, p]))
  const legsCache = new Map<string, Leg[]>()
  const milesCache = new Map<string, number>()
  const ctx: Context = {
    data,
    extras,
    places: (t) => t.destinations.flatMap((d) => byId.get(d.placeId) ?? []),
    legs: (t) => {
      if (!legsCache.has(t.id)) legsCache.set(t.id, legsOf(t, data, memory))
      return legsCache.get(t.id)!
    },
    driveMiles: (t) => {
      if (!milesCache.has(t.id)) milesCache.set(t.id, (distancesByMode(routeOf(t, data.places, { home: data.home, memory })).drive ?? 0) / 1609.344)
      return milesCache.get(t.id)!
    },
  }
  const trips = inDateOrder(data)
  return ACHIEVEMENTS.map((achievement) => {
    const progress = achievement.progress(trips, ctx)
    const reachedTiers = achievement.tiers.filter((t) => progress >= t.goal)
    // When each reached tier was earned: the first trip (in date order) after which it counts.
    const earned: EarnedTier[] = []
    let k = 0
    for (const tier of reachedTiers) {
      while (k < trips.length && achievement.progress(trips.slice(0, k + 1), ctx) < tier.goal) k++
      earned.push({ ...tier, trip: trips[Math.min(k, trips.length - 1)] })
    }
    return {
      achievement,
      progress,
      reached: reachedTiers.at(-1) ?? null,
      next: achievement.tiers.find((t) => progress < t.goal) ?? null,
      earned,
    }
  })
}

/** "parks:silver" for every tier reached, to tell which ones a change just earned. */
export const earnedKeys = (statuses: AchievementStatus[]) => new Set(statuses.flatMap((s) => s.earned.map((e) => `${s.achievement.id}:${e.level}`)))

/** The tiers earned by going from `before` to `after` (e.g. saving a trip), most impressive first. */
export function newlyEarned(before: AchievementStatus[], after: AchievementStatus[]): { status: AchievementStatus; tier: EarnedTier }[] {
  const had = earnedKeys(before)
  const order: Record<TierLevel, number> = { gold: 0, silver: 1, bronze: 2 }
  return after
    .flatMap((status) => status.earned.filter((e) => !had.has(`${status.achievement.id}:${e.level}`)).map((tier) => ({ status, tier })))
    .sort((a, b) => order[a.tier.level] - order[b.tier.level])
}

export const TIER_NAMES: Record<TierLevel, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' }
