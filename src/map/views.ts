import type { LngLatBoundsLike } from 'maplibre-gl'

export type ViewId = 'us'

/** "us" is the continental US, the map's home view. */
export const VIEWS: Record<ViewId, { label: string; short: string; bounds: LngLatBoundsLike }> = {
  us: { label: 'Continental US', short: 'US', bounds: [[-125, 24.3], [-66.9, 49.5]] },
}

/** Flat map or globe (Map controls → 🌐), remembered per device. */
export type MapProjection = 'flat' | 'globe'

/** The flat map's farthest zoom out. */
export const FLAT_MIN_ZOOM = 1.5

/** Zoomed all the way out, the globe is this share of the screen's shorter side. */
export const GLOBE_FILL = 0.75

/**
 * The zoom at which the globe's disc spans `fill` of the shorter side of a width × height map.
 * MapLibre sizes the globe by zoom and the center's latitude (radius = worldSize / 2π / cos lat),
 * and the camera's perspective makes the disc look a little bigger than that radius.
 */
export function globeZoom(width: number, height: number, lat: number, fovDegrees: number, fill = GLOBE_FILL): number {
  const r = (fill * Math.min(width, height)) / 2
  // Camera to the center of the view, in pixels; the disc a sphere of radius R shows from there is
  // r = D·R / √(D² + 2DR), so R = (r² + r·√(r² + D²)) / D.
  const d = (0.5 / Math.tan((fovDegrees * Math.PI) / 360)) * height
  const radius = (r * r + r * Math.sqrt(r * r + d * d)) / d
  const worldSize = radius * 2 * Math.PI * Math.cos((Math.min(Math.abs(lat), 85.05) * Math.PI) / 180)
  return Math.log2(worldSize / 512)
}
