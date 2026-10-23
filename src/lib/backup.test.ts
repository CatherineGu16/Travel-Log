import { describe, expect, it } from 'vitest'
import { backupZip, readBackup } from './backup.ts'
import { addPerson, emptyData, saveTrip } from './travelActions.ts'
import { sameContent } from './travelData.ts'
import { createZip, crc32, readZip } from './zip.ts'

describe('zip', () => {
  it('round-trips files, with standard CRCs', () => {
    expect(crc32(new TextEncoder().encode('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339)
    const files = [
      { name: 'travel.json', bytes: new TextEncoder().encode('{"a":1}') },
      { name: 'avatars/mom.jpg', bytes: new Uint8Array([255, 216, 255, 0, 1, 2]) },
    ]
    expect(readZip(createZip(files))).toEqual(files)
  })

  it('rejects things that are not zips', () => {
    expect(() => readZip(new Uint8Array([1, 2, 3]))).toThrow(/not a zip/)
  })
})

describe('backup', () => {
  it('exports travel.json and current photo avatars, and imports them back', async () => {
    const ctx = { now: '2026-10-23T00:00:00.000Z', newId: () => 'trip-1' }
    let data = addPerson(emptyData('t'), ctx, 'mom', {
      name: 'Mom',
      groupIds: [],
      avatar: { kind: 'photo', color: '#000', emoji: null, photoUpdatedAt: 'p1' },
    })
    data = saveTrip(data, ctx, {
      title: 'Moab',
      startDate: '2024',
      endDate: null,
      approximate: false,
      main: { place: { name: 'Moab', lat: 38.57, lng: -109.55 } },
      stops: [],
      companions: ['mom'],
      isFamily: true,
      description: '',
      highlights: '',
      rating: null,
      tags: [],
    })
    const avatars = [
      { personId: 'mom', photoUpdatedAt: 'p1', blob: new Blob(['photo']), pending: false },
      { personId: 'gone', photoUpdatedAt: 'x', blob: new Blob(['stale']), pending: false },
    ]
    const zip = await backupZip({ data, avatars })
    const back = await readBackup(new File([zip], 'travel-log.zip'))
    expect(sameContent(back.data, data)).toBe(true)
    expect(back.avatars.map((a) => [a.personId, a.photoUpdatedAt])).toEqual([['mom', 'p1']])
    expect(await back.avatars[0].blob.text()).toBe('photo')

    const json = await readBackup(new File([JSON.stringify(data)], 'travel.json'))
    expect(sameContent(json.data, data)).toBe(true)
    await expect(readBackup(new File(['hello'], 'notes.txt'))).rejects.toThrow(/isn't a Travel Log backup/)
  })
})
