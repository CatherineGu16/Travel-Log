import type { LngLatBoundsLike } from 'maplibre-gl'

export type ViewId = 'us'

/** "us" is the continental US, the map's home view. */
export const VIEWS: Record<ViewId, { label: string; short: string; bounds: LngLatBoundsLike }> = {
  us: { label: 'Continental US', short: 'US', bounds: [[-125, 24.3], [-66.9, 49.5]] },
}

/** Zoomed all the way out, the map is a globe. */
export const WORLD_ZOOM = 1.2
