import { describe, expect, it } from 'vitest'
import { emptyData } from '../lib/travelActions.ts'
import { avatarPath, decodeBase64, encodeBase64, githubApi, type SyncTarget } from './github.ts'

const b64 = (text: string) => encodeBase64(new TextEncoder().encode(text))

const T: SyncTarget = { owner: 'me', repo: 'travel-data', path: 'travel.json', token: 'tkn' }

type Call = { url: string; init: RequestInit }
function fakeFetch(responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>) {
  const calls: Call[] = []
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const r = responses.shift()!
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: r.headers })
  }) as unknown as typeof fetch
  return { fn, calls }
}

describe('base64', () => {
  it('round-trips non-ASCII text', () => {
    const text = 'Haleakalā — Hawaiʻi Volcanoes “note” ✓'
    expect(decodeBase64(b64(text))).toBe(text)
    expect(decodeBase64(b64(text).replace(/(.{10})/g, '$1\n'))).toBe(text)
  })
})

describe('githubApi', () => {
  it('sends the token only to api.github.com, never caching', async () => {
    const { fn, calls } = fakeFetch([{ status: 200, body: { private: true } }])
    await githubApi(fn).checkRepo(T)
    expect(calls[0].url).toBe('https://api.github.com/repos/me/travel-data')
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer tkn')
    expect(calls[0].init.cache).toBe('no-store')
  })

  it('refuses a public repo', async () => {
    const { fn } = fakeFetch([{ status: 200, body: { private: false } }])
    await expect(githubApi(fn).checkRepo(T)).rejects.toMatchObject({ kind: 'public-repo' })
  })

  it('reads the file, and treats a missing file as empty', async () => {
    const data = emptyData('2026-10-16T00:00:00Z')
    const { fn } = fakeFetch([
      { status: 200, body: { sha: 'abc', encoding: 'base64', content: b64(JSON.stringify(data)) } },
      { status: 404, body: { message: 'Not Found' } },
    ])
    const api = githubApi(fn)
    expect(await api.getFile(T)).toEqual({ sha: 'abc', data })
    expect(await api.getFile(T)).toBeNull()
  })

  it('writes with the previous sha and returns the new one', async () => {
    const { fn, calls } = fakeFetch([{ status: 201, body: { content: { sha: 'new' } } }])
    const sha = await githubApi(fn).putFile(T, emptyData('x'), 'old', 'msg')
    expect(sha).toBe('new')
    const body = JSON.parse(calls[0].init.body as string)
    expect(body).toMatchObject({ message: 'msg', sha: 'old' })
    expect(JSON.parse(decodeBase64(body.content)).schemaVersion).toBe(1)
  })

  it('maps GitHub errors to plain reasons', async () => {
    const cases: Array<[number, string, Record<string, string>?]> = [
      [401, 'auth'],
      [403, 'auth'],
      [403, 'rate-limit', { 'x-ratelimit-remaining': '0' }],
      [409, 'conflict'],
      [422, 'conflict'],
      [500, 'other'],
    ]
    for (const [status, kind, headers] of cases) {
      const { fn } = fakeFetch([{ status, body: {}, headers }])
      await expect(githubApi(fn).putFile(T, emptyData('x'), 's', 'm')).rejects.toMatchObject({ kind })
    }
  })

  it('reports network failures as offline-style errors', async () => {
    const fn = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    await expect(githubApi(fn).getFile(T)).rejects.toMatchObject({ kind: 'network' })
  })

  it('rejects a file that is not a travel log', async () => {
    const { fn } = fakeFetch([{ status: 200, body: { sha: 'a', encoding: 'base64', content: b64('{"hello":1}') } }])
    await expect(githubApi(fn).getFile(T)).rejects.toMatchObject({ kind: 'bad-file' })
  })

  it('downloads a photo as raw bytes from api.github.com, and treats a missing one as null', async () => {
    const calls: Call[] = []
    const fn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return calls.length === 1 ? new Response('jpeg bytes', { status: 200 }) : new Response(null, { status: 404 })
    }) as unknown as typeof fetch
    const api = githubApi(fn)
    expect(await (await api.getBlob(T, avatarPath('mom')))!.text()).toBe('jpeg bytes')
    expect(calls[0].url).toBe('https://api.github.com/repos/me/travel-data/contents/avatars/mom.jpg')
    expect((calls[0].init.headers as Record<string, string>).Accept).toBe('application/vnd.github.raw+json')
    expect(await api.getBlob(T, avatarPath('dad'))).toBeNull()
  })

  it('uploads a photo, replacing the existing file by its sha', async () => {
    const { fn, calls } = fakeFetch([
      { status: 200, body: { sha: 'old-photo' } },
      { status: 200, body: { content: { sha: 'new-photo' } } },
    ])
    await githubApi(fn).putBlob(T, avatarPath('mom'), new Blob(['jpeg']), 'msg')
    const body = JSON.parse(calls[1].init.body as string)
    expect(calls[1].init.method).toBe('PUT')
    expect(body).toMatchObject({ message: 'msg', sha: 'old-photo' })
    expect(decodeBase64(body.content)).toBe('jpeg')
  })
})
