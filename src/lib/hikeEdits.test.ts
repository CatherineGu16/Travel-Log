import { describe, expect, it } from 'vitest'
import type { NpsHike } from './gazetteer.ts'
import { parsePublicHikeEdits, shownHikes, withHikeEdits, type PublicHikeEdit } from './hikeEdits.ts'
import type { HikeEdit } from './types.ts'

const nps: NpsHike = { id: 'skyline-trail', name: 'Skyline Trail', npsUrl: null, difficulty: null, distanceMi: 5, distanceSource: 'nps', duration: '4 hours' }
const fix = (over: Partial<HikeEdit> = {}): HikeEdit => ({
  id: 'mount-rainier|skyline-trail',
  parkId: 'mount-rainier',
  hikeId: 'skyline-trail',
  name: 'Skyline Loop',
  distanceMi: 5.5,
  distanceKind: 'loop',
  duration: '4–5 hours',
  difficulty: 'Strenuous',
  hidden: false,
  createdAt: 't1',
  updatedAt: '2026-10-25T10:00:00.000Z',
  ...over,
})
const pub = (over: Partial<PublicHikeEdit> = {}): PublicHikeEdit => ({
  name: 'Skyline (published)',
  distanceMi: 5.4,
  distanceKind: null,
  duration: null,
  difficulty: 'Moderate',
  hidden: false,
  editedAt: '2026-10-24T10:00:00.000Z',
  ...over,
})

describe('hike corrections', () => {
  it('shows NPS values when nothing is corrected', () => {
    expect(shownHikes([nps], undefined, [])[0]).toMatchObject({ name: 'Skyline Trail', distanceMi: 5, hidden: false, original: null })
  })

  it('shows the newest correction: yours at once, or the published one', () => {
    expect(shownHikes([nps], { 'skyline-trail': pub() }, [])[0]).toMatchObject({ name: 'Skyline (published)', distanceMi: 5.4, original: nps })
    expect(shownHikes([nps], { 'skyline-trail': pub() }, [fix()])[0]).toMatchObject({ name: 'Skyline Loop', distanceMi: 5.5, difficulty: 'Strenuous' })
    // A reset newer than the published correction goes back to NPS before the next deploy.
    expect(shownHikes([nps], { 'skyline-trail': pub() }, [fix({ deleted: true })])[0]).toMatchObject({ name: 'Skyline Trail', original: null })
    expect(shownHikes([nps], undefined, [fix({ hidden: true })])[0].hidden).toBe(true)
  })

  it('writes corrections to the public file and removes reset ones', () => {
    const written = withHikeEdits({}, [fix()])
    expect(written).toEqual({
      'mount-rainier': { 'skyline-trail': { name: 'Skyline Loop', distanceMi: 5.5, distanceKind: 'loop', duration: '4–5 hours', difficulty: 'Strenuous', hidden: false, editedAt: '2026-10-25T10:00:00.000Z' } },
    })
    expect(withHikeEdits(written, [fix({ deleted: true, updatedAt: '2026-10-26T00:00:00.000Z' })])).toEqual({})
    // An older copy doesn't overwrite a newer published correction.
    expect(withHikeEdits({ 'mount-rainier': { 'skyline-trail': pub({ editedAt: '2027-01-01' }) } }, [fix()])['mount-rainier']['skyline-trail'].name).toBe('Skyline (published)')
    expect(parsePublicHikeEdits(JSON.parse(JSON.stringify(written)))).toEqual(written)
  })
})
