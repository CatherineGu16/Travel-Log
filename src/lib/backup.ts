import type { AvatarRecord } from '../store/avatarStore.ts'
import { todayIso } from './partialDate.ts'
import { parseTravelData } from './travelData.ts'
import type { TravelData } from './types.ts'
import { createZip, readZip } from './zip.ts'

export interface Backup {
  data: TravelData
  avatars: AvatarRecord[]
}

/** A .zip with travel.json and every photo avatar, the same layout as the private repo. */
export async function backupZip({ data, avatars }: Backup): Promise<Blob> {
  const current = avatars.filter((a) =>
    data.people.some((p) => p.id === a.personId && !p.deleted && p.avatar.kind === 'photo' && p.avatar.photoUpdatedAt === a.photoUpdatedAt),
  )
  const zip = createZip([
    { name: 'travel.json', bytes: new TextEncoder().encode(JSON.stringify(data, null, 2) + '\n') },
    ...(await Promise.all(current.map(async (a) => ({ name: `avatars/${a.personId}.jpg`, bytes: new Uint8Array(await a.blob.arrayBuffer()) })))),
  ])
  return new Blob([zip], { type: 'application/zip' })
}

export const backupFileName = (now = new Date()) => `travel-log-${todayIso(now)}.zip`

/** Reads a backup: a .zip from Export, or a bare travel.json (e.g. downloaded from GitHub). */
export async function readBackup(file: File): Promise<Backup> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b
  let json: string
  let photos: { personId: string; bytes: Uint8Array<ArrayBuffer> }[] = []
  if (isZip) {
    let entries
    try {
      entries = readZip(bytes)
    } catch (e) {
      throw new Error(`"${file.name}" couldn't be opened: ${(e as Error).message}.`)
    }
    const travel = entries.find((e) => e.name === 'travel.json')
    if (!travel) throw new Error(`"${file.name}" has no travel.json inside.`)
    json = new TextDecoder().decode(travel.bytes)
    photos = entries.flatMap((e) => {
      const m = e.name.match(/^avatars\/(.+)\.jpg$/)
      return m ? [{ personId: m[1], bytes: e.bytes }] : []
    })
  } else json = new TextDecoder().decode(bytes)

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error(`"${file.name}" isn't a Travel Log backup.`)
  }
  const data = parseTravelData(parsed)
  const avatars = photos.flatMap(({ personId, bytes: b }) => {
    const person = data.people.find((p) => p.id === personId)
    const stamp = person?.avatar.kind === 'photo' ? person.avatar.photoUpdatedAt : null
    return stamp ? [{ personId, photoUpdatedAt: stamp, blob: new Blob([b], { type: 'image/jpeg' }), pending: true }] : []
  })
  return { data, avatars }
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
