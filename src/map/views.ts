import type { LngLatBoundsLike } from 'maplibre-gl'

export type ViewId = 'us' | 'alaska' | 'hawaii' | 'caribbean' | 'samoa'

/** Quick-jump views. "us" is the continental US, the map's home view. */
export const VIEWS: Record<ViewId, { label: string; short: string; bounds: LngLatBoundsLike }> = {
  us: { label: 'Continental US', short: 'US', bounds: [[-125, 24.3], [-66.9, 49.5]] },
  alaska: { label: 'Alaska', short: 'AK', bounds: [[-170, 51.5], [-129.9, 71.5]] },
  hawaii: { label: 'Hawaii', short: 'HI', bounds: [[-160.4, 18.8], [-154.7, 22.3]] },
  caribbean: { label: 'Puerto Rico & Virgin Islands', short: 'PR·VI', bounds: [[-67.4, 17.6], [-64.5, 18.6]] },
  samoa: { label: 'American Samoa', short: 'AS', bounds: [[-171.1, -14.6], [-169.4, -14.1]] },
}

export const QUICK_JUMPS: ViewId[] = ['alaska', 'hawaii', 'caribbean', 'samoa']
