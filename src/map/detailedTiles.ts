import type { LayerSpecification, Map as MapLibreMap, SourceSpecification, StyleSpecification } from 'maplibre-gl'

/** OpenFreeMap styles for the optional detailed map (free, no key, no account). */
const STYLE_URLS = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}
const PREFIX = 'ofm-'
/** Our own base layers that the tiles replace while the detailed map is on. */
const OUTLINE_BASE = ['countries', 'country-borders', 'states', 'states-coast', 'lakes', 'cities-major', 'cities-mid', 'cities-minor']
/** The tiles go under everything that's yours: state shading, parks, routes and pins. */
const INSERT_BEFORE = 'states-visited'

const styles = new Map<string, Promise<StyleSpecification>>()
const fetchStyle = (theme: 'light' | 'dark') => {
  if (!styles.has(theme))
    styles.set(
      theme,
      fetch(STYLE_URLS[theme]).then((r) => {
        if (!r.ok) throw new Error(`OpenFreeMap returned ${r.status}`)
        return r.json() as Promise<StyleSpecification>
      }),
    )
  return styles.get(theme)!.catch((e) => {
    styles.delete(theme)
    throw e
  })
}

/**
 * Puts OpenFreeMap's streets, terrain and labels under your layers. Its fonts are the same Noto
 * Sans the app bundles; its icon sprite isn't loaded, so icons are dropped and their labels kept.
 */
export async function showDetailed(map: MapLibreMap, theme: 'light' | 'dark'): Promise<void> {
  const style = await fetchStyle(theme)
  hideDetailed(map)
  for (const [id, source] of Object.entries(style.sources)) map.addSource(PREFIX + id, source as SourceSpecification)
  for (const layer of style.layers) {
    if (layer.type === 'symbol' && /shield/.test(layer.id)) continue
    const copy = { ...layer, id: PREFIX + layer.id } as LayerSpecification & { source?: string; layout?: Record<string, unknown> }
    if ('source' in layer && typeof layer.source === 'string') copy.source = PREFIX + layer.source
    if (copy.type === 'symbol' && copy.layout && 'icon-image' in copy.layout) {
      const { 'icon-image': _icon, ...layout } = copy.layout
      copy.layout = layout
    }
    map.addLayer(copy as LayerSpecification, INSERT_BEFORE)
  }
  for (const id of OUTLINE_BASE) map.setLayoutProperty(id, 'visibility', 'none')
  map.setPaintProperty('states-visited', 'fill-opacity', 0.45)
}

/** Back to the bundled outline map. */
export function hideDetailed(map: MapLibreMap): void {
  const style = map.getStyle()
  for (const layer of style.layers) if (layer.id.startsWith(PREFIX)) map.removeLayer(layer.id)
  for (const id of Object.keys(style.sources)) if (id.startsWith(PREFIX)) map.removeSource(id)
  for (const id of OUTLINE_BASE) map.setLayoutProperty(id, 'visibility', 'visible')
  map.setPaintProperty('states-visited', 'fill-opacity', 1)
}
