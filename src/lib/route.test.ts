import { describe, expect, it } from 'vitest'
import { addBend, insertCheapest, legPaths, routeLine, routeOf } from './route.ts'
import type { LngLat, Place, Trip } from './types.ts'

const place = (id: string, lat: number, lng: number): Place => ({
  id,
  name: id,
  lat,
  lng,
  city: null,
  countryCode: 'US',
  regionCode: null,
  parkId: null,
  createdAt: '',
  updatedAt: '',
})
const places = [place('zion', 37.3, -113.05), place('vegas', 36.17, -115.14), place('springdale', 37.18, -113.0), place('bryce', 37.6, -112.17)]
const trip = (destinations: [string, boolean][]): Trip =>
  ({ destinations: destinations.map(([placeId, isMain]) => ({ placeId, isMain, startDate: null, endDate: null, note: '', via: [] as LngLat[] })) }) as Trip

const names = (r: ReturnType<typeof routeOf>) => r.map((p) => `${p.place.id}${p.number ?? ''}`)

describe('routeOf', () => {
  it('follows the destinations in order, numbering the stops', () => {
    expect(
      names(
        routeOf(
          trip([
            ['vegas', false],
            ['springdale', false],
            ['zion', true],
          ]),
          places,
        ),
      ),
    ).toEqual(['vegas1', 'springdale2', 'zion'])
    expect(
      names(
        routeOf(
          trip([
            ['zion', true],
            ['bryce', true],
          ]),
          places,
        ),
      ),
    ).toEqual(['zion', 'bryce'])
  })

  it('has no route for a single place', () => {
    expect(routeOf(trip([['zion', true]]), places)).toEqual([])
  })
})

describe('insertCheapest (converting older trips)', () => {
  it('slots a place in where it adds the least distance', () => {
    const [zion, vegas, springdale, bryce] = places
    expect(insertCheapest([vegas, springdale], zion).map((p) => p.id)).toEqual(['vegas', 'springdale', 'zion'])
    expect(insertCheapest([vegas, bryce], springdale).map((p) => p.id)).toEqual(['vegas', 'springdale', 'bryce'])
  })
})

describe('route bends', () => {
  it('draws the line through the bends on the way to each place', () => {
    const t = trip([
      ['vegas', true],
      ['zion', true],
    ])
    t.destinations[0].via = [[0, 0]] // nothing leads to the first place
    t.destinations[1].via = [[-114, 36.5]]
    expect(routeLine(routeOf(t, places))).toEqual([
      [-115.14, 36.17],
      [-114, 36.5],
      [-113.05, 37.3],
    ])
  })

  it('puts each tap where it fits along the leg, whatever order you tap in', () => {
    const from: [number, number] = [0, 0]
    const to: [number, number] = [10, 0]
    let via = addBend(from, [], to, [8, 1])
    via = addBend(from, via, to, [2, 1])
    via = addBend(from, via, to, [5, 2])
    expect(via).toEqual([
      [2, 1],
      [5, 2],
      [8, 1],
    ])
  })
})

describe('reusing the way you came', () => {
  const ca = [place('la', 34.05, -118.24), place('bakersfield', 35.37, -119.02), place('yosemite', 37.75, -119.59), place('irvine', 33.68, -117.83)]
  const drive = (ids: string[]) =>
    ({
      destinations: ids.map((placeId, i) => ({ placeId, isMain: i === 0, startDate: null, endDate: null, note: '', via: [] as LngLat[], legMode: 'drive' })),
      start: { name: 'Pasadena', lat: 34.15, lng: -118.14 },
      startMode: 'drive',
      endMode: 'drive',
      returnSameWay: false,
    }) as unknown as Trip
  const at = (id: string) => {
    const p = ca.find((x) => x.id === id)!
    return [p.lng, p.lat]
  }

  it('drives down from Yosemite the way it came up, then turns off for Irvine', () => {
    const route = routeOf(drive(['la', 'bakersfield', 'yosemite', 'irvine']), ca)
    const down = legPaths(route)[4]!
    expect(down[0]).toEqual(at('yosemite'))
    expect(down).toContainEqual(at('bakersfield'))
    expect(down.at(-1)).toEqual(at('irvine'))
    // The way up was straight, and nothing came before Pasadena.
    expect(legPaths(route)[1]).toEqual([[-118.14, 34.15], at('la')])
  })

  it('goes straight when the path so far leads the wrong way', () => {
    const t = drive(['la', 'bakersfield'])
    t.start = { name: 'San Diego', lat: 32.72, lng: -117.16 }
    // Bakersfield from LA: back toward San Diego would be a detour.
    expect(legPaths(routeOf(t, ca))[2]).toEqual([at('la'), at('bakersfield')])
  })

  it('keeps the bends of a leg you shaped', () => {
    const t = drive(['la', 'bakersfield'])
    t.destinations[1].via = [[-118.6, 34.8]]
    expect(legPaths(routeOf(t, ca))[2]).toEqual([at('la'), [-118.6, 34.8], at('bakersfield')])
  })
})
