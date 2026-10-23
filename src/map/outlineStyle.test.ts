import { describe, expect, it } from 'vitest'
import { outlineStyle, PALETTES, themedPaint } from './outlineStyle.ts'
import type { OutlineData } from './mapData.ts'

const empty = { type: 'FeatureCollection', features: [] } as const
const data = { countries: empty, states: empty, stateBorders: empty, lakes: empty, cities: empty } as unknown as OutlineData

describe('outlineStyle', () => {
  const style = outlineStyle(data, PALETTES.light, 'https://example.test/fonts/{fontstack}/{range}.pbf')

  it('uses only bundled sources (no tiles, no outside URLs)', () => {
    for (const source of Object.values(style.sources)) expect(source.type).toBe('geojson')
    expect(style.glyphs).toContain('{fontstack}/{range}.pbf')
  })

  it('draws land above water, shading under borders, and pins above everything else', () => {
    const ids = style.layers.map((l) => l.id)
    expect(ids[0]).toBe('water')
    expect(ids.indexOf('states')).toBeLessThan(ids.indexOf('states-visited'))
    expect(ids.indexOf('states-visited')).toBeLessThan(ids.indexOf('state-borders'))
    expect(ids.indexOf('cities-minor')).toBeLessThan(ids.indexOf('pins'))
    expect(ids.indexOf('pins')).toBeLessThan(ids.indexOf('pin-badges'))
  })

  it('clusters pins and lets states carry their trip count as feature-state', () => {
    expect(style.sources.pins).toMatchObject({ type: 'geojson', cluster: true })
    expect(style.sources.states).toMatchObject({ promoteId: 'code' })
  })

  it('only repaints layers that exist', () => {
    const ids = new Set(style.layers.map((l) => l.id))
    for (const { layer } of themedPaint(PALETTES.dark)) expect(ids.has(layer), layer).toBe(true)
  })
})
