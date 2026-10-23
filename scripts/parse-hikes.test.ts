import { describe, expect, it } from 'vitest'
// @ts-expect-error: a plain JS build script
import { parseDifficulty, parseDistanceMi, parseDuration } from './build-park-hikes.mjs'

describe('hike details from NPS text', () => {
  it('reads stated distances, preferring round-trip figures', () => {
    expect(parseDistanceMi('Upper Emerald Pools Trail is a moderate, 1 mile (1.6 km) trail')).toBe(1)
    expect(parseDistanceMi('The moderate, 2.0 mi (3.2 km) Kayenta Trail follows the river')).toBe(2)
    expect(parseDistanceMi('A 3 km loop through the forest')).toBe(1.9)
    expect(parseDistanceMi('Walk 1.5 miles to the falls, 4.2 miles round trip')).toBe(4.2)
    expect(parseDistanceMi('It is 2.5 miles one way')).toBe(5)
  })

  it('skips distances that describe only part of the hike or the drive there', () => {
    expect(parseDistanceMi('After 1 mile (0.6 km) on the easy, paved Riverside Walk, wade upstream')).toBeNull()
    expect(parseDistanceMi('This duration only accounts for the 0.5 mi (0.3 km) Angels Landing Trail')).toBeNull()
    expect(parseDistanceMi('The trailhead is 12 miles from the visitor center')).toBeNull()
    expect(parseDistanceMi('After seven miles, a spur trail leads to a viewpoint')).toBeNull()
  })

  it('reads difficulty from tags first, then text', () => {
    expect(parseDifficulty(['moderate hike', 'Zion'], 'an easy stroll')).toBe('Moderate')
    expect(parseDifficulty([], 'A strenuous climb')).toBe('Strenuous')
    expect(parseDifficulty(['difficult'], '')).toBe('Strenuous')
    expect(parseDifficulty([], 'no clue')).toBeNull()
  })

  it('tidies the NPS time estimate', () => {
    expect(parseDuration('1-2 Hours')).toBe('1–2 hours')
    expect(parseDuration('30-60 Minutes')).toBe('30–60 minutes')
    expect(parseDuration('')).toBeNull()
  })
})
