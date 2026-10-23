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

  it('draws land above water and labels on top', () => {
    const ids = style.layers.map((l) => l.id)
    expect(ids[0]).toBe('water')
    expect(ids.indexOf('states')).toBeLessThan(ids.indexOf('state-borders'))
    expect(ids.at(-1)).toMatch(/^cities-/)
  })

  it('only repaints layers that exist', () => {
    const ids = new Set(style.layers.map((l) => l.id))
    for (const { layer } of themedPaint(PALETTES.dark)) expect(ids.has(layer), layer).toBe(true)
  })
})
