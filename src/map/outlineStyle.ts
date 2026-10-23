import type { ExpressionSpecification, Map as MapLibreMap, StyleSpecification, SymbolLayerSpecification } from 'maplibre-gl'
import type { OutlineData } from './mapData.ts'
import { PIN_IMAGES } from './pinImages.ts'

export type MapPalette = {
  water: string
  land: string
  foreignLand: string
  stateBorder: string
  countryBorder: string
  coast: string
  label: string
  labelHalo: string
  /** State shading for 1 · 2–3 · 4–6 · 7+ trips. */
  shades: [string, string, string, string]
  pin: string
  pinPark: string
  pinCenter: string
  badge: string
  badgeText: string
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
    shades: ['#f6ebc4', '#efd995', '#e5c262', '#d4a73a'],
    pin: '#d1543a',
    pinPark: '#2f7d4f',
    pinCenter: '#ffffff',
    badge: '#22261f',
    badgeText: '#ffffff',
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
    shades: ['#4a4730', '#625a33', '#7f6f37', '#a28a3c'],
    pin: '#f07a5f',
    pinPark: '#5cbf84',
    pinCenter: '#141a20',
    badge: '#e9eef2',
    badgeText: '#141a20',
  },
}

/** Fill color by the state's trip count level (feature-state "level", 0–4). */
const shadeExpression = (p: MapPalette): ExpressionSpecification => [
  'match',
  ['coalesce', ['feature-state', 'level'], 0],
  1,
  p.shades[0],
  2,
  p.shades[1],
  3,
  p.shades[2],
  4,
  p.shades[3],
  'rgba(0,0,0,0)',
]

type PaintProp = Parameters<MapLibreMap['setPaintProperty']>[1]
type PaintValue = Parameters<MapLibreMap['setPaintProperty']>[2]

/** Paint properties that change with the theme, so a theme switch can repaint without a reload. */
export function themedPaint(p: MapPalette): { layer: string; prop: PaintProp; value: PaintValue }[] {
  return [
    { layer: 'water', prop: 'background-color', value: p.water },
    { layer: 'countries', prop: 'fill-color', value: p.foreignLand },
    { layer: 'country-borders', prop: 'line-color', value: p.countryBorder },
    { layer: 'states', prop: 'fill-color', value: p.land },
    { layer: 'states-visited', prop: 'fill-color', value: shadeExpression(p) },
    { layer: 'states-coast', prop: 'line-color', value: p.coast },
    { layer: 'lakes', prop: 'fill-color', value: p.water },
    { layer: 'state-borders', prop: 'line-color', value: p.stateBorder },
    ...['cities-major', 'cities-mid', 'cities-minor'].flatMap((layer) => [
      { layer, prop: 'text-color' as const, value: p.label },
      { layer, prop: 'text-halo-color' as const, value: p.labelHalo },
    ]),
    { layer: 'pin-clusters', prop: 'circle-color', value: p.pin },
    { layer: 'pin-clusters', prop: 'circle-stroke-color', value: p.pinCenter },
    { layer: 'pin-cluster-count', prop: 'text-color', value: p.pinCenter },
    { layer: 'pin-badges', prop: 'circle-color', value: p.badge },
    { layer: 'pin-badges', prop: 'circle-stroke-color', value: p.pinCenter },
    { layer: 'pin-badge-count', prop: 'text-color', value: p.badgeText },
    { layer: 'pin-labels', prop: 'text-color', value: p.label },
    { layer: 'pin-labels', prop: 'text-halo-color', value: p.labelHalo },
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

const EMPTY = { type: 'FeatureCollection' as const, features: [] }
/** Pin size grows a little when selected. */
const pinSize: ExpressionSpecification = ['case', ['boolean', ['get', 'selected'], false], 1.3, 1]

/**
 * The bundled outline map (water, neighboring countries, states, lakes, city labels) plus your
 * layers: states shaded by trip count and one pin per major location. No outside requests;
 * glyphs come from the app's own public/fonts/.
 */
export function outlineStyle(data: OutlineData, palette: MapPalette, glyphsUrl: string): StyleSpecification {
  const p = palette
  return {
    version: 8,
    glyphs: glyphsUrl,
    sources: {
      countries: { type: 'geojson', data: data.countries, attribution: 'Natural Earth' },
      // promoteId lets each state carry its trip count as feature-state, keyed by "US-CA".
      states: { type: 'geojson', data: data.states, attribution: 'US Census Bureau', promoteId: 'code' },
      'state-borders': { type: 'geojson', data: data.stateBorders },
      lakes: { type: 'geojson', data: data.lakes },
      cities: { type: 'geojson', data: data.cities },
      pins: { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 36, clusterMaxZoom: 5 },
    },
    layers: [
      { id: 'water', type: 'background', paint: { 'background-color': p.water } },
      { id: 'countries', type: 'fill', source: 'countries', paint: { 'fill-color': p.foreignLand } },
      { id: 'country-borders', type: 'line', source: 'countries', paint: { 'line-color': p.countryBorder, 'line-width': 0.6 } },
      { id: 'states', type: 'fill', source: 'states', paint: { 'fill-color': p.land } },
      { id: 'states-visited', type: 'fill', source: 'states', paint: { 'fill-color': shadeExpression(p) } },
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

      // Clusters of pins when zoomed out.
      {
        id: 'pin-clusters',
        type: 'circle',
        source: 'pins',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': p.pin,
          'circle-radius': ['step', ['get', 'point_count'], 15, 5, 18, 15, 22],
          'circle-stroke-width': 2,
          'circle-stroke-color': p.pinCenter,
        },
      },
      {
        id: 'pin-cluster-count',
        type: 'symbol',
        source: 'pins',
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 13 },
        paint: { 'text-color': p.pinCenter },
      },
      // One pin per major location: green for national parks.
      {
        id: 'pins',
        type: 'symbol',
        source: 'pins',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['case', ['get', 'isPark'], PIN_IMAGES.park, PIN_IMAGES.accent],
          'icon-anchor': 'bottom',
          'icon-size': pinSize,
          'icon-allow-overlap': true,
          'symbol-sort-key': ['case', ['boolean', ['get', 'selected'], false], 1, 0],
        },
      },
      // Stacked dates: a small ×N badge on pins visited more than once.
      {
        id: 'pin-badges',
        type: 'circle',
        source: 'pins',
        filter: ['all', ['!', ['has', 'point_count']], ['>', ['get', 'count'], 1]],
        paint: {
          'circle-radius': 8,
          'circle-color': p.badge,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': p.pinCenter,
          'circle-translate': [11, -34],
        },
      },
      {
        id: 'pin-badge-count',
        type: 'symbol',
        source: 'pins',
        filter: ['all', ['!', ['has', 'point_count']], ['>', ['get', 'count'], 1]],
        layout: {
          'text-field': ['to-string', ['get', 'count']],
          'text-font': ['Noto Sans Bold'],
          'text-size': 10,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: { 'text-color': p.badgeText, 'text-translate': [11, -34] },
      },
      {
        id: 'pin-labels',
        type: 'symbol',
        source: 'pins',
        minzoom: 6,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
          'text-anchor': 'top',
          'text-offset': [0, 0.3],
          'text-optional': true,
        },
        paint: { 'text-color': p.label, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.6 },
      },
    ],
  }
}
