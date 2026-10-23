import { describe, expect, it } from 'vitest'
import parks from './national-parks.json'
import boundaries from './park-boundaries.json'
import states from './us-states.json'
import places from './us-places.json'
import parkHikes from './park-hikes.json'

const STATE_CODE = /^US-[A-Z]{2}$/

describe('national-parks.json', () => {
  it('lists all 64 national parks (Chiricahua became the 64th in October 2026)', () => {
    expect(parks).toHaveLength(64)
    expect(parks.map((p) => p.id)).toContain('chiricahua')
  })

  it('has unique ids and NPS codes', () => {
    expect(new Set(parks.map((p) => p.id)).size).toBe(parks.length)
    expect(new Set(parks.map((p) => p.npsCode)).size).toBe(parks.length)
  })

  it('gives every park a location, established date, area and valid state codes', () => {
    for (const p of parks) {
      expect(p.lat, p.name).toBeTypeOf('number')
      expect(p.lng, p.name).toBeTypeOf('number')
      expect(p.established, p.name).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(p.areaAcres, p.name).toBeGreaterThan(0)
      expect(p.states.length, p.name).toBeGreaterThan(0)
      for (const s of p.states) expect(s, p.name).toMatch(STATE_CODE)
    }
  })

  it('has a boundary for every park', () => {
    const ids = new Set(boundaries.objects.parks.geometries.map((g) => (g.properties as { id: string }).id))
    for (const p of parks) expect(ids.has(p.id), p.name).toBe(true)
  })
})

describe('us-states.json', () => {
  it('tags every state with an ISO 3166-2 code, and includes the 50 states', () => {
    const codes = states.objects.states.geometries.map((g) => g.properties.code)
    for (const c of codes) expect(c).toMatch(STATE_CODE)
    const fifty = codes.filter((c) => !['US-DC', 'US-PR', 'US-VI', 'US-GU', 'US-AS', 'US-MP'].includes(c))
    expect(fifty).toHaveLength(50)
  })
})

describe('us-places.json', () => {
  it('has compact [name, state, lat, lng] rows with tidy names', () => {
    expect(places.length).toBeGreaterThan(30000)
    const moab = places.find((r) => r[0] === 'Moab' && r[1] === 'UT')
    expect(moab).toBeDefined()
    expect(places.some((r) => / (city|town|CDP)$/.test(r[0] as string))).toBe(false)
  })
})

describe('park-hikes.json', () => {
  const hikes = parkHikes as Record<string, { id: string; name: string; npsUrl: string }[]>

  it('has an entry (possibly empty) for every park, and nothing else', () => {
    expect(Object.keys(hikes).sort()).toEqual(parks.map((p) => p.id).sort())
  })

  it('lists named hikes with unique ids and nps.gov links', () => {
    for (const [parkId, list] of Object.entries(hikes)) {
      expect(new Set(list.map((h) => h.id)).size, parkId).toBe(list.length)
      for (const h of list) {
        expect(h.name, parkId).not.toMatch(/^hike /i)
        expect(h.npsUrl, h.name).toMatch(/^https:\/\/www\.nps\.gov\//)
      }
    }
  })
})
