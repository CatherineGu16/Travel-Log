import { describe, expect, it } from 'vitest'
import { hikesDone, includesFamily, tripPeopleIds, parkVisits, parksVisited, pinsOf, shadeLevel, statesVisited, tripsPerRegion, visitsTo } from './derive.ts'
import {
  addGroup,
  addHike,
  addPerson,
  deleteGroup,
  deletePerson,
  deleteTrip,
  emptyData,
  findSamePlace,
  hikeKey,
  removeHike,
  revertTo,
  saveTrip,
  setPersonGroups,
  type TripInput,
} from './travelActions.ts'
import { FAMILY_GROUP_ID, type EditContext, type TravelData } from './types.ts'
import { tripInput } from '../test/tripInput.ts'

let n = 0
const ctx = (now = '2026-10-23T12:00:00.000Z'): EditContext => ({ now, newId: () => `id${++n}` })

const zion = { name: 'Zion National Park', lat: 37.3, lng: -113.05, regionCode: 'US-UT', parkId: 'zion' }
const springdale = { name: 'Springdale', lat: 37.18, lng: -113.0, regionCode: 'US-UT' }
const vegas = { name: 'Las Vegas', lat: 36.17, lng: -115.14, regionCode: 'US-NV' }

const trip = (over: Parameters<typeof tripInput>[0] = {}): TripInput =>
  tripInput({
    title: 'Utah 2023',
    startDate: '2023-07-04',
    endDate: '2023-07-09',
    main: { place: zion },
    stops: [{ place: { place: vegas }, note: 'Flew in' }, { place: { place: springdale } }],
    ...over,
  })

describe('emptyData', () => {
  it('starts with Family and Friends groups that have fixed ids, so devices merge them into one', () => {
    const data = emptyData('now')
    expect(data.groups).toEqual([
      expect.objectContaining({ id: FAMILY_GROUP_ID, name: 'Family', isFamily: true }),
      expect.objectContaining({ id: 'friends', name: 'Friends', isFamily: false }),
    ])
  })
})

describe('saveTrip', () => {
  it('creates a multi-stop trip with its places', () => {
    const data = saveTrip(emptyData('t0'), ctx(), trip())
    expect(data.trips).toHaveLength(1)
    expect(data.places.map((p) => p.name)).toEqual(['Zion National Park', 'Las Vegas', 'Springdale'])
    const t = data.trips[0]
    expect(t.destinations.map((d) => [data.places.find((p) => p.id === d.placeId)?.name, d.isMain])).toEqual([
      ['Zion National Park', true],
      ['Las Vegas', false],
      ['Springdale', false],
    ])
    expect(t.destinations[1].note).toBe('Flew in')
  })

  it('reuses a place you have been to, so a second visit stacks on the same pin', () => {
    let data = saveTrip(emptyData('t0'), ctx(), trip())
    data = saveTrip(data, ctx(), trip({ title: 'Zion again', startDate: '2025-04', endDate: null, stops: [] }))
    expect(data.places.filter((p) => p.parkId === 'zion')).toHaveLength(1)
    const pins = pinsOf(data)
    expect(pins).toHaveLength(1)
    expect(pins[0].trips.map((t) => t.title)).toEqual(['Zion again', 'Utah 2023'])
    expect(pins[0].isPark).toBe(true)
  })

  it('updates a trip in place', () => {
    let data = saveTrip(emptyData('t0'), ctx(), trip())
    const id = data.trips[0].id
    data = saveTrip(data, ctx('2026-10-24T00:00:00.000Z'), trip({ title: 'Renamed', stops: [] }), id)
    expect(data.trips).toHaveLength(1)
    expect(data.trips[0]).toMatchObject({ id, title: 'Renamed', updatedAt: '2026-10-24T00:00:00.000Z' })
    expect(data.trips[0].destinations).toHaveLength(1)
  })

  it('drops an end date that equals the start date', () => {
    const data = saveTrip(emptyData('t0'), ctx(), trip({ startDate: '2023-07', endDate: '2023-07' }))
    expect(data.trips[0].endDate).toBeNull()
  })
})

describe('findSamePlace', () => {
  it('matches the same name nearby, or practically the same spot, but not a namesake far away', () => {
    const data = saveTrip(emptyData('t0'), ctx(), trip({ main: { place: springdale }, stops: [] }))
    expect(findSamePlace(data.places, { ...springdale, lat: 37.181 })).toBeDefined()
    expect(findSamePlace(data.places, { name: 'Dropped pin', lat: 37.1801, lng: -113.0001 })).toBeDefined()
    expect(findSamePlace(data.places, { name: 'Springdale', lat: 36.19, lng: -94.15, regionCode: 'US-AR' })).toBeUndefined()
  })
})

describe('derived values', () => {
  it('counts trips per state once per trip, and the 50-state total', () => {
    let data = saveTrip(emptyData('t0'), ctx(), trip())
    data = saveTrip(data, ctx(), trip({ main: { place: vegas }, stops: [] }))
    const perRegion = tripsPerRegion(data)
    expect(perRegion.get('US-UT')).toBe(1)
    expect(perRegion.get('US-NV')).toBe(2)
    expect(statesVisited(perRegion)).toBe(2)
    expect(parksVisited(data)).toEqual(new Set(['zion']))
  })

  it('shades states in steps of 1 · 2–3 · 4–6 · 7+', () => {
    expect([0, 1, 2, 3, 4, 6, 7, 20].map(shadeLevel)).toEqual([0, 1, 2, 2, 3, 3, 4, 4])
  })

  it('ignores deleted trips', () => {
    let data = saveTrip(emptyData('t0'), ctx(), trip())
    data = deleteTrip(data, ctx(), data.trips[0].id)
    expect(pinsOf(data)).toEqual([])
    expect(tripsPerRegion(data).size).toBe(0)
  })
})

describe('people and groups', () => {
  const withPeople = (): TravelData => {
    let data = addPerson(emptyData('t0'), ctx(), 'mom', { name: 'Mom', groupIds: [FAMILY_GROUP_ID] })
    data = addPerson(data, ctx(), 'sam', { name: 'Sam', groupIds: [] })
    return data
  }

  it('adds people with an initials avatar and puts them in groups', () => {
    const data = withPeople()
    expect(data.people.find((p) => p.id === 'mom')?.avatar.kind).toBe('initials')
    expect(data.groups.find((g) => g.id === FAMILY_GROUP_ID)?.memberIds).toEqual(['mom'])
    expect(includesFamily(data, ['sam'])).toBe(false)
    expect(includesFamily(data, ['sam', 'mom'])).toBe(true)
  })

  it('moves a person between groups and removes them from groups when deleted', () => {
    let data = addGroup(withPeople(), ctx(), 'College friends', ['sam'])
    const college = data.groups.find((g) => g.name === 'College friends')!.id
    data = setPersonGroups(data, ctx(), 'mom', [college])
    expect(data.groups.find((g) => g.id === FAMILY_GROUP_ID)?.memberIds).toEqual([])
    expect(data.groups.find((g) => g.id === college)?.memberIds).toEqual(['sam', 'mom'])
    data = deletePerson(data, ctx(), 'sam')
    expect(data.groups.find((g) => g.id === college)?.memberIds).toEqual(['mom'])
    expect(data.people.find((p) => p.id === 'sam')?.deleted).toBe(true)
  })

  it("won't delete the Family group", () => {
    expect(() => deleteGroup(withPeople(), ctx(), FAMILY_GROUP_ID)).toThrow()
  })
})

describe('revertTo', () => {
  it('tombstones records created since the snapshot and restores changed ones with a new updatedAt', () => {
    const before = saveTrip(emptyData('t0'), ctx(), trip())
    let after = saveTrip(before, ctx(), trip({ title: 'Second', main: { place: vegas }, stops: [] }))
    after = saveTrip(after, ctx(), trip({ title: 'Edited', stops: [] }), before.trips[0].id)
    const reverted = revertTo(after, before, ctx('2026-12-01T00:00:00.000Z'))
    expect(reverted.trips.find((t) => t.title === 'Second')?.deleted).toBe(true)
    expect(reverted.trips.find((t) => t.id === before.trips[0].id)).toMatchObject({ title: 'Utah 2023', updatedAt: '2026-12-01T00:00:00.000Z' })
  })
})

describe('visitsTo', () => {
  it('stacks every visit to a place, as main destination or stop, newest first, using stop dates when given', () => {
    let data = saveTrip(emptyData('t0'), ctx(), trip({ main: { place: vegas }, stops: [], startDate: '2019' }))
    data = saveTrip(
      data,
      ctx(),
      trip({ stops: [{ place: { place: vegas }, startDate: '2023-07-03' }] }),
    )
    const vegasId = data.places.find((p) => p.name === 'Las Vegas')!.id
    expect(visitsTo(data, vegasId).map((v) => [v.trip.title, v.startDate])).toEqual([
      ['Utah 2023', '2023-07-03'],
      ['Utah 2023', '2019'],
    ])
  })
})

describe('hikes', () => {
  it('checks off hikes on trips and stacks repeat hikes; custom hikes are keyed by name', () => {
    let data = saveTrip(emptyData('t0'), ctx(), trip({ title: 'Zion 2023' }))
    data = saveTrip(data, ctx(), trip({ title: 'Zion 2025', startDate: '2025', endDate: null, stops: [] }))
    const [first, second] = data.trips
    const angels = { parkId: 'zion', hikeId: 'angels-landing', name: 'Angels Landing', date: null }
    data = addHike(data, ctx(), first.id, angels)
    data = addHike(data, ctx(), second.id, { ...angels, date: '2025-05-02' })
    data = addHike(data, ctx(), second.id, { parkId: 'zion', hikeId: null, name: ' Secret slot canyon ', date: null })
    data = addHike(data, ctx(), second.id, angels) // same hike again on the same trip: still one entry, date updated
    expect(data.trips[1].hikes).toHaveLength(2)

    const done = hikesDone(data, 'zion')
    expect([...done.values()].map((h) => [h.name, h.times.map((t) => t.date)])).toEqual([
      ['Angels Landing', ['2025', '2023-07-04']],
      ['Secret slot canyon', ['2025']],
    ])
    expect(parkVisits(data, 'zion').map((v) => v.trip.title)).toEqual(['Zion 2025', 'Zion 2023'])

    data = removeHike(data, ctx(), second.id, hikeKey('zion', null, 'secret slot canyon'))
    expect(hikesDone(data, 'zion').size).toBe(1)
  })

  it('saves hikes from the trip form, and keeps them when an update leaves them out', () => {
    let data = saveTrip(emptyData('t0'), ctx(), trip({ hikes: [{ parkId: 'zion', hikeId: 'the-narrows', name: 'The Narrows', date: null }] }))
    expect(data.trips[0].hikes.map((h) => h.name)).toEqual(['The Narrows'])
    data = saveTrip(data, ctx(), trip({ title: 'Renamed' }), data.trips[0].id)
    expect(data.trips[0].hikes.map((h) => h.name)).toEqual(['The Narrows'])
  })
})

describe('trips with more than one main destination', () => {
  it('pins each main destination, and each place keeps its own dates', () => {
    const data = saveTrip(
      emptyData('t0'),
      ctx(),
      tripInput({
        title: 'Utah + Vegas',
        startDate: '2024-05-01',
        endDate: '2024-05-06',
        destinations: [
          { place: { place: zion }, isMain: true, startDate: '2024-05-01', endDate: '2024-05-03', note: '' },
          { place: { place: vegas }, isMain: true, startDate: '2024-05-04', endDate: '2024-05-06', note: '' },
        ],
      }),
    )
    expect(pinsOf(data).map((p) => p.place.name).sort()).toEqual(['Las Vegas', 'Zion National Park'])
    const zionId = data.places.find((p) => p.parkId === 'zion')!.id
    expect(visitsTo(data, zionId).map((v) => [v.startDate, v.endDate])).toEqual([['2024-05-01', '2024-05-03']])
    expect(parkVisits(data, 'zion').map((v) => v.startDate)).toEqual(['2024-05-01'])
  })

  it('makes the first destination the main one when none is marked', () => {
    const data = saveTrip(emptyData('t0'), ctx(), tripInput({ stops: [{ place: { place: vegas } }, { place: { place: zion } }] }))
    expect(data.trips[0].destinations.map((d) => d.isMain)).toEqual([true, false])
  })
})

describe('who went', () => {
  it('tags groups without listing people, and a Family tag counts as family', () => {
    let data = addPerson(emptyData('t0'), ctx(), 'mom', { name: 'Mom', groupIds: [FAMILY_GROUP_ID] })
    data = saveTrip(data, ctx(), trip({ companionGroupIds: [FAMILY_GROUP_ID, 'friends', FAMILY_GROUP_ID] }))
    expect(data.trips[0].companionGroupIds).toEqual([FAMILY_GROUP_ID, 'friends'])
    expect(tripPeopleIds(data.trips[0], data)).toEqual(['mom'])
    expect(includesFamily(data, [], ['friends'])).toBe(false)
    expect(includesFamily(data, [], [FAMILY_GROUP_ID])).toBe(true)
  })
})
