import { describe, expect, it } from 'vitest'
import parks from '../data/national-parks.json'
import towns from '../data/us-places.json'
import { searchPlaces, type TownRow } from './placeSearch.ts'
import type { Place } from './types.ts'

const sources = (yours: Place[] = []) => ({
  yours,
  visits: new Map(yours.map((p) => [p.id, 2])),
  parks,
  towns: towns as unknown as TownRow[],
})

const zionPlace: Place = {
  id: 'p1',
  name: 'Zion National Park',
  lat: 37.3,
  lng: -113.05,
  city: null,
  countryCode: 'US',
  regionCode: 'US-UT',
  parkId: 'zion',
  createdAt: '',
  updatedAt: '',
}

describe('searchPlaces', () => {
  it('finds national parks by short or full name', () => {
    expect(searchPlaces('zion', sources())[0]).toMatchObject({ kind: 'park', label: 'Zion National Park' })
    expect(searchPlaces('chiricahua', sources())[0]).toMatchObject({ kind: 'park', label: 'Chiricahua National Park' })
  })

  it('lists places you have been first, and drops the duplicate park result', () => {
    const results = searchPlaces('zion', sources([zionPlace]))
    expect(results[0]).toMatchObject({ kind: 'yours', ref: { placeId: 'p1' }, detail: 'Been 2× · UT' })
    expect(results.filter((r) => r.label === 'Zion National Park')).toHaveLength(1)
  })

  it('finds towns, and narrows by a trailing state code', () => {
    expect(searchPlaces('moab', sources())[0]).toMatchObject({ kind: 'town', label: 'Moab', detail: 'UT' })
    const springdale = searchPlaces('Springdale, UT', sources())
    expect(springdale[0]).toMatchObject({ label: 'Springdale', detail: 'UT' })
    expect(springdale.every((r) => r.detail === 'UT')).toBe(true)
  })

  it('needs at least two characters', () => {
    expect(searchPlaces('z', sources())).toEqual([])
  })
})

describe('searchPlaces near a place', () => {
  it('puts the same-named town nearest the main destination first', () => {
    const zion = { lat: 37.3, lng: -113.05 }
    const results = searchPlaces('st george', sources(), 8, zion)
    expect(results[0]).toMatchObject({ label: expect.stringMatching(/^St\.? George$/), detail: 'UT' })
    expect(results[0]).not.toHaveProperty('distance')
  })
})
