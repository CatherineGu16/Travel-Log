import { Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef, useState } from 'react'
import { resolvedTheme } from '../ui/theme.ts'
import { loadOutlineData } from './mapData.ts'
import { outlineStyle, PALETTES, themedPaint } from './outlineStyle.ts'
import { QUICK_JUMPS, VIEWS, type ViewId } from './views.ts'

// MapLibre 6 runs its tile/geometry work in a separate worker file, served from the app's own assets.
setWorkerUrl(workerUrl)

/** Glyph URL template for the bundled label fonts (MapLibre needs it absolute). */
const glyphsUrl = () => `${location.origin}${import.meta.env.BASE_URL}fonts/{fontstack}/{range}.pbf`

const fitPadding = () => (window.innerWidth < 640 ? 24 : 56)

export function MapView() {
  const container = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let instance: MapLibreMap | null = null
    void loadOutlineData()
      .then((data) => {
        if (cancelled || !container.current) return
        const created = new MapLibreMap({
          container: container.current,
          style: outlineStyle(data, PALETTES[resolvedTheme()], glyphsUrl()),
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
        created.on('load', () => !cancelled && setMap(created))
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      instance?.remove()
    }
  }, [])

  // Repaint when the theme changes, from Settings or from the device.
  useEffect(() => {
    if (!map) return
    const repaint = () => {
      for (const { layer, prop, value } of themedPaint(PALETTES[resolvedTheme()])) map.setPaintProperty(layer, prop, value)
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

function MapControls(props: { onZoomIn: () => void; onZoomOut: () => void; onReset: () => void; onJump: (id: ViewId) => void }) {
  const btn =
    'grid min-h-11 min-w-11 place-items-center px-2 text-sm font-bold text-fg hover:bg-raised active:bg-raised disabled:opacity-40'
  return (
    <>
      <div className="absolute right-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+2.25rem)] flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-md">
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
        className="absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+2.25rem)] left-3 flex overflow-hidden rounded-xl border border-line bg-surface shadow-md"
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
