import { describe, expect, it } from 'vitest'
import parks from '../data/national-parks.json'
import towns from '../data/us-places.json'
import world from '../data/world-cities.json'
import { searchPlaces, type TownRow, type WorldCities } from './placeSearch.ts'
import type { Place } from './types.ts'

const sources = (yours: Place[] = []) => ({
  yours,
  visits: new Map(yours.map((p) => [p.id, 2])),
  parks,
  towns: towns as unknown as TownRow[],
  world: world as unknown as WorldCities,
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

describe('searchPlaces by size', () => {
  it('lists bigger towns first among equal matches', () => {
    expect(searchPlaces('portland', sources())[0]).toMatchObject({ label: 'Portland', detail: 'OR' })
    expect(searchPlaces('springfield', sources()).slice(0, 3).map((r) => r.detail)).toEqual(['MO', 'MA', 'IL'])
    expect(searchPlaces('chica', sources())[0]).toMatchObject({ label: 'Chicago', detail: 'IL' })
    expect(searchPlaces('honolulu', sources())[0]).toMatchObject({ label: 'Honolulu', detail: 'HI' })
  })

  it('still puts towns near the main destination first', () => {
    const maine = { lat: 43.86, lng: -70.1 } // Freeport, ME
    expect(searchPlaces('portland', sources(), 8, maine)[0]).toMatchObject({ label: 'Portland', detail: 'ME' })
  })
})

describe('searchPlaces worldwide', () => {
  it('lists big cities abroad before small US towns of the same name', () => {
    const lisbon = searchPlaces('lisbon', sources())
    expect(lisbon[0]).toMatchObject({ kind: 'town', label: 'Lisbon', detail: 'Portugal', ref: { place: { countryCode: 'PT', regionCode: null } } })
    expect(lisbon.slice(1, 4).map((r) => r.detail)).toEqual(['WI', 'OH', 'IA'])
    // Even near a small one: Lisbon, Portugal is far bigger than Lisbon, Ohio.
    expect(searchPlaces('lisbon', sources(), 8, { lat: 40.77, lng: -80.77 })[0]).toMatchObject({ detail: 'Portugal' })
    expect(searchPlaces('funchal', sources())[0]).toMatchObject({ label: 'Funchal', detail: 'Madeira, Portugal' })
  })

  it('narrows to a country by name, code or common alias; US state codes come first', () => {
    expect(searchPlaces('Lisbon, Portugal', sources()).every((r) => r.detail.endsWith('Portugal'))).toBe(true)
    expect(searchPlaces('london uk', sources())[0]).toMatchObject({ label: 'London', detail: expect.stringMatching(/United Kingdom$/) })
    expect(searchPlaces('london ca', sources()).every((r) => r.detail === 'CA')).toBe(true)
    expect(searchPlaces('london usa', sources()).every((r) => /^[A-Z]{2}$/.test(r.detail))).toBe(true)
  })
})
