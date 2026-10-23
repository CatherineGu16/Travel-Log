import { describe, expect, it } from 'vitest'
import { addPerson, deleteTrip, saveTrip, type TripInput } from '../lib/travelActions.ts'
import type { EditContext, TravelData } from '../lib/types.ts'
import { memoryAvatars } from '../store/avatarStore.ts'
import { memoryBackend } from '../store/storage.ts'
import { createTravelStore } from '../store/travelStore.ts'
import { SyncError, type RemoteApi, type SyncTarget } from './github.ts'
import { createSyncEngine, type MetaStore, type SyncConfig, type SyncMeta } from './syncEngine.ts'
import { tripInput } from '../test/tripInput.ts'

/** In-memory GitHub: travel.json with a version sha that changes on every write, plus binary files. */
function fakeGitHub(opts: { isPrivate?: boolean } = {}) {
  let file: { data: TravelData; sha: string } | null = null
  const blobs = new Map<string, Blob>()
  let version = 0
  const calls: string[] = []
  /** Runs once, right before the next PUT lands, to simulate another device saving first. */
  let beforeNextPut: (() => void) | null = null
  const api: RemoteApi = {
    async checkRepo(t: SyncTarget) {
      calls.push('check')
      if (t.token !== 'good') throw new SyncError('auth', 'bad key')
      if (opts.isPrivate === false) throw new SyncError('public-repo', 'public')
    },
    async getFile() {
      calls.push('get')
      return file && { data: structuredClone(file.data), sha: file.sha }
    },
    async putFile(_t, data, sha) {
      calls.push('put')
      if (beforeNextPut) {
        const f = beforeNextPut
        beforeNextPut = null
        f()
      }
      if ((file?.sha ?? null) !== sha) throw new SyncError('conflict', 'stale sha')
      file = { data: structuredClone(data), sha: `v${++version}` }
      return file.sha
    },
    async getBlob(_t, path) {
      calls.push(`get ${path}`)
      return blobs.get(path) ?? null
    },
    async putBlob(_t, path, blob) {
      calls.push(`put ${path}`)
      blobs.set(path, blob)
    },
  }
  return {
    api,
    calls,
    blobs,
    get file() {
      return file
    },
    setFile(data: TravelData) {
      file = { data: structuredClone(data), sha: `v${++version}` }
    },
    racePut(f: () => void) {
      beforeNextPut = f
    },
  }
}

function memoryMeta(): MetaStore & { meta: SyncMeta | null } {
  return {
    meta: null,
    load() {
      return this.meta ?? { config: null, sha: null, dirty: false, lastSyncedAt: null }
    },
    save(m) {
      this.meta = structuredClone(m)
    },
  }
}

const CONFIG: SyncConfig = { owner: 'me', repo: 'travel-data', path: 'travel.json', token: 'good', deviceName: 'test' }

let ids = 0
async function device(gh: ReturnType<typeof fakeGitHub>, name: string, nowIso = '2026-10-23T12:00:00Z') {
  const store = createTravelStore(memoryBackend(), () => new Date(nowIso), () => `${name}-${++ids}`)
  await store.init()
  const avatars = memoryAvatars()
  const engine = createSyncEngine(store, gh.api, memoryMeta(), avatars, { debounceMs: 0, isOnline: () => true })
  return { store, engine, avatars }
}

const trip = (title: string): TripInput => tripInput({ title, main: { name: title, lat: 38 + title.length / 10, lng: -100 - title.length, regionCode: 'US-UT' } })
const addTrip = (title: string) => (d: TravelData, c: EditContext) => saveTrip(d, c, trip(title))
const titles = (d: TravelData) =>
  d.trips
    .filter((t) => !t.deleted)
    .map((t) => t.title)
    .sort()

describe('sync engine', () => {
  it('creates travel.json on first connect and reports synced', async () => {
    const gh = fakeGitHub()
    const phone = await device(gh, 'phone')
    phone.store.apply(addTrip('Moab'), 'x')
    await phone.engine.connect(CONFIG)
    expect(titles(gh.file!.data)).toEqual(['Moab'])
    expect(phone.engine.getState()).toMatchObject({ status: 'synced', error: null })
  })

  it('carries trips between devices in both directions', async () => {
    const gh = fakeGitHub()
    const phone = await device(gh, 'phone')
    const pc = await device(gh, 'pc')
    phone.store.apply(addTrip('Moab'), 'x')
    await phone.engine.connect(CONFIG)
    await pc.engine.connect(CONFIG)
    expect(titles(pc.store.getState().data)).toEqual(['Moab'])

    pc.store.apply(addTrip('Chicago'), 'x')
    await pc.engine.syncNow()
    await phone.engine.syncNow()
    expect(titles(phone.store.getState().data)).toEqual(['Chicago', 'Moab'])
  })

  it('merges offline edits from two devices instead of overwriting', async () => {
    const gh = fakeGitHub()
    const phone = await device(gh, 'phone')
    const pc = await device(gh, 'pc')
    await phone.engine.connect(CONFIG)
    await pc.engine.connect(CONFIG)
    phone.store.apply(addTrip('Zion'), 'x')
    pc.store.apply(addTrip('Acadia'), 'x')
    await phone.engine.syncNow()
    await pc.engine.syncNow()
    await phone.engine.syncNow()
    expect(titles(gh.file!.data)).toEqual(['Acadia', 'Zion'])
    expect(titles(phone.store.getState().data)).toEqual(['Acadia', 'Zion'])
  })

  it('retries when another device saves between read and write', async () => {
    const gh = fakeGitHub()
    const phone = await device(gh, 'phone')
    await phone.engine.connect(CONFIG)
    const other = saveTrip(structuredClone(gh.file!.data), { now: '2026-10-23T12:00:00Z', newId: () => 'pc-1' }, trip('Denver'))
    phone.store.apply(addTrip('Moab'), 'x')
    gh.racePut(() => gh.setFile(other))
    await phone.engine.syncNow()
    expect(titles(gh.file!.data)).toEqual(['Denver', 'Moab'])
    expect(phone.engine.getState().status).toBe('synced')
  })

  it('sends deletes made after a sync', async () => {
    const gh = fakeGitHub()
    const phone = await device(gh, 'phone', '2026-10-23T12:00:00Z')
    phone.store.apply(addTrip('Moab'), 'x')
    await phone.engine.connect(CONFIG)
    const id = phone.store.getState().data.trips[0].id
    phone.store.apply((d) => deleteTrip(d, { now: '2026-10-23T13:00:00Z', newId: () => 'n' }, id), 'x')
    await phone.engine.syncNow()
    expect(gh.file!.data.trips.find((t) => t.id === id)?.deleted).toBe(true)
  })

  it('uploads a photo avatar before the travel.json that points to it, and other devices download it', async () => {
    const gh = fakeGitHub()
    const phone = await device(gh, 'phone')
    const pc = await device(gh, 'pc')
    await phone.engine.connect(CONFIG)
    await pc.engine.connect(CONFIG)

    const photoAt = '2026-10-23T12:30:00.000Z'
    const blob = new Blob(['jpeg bytes'], { type: 'image/jpeg' })
    await phone.avatars.put({ personId: 'mom', photoUpdatedAt: photoAt, blob, pending: true })
    phone.store.apply(
      (d, c) => addPerson(d, c, 'mom', { name: 'Mom', groupIds: [], avatar: { kind: 'photo', color: '#000', emoji: null, photoUpdatedAt: photoAt } }),
      'x',
    )
    gh.calls.length = 0
    await phone.engine.syncNow()
    expect(gh.calls).toEqual(['get', 'put avatars/mom.jpg', 'put'])
    expect((await phone.avatars.pending()).length).toBe(0)

    await pc.engine.syncNow()
    expect(pc.store.getState().data.people[0].avatar.photoUpdatedAt).toBe(photoAt)
    expect(await pc.engine.downloadAvatar('mom', photoAt)).toBe(true)
    expect(await (await pc.avatars.get('mom'))!.blob.text()).toBe('jpeg bytes')
  })

  it("doesn't upload a photo that was replaced before it synced", async () => {
    const gh = fakeGitHub()
    const phone = await device(gh, 'phone')
    await phone.engine.connect(CONFIG)
    await phone.avatars.put({ personId: 'mom', photoUpdatedAt: 'old', blob: new Blob(['old']), pending: true })
    phone.store.apply((d, c) => addPerson(d, c, 'mom', { name: 'Mom', groupIds: [] }), 'x')
    await phone.engine.syncNow()
    expect(gh.blobs.size).toBe(0)
  })

  it('does nothing when there is nothing new', async () => {
    const gh = fakeGitHub()
    const phone = await device(gh, 'phone')
    await phone.engine.connect(CONFIG)
    gh.calls.length = 0
    await phone.engine.syncNow()
    expect(gh.calls).toEqual(['get'])
  })

  it('refuses public repos and bad keys without saving the config', async () => {
    const pub = fakeGitHub({ isPrivate: false })
    const a = await device(pub, 'a')
    await expect(a.engine.connect(CONFIG)).rejects.toMatchObject({ kind: 'public-repo' })
    expect(a.engine.getState()).toMatchObject({ status: 'off', config: null, errorKind: 'public-repo' })

    const gh = fakeGitHub()
    const b = await device(gh, 'b')
    await expect(b.engine.connect({ ...CONFIG, token: 'nope' })).rejects.toMatchObject({ kind: 'auth' })
    expect(gh.calls).toEqual(['check'])
  })

  it('reports offline without calling GitHub, then catches up', async () => {
    const gh = fakeGitHub()
    let online = true
    const store = createTravelStore(memoryBackend())
    await store.init()
    const engine = createSyncEngine(store, gh.api, memoryMeta(), memoryAvatars(), { debounceMs: 0, isOnline: () => online })
    await engine.connect(CONFIG)
    online = false
    store.apply(addTrip('Moab'), 'x')
    await engine.syncNow()
    expect(engine.getState().status).toBe('offline')
    online = true
    await engine.syncNow()
    expect(titles(gh.file!.data)).toEqual(['Moab'])
    expect(engine.getState().status).toBe('synced')
  })

  it('keeps the access key out of the reported state', async () => {
    const gh = fakeGitHub()
    const phone = await device(gh, 'phone')
    await phone.engine.connect(CONFIG)
    expect(JSON.stringify(phone.engine.getState())).not.toContain('good')
  })
})
