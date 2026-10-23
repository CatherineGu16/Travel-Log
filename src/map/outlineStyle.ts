import type { Map as MapLibreMap, StyleSpecification, SymbolLayerSpecification } from 'maplibre-gl'
import type { OutlineData } from './mapData.ts'

export type MapPalette = {
  water: string
  land: string
  foreignLand: string
  stateBorder: string
  countryBorder: string
  coast: string
  label: string
  labelHalo: string
}

export const PALETTES: Record<'light' | 'dark', MapPalette> = {
  light: {
    water: '#c9dfe8',
    land: '#fbf8ef',
    foreignLand: '#ece7da',
    stateBorder: '#bdb39d',
    countryBorder: '#9a917e',
    coast: '#9fbfcc',
    label: '#4b4f45',
    labelHalo: '#fbf8ef',
  },
  dark: {
    water: '#0f1b24',
    land: '#232c35',
    foreignLand: '#1b2229',
    stateBorder: '#45525f',
    countryBorder: '#5b6876',
    coast: '#2a4252',
    label: '#b7c2cc',
    labelHalo: '#1a2229',
  },
}

/** Paint properties that change with the theme, so a theme switch can repaint without a reload. */
type PaintProp = Parameters<MapLibreMap['setPaintProperty']>[1]

export function themedPaint(p: MapPalette): { layer: string; prop: PaintProp; value: string }[] {
  return [
    { layer: 'water', prop: 'background-color', value: p.water },
    { layer: 'countries', prop: 'fill-color', value: p.foreignLand },
    { layer: 'country-borders', prop: 'line-color', value: p.countryBorder },
    { layer: 'states', prop: 'fill-color', value: p.land },
    { layer: 'states-coast', prop: 'line-color', value: p.coast },
    { layer: 'lakes', prop: 'fill-color', value: p.water },
    { layer: 'state-borders', prop: 'line-color', value: p.stateBorder },
    ...['cities-major', 'cities-mid', 'cities-minor'].flatMap((layer) => [
      { layer, prop: 'text-color' as const, value: p.label },
      { layer, prop: 'text-halo-color' as const, value: p.labelHalo },
    ]),
  ]
}

const cityLayer = (
  id: string,
  minzoom: number,
  ranks: [number, number],
  size: [number, number],
  p: MapPalette,
): SymbolLayerSpecification => ({
  id,
  type: 'symbol',
  source: 'cities',
  minzoom,
  filter: ['all', ['>=', ['get', 'rank'], ranks[0]], ['<=', ['get', 'rank'], ranks[1]]],
  layout: {
    'text-field': ['get', 'name'],
    'text-font': ['Noto Sans Regular'],
    'text-size': ['interpolate', ['linear'], ['zoom'], minzoom, size[0], minzoom + 4, size[1]],
    'symbol-sort-key': ['get', 'rank'],
    'text-padding': 4,
  },
  paint: { 'text-color': p.label, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.4 },
})

/**
 * The bundled outline map: water, neighboring countries, states, lakes and city labels, with no
 * outside requests. Glyphs come from the app's own public/fonts/.
 */
export function outlineStyle(data: OutlineData, palette: MapPalette, glyphsUrl: string): StyleSpecification {
  const p = palette
  return {
    version: 8,
    glyphs: glyphsUrl,
    sources: {
      countries: { type: 'geojson', data: data.countries, attribution: 'Natural Earth' },
      states: { type: 'geojson', data: data.states, attribution: 'US Census Bureau' },
      'state-borders': { type: 'geojson', data: data.stateBorders },
      lakes: { type: 'geojson', data: data.lakes },
      cities: { type: 'geojson', data: data.cities },
    },
    layers: [
      { id: 'water', type: 'background', paint: { 'background-color': p.water } },
      { id: 'countries', type: 'fill', source: 'countries', paint: { 'fill-color': p.foreignLand } },
      { id: 'country-borders', type: 'line', source: 'countries', paint: { 'line-color': p.countryBorder, 'line-width': 0.6 } },
      { id: 'states', type: 'fill', source: 'states', paint: { 'fill-color': p.land } },
      { id: 'states-coast', type: 'line', source: 'states', paint: { 'line-color': p.coast, 'line-width': 0.8 } },
      { id: 'lakes', type: 'fill', source: 'lakes', paint: { 'fill-color': p.water } },
      {
        id: 'state-borders',
        type: 'line',
        source: 'state-borders',
        layout: { 'line-join': 'round' },
        paint: { 'line-color': p.stateBorder, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.7, 8, 1.6] },
      },
      cityLayer('cities-major', 3, [0, 2], [11, 14], p),
      cityLayer('cities-mid', 5, [3, 5], [11, 13], p),
      cityLayer('cities-minor', 7, [6, 10], [10, 12], p),
    ],
  }
}
