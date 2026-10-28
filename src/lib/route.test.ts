import { describe, expect, it } from 'vitest'
import { addBend, followTraveledBends, insertCheapest, legPaths, routeLine, routeOf } from './route.ts'
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
  const ca = [
    place('la', 34.05, -118.24),
    place('bakersfield', 35.37, -119.02),
    place('yosemite', 37.75, -119.59),
    place('irvine', 33.68, -117.83),
    place('fresno', 36.74, -119.79),
  ]
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

  it('keeps to the way up from LA and only turns off to reach a stop for food in Fresno', () => {
    const route = routeOf(drive(['la', 'yosemite', 'fresno', 'irvine']), ca)
    const [, , , toFresno, toIrvine] = legPaths(route)
    // Down the drawn way up (the LA–Yosemite line), then off it to Fresno.
    expect(toFresno![0]).toEqual(at('yosemite'))
    expect(toFresno!.at(-1)).toEqual(at('fresno'))
    expect(toFresno).toHaveLength(3)
    const [lng, lat] = toFresno![1]
    const along = (lat - 34.05) / (37.75 - 34.05)
    expect(along).toBeGreaterThan(0.3)
    expect(along).toBeLessThan(0.9)
    expect(lng).toBeCloseTo(-118.24 + along * (-119.59 + 118.24), 2)
    // On from Fresno: back onto it, through LA, then Irvine.
    expect(toIrvine).toContainEqual(at('la'))
  })

  it('after a stop for food on the way home, the rest of the drive rejoins the way up', () => {
    const route = routeOf(drive(['bakersfield', 'yosemite', 'fresno']), ca)
    // Pasadena → Bakersfield → Yosemite → Fresno → Pasadena: the last leg is the drive home.
    const home = legPaths(route)[4]!
    expect(home[0]).toEqual(at('fresno'))
    expect(home).toContainEqual(at('bakersfield'))
    expect(home.at(-1)).toEqual([-118.14, 34.15])
  })

  it('goes straight when the path so far leads the wrong way', () => {
    const t = drive(['la', 'bakersfield'])
    t.start = { name: 'San Diego', lat: 32.72, lng: -117.16 }
    // Bakersfield from LA: back toward San Diego would be a detour.
    expect(legPaths(routeOf(t, ca))[2]).toEqual([at('la'), at('bakersfield')])
  })

  it('"follow the way you came": back along the drawn route, leaving where it is closest to the stop', () => {
    const route = routeOf(drive(['la', 'yosemite', 'fresno']), ca)
    // Pasadena → LA → Yosemite → Fresno: the leg to Fresno is route[3].
    const bends = followTraveledBends(route, 3)!
    expect(bends).toHaveLength(1)
    const [lng, lat] = bends[0]
    // On the LA–Yosemite line, level with Fresno (the closest point to it).
    const along = (lat - 34.05) / (37.75 - 34.05)
    expect(lng).toBeCloseTo(-118.24 + along * (-119.59 + 118.24), 2)
    expect(lat).toBeGreaterThan(36.3)
    expect(lat).toBeLessThan(37.1)
    // Not for the first leg, which has nothing behind it.
    expect(followTraveledBends(route, 1)).toBeNull()
  })

  it('keeps the bends of a leg you shaped', () => {
    const t = drive(['la', 'bakersfield'])
    t.destinations[1].via = [[-118.6, 34.8]]
    expect(legPaths(routeOf(t, ca))[2]).toEqual([at('la'), [-118.6, 34.8], at('bakersfield')])
  })
})
