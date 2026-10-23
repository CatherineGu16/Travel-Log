import { LngLatBounds, Map as MapLibreMap, setWorkerUrl, type ExpressionSpecification, type GeoJSONSource, type MapMouseEvent } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef, useState } from 'react'
import { shadeLevel, type Pin } from '../lib/derive.ts'
import { loadParkBoundaries, PARKS } from '../lib/gazetteer.ts'
import type { RoutePoint } from '../lib/route.ts'
import { resolvedTheme } from '../ui/theme.ts'
import { loadOutlineData } from './mapData.ts'
import { outlineStyle, PALETTES, themedPaint } from './outlineStyle.ts'
import { hideDetailed, showDetailed } from './detailedTiles.ts'
import { setParkImages, setPinImages } from './pinImages.ts'
import { QUICK_JUMPS, VIEWS, type ViewId } from './views.ts'

// MapLibre 6 runs its tile/geometry work in a separate worker file, served from the app's own assets.
setWorkerUrl(workerUrl)

/** Glyph URL template for the bundled label fonts (MapLibre needs it absolute). */
const glyphsUrl = () => `${location.origin}${import.meta.env.BASE_URL}fonts/{fontstack}/{range}.pbf`

const fitPadding = () => (window.innerWidth < 640 ? 24 : 56)
const LONG_PRESS_MS = 550

export type ParksMode = 'off' | 'all' | 'visited' | 'not-visited'
const PARK_LAYERS = ['park-areas', 'park-outlines', 'park-icons', 'park-labels']

/** Room around a fitted route for the header and the pin card (left panel on desktop, bottom sheet on phones). */
const routePadding = () =>
  window.innerWidth < 640
    ? { top: 90, bottom: Math.round(window.innerHeight * 0.5), left: 40, right: 40 }
    : { top: 90, bottom: 60, left: 440, right: 80 }

export interface MapViewProps {
  pins: Pin[]
  tripsPerRegion: Map<string, number>
  selectedPlaceId: string | null
  /** The selected trip's route (empty when it has no stops), and which trip it is. */
  route: RoutePoint[]
  routeTripId: string | null
  onSelectPin: (placeId: string | null) => void
  /** Long-press (touch) or right-click (desktop): add a trip at that spot. */
  onAddAt: (lng: number, lat: number) => void
  /** While set, the next tap on the map picks a place instead of selecting pins. */
  picking: boolean
  onPick: (lng: number, lat: number) => void
  /** National parks layer: which parks to show, which you've visited, and what tapping one does. */
  parksMode: ParksMode
  visitedParks: Set<string>
  onSelectPark: (parkId: string) => void
  /** Settings → Map detail: add OpenFreeMap tiles under your layers. */
  detailed: boolean
  onDetailedFailed: () => void
  /** Changes when the map should fly to a place (e.g. a trip you just saved). */
  focus: { lng: number; lat: number; token: number } | null
}

export function MapView(props: MapViewProps) {
  const container = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [failed, setFailed] = useState(false)
  // Handlers read the latest props without re-binding map events.
  const latest = useRef(props)
  useEffect(() => {
    latest.current = props
  })

  useEffect(() => {
    let cancelled = false
    let instance: MapLibreMap | null = null
    void loadOutlineData()
      .then((data) => {
        if (cancelled || !container.current) return
        const palette = PALETTES[resolvedTheme()]
        const created = new MapLibreMap({
          container: container.current,
          style: outlineStyle(data, palette, glyphsUrl()),
          bounds: VIEWS.us.bounds,
          fitBoundsOptions: { padding: fitPadding() },
          minZoom: 1.5,
          maxZoom: 14,
          attributionControl: { compact: true, customAttribution: 'National Park Service' },
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
        })
        created.touchZoomRotate.disableRotation()
        created.keyboard.disableRotation()
        instance = created
        created.on('load', () => {
          if (cancelled) return
          setPinImages(created, { accent: palette.pin, park: palette.pinPark, center: palette.pinCenter })
          setParkImages(created, { park: palette.park, muted: palette.parkMuted, surface: palette.surface })
          bindInteractions(created, latest)
          setMap(created)
        })
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      instance?.remove()
    }
  }, [])

  // Pins: one per major location.
  const { pins, selectedPlaceId } = props
  useEffect(() => {
    const source = map?.getSource<GeoJSONSource>('pins')
    source?.setData({
      type: 'FeatureCollection',
      features: pins.map((pin) => ({
        type: 'Feature',
        properties: {
          placeId: pin.place.id,
          name: pin.place.name,
          isPark: pin.isPark,
          count: pin.trips.length,
          selected: pin.place.id === selectedPlaceId,
          dim: selectedPlaceId !== null && pin.place.id !== selectedPlaceId,
        },
        geometry: { type: 'Point', coordinates: [pin.place.lng, pin.place.lat] },
      })),
    })
  }, [map, pins, selectedPlaceId])

  // The selected trip's route, fitted into view (around the pin card) when the trip changes.
  const { route, routeTripId } = props
  useEffect(() => {
    if (!map) return
    map.getSource<GeoJSONSource>('route')?.setData({
      type: 'FeatureCollection',
      features: [
        ...(route.length > 1
          ? [
              {
                type: 'Feature' as const,
                properties: {},
                geometry: { type: 'LineString' as const, coordinates: route.map((r) => [r.place.lng, r.place.lat]) },
              },
            ]
          : []),
        ...route
          .filter((r) => r.number !== null)
          .map((r) => ({
            type: 'Feature' as const,
            properties: { number: r.number, name: r.place.name },
            geometry: { type: 'Point' as const, coordinates: [r.place.lng, r.place.lat] },
          })),
      ],
    })
  }, [map, route])

  // Only when a different trip is shown, not on every edit, so it reads the route from the ref.
  useEffect(() => {
    const current = latest.current.route
    if (!map || !routeTripId || current.length < 2) return
    const bounds = new LngLatBounds()
    for (const r of current) bounds.extend([r.place.lng, r.place.lat])
    map.fitBounds(bounds, { padding: routePadding(), maxZoom: 10, duration: 800 })
  }, [map, routeTripId])

  // National parks: badges for all 64, boundaries loaded the first time the layer is shown.
  const { parksMode, visitedParks } = props
  const [boundaries, setBoundaries] = useState<Awaited<ReturnType<typeof loadParkBoundaries>> | null>(null)
  useEffect(() => {
    if (parksMode !== 'off' && !boundaries) void loadParkBoundaries().then(setBoundaries)
  }, [parksMode, boundaries])
  useEffect(() => {
    if (!map) return
    map.getSource<GeoJSONSource>('parks')?.setData({
      type: 'FeatureCollection',
      features: PARKS.map((park) => ({
        type: 'Feature',
        properties: { parkId: park.id, name: park.name, visited: visitedParks.has(park.id) },
        geometry: { type: 'Point', coordinates: [park.lng, park.lat] },
      })),
    })
    if (boundaries)
      map.getSource<GeoJSONSource>('park-areas')?.setData({
        ...boundaries,
        features: boundaries.features.map((f) => ({ ...f, properties: { ...f.properties, visited: visitedParks.has(f.properties.id) } })),
      })
  }, [map, visitedParks, boundaries])
  useEffect(() => {
    if (!map) return
    for (const layer of PARK_LAYERS) map.setLayoutProperty(layer, 'visibility', parksMode === 'off' ? 'none' : 'visible')
    const visited: ExpressionSpecification = ['boolean', ['get', 'visited'], false]
    const show = parksMode === 'visited' ? visited : parksMode === 'not-visited' ? (['!', visited] satisfies ExpressionSpecification) : null
    for (const layer of ['park-icons', 'park-labels', 'park-outlines']) map.setFilter(layer, show)
    // Only visited parks are shaded, so in "not visited" mode there's nothing to fill.
    map.setFilter('park-areas', parksMode === 'not-visited' ? ['==', 1, 0] : visited)
  }, [map, parksMode])

  // States shaded by how many trips visited them.
  const { tripsPerRegion } = props
  const shaded = useRef(new Set<string>())
  useEffect(() => {
    if (!map) return
    for (const code of shaded.current) if (!tripsPerRegion.has(code)) map.setFeatureState({ source: 'states', id: code }, { level: 0 })
    for (const [code, n] of tripsPerRegion) map.setFeatureState({ source: 'states', id: code }, { level: shadeLevel(n) })
    shaded.current = new Set(tripsPerRegion.keys())
  }, [map, tripsPerRegion])

  // Fly to a place on request.
  const { focus } = props
  useEffect(() => {
    if (map && focus) map.easeTo({ center: [focus.lng, focus.lat], zoom: Math.max(map.getZoom(), 5), duration: 800 })
  }, [map, focus])

  useEffect(() => {
    if (map) map.getCanvas().style.cursor = props.picking ? 'crosshair' : ''
  }, [map, props.picking])

  // The optional detailed map, restyled for the theme.
  const [themeTick, setThemeTick] = useState(0)
  const { detailed } = props
  useEffect(() => {
    if (!map) return
    if (!detailed) return hideDetailed(map)
    let cancelled = false
    showDetailed(map, resolvedTheme()).catch(() => !cancelled && latest.current.onDetailedFailed())
    return () => {
      cancelled = true
    }
  }, [map, detailed, themeTick])

  // Repaint when the theme changes, from Settings or from the device.
  useEffect(() => {
    if (!map) return
    const repaint = () => {
      setThemeTick((t) => t + 1)
      const palette = PALETTES[resolvedTheme()]
      for (const { layer, prop, value } of themedPaint(palette)) map.setPaintProperty(layer, prop, value)
      setPinImages(map, { accent: palette.pin, park: palette.pinPark, center: palette.pinCenter })
      setParkImages(map, { park: palette.park, muted: palette.parkMuted, surface: palette.surface })
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', repaint)
    const observer = new MutationObserver(repaint)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      media.removeEventListener('change', repaint)
      observer.disconnect()
    }
  }, [map])

  const jump = (id: ViewId) => map?.fitBounds(VIEWS[id].bounds, { padding: fitPadding(), duration: 900 })

  return (
    <div className="relative h-full w-full">
      {/* MapLibre's stylesheet makes its container position: relative, so it fills an absolute wrapper. */}
      <div className="absolute inset-0">
        <div ref={container} className="h-full w-full" data-testid="map" aria-label="Map of your travels" role="region" />
      </div>
      {failed && (
        <p className="absolute inset-x-4 top-24 rounded-lg bg-surface p-4 text-center text-danger shadow">
          The map couldn't load. Try reloading the page.
        </p>
      )}
      {map && (
        <MapControls
          onZoomIn={() => map.zoomIn()}
          onZoomOut={() => map.zoomOut()}
          onReset={() => jump('us')}
          onJump={jump}
        />
      )}
    </div>
  )
}

/** Taps select pins (or zoom into clusters); long-press / right-click adds a trip; pick mode picks. */
function bindInteractions(map: MapLibreMap, latest: { current: MapViewProps }) {
  const pinLayers = ['pins', 'pin-badges', 'pin-badge-count']

  map.on('click', (e: MapMouseEvent) => {
    const props = latest.current
    if (props.picking) return props.onPick(e.lngLat.lng, e.lngLat.lat)
    const cluster = map.queryRenderedFeatures(e.point, { layers: ['pin-clusters'] })[0]
    if (cluster) {
      void map
        .getSource<GeoJSONSource>('pins')!
        .getClusterExpansionZoom(cluster.properties.cluster_id as number)
        .then((zoom) => map.easeTo({ center: (cluster.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.5 }))
      return
    }
    // A little slack around the point makes pins easy to tap with a finger.
    const box: [[number, number], [number, number]] = [
      [e.point.x - 10, e.point.y - 10],
      [e.point.x + 10, e.point.y + 10],
    ]
    const pin = map.queryRenderedFeatures(box, { layers: pinLayers })[0]
    if (pin) return props.onSelectPin(pin.properties.placeId as string)
    const park = props.parksMode !== 'off' ? map.queryRenderedFeatures(box, { layers: ['park-icons'] })[0] : undefined
    if (park) return props.onSelectPark(park.properties.parkId as string)
    props.onSelectPin(null)
  })

  for (const layer of [...pinLayers, 'pin-clusters', 'park-icons']) {
    map.on('mouseenter', layer, () => !latest.current.picking && (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', layer, () => !latest.current.picking && (map.getCanvas().style.cursor = ''))
  }

  map.on('contextmenu', (e) => {
    e.preventDefault()
    if (!latest.current.picking) latest.current.onAddAt(e.lngLat.lng, e.lngLat.lat)
  })

  // Long-press on touch screens. Any movement (pan, pinch) cancels it.
  let timer: number | undefined
  const cancel = () => window.clearTimeout(timer)
  map.on('touchstart', (e) => {
    cancel()
    if (e.originalEvent.touches.length !== 1 || latest.current.picking) return
    const { lng, lat } = e.lngLat
    timer = window.setTimeout(() => latest.current.onAddAt(lng, lat), LONG_PRESS_MS)
  })
  for (const ev of ['touchend', 'touchcancel', 'touchmove', 'movestart'] as const) map.on(ev, cancel)
}

function MapControls(props: { onZoomIn: () => void; onZoomOut: () => void; onReset: () => void; onJump: (id: ViewId) => void }) {
  const btn =
    'grid min-h-11 min-w-11 place-items-center px-2 text-sm font-bold text-fg hover:bg-raised active:bg-raised disabled:opacity-40'
  return (
    <>
      <div className="absolute right-3 bottom-[calc(0.75rem+2.25rem)] flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-md">
        <button className={btn} onClick={props.onZoomIn} aria-label="Zoom in">
          <span aria-hidden className="text-xl leading-none">+</span>
        </button>
        <span className="h-px bg-line" />
        <button className={btn} onClick={props.onZoomOut} aria-label="Zoom out">
          <span aria-hidden className="text-xl leading-none">−</span>
        </button>
        <span className="h-px bg-line" />
        <button className={btn} onClick={props.onReset} aria-label="Reset to US" title="Reset to US">
          US
        </button>
      </div>
      <nav
        aria-label="Jump to"
        className="absolute bottom-[calc(0.75rem+2.25rem)] left-3 flex overflow-hidden rounded-xl border border-line bg-surface shadow-md"
      >
        {QUICK_JUMPS.map((id, i) => (
          <span key={id} className="flex">
            {i > 0 && <span className="w-px bg-line" />}
            <button className={btn} onClick={() => props.onJump(id)} aria-label={`Jump to ${VIEWS[id].label}`} title={VIEWS[id].label}>
              {VIEWS[id].short}
            </button>
          </span>
        ))}
      </nav>
    </>
  )
}
