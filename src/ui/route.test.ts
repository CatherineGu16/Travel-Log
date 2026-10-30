import { describe, expect, it } from 'vitest'
import { achievementHref, pageHref, parseHash, placeHref, statHref, tripHref, youHref } from './route.ts'

describe('parseHash', () => {
  it('reads the page, falling back to the map', () => {
    expect(parseHash('').page).toBe('map')
    expect(parseHash('#/').page).toBe('map')
    expect(parseHash('#/parks')).toMatchObject({ page: 'you', section: 'parks' })
    expect(parseHash('#/places').page).toBe('map')
    expect(parseHash('#/trips/?x=1').page).toBe('trips')
  })

  it('reads the trip open on Trips', () => {
    expect(parseHash('#/trips')).toEqual({ page: 'trips', placeId: null, tripId: null, section: 'profile', stat: null, achievementId: null })
    expect(parseHash('#/trips/abc-123')).toMatchObject({ page: 'trips', tripId: 'abc-123' })
    expect(parseHash('#/parks/abc').tripId).toBeNull()
  })

  it('reads a place on Trips (a map pin), and a trip reached from it', () => {
    expect(parseHash('#/trips/at/moab')).toMatchObject({ page: 'trips', placeId: 'moab', tripId: null })
    expect(parseHash('#/trips/at/moab/t1')).toMatchObject({ page: 'trips', placeId: 'moab', tripId: 't1' })
    expect(parseHash('#/trips/at')).toMatchObject({ placeId: null, tripId: 'at' })
    expect(parseHash(placeHref('a/b', 'c d'))).toMatchObject({ placeId: 'a/b', tripId: 'c d' })
  })

  it('reads the section of You, the profile when unknown', () => {
    expect(parseHash('#/you').section).toBe('profile')
    expect(parseHash('#/you/settings')).toEqual({ page: 'you', placeId: null, tripId: null, section: 'settings', stat: null, achievementId: null })
    expect(parseHash('#/you/achievements/').section).toBe('achievements')
    expect(parseHash('#/you/nope').section).toBe('profile')
  })

  it('reads a stat list or an achievement open on You', () => {
    expect(parseHash(statHref('states'))).toMatchObject({ page: 'you', section: 'profile', stat: 'states' })
    expect(parseHash('#/you/stats/nope').stat).toBeNull()
    expect(parseHash(achievementHref('parks-64'))).toMatchObject({ section: 'achievements', achievementId: 'parks-64' })
    expect(parseHash('#/you/achievements').achievementId).toBeNull()
  })

  it('round-trips the addresses it makes', () => {
    expect(parseHash(pageHref('map')).page).toBe('map')
    expect(parseHash(tripHref('a b/c')).tripId).toBe('a b/c')
    expect(parseHash(youHref('people')).section).toBe('people')
    expect(youHref('profile')).toBe('#/you')
  })
})
