import { LngLatBounds, Map as MapLibreMap, setWorkerUrl, type ExpressionSpecification, type GeoJSONSource, type MapMouseEvent } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef, useState } from 'react'
import { shadeLevel, type Pin } from '../lib/derive.ts'
import { loadParkBoundaries, PARKS } from '../lib/gazetteer.ts'
import { greatCircle, unwrapLngs } from '../lib/geo.ts'
import type { LngLat } from '../lib/types.ts'
import { legPaths, type RoutePoint } from '../lib/route.ts'
import { resolvedTheme } from '../ui/theme.ts'
import { loadOutlineData } from './mapData.ts'
import { outlineStyle, PALETTES, themedPaint } from './outlineStyle.ts'
import { hideDetailed, showDetailed } from './detailedTiles.ts'
import { setParkImages, setPinImages } from './pinImages.ts'
import { usePersistentState } from '../ui/usePersistentState.ts'
import { FLAT_MIN_ZOOM, globeZoom, VIEWS, type MapProjection } from './views.ts'

// MapLibre 6 runs its tile/geometry work in a separate worker file, served from the app's own assets.
setWorkerUrl(workerUrl)

/** Glyph URL template for the bundled label fonts (MapLibre needs it absolute). */
const glyphsUrl = () => `${location.origin}${import.meta.env.BASE_URL}fonts/{fontstack}/{range}.pbf`

const fitPadding = () => (window.innerWidth < 640 ? 24 : 56)
const LONG_PRESS_MS = 550

export type ParksMode = 'off' | 'all' | 'visited' | 'not-visited'
const PARK_LAYERS = ['park-areas', 'park-outlines', 'park-icons', 'park-labels']

/**
 * Room around a fitted route for the header and the pin card (left panel on desktop, bottom sheet
 * on phones), or, while you shape a route, for the instructions across the top.
 */
const routePadding = (shaping: boolean) =>
  shaping
    ? { top: 200, bottom: 120, left: 50, right: 150 }
    : window.innerWidth < 640
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
  /** Dots on the route's bends (while shaping it). */
  showBends?: boolean
  /** While set, taps on the map pick a point instead of selecting pins. */
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
  // Flat map or globe; the map reads the one in place from the ref.
  const [projection, setMapProjection] = usePersistentState<MapProjection>('travel.mapProjection', 'flat', (v) => (v === 'globe' ? 'globe' : 'flat'))
  const shownProjection = useRef(projection)

  useEffect(() => {
    let cancelled = false
    let instance: MapLibreMap | null = null
    void loadOutlineData()
      .then((data) => {
        if (cancelled || !container.current) return
        const palette = PALETTES[resolvedTheme()]
        const created = new MapLibreMap({
          container: container.current,
          style: { ...outlineStyle(data, palette, glyphsUrl()), projection: { type: projectionType(shownProjection.current) } },
          bounds: VIEWS.us.bounds,
          fitBoundsOptions: { padding: fitPadding() },
          maxZoom: 14,
          attributionControl: { compact: true, customAttribution: ['National Park Service', 'Place names: GeoNames'] },
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
        })
        const limitZoom = () => created.setMinZoom(minZoomFor(created, shownProjection.current))
        limitZoom()
        created.on('move', limitZoom)
        created.on('resize', limitZoom)
        // Wheel zooming on the globe can overshoot the limit; ease back when it settles.
        created.on('moveend', () => {
          if (shownProjection.current !== 'globe') return
          const min = worldZoom(created)
          if (created.getZoom() < min - 0.01) created.easeTo({ zoom: min, duration: 300 })
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

  // Switching between the flat map and the globe. Turning the globe on zooms out to see all of it;
  // back to flat, the view stays unless it was zoomed out past the flat map's limit.
  useEffect(() => {
    if (!map || shownProjection.current === projection) return
    shownProjection.current = projection
    map.setProjection({ type: projectionType(projection) })
    map.setMinZoom(minZoomFor(map, projection))
    if (projection === 'globe') map.easeTo({ zoom: worldZoom(map), duration: 900 })
    else if (map.getZoom() <= FLAT_MIN_ZOOM) map.fitBounds(VIEWS.us.bounds, { padding: fitPadding(), duration: 900 })
  }, [map, projection])

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
    const paths = legPaths(route)
    map.getSource<GeoJSONSource>('route')?.setData({
      type: 'FeatureCollection',
      features: [
        // The way back the same way runs over the way there, so it isn't drawn twice.
        ...route.slice(1).flatMap((r, i) =>
          r.leg?.role === 'return'
            ? []
            : [
                {
                  type: 'Feature' as const,
                  properties: { style: legStyle(r) },
                  geometry: { type: 'LineString' as const, coordinates: unwrapLngs(paths[i + 1] ?? flightArc(route[i], r)) },
                },
              ],
        ),
        // Home starts and ends the trip at the same spot, and stops passed on the way back are
        // already marked: one marker each.
        ...route
          .filter((r, i) => !r.returning && (r.number !== null || r.marker || (r.role === 'home' && i === 0)))
          .map((r) => ({
            type: 'Feature' as const,
            properties: { number: r.marker ?? r.number ?? 'H', name: r.place.name },
            geometry: { type: 'Point' as const, coordinates: [r.place.lng, r.place.lat] },
          })),
        // Bends: small dots while you're shaping the route, so you can see what you tapped.
        ...(props.showBends ? route.flatMap((r) => r.via) : []).map((coordinates) => ({
          type: 'Feature' as const,
          properties: { bend: true },
          geometry: { type: 'Point' as const, coordinates },
        })),
      ],
    })
  }, [map, route, props.showBends])

  // Only when a different trip is shown, not on every edit, so it reads the route from the ref.
  // Fitted to the places (and the bends of ground legs), not flight arcs: a long flight can run off
  // the edge so the places stay readable. Home is left out when you flew from it.
  useEffect(() => {
    const current = latest.current.route
    if (!map || !routeTripId || current.length < 2) return
    const bounds = new LngLatBounds()
    const flewFrom = (i: number) => [current[i]?.leg, current[i + 1]?.leg].every((l) => !l || l.mode === 'flight')
    current.forEach((r, i) => {
      if (r.role === 'home' && flewFrom(i)) return
      if (legStyle(r) !== 'flight') for (const p of r.via) bounds.extend(p)
      bounds.extend([r.place.lng, r.place.lat])
    })
    if (bounds.isEmpty()) return
    map.fitBounds(bounds, { padding: routePadding(!!latest.current.showBends), maxZoom: 10, duration: 800 })
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


  return (
    <div className="relative h-full w-full">
      {/* MapLibre's stylesheet makes its container position: relative, so it fills an absolute wrapper. */}
      <div className="absolute inset-0">
        <div ref={container} className="map-space h-full w-full" data-testid="map" aria-label="Map of your travels" role="region" />
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
          onReset={() => map.fitBounds(VIEWS.us.bounds, { padding: fitPadding(), duration: 900 })}
          globe={projection === 'globe'}
          onToggleGlobe={() => setMapProjection(projection === 'globe' ? 'flat' : 'globe')}
        />
      )}
    </div>
  )
}

/** MapLibre's globe flattens on its own when zoomed in close, so street detail still looks right. */
const projectionType = (p: MapProjection) => (p === 'globe' ? 'globe' : 'mercator')

/** Zoomed all the way out, the globe fills 75% of the screen; the flat map stops at FLAT_MIN_ZOOM. */
const minZoomFor = (map: MapLibreMap, p: MapProjection) => (p === 'globe' ? worldZoom(map) : FLAT_MIN_ZOOM)

/**
 * The zoom that shows the whole globe at 75% of the map's shorter side. The globe's size at a
 * given zoom depends on the latitude in view, so this follows the map as it moves.
 */
const worldZoom = (map: MapLibreMap) => {
  const { clientWidth, clientHeight } = map.getContainer()
  const zoom = globeZoom(clientWidth, clientHeight, map.getCenter().lat, map.getVerticalFieldOfView())
  // Before the map has a size there's nothing to fit.
  return Number.isFinite(zoom) ? Math.min(Math.max(zoom, -2), map.getMaxZoom()) : 0
}

/** How a leg is drawn: a flight as a dashed arc, "not sure" (or a leg being shaped) dotted, the rest solid. */
const legStyle = (to: RoutePoint) => (!to.leg || to.leg.mode === 'unknown' ? 'unknown' : to.leg.mode === 'flight' ? 'flight' : 'ground')

/** A flight arriving at `to`: along great circles, through any bends. (Ground legs come from legPaths.) */
function flightArc(from: RoutePoint, to: RoutePoint): LngLat[] {
  const points: LngLat[] = [[from.place.lng, from.place.lat], ...to.via, [to.place.lng, to.place.lat]]
  return points.slice(1).flatMap((p, i) => greatCircle(points[i], p).slice(i === 0 ? 0 : 1))
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

function MapControls(props: { onZoomIn: () => void; onZoomOut: () => void; onReset: () => void; globe: boolean; onToggleGlobe: () => void }) {
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
        <span className="h-px bg-line" />
        <button
          className={`${btn} ${props.globe ? 'bg-raised' : ''}`}
          onClick={props.onToggleGlobe}
          aria-label="Globe view"
          aria-pressed={props.globe}
          title={props.globe ? 'Globe view: on (tap for the flat map)' : 'Globe view: off (tap to see the globe)'}
        >
          <span aria-hidden className={`text-lg leading-none ${props.globe ? '' : 'opacity-60 grayscale'}`}>
            🌐
          </span>
        </button>
      </div>
    </>
  )
}
