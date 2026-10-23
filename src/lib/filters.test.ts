import { describe, expect, it } from 'vitest'
import { activeFilterCount, filterData, groupTrips, matchesSearch, NO_FILTER, reviveFilter } from './filters.ts'
import { addPerson, emptyData, saveTrip, type TripInput } from './travelActions.ts'
import { FAMILY_GROUP_ID, type EditContext } from './types.ts'

let n = 0
const ctx: EditContext = { now: '2026-10-23T00:00:00.000Z', newId: () => `id${++n}` }
const place = (name: string, lat: number, lng: number, regionCode: string) => ({ place: { name, lat, lng, regionCode } })
const input = (over: Partial<TripInput>): TripInput => ({
  title: 'Trip',
  startDate: '2023',
  endDate: null,
  approximate: false,
  main: place('Moab', 38.57, -109.55, 'US-UT'),
  stops: [],
  companions: [],
  isFamily: false,
  description: '',
  highlights: '',
  rating: null,
  tags: [],
  ...over,
})

const data = (() => {
  let d = addPerson(emptyData('t'), ctx, 'mom', { name: 'Mom', groupIds: [FAMILY_GROUP_ID] })
  d = saveTrip(d, ctx, input({ title: 'Moab with Mom', companions: ['mom'], isFamily: true, tags: ['camping'], rating: 4 }))
  d = saveTrip(d, ctx, input({ title: 'Chicago work trip', startDate: '2019-05', main: place('Chicago', 41.88, -87.63, 'US-IL'), highlights: 'Deep dish' }))
  d = saveTrip(d, ctx, input({ title: 'Denver', startDate: '2023-02', main: place('Denver', 39.74, -104.99, 'US-CO'), rating: 5 }))
  return d
})()

const titles = (d: typeof data) => d.trips.filter((t) => !t.deleted).map((t) => t.title)

describe('filters', () => {
  it('filters Family / Not family, by person, year and tag', () => {
    expect(titles(filterData(data, { ...NO_FILTER, who: 'family' }))).toEqual(['Moab with Mom'])
    expect(titles(filterData(data, { ...NO_FILTER, who: 'not-family' }))).toEqual(['Chicago work trip', 'Denver'])
    expect(titles(filterData(data, { ...NO_FILTER, personIds: ['mom'] }))).toEqual(['Moab with Mom'])
    expect(titles(filterData(data, { ...NO_FILTER, year: '2019' }))).toEqual(['Chicago work trip'])
    expect(titles(filterData(data, { ...NO_FILTER, tag: 'camping' }))).toEqual(['Moab with Mom'])
    expect(filterData(data, NO_FILTER)).toBe(data)
  })

  it('revives stored filters safely and counts active ones', () => {
    expect(reviveFilter({ who: 'nonsense', personIds: [1, 'a'], year: 2019 })).toEqual({ ...NO_FILTER, personIds: ['a'] })
    expect(activeFilterCount({ who: 'family', personIds: ['a'], year: '2020', tag: null })).toBe(3)
  })
})

describe('matchesSearch', () => {
  const find = (q: string) => data.trips.filter((t) => matchesSearch(t, data, q)).map((t) => t.title)
  it('searches titles, places, states, notes, people, groups and tags', () => {
    expect(find('chicago')).toEqual(['Chicago work trip'])
    expect(find('utah')).toEqual(['Moab with Mom'])
    expect(find('deep dish')).toEqual(['Chicago work trip'])
    expect(find('mom')).toEqual(['Moab with Mom'])
    expect(find('family camping')).toEqual(['Moab with Mom'])
    expect(find('')).toHaveLength(3)
  })
})

describe('groupTrips', () => {
  const trips = data.trips
  it('groups by year (newest first), state, or family, and sorts within groups', () => {
    expect(groupTrips(trips, data, 'year', 'newest').map((g) => [g.label, g.trips.map((t) => t.title)])).toEqual([
      ['2023', ['Denver', 'Moab with Mom']],
      ['2019', ['Chicago work trip']],
    ])
    expect(groupTrips(trips, data, 'state', 'title').map((g) => g.label)).toEqual(['Colorado', 'Illinois', 'Utah'])
    expect(groupTrips(trips, data, 'family', 'rating').map((g) => [g.label, g.trips.map((t) => t.title)])).toEqual([
      ['Family', ['Moab with Mom']],
      ['Not family', ['Denver', 'Chicago work trip']],
    ])
  })
})
