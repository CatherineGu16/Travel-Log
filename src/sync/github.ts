import { parseTravelData } from '../lib/travelData.ts'
import type { TravelData } from '../lib/types.ts'

/** Where your data lives: travel.json in a private GitHub repo, reached with a fine-grained token. */
export interface SyncTarget {
  owner: string
  repo: string
  path: string
  token: string
}

export type SyncErrorKind = 'auth' | 'not-found' | 'public-repo' | 'conflict' | 'rate-limit' | 'network' | 'bad-file' | 'other'

export class SyncError extends Error {
  readonly kind: SyncErrorKind
  constructor(kind: SyncErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

export interface RemoteFile {
  data: TravelData
  sha: string
}

/** The calls the sync engine needs, so tests can swap in a fake GitHub. */
export interface RemoteApi {
  checkRepo(t: SyncTarget): Promise<void>
  getFile(t: SyncTarget): Promise<RemoteFile | null>
  /** Returns the new sha. sha = null creates the file. */
  putFile(t: SyncTarget, data: TravelData, sha: string | null, message: string): Promise<string>
  /** A binary file (an avatar photo) at `path` in the same repo, or null if it isn't there. */
  getBlob(t: SyncTarget, path: string): Promise<Blob | null>
  /** Writes a binary file, replacing any file already at `path`. */
  putBlob(t: SyncTarget, path: string, blob: Blob, message: string): Promise<void>
  /** A JSON file at `path` (in any repo the key can reach), or null if it isn't there. */
  getJson(t: SyncTarget, path: string): Promise<{ value: unknown; sha: string } | null>
  /** Writes a JSON file. sha = null creates it; a stale sha fails with a 'conflict' error. */
  putJson(t: SyncTarget, path: string, value: unknown, sha: string | null, message: string): Promise<void>
}

const API = 'https://api.github.com'

export function githubApi(fetchFn: typeof fetch = (...a) => fetch(...a)): RemoteApi {
  const call = async (t: SyncTarget, url: string, init: RequestInit = {}, accept = 'application/vnd.github+json') => {
    let res: Response
    try {
      res = await fetchFn(url, {
        ...init,
        cache: 'no-store',
        headers: {
          Accept: accept,
          Authorization: `Bearer ${t.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      })
    } catch {
      throw new SyncError('network', "Can't reach GitHub. Check your connection.")
    }
    return res
  }

  const fail = async (res: Response, what: string): Promise<never> => {
    if (res.status === 401) throw new SyncError('auth', 'GitHub rejected the access key. It may have expired or been revoked.')
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0')
      throw new SyncError('rate-limit', 'GitHub rate limit reached. Sync will retry later.')
    if (res.status === 403) throw new SyncError('auth', `The access key isn't allowed to ${what}. It needs Contents: Read and write on this repo.`)
    if (res.status === 404) throw new SyncError('not-found', "Repo not found, or the access key can't see it.")
    if (res.status === 409 || res.status === 422) throw new SyncError('conflict', 'Another device saved first.')
    throw new SyncError('other', `GitHub returned ${res.status} while trying to ${what}.`)
  }

  const contentsUrl = (t: SyncTarget, path = t.path) =>
    `${API}/repos/${encodeURIComponent(t.owner)}/${encodeURIComponent(t.repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`

  /** The current version (sha) of a file, needed to replace it; null if it doesn't exist yet. */
  const shaOf = async (t: SyncTarget, path: string): Promise<string | null> => {
    const res = await call(t, contentsUrl(t, path))
    if (res.status === 404) return null
    if (!res.ok) await fail(res, 'read a photo')
    return ((await res.json()) as { sha: string }).sha
  }

  return {
    async checkRepo(t) {
      const res = await call(t, `${API}/repos/${encodeURIComponent(t.owner)}/${encodeURIComponent(t.repo)}`)
      if (!res.ok) await fail(res, 'read the repo')
      const repo = (await res.json()) as { private?: boolean }
      if (repo.private !== true)
        throw new SyncError('public-repo', `${t.owner}/${t.repo} is public. Make it private on GitHub before syncing your travels.`)
    },

    async getFile(t) {
      const res = await call(t, contentsUrl(t))
      if (res.status === 404) return null
      if (!res.ok) await fail(res, 'read your travel log')
      const body = (await res.json()) as { sha: string; content?: string; encoding?: string }
      if (body.encoding !== 'base64' || body.content === undefined) throw new SyncError('bad-file', `${t.path} is too large or not a file.`)
      try {
        return { sha: body.sha, data: parseTravelData(JSON.parse(decodeBase64(body.content))) }
      } catch (e) {
        throw new SyncError('bad-file', `${t.path} in ${t.repo} isn't a Travel Log file: ${(e as Error).message}`)
      }
    },

    async putFile(t, data, sha, message) {
      const res = await call(t, contentsUrl(t), {
        method: 'PUT',
        body: JSON.stringify({ message, content: encodeBase64(new TextEncoder().encode(JSON.stringify(data, null, 2) + '\n')), ...(sha ? { sha } : {}) }),
      })
      if (!res.ok) await fail(res, 'save your travel log')
      const body = (await res.json()) as { content: { sha: string } }
      return body.content.sha
    },

    async getBlob(t, path) {
      // The raw media type returns the file's bytes directly from api.github.com.
      const res = await call(t, contentsUrl(t, path), {}, 'application/vnd.github.raw+json')
      if (res.status === 404) return null
      if (!res.ok) await fail(res, 'download a photo')
      return await res.blob()
    },

    async getJson(t, path) {
      const res = await call(t, contentsUrl(t, path))
      if (res.status === 404) return null
      if (!res.ok) await fail(res, `read ${path}`)
      const body = (await res.json()) as { sha: string; content?: string; encoding?: string }
      if (body.encoding !== 'base64' || body.content === undefined) throw new SyncError('bad-file', `${path} is too large or not a file.`)
      try {
        return { sha: body.sha, value: JSON.parse(decodeBase64(body.content)) as unknown }
      } catch {
        throw new SyncError('bad-file', `${path} in ${t.repo} isn't valid JSON.`)
      }
    },

    async putJson(t, path, value, sha, message) {
      const content = encodeBase64(new TextEncoder().encode(JSON.stringify(value, null, 1) + '\n'))
      const res = await call(t, contentsUrl(t, path), { method: 'PUT', body: JSON.stringify({ message, content, ...(sha ? { sha } : {}) }) })
      if (!res.ok) await fail(res, `save ${path}`)
    },

    async putBlob(t, path, blob, message) {
      const content = encodeBase64(new Uint8Array(await blob.arrayBuffer()))
      for (let attempt = 0; ; attempt++) {
        const sha = await shaOf(t, path)
        const res = await call(t, contentsUrl(t, path), { method: 'PUT', body: JSON.stringify({ message, content, ...(sha ? { sha } : {}) }) })
        if (res.ok) return
        if ((res.status === 409 || res.status === 422) && attempt < 2) continue
        await fail(res, 'upload a photo')
      }
    },
  }
}

/** Base64 of bytes, chunked so large files don't overflow the argument limit. */
export function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

export function decodeBase64(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
}

/** Where a person's photo avatar lives in the private repo. */
export const avatarPath = (personId: string) => `avatars/${personId}.jpg`
