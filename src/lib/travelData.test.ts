import { describe, expect, it } from 'vitest'
import { addPerson, deleteTrip, emptyData, saveTrip, type TripInput } from './travelActions.ts'
import { mergeData, parseTravelData, sameContent } from './travelData.ts'
import { FAMILY_GROUP_ID, type EditContext } from './types.ts'

let n = 0
const at = (now: string): EditContext => ({ now, newId: () => `id${++n}` })
const input: TripInput = {
  title: 'Moab',
  startDate: '2024',
  endDate: null,
  approximate: false,
  main: { place: { name: 'Moab', lat: 38.57, lng: -109.55, regionCode: 'US-UT' } },
  stops: [],
  companions: [],
  isFamily: false,
  description: '',
  highlights: '',
  rating: null,
  tags: [],
}

describe('mergeData', () => {
  it('keeps edits from both devices, newest per record, deletes win ties', () => {
    const base = saveTrip(emptyData('t0'), at('2026-01-01T00:00:00Z'), input)
    const id = base.trips[0].id
    const phone = saveTrip(base, at('2026-01-02T00:00:00Z'), { ...input, title: 'Moab (phone)' }, id)
    const pc = saveTrip(base, at('2026-01-03T00:00:00Z'), { ...input, title: 'Chicago', main: { place: { name: 'Chicago', lat: 41.88, lng: -87.63 } } })
    const merged = mergeData(phone, pc)
    expect(merged.trips.map((t) => t.title).sort()).toEqual(['Chicago', 'Moab (phone)'])

    const deleted = deleteTrip(base, at('2026-01-01T00:00:00Z'), id)
    expect(mergeData(base, deleted).trips.find((t) => t.id === id)?.deleted).toBe(true)
  })

  it("never lets a new device's empty Family group wipe out family members from another device", () => {
    const phone = addPerson(emptyData('2026-01-01T00:00:00Z'), at('2026-01-02T00:00:00Z'), 'mom', { name: 'Mom', groupIds: [FAMILY_GROUP_ID] })
    const newPc = emptyData('2026-06-01T00:00:00Z')
    for (const merged of [mergeData(phone, newPc), mergeData(newPc, phone)])
      expect(merged.groups.find((g) => g.id === FAMILY_GROUP_ID)?.memberIds).toEqual(['mom'])
  })
})

describe('parseTravelData', () => {
  it('round-trips real data and compares equal', () => {
    const data = addPerson(saveTrip(emptyData('t0'), at('2026-01-01T00:00:00Z'), input), at('2026-01-01T00:00:00Z'), 'p', { name: 'Pat', groupIds: [] })
    const parsed = parseTravelData(JSON.parse(JSON.stringify(data)))
    expect(sameContent(parsed, data)).toBe(true)
  })

  it('rejects files that are not Travel Log data, and drops malformed records', () => {
    expect(() => parseTravelData({ schemaVersion: 2 })).toThrow(/unknown version/)
    expect(() => parseTravelData([1, 2])).toThrow(/not a JSON object/)
    const parsed = parseTravelData({
      schemaVersion: 1,
      trips: [{ id: 'x', updatedAt: 't' }, 'nonsense'],
      places: [{ id: 'p', updatedAt: 't', name: 'Somewhere', lat: 1, lng: 2 }],
      people: [],
      groups: [],
    })
    expect(parsed.trips).toEqual([])
    expect(parsed.places).toHaveLength(1)
    expect(parsed.groups.map((g) => g.id)).toEqual([FAMILY_GROUP_ID])
  })
})
