import { describe, expect, it } from 'vitest'
import { globeZoom } from './views.ts'

describe('globeZoom', () => {
  it('keeps the globe the same size on screen whatever the latitude in view', () => {
    // MapLibre's globe grows by 1 / cos(lat) at a given zoom, so 60° needs one zoom level less.
    expect(globeZoom(420, 800, 0, 36.87) - globeZoom(420, 800, 60, 36.87)).toBeCloseTo(1)
  })

  it('fits the shorter side of the map', () => {
    // A wide map is limited by its height, like a square one of that height.
    expect(globeZoom(1280, 800, 0, 36.87)).toBeCloseTo(globeZoom(800, 800, 0, 36.87))
    expect(globeZoom(420, 800, 0, 36.87, 0.75)).toBeGreaterThan(globeZoom(420, 800, 0, 36.87, 0.5))
  })
})
