import { describe, expect, it } from 'vitest'
import { hikesLogged, nextMonth, tripsBy, tripsByArea, tripsByMonth, tripWhere } from './stats.ts'
import { deleteTrip, emptyData, saveTrip } from './travelActions.ts'
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

describe('tripWhere', () => {
  it('names the main places and how far each way of traveling went', () => {
    const d = data()
    expect(tripWhere(d.trips.find((t) => t.title === 'Lisbon')!, d)).toBe('Lisbon')
    expect(tripWhere(d.trips.find((t) => t.title === 'Utah')!, d)).toMatch(/^Zion National Park · ~\d+ mi driven$/)
  })
})

describe('tripsByMonth', () => {
  it('counts trips by the month they started, with the empty months between, up to this month', () => {
    let d = emptyData('t0')
    for (const [title, startDate] of [['A', '2024-11-03'], ['B', '2025-01'], ['C', '2025-01-20'], ['Old', '2019'], ['Gone', '2024-12-01']] as const)
      d = saveTrip(d, ctx(), tripInput({ title, startDate, main: { name: title, lat: 38, lng: -109, regionCode: 'US-UT' } }))
    d = deleteTrip(d, ctx(), d.trips.find((t) => t.title === 'Gone')!.id)
    const { months, yearOnly } = tripsByMonth(d, '2025-03-10')
    expect(months.map((m) => [m.month, m.trips.map((t) => t.title)])).toEqual([
      ['2024-11', ['A']],
      ['2024-12', []],
      ['2025-01', ['B', 'C']],
      ['2025-02', []],
      ['2025-03', []],
    ])
    // A year has no month to go in.
    expect(yearOnly.map((t) => t.title)).toEqual(['Old'])
  })

  it('reaches a trip dated ahead; nothing month-dated means no months', () => {
    let d = saveTrip(emptyData('t0'), ctx(), tripInput({ title: 'Later', startDate: '2025-05-01', main: { name: 'X', lat: 38, lng: -109, regionCode: 'US-UT' } }))
    expect(tripsByMonth(d, '2025-03-10').months.map((m) => m.month)).toEqual(['2025-05'])
    d = saveTrip(emptyData('t0'), ctx(), tripInput({ title: 'Year', startDate: '2020', main: { name: 'X', lat: 38, lng: -109, regionCode: 'US-UT' } }))
    expect(tripsByMonth(d, '2025-03-10')).toMatchObject({ months: [], yearOnly: [{ title: 'Year' }] })
  })

  it('steps across a year end', () => {
    expect(nextMonth('2024-12')).toBe('2025-01')
    expect(nextMonth('2025-09')).toBe('2025-10')
  })
})
