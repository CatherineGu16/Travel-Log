import { describe, expect, it } from 'vitest'
import { greatCircle } from './geo.ts'
import { formatDistance, legMemory, legsOf, matchesMode, tripKind } from './legs.ts'
import { routeOf } from './route.ts'
import { setHome } from './travelActions.ts'
import { parseTravelData } from './travelData.ts'
import type { Destination, Home, LegMode, Place, TravelData, Trip } from './types.ts'

const place = (id: string, lat: number, lng: number): Place => ({ id, name: id, lat, lng, city: null, countryCode: 'US', regionCode: null, parkId: null, createdAt: '', updatedAt: '' })
const places = [place('la', 34.05, -118.24), place('vegas', 36.17, -115.14), place('honolulu', 21.31, -157.86), place('sf', 37.77, -122.42)]
const home: Home = { id: 'home', name: 'Home', lat: 34.15, lng: -118.14, createdAt: '', updatedAt: '' }
const dest = (placeId: string, legMode: LegMode | null = null): Destination => ({ placeId, isMain: true, startDate: null, endDate: null, note: '', via: [], legMode })
const trip = (id: string, destinations: Destination[], extra: Partial<Trip> = {}): Trip =>
  ({ id, destinations, startMode: 'flight', endMode: 'flight', start: null, updatedAt: id, createdAt: id, ...extra }) as Trip
const data = (trips: Trip[], withHome = false) => ({ trips, places, home: withHome ? home : null }) as TravelData

describe('legs', () => {
  it('guesses a drive for a short leg and a flight for a long one', () => {
    const t = trip('a', [dest('la'), dest('vegas'), dest('honolulu')])
    const legs = legsOf(t, data([t]))
    expect(legs.map((l) => [l.mode, l.guessed])).toEqual([
      ['drive', true],
      ['flight', true],
    ])
    expect(formatDistance(legs[0].distanceM)).toBe('228 mi')
  })

  it('guesses longer legs as drives right after a drive, as on a road trip', () => {
    const yosemite = place('yosemite', 37.75, -119.59)
    const d = { places: [...places, yosemite], home: null } as unknown as TravelData
    // LA to Yosemite is ~265 mi in a straight line: a flight on its own, a drive after driving from home.
    const flown = trip('a', [dest('la'), dest('yosemite')])
    expect(legsOf(flown, d)[0].mode).toBe('flight')
    const driven = trip('b', [dest('la'), dest('yosemite'), dest('honolulu')], { start: home, startMode: 'drive' })
    expect(legsOf(driven, d).map((l) => l.mode)).toEqual(['drive', 'drive', 'flight', 'flight'])
  })

  it('remembers a mode you picked for the same two places, either direction', () => {
    const earlier = trip('1', [dest('la'), dest('sf', 'train')])
    const later = trip('2', [dest('sf'), dest('la')])
    const d = data([earlier, later])
    expect(legsOf(later, d, legMemory(d))[0]).toMatchObject({ mode: 'train', guessed: true })
  })

  it('goes from and back to where the trip started, the way you left', () => {
    expect(legsOf(trip('a', [dest('vegas')], { startMode: 'drive', endMode: 'drive' }), data([]))).toEqual([])
    const t = trip('a', [dest('vegas')], { startMode: 'drive', endMode: 'drive', start: home })
    const legs = legsOf(t, data([t]))
    expect(legs.map((l) => [l.from.name, l.to.name, l.mode, l.role])).toEqual([
      ['Home', 'vegas', 'drive', 'home'],
      ['vegas', 'Home', 'drive', 'home'],
    ])
    // A single-stop drive from home is a road trip.
    expect(tripKind(legs)).toBe('road-trip')
    expect(routeOf(t, places).map((r) => r.role)).toEqual(['home', 'main', 'home'])
  })

  it('keeps its own start when Home changes; older trips follow Home until it does', () => {
    const own = trip('a', [dest('vegas')], { start: { name: 'Old place', lat: 37.77, lng: -122.42 } })
    const older = trip('b', [dest('vegas')])
    delete older.start
    const d = data([own, older], true)
    expect(legsOf(own, d)[0].from.name).toBe('Old place')
    expect(legsOf(older, d)[0].from.name).toBe('Home')
    // Changing Home copies the old one onto trips that followed it.
    const moved = setHome(d, { now: 'n', newId: () => 'x' }, { name: 'New home', lat: 40.7, lng: -74 })
    expect(moved.trips.map((t) => legsOf(t, moved)[0].from.name)).toEqual(['Old place', 'Home'])
    expect(moved.trips[1]).toMatchObject({ start: { name: 'Home' }, updatedAt: 'n' })
    expect(moved.trips[0].updatedAt).toBe('a')
    // With no home yet, setting the first one doesn't pin anything: they start there.
    const first = setHome(data([older]), { now: 'n', newId: () => 'x' }, { name: 'First home', lat: 40.7, lng: -74 })
    expect(legsOf(first.trips[0], first)[0].from.name).toBe('First home')
  })

  it('flies from and back when you flew, so it counts as a flight', () => {
    const t = trip('a', [dest('honolulu')], { start: home })
    const legs = legsOf(t, data([t]))
    expect(legs.map((l) => l.mode)).toEqual(['flight', 'flight'])
    expect(matchesMode(legs, 'flight')).toBe(true)
    expect(tripKind(legs)).toBeNull()
  })

  it('shapes the way there and back like any leg, but not a flight', () => {
    const bend: [number, number] = [-117, 35]
    const driven = trip('a', [dest('vegas')], { start: home, startMode: 'drive', endMode: 'flight', startVia: [bend], endVia: [bend] })
    const [there, back] = legsOf(driven, data([driven]))
    expect(there.via).toEqual([bend])
    expect(back.via).toEqual([])
    expect(routeOf(driven, places)[1].via).toEqual([bend])
  })

  it('goes back to where it started from the last place', () => {
    const t = trip('a', [dest('la'), { ...dest('vegas', 'train'), via: [[-117, 35]] }], { startMode: 'drive', endMode: 'drive', start: home })
    expect(legsOf(t, data([t])).map((l) => `${l.from.name}>${l.to.name} ${l.mode} ${l.role}`)).toEqual([
      'Home>la drive home',
      'la>vegas train stop',
      'vegas>Home drive home',
    ])
    expect(routeOf(t, places).map((r) => r.role)).toEqual(['home', 'main', 'main', 'home'])
  })

  it('makes an all-drive trip a road trip and any cruise a cruise', () => {
    const d = data([])
    const road = legsOf(trip('a', [dest('la'), dest('vegas'), dest('la')]), d)
    const flew = legsOf(trip('b', [dest('la'), dest('honolulu')]), d)
    const cruise = legsOf(trip('c', [dest('la'), dest('vegas'), dest('honolulu', 'cruise')]), d)
    expect([road, flew, cruise, []].map(tripKind)).toEqual(['road-trip', null, 'cruise', null])
    expect(matchesMode(flew, 'flight')).toBe(true)
    expect(matchesMode(cruise, 'road-trip')).toBe(false)
  })
})

describe('trips saved with one travel mode', () => {
  const parse = (travelMode: string) =>
    parseTravelData({
      schemaVersion: 1,
      places,
      trips: [{ id: 't', updatedAt: 't', startDate: '2020', travelMode, destinations: [{ placeId: 'la', isMain: true }, { placeId: 'vegas', isMain: true }] }],
      people: [],
      groups: [],
    }).trips[0]

  it('carry the mode over onto the legs; a road trip was driven from home, a flight flown', () => {
    expect(parse('road-trip')).toMatchObject({ startMode: 'drive', endMode: 'drive' })
    // It followed Home then, so it does until Home changes.
    expect('start' in parse('road-trip')).toBe(false)
    expect(parse('road-trip').destinations.map((d) => d.legMode)).toEqual([null, 'drive'])
    expect(parse('cruise').destinations.map((d) => d.legMode)).toEqual([null, 'cruise'])
    expect(parse('flight')).toMatchObject({ startMode: 'flight', endMode: 'flight' })
    expect('travelMode' in parse('flight')).toBe(false)
  })
})

describe('greatCircle', () => {
  it('runs from one end to the other and crosses the antimeridian the short way', () => {
    const arc = greatCircle([-170.7, -14.3], [144.8, 13.4], 8)
    expect(arc[0][0]).toBeCloseTo(-170.7)
    expect(arc[0][1]).toBeCloseTo(-14.3)
    expect(arc.at(-1)![0]).toBeCloseTo(144.8 - 360)
    expect(arc.every(([lng], i) => i === 0 || Math.abs(lng - arc[i - 1][0]) < 180)).toBe(true)
  })
})
