import { describe, expect, it } from 'vitest'
// @ts-expect-error: a plain JS build script
import { headedHikes, listingSearches, trailFeedHike, parseDifficulty, parseDistanceMi, parseDuration, statedDistance } from './build-park-hikes.mjs'

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

describe('nps.gov pages that load their hike lists', () => {
  it("finds a listing box's search, asking for every result", () => {
    const html = `jQuery('#searchListing-1').searchlisting({
searchURL: "/solr/",
searchURLReady: "/solr/?q=*&fl=Title,Duration,PageURL&sort=Title asc&start=0&fq=Category:\\"Trip Ideas\\" AND Tags_Item:\\"hiking\\" AND Sites_Codes_Item:\\"acad\\"&rows=10",`
    expect(listingSearches(html)).toEqual(['/solr/?q=*&fl=Title,Duration,PageURL&sort=Title asc&start=0&fq=Category:"Trip Ideas" AND Tags_Item:"hiking" AND Sites_Codes_Item:"acad"&rows=500'])
  })

  it("reads the distance a hike's page states", () => {
    expect(statedDistance('… | Distance: 2.7 miles round trip | Terrain: …')).toEqual([2.7, 'round trip'])
    expect(statedDistance('Distance: 1.4 miles, loop')).toEqual([1.4, 'loop'])
    expect(statedDistance('Distance: 3 km one way')).toEqual([1.9, 'one way'])
    expect(statedDistance('Distance: 2 miles | Terrain')).toEqual([2, null])
    expect(statedDistance('No distance here')).toBeNull()
  })

  it('reads trails written as a heading and a paragraph starting with the distance', () => {
    const html = `<h2>Alder Trail</h2>
<p>0.6 miles (1 km)
This short, easy walk traverses inland from the rocky shore.</p>
<h2>Schoodic Bike Trails</h2>
<p>8.3 miles of wide paths</p>
<h2>Visiting</h2>
<p>The park is open all year.</p>`
    expect(headedHikes(html)).toEqual([{ name: 'Alder Trail', distanceMi: 0.6, distanceKind: null, duration: null, difficulty: 'Easy', url: null }])
  })
})

describe("NPS's trail database", () => {
  it('maps a trail to a hike as NPS shows it', () => {
    const trail = (over: object) => ({ id: 'x', name: 'Cadillac Summit Loop ', difficulty: 'Easy', length: 0.349, lengthUnit: 'Miles', routeType: 'Loop', hikeTime: '', ...over })
    expect(trailFeedHike(trail({}))).toEqual({
      name: 'Cadillac Summit Loop',
      distanceMi: 0.3,
      distanceKind: 'loop',
      duration: null,
      difficulty: 'Easy',
      url: 'https://www.nps.gov/trails/view.htm?id=x',
    })
    expect(trailFeedHike(trail({ difficulty: 'Hard', routeType: 'Point to point', length: 3.939, hikeTime: '3-6' }))).toMatchObject({
      difficulty: 'Strenuous',
      distanceMi: 3.9,
      distanceKind: 'one way',
      duration: '3–6 hours',
    })
    // Out-and-back lengths are sometimes round trip, sometimes one way: not labelled.
    expect(trailFeedHike(trail({ routeType: 'Out & back' })).distanceKind).toBeNull()
  })
})

