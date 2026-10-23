import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { saveTrip } from '../lib/travelActions.ts'
import { indexedDbBackend, memoryBackend } from './storage.ts'
import { createTravelStore } from './travelStore.ts'

const input = {
  title: 'Moab',
  startDate: '2024',
  endDate: null,
  approximate: false,
  main: { place: { name: 'Moab', lat: 38.57, lng: -109.55, regionCode: 'US-UT' } },
  stops: [],
  companions: [],
  isFamily: false,
  description: '',
  highlights: '',
  rating: null,
  tags: [],
}

describe('travelStore', () => {
  it('saves to IndexedDB, and the data is there after a reload', async () => {
    const store = createTravelStore(indexedDbBackend())
    await store.init()
    store.apply((d, c) => saveTrip(d, c, input), 'Added Moab')
    await store.flush()

    const reopened = createTravelStore(indexedDbBackend())
    await reopened.init()
    expect(reopened.getState().data.trips.map((t) => t.title)).toEqual(['Moab'])
  })

  it('undoes the latest edit, but not by a stale id', async () => {
    const store = createTravelStore(memoryBackend())
    await store.init()
    const first = store.apply((d, c) => saveTrip(d, c, input), 'Added Moab')!
    store.apply((d, c) => saveTrip(d, c, { ...input, title: 'Moab 2' }), 'Added Moab 2')
    expect(store.undo(first)).toBe(false)
    expect(store.undo()).toBe(true)
    expect(store.getState().data.trips.filter((t) => !t.deleted).map((t) => t.title)).toEqual(['Moab'])
  })

  it('refuses a failing edit and reports why', async () => {
    const store = createTravelStore(memoryBackend())
    await store.init()
    expect(store.apply(() => { throw new Error('nope') }, 'Broken')).toBeNull()
    expect(store.getState().error).toBe('nope')
  })
})
