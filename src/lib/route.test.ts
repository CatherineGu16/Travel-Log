import { describe, expect, it } from 'vitest'
import { routeOf } from './route.ts'
import type { Place, Trip } from './types.ts'

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
const trip = (mainPlaceId: string, stops: string[]): Trip =>
  ({ mainPlaceId, stops: stops.map((placeId) => ({ placeId, startDate: null, endDate: null, note: '' })) }) as Trip

const names = (r: ReturnType<typeof routeOf>) => r.map((p) => `${p.place.id}${p.number ?? ''}`)

describe('routeOf', () => {
  it('slots the main destination in where it adds the least distance', () => {
    expect(names(routeOf(trip('zion', ['vegas', 'springdale']), places))).toEqual(['vegas1', 'springdale2', 'zion'])
    expect(names(routeOf(trip('springdale', ['vegas', 'bryce']), places))).toEqual(['vegas1', 'springdale', 'bryce2'])
  })

  it('keeps the order when the main destination is also listed as a stop', () => {
    expect(names(routeOf(trip('zion', ['zion', 'vegas']), places))).toEqual(['zion', 'vegas1'])
  })

  it('has no route without stops', () => {
    expect(routeOf(trip('zion', []), places)).toEqual([])
  })
})
