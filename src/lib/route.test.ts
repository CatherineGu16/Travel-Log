import { describe, expect, it } from 'vitest'
import { addBend, insertCheapest, routeLine, routeOf } from './route.ts'
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
