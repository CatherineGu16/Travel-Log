import { describe, expect, it } from 'vitest'
import { pageHref, parseHash, tripHref, youHref } from './route.ts'

describe('parseHash', () => {
  it('reads the page, falling back to the map', () => {
    expect(parseHash('').page).toBe('map')
    expect(parseHash('#/').page).toBe('map')
    expect(parseHash('#/parks').page).toBe('parks')
    expect(parseHash('#/places').page).toBe('map')
    expect(parseHash('#/trips/?x=1').page).toBe('trips')
  })

  it('reads the trip open on Trips', () => {
    expect(parseHash('#/trips')).toEqual({ page: 'trips', tripId: null, section: 'profile' })
    expect(parseHash('#/trips/abc-123')).toMatchObject({ page: 'trips', tripId: 'abc-123' })
    expect(parseHash('#/parks/abc').tripId).toBeNull()
  })

  it('reads the section of You, the profile when unknown', () => {
    expect(parseHash('#/you').section).toBe('profile')
    expect(parseHash('#/you/settings')).toEqual({ page: 'you', tripId: null, section: 'settings' })
    expect(parseHash('#/you/achievements/').section).toBe('achievements')
    expect(parseHash('#/you/nope').section).toBe('profile')
  })

  it('round-trips the addresses it makes', () => {
    expect(parseHash(pageHref('map')).page).toBe('map')
    expect(parseHash(tripHref('a b/c')).tripId).toBe('a b/c')
    expect(parseHash(youHref('people')).section).toBe('people')
    expect(youHref('profile')).toBe('#/you')
  })
})
