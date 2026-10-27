import type { ExpressionSpecification, Map as MapLibreMap, StyleSpecification, SymbolLayerSpecification } from 'maplibre-gl'
import type { OutlineData } from './mapData.ts'
import { PARK_IMAGES, PIN_IMAGES } from './pinImages.ts'

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
  /** The selected trip's dashed route and numbered stops. */
  route: string
  routeText: string
  /** Parks layer: icons, boundaries and labels. */
  park: string
  parkMuted: string
  surface: string
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
    route: '#2b6f8f',
    routeText: '#ffffff',
    park: '#2f7d4f',
    parkMuted: '#8b8f80',
    surface: '#fffdf7',
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
    route: '#7cc4e4',
    routeText: '#0f1b24',
    park: '#5cbf84',
    parkMuted: '#7d8a96',
    surface: '#1b232b',
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
    { layer: 'route-ground', prop: 'line-color', value: p.route },
    { layer: 'route-unknown', prop: 'line-color', value: p.route },
    { layer: 'route-flight', prop: 'line-color', value: p.pin },
    { layer: 'route-bends', prop: 'circle-color', value: p.pinCenter },
    { layer: 'route-bends', prop: 'circle-stroke-color', value: p.route },
    { layer: 'route-stops', prop: 'circle-color', value: p.route },
    { layer: 'route-stops', prop: 'circle-stroke-color', value: p.pinCenter },
    { layer: 'route-stop-numbers', prop: 'text-color', value: p.routeText },
    { layer: 'route-labels', prop: 'text-color', value: p.label },
    { layer: 'route-labels', prop: 'text-halo-color', value: p.labelHalo },
    { layer: 'park-areas', prop: 'fill-color', value: p.park },
    { layer: 'park-outlines', prop: 'line-color', value: parkOutline(p) },
    { layer: 'park-labels', prop: 'text-color', value: p.park },
    { layer: 'park-labels', prop: 'text-halo-color', value: p.labelHalo },
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
/** Visited parks get a solid green outline; parks not visited yet a muted one. */
const parkOutline = (p: MapPalette): ExpressionSpecification => ['case', ['boolean', ['get', 'visited'], false], p.park, p.parkMuted]
/** Pin size grows a little when selected. */
const pinSize: ExpressionSpecification = ['case', ['boolean', ['get', 'selected'], false], 1.3, 1]
/** Other pins fade while one is selected. */
const pinOpacity: ExpressionSpecification = ['case', ['boolean', ['get', 'dim'], false], 0.35, 1]

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
      route: { type: 'geojson', data: EMPTY },
      parks: { type: 'geojson', data: EMPTY, attribution: 'National Park Service' },
      'park-areas': { type: 'geojson', data: EMPTY },
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

      // National parks layer (hidden until turned on): shaded boundaries when zoomed in, tree badges.
      {
        id: 'park-areas',
        type: 'fill',
        source: 'park-areas',
        minzoom: 5,
        layout: { visibility: 'none' },
        filter: ['boolean', ['get', 'visited'], false],
        paint: { 'fill-color': p.park, 'fill-opacity': 0.18 },
      },
      {
        id: 'park-outlines',
        type: 'line',
        source: 'park-areas',
        minzoom: 5,
        layout: { visibility: 'none' },
        paint: { 'line-color': parkOutline(p), 'line-width': 1.2, 'line-dasharray': [3, 2] },
      },
      {
        id: 'park-icons',
        type: 'symbol',
        source: 'parks',
        layout: {
          visibility: 'none',
          'icon-image': ['case', ['boolean', ['get', 'visited'], false], PARK_IMAGES.visited, PARK_IMAGES.notVisited],
          'icon-allow-overlap': true,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 7, 1.1],
          'symbol-sort-key': ['case', ['boolean', ['get', 'visited'], false], 1, 0],
        },
      },
      {
        id: 'park-labels',
        type: 'symbol',
        source: 'parks',
        minzoom: 5,
        layout: {
          visibility: 'none',
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Italic'],
          'text-size': 11,
          'text-anchor': 'top',
          'text-offset': [0, 1],
          'text-optional': true,
        },
        paint: { 'text-color': p.park, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.4 },
      },

      // The selected trip's route, leg by leg in visit order: solid on the ground, a dashed arc for
      // a flight, dotted when you're not sure.
      {
        id: 'route-ground',
        type: 'line',
        source: 'route',
        filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'style'], 'ground']],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': p.route, 'line-width': 3 },
      },
      {
        id: 'route-flight',
        type: 'line',
        source: 'route',
        filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'style'], 'flight']],
        layout: { 'line-join': 'round' },
        paint: { 'line-color': p.pin, 'line-width': 2.5, 'line-dasharray': [3, 2] },
      },
      {
        id: 'route-unknown',
        type: 'line',
        source: 'route',
        filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'style'], 'unknown']],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': p.route, 'line-width': 2.5, 'line-dasharray': [0.1, 2.2] },
      },
      {
        id: 'route-bends',
        type: 'circle',
        source: 'route',
        filter: ['all', ['==', ['geometry-type'], 'Point'], ['has', 'bend']],
        paint: { 'circle-radius': 5, 'circle-color': p.pinCenter, 'circle-stroke-width': 2.5, 'circle-stroke-color': p.route },
      },
      {
        id: 'route-stops',
        type: 'circle',
        source: 'route',
        filter: ['all', ['==', ['geometry-type'], 'Point'], ['has', 'number']],
        paint: { 'circle-radius': 10, 'circle-color': p.route, 'circle-stroke-width': 2, 'circle-stroke-color': p.pinCenter },
      },
      {
        id: 'route-stop-numbers',
        type: 'symbol',
        source: 'route',
        filter: ['all', ['==', ['geometry-type'], 'Point'], ['has', 'number']],
        layout: {
          'text-field': ['to-string', ['get', 'number']],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: { 'text-color': p.routeText },
      },
      {
        id: 'route-labels',
        type: 'symbol',
        source: 'route',
        filter: ['all', ['==', ['geometry-type'], 'Point'], ['has', 'number']],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
          'text-anchor': 'left',
          'text-offset': [1.1, 0],
          'text-optional': true,
        },
        paint: { 'text-color': p.label, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.6 },
      },

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
        paint: { 'icon-opacity': pinOpacity },
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
          'circle-translate': [14, -40],
          'circle-opacity': pinOpacity,
          'circle-stroke-opacity': pinOpacity,
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
        paint: { 'text-color': p.badgeText, 'text-translate': [14, -40], 'text-opacity': pinOpacity },
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
