import { Map as MapLibreMap, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef } from 'react'
import type { RoutePoint } from '../lib/route.ts'
import { resolvedTheme } from '../ui/theme.ts'
import { loadOutlineData } from './mapData.ts'
import { outlineStyle, PALETTES } from './outlineStyle.ts'
import { setPinImages } from './pinImages.ts'
import { routeBounds, routeCollection } from './routeData.ts'

setWorkerUrl(workerUrl)

const glyphsUrl = () => `${location.origin}${import.meta.env.BASE_URL}fonts/{fontstack}/{range}.pbf`

/**
 * A small, still picture of one trip's route on the outline map (for the trip page, where the big
 * map is covered): its legs, numbered stops, and a pin for each main destination.
 */
export default function RouteMap({ route, label }: { route: RoutePoint[]; label: string }) {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let cancelled = false
    let map: MapLibreMap | null = null
    void loadOutlineData().then((data) => {
      if (cancelled || !container.current) return
      const palette = PALETTES[resolvedTheme()]
      const bounds = routeBounds(route)
      map = new MapLibreMap({
        container: container.current,
        style: outlineStyle(data, palette, glyphsUrl()),
        bounds: bounds.isEmpty() ? undefined : bounds,
        fitBoundsOptions: { padding: 28, maxZoom: 9 },
        interactive: false,
        attributionControl: false,
      })
      map.on('load', () => {
        if (!map) return
        setPinImages(map, { accent: palette.pin, park: palette.pinPark, center: palette.pinCenter })
        map.getSource<GeoJSONSource>('route')?.setData(routeCollection(route))
        map.getSource<GeoJSONSource>('pins')?.setData({
          type: 'FeatureCollection',
          features: route
            .filter((r) => r.role === 'main')
            .map((r) => ({
              type: 'Feature',
              properties: { placeId: r.place.id, name: r.place.name, isPark: !!r.place.parkId, count: 1, selected: false, dim: false },
              geometry: { type: 'Point', coordinates: [r.place.lng, r.place.lat] },
            })),
        })
      })
    })
    return () => {
      cancelled = true
      map?.remove()
    }
  }, [route])
  return <div ref={container} role="img" aria-label={label} className="map-space h-44 w-full overflow-hidden rounded-xl border border-line" />
}
