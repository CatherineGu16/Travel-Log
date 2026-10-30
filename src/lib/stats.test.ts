import { describe, expect, it } from 'vitest'
import { hikesLogged, tripsBy, tripsByArea } from './stats.ts'
import { emptyData, saveTrip } from './travelActions.ts'
import type { EditContext, TravelData } from './types.ts'
import { tripInput } from '../test/tripInput.ts'

let n = 0
const ctx = (now = '2026-10-23T12:00:00.000Z'): EditContext => ({ now, newId: () => `id${++n}` })

const zion = { name: 'Zion National Park', lat: 37.3, lng: -113.05, regionCode: 'US-UT', parkId: 'zion' }
const vegas = { name: 'Las Vegas', lat: 36.17, lng: -115.14, regionCode: 'US-NV' }
const lisbon = { name: 'Lisbon', lat: 38.72, lng: -9.14, regionCode: null, countryCode: 'PT' }

function data(): TravelData {
  let d = emptyData('2026-01-01T00:00:00.000Z')
  d = saveTrip(d, ctx(), { ...tripInput({ title: 'Utah', startDate: '2023-07-04', endDate: '2023-07-09', main: { place: zion }, stops: [{ place: { place: vegas } }] }), hikes: [{ parkId: 'zion', hikeId: null, name: 'Angels Landing', date: '2023-07-05' }] })
  d = saveTrip(d, ctx(), tripInput({ title: 'Vegas', startDate: '2024-02-01', main: { place: vegas } }))
  d = saveTrip(d, ctx(), tripInput({ title: 'Lisbon', startDate: '2025-05-01', endDate: '2025-05-03', main: { place: lisbon } }))
  return d
}

describe('stat lists', () => {
  it('lists states (not countries) by how many trips went there, each with its trips newest first', () => {
    const states = tripsByArea(data(), 'state')
    expect(states.map((s) => [s.name, s.trips.map((t) => t.title)])).toEqual([
      ['Nevada', ['Vegas', 'Utah']],
      ['Utah', ['Utah']],
    ])
    expect(tripsByArea(data(), 'country').map((c) => [c.code, c.trips.length])).toEqual([
      ['US', 2],
      ['PT', 1],
    ])
  })

  it('ranks trips by days, leaving out trips with none', () => {
    expect(tripsBy(data(), 'days').map((r) => [r.trip.title, r.amount])).toEqual([
      ['Utah', 6],
      ['Lisbon', 3],
      ['Vegas', 1],
    ])
    expect(tripsBy(data(), 'flight')).toEqual([])
  })

  it('lists hikes newest first, with their trip', () => {
    expect(hikesLogged(data()).map((h) => [h.hike.name, h.trip.title])).toEqual([['Angels Landing', 'Utah']])
  })
})
