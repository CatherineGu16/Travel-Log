import { describe, expect, it } from 'vitest'
import { achievementStatus, newlyEarned } from './achievements.ts'
import { addPerson, emptyData, saveTrip } from './travelActions.ts'
import { FAMILY_GROUP_ID, type EditContext, type TravelData } from './types.ts'
import { tripInput } from '../test/tripInput.ts'

let n = 0
const ctx: EditContext = { now: '2026-10-29T00:00:00.000Z', newId: () => `id${++n}` }
const park = (id: string, name: string, lat: number, lng: number, regionCode: string) => ({ place: { name, lat, lng, regionCode, parkId: id } })
const town = (name: string, lat: number, lng: number, regionCode: string | null, countryCode = 'US') => ({ place: { name, lat, lng, regionCode, countryCode } })
const status = (data: TravelData, id: string, extras = {}) => achievementStatus(data, extras).find((s) => s.achievement.id === id)!

const MIGHTY_5 = [
  park('zion', 'Zion National Park', 37.3, -113.05, 'US-UT'),
  park('bryce-canyon', 'Bryce Canyon National Park', 37.6, -112.17, 'US-UT'),
  park('capitol-reef', 'Capitol Reef National Park', 38.2, -111.17, 'US-UT'),
  park('canyonlands', 'Canyonlands National Park', 38.2, -109.93, 'US-UT'),
  park('arches', 'Arches National Park', 38.73, -109.59, 'US-UT'),
]

describe('achievements', () => {
  it('counts parks toward tiers and knows which trip earned each one', () => {
    let d = emptyData('t')
    d = saveTrip(d, ctx, tripInput({ title: 'Zion & Bryce', startDate: '2021', main: MIGHTY_5[0].place, stops: [{ place: MIGHTY_5[1] }] }))
    d = saveTrip(d, ctx, tripInput({ title: 'Utah 2023', startDate: '2023', main: MIGHTY_5[2].place, stops: MIGHTY_5.slice(3).map((p) => ({ place: p })) }))
    const parks = status(d, 'parks')
    expect(parks).toMatchObject({ progress: 5, reached: null, next: { level: 'bronze', goal: 10 } })
    // Park Hopper: three parks on the 2023 trip reach Silver; Bronze came on the first trip (two parks).
    const hopper = status(d, 'park-hopper')
    expect(hopper.reached).toMatchObject({ level: 'silver' })
    expect(hopper.earned.map((e) => [e.level, e.trip.title])).toEqual([
      ['bronze', 'Zion & Bryce'],
      ['silver', 'Utah 2023'],
    ])
    // A set is a one-off, earned by the trip that completes it.
    expect(status(d, 'parks-mighty-5').earned.map((e) => e.trip.title)).toEqual(['Utah 2023'])
  })

  it('measures the longest road trip by the miles driven, and counts flights and ways to travel', () => {
    let d = emptyData('t')
    const la = town('Los Angeles', 34.05, -118.24, 'US-CA')
    const sf = town('San Francisco', 37.77, -122.42, 'US-CA')
    const seattle = town('Seattle', 47.61, -122.33, 'US-WA')
    const stop = (place: typeof la, legMode: 'drive' | 'flight' | 'train' | null) => ({ place, isMain: true, startDate: null, endDate: null, note: '', legMode })
    d = saveTrip(d, ctx, tripInput({ startDate: '2022', destinations: [stop(la, null), stop(sf, 'drive'), stop(seattle, 'drive')] }))
    const road = status(d, 'longest-road-trip')
    // LA → SF (~350 mi) → Seattle (~680 mi), all driven: over 1,000 mi.
    expect(road.progress).toBeGreaterThan(1000)
    expect(road.reached).toMatchObject({ level: 'silver' })
    expect(status(d, 'flights').progress).toBe(0)
    d = saveTrip(d, ctx, tripInput({ startDate: '2023', destinations: [stop(seattle, null), stop(la, 'flight'), stop(sf, 'train')] }))
    expect(status(d, 'flights').progress).toBe(1)
    expect(status(d, 'ways-to-travel')).toMatchObject({ progress: 3, reached: { level: 'bronze' } })
  })

  it('counts countries and continents', () => {
    let d = emptyData('t')
    d = saveTrip(d, ctx, tripInput({ startDate: '2019', main: town('Lisbon', 38.72, -9.14, null, 'PT').place }))
    d = saveTrip(d, ctx, tripInput({ startDate: '2020', main: town('Tokyo', 35.68, 139.69, null, 'JP').place }))
    d = saveTrip(d, ctx, tripInput({ startDate: '2021', main: town('Moab', 38.57, -109.55, 'US-UT').place }))
    expect(status(d, 'countries')).toMatchObject({ progress: 3, reached: { level: 'bronze' } })
    expect(status(d, 'continents', { continents: { PT: 'EU', JP: 'AS', US: 'NA' } }).progress).toBe(3)
    // Three years in a row: a Bronze streak.
    expect(status(d, 'year-streak')).toMatchObject({ progress: 3, reached: { level: 'bronze' } })
  })

  it('counts family trips only when everyone in Family went', () => {
    let d = addPerson(emptyData('t'), ctx, 'mom', { name: 'Mom', groupIds: [FAMILY_GROUP_ID] })
    d = addPerson(d, ctx, 'dad', { name: 'Dad', groupIds: [FAMILY_GROUP_ID] })
    const moab = town('Moab', 38.57, -109.55, 'US-UT').place
    d = saveTrip(d, ctx, tripInput({ startDate: '2020', main: moab, companions: ['mom'] }))
    expect(status(d, 'family-trips').progress).toBe(0)
    d = saveTrip(d, ctx, tripInput({ startDate: '2021', main: { placeId: d.places[0].id }, companions: ['mom', 'dad'] }))
    expect(status(d, 'family-trips')).toMatchObject({ progress: 1, reached: { level: 'bronze' } })
    expect(status(d, 'travel-buddy').progress).toBe(2)
  })

  it('tells what a change just earned, most impressive first', () => {
    let d = emptyData('t')
    d = saveTrip(d, ctx, tripInput({ startDate: '2021', main: MIGHTY_5[0].place, stops: [{ place: MIGHTY_5[1] }] }))
    const before = achievementStatus(d)
    d = saveTrip(d, ctx, tripInput({ startDate: '2023', main: MIGHTY_5[2].place, stops: MIGHTY_5.slice(3).map((p) => ({ place: p })) }))
    const earned = newlyEarned(before, achievementStatus(d)).map((e) => `${e.status.achievement.id}:${e.tier.level}`)
    expect(earned).toEqual(expect.arrayContaining(['parks-mighty-5:gold', 'park-hopper:silver']))
    expect(earned).not.toContain('park-hopper:bronze')
    expect(earned[0]).toMatch(/:gold$/)
  })
})
