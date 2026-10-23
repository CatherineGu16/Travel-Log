import { useRef, useState } from 'react'
import { backupFileName, backupZip, download, readBackup, type Backup } from '../lib/backup.ts'
import { live } from '../lib/travelActions.ts'
import { useAvatars, useStore, useTravelState } from '../store/useTravel.ts'

/** Export everything (trips, people, photo avatars) as a .zip, or load one onto this device. */
export function BackupPanel() {
  const store = useStore()
  const avatars = useAvatars()
  const { data } = useTravelState()
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ name: string; backup: Backup } | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const exportNow = async () => {
    setMessage(null)
    download(await backupZip({ data, avatars: await avatars.all() }), backupFileName())
  }

  async function pick(file: File | undefined) {
    if (!file) return
    setMessage(null)
    try {
      setPending({ name: file.name, backup: await readBackup(file) })
    } catch (e) {
      setMessage({ tone: 'error', text: (e as Error).message })
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  async function confirm(mode: 'merge' | 'replace') {
    if (!pending) return
    // Photos first, so the records that point to them always have them.
    for (const avatar of pending.backup.avatars) await avatars.put(avatar)
    store.importData(pending.backup.data, mode)
    setMessage({ tone: 'ok', text: `Imported ${live(pending.backup.data.trips).length} trips from ${pending.name}.` })
    setPending(null)
  }

  const button = 'min-h-11 rounded-lg px-4 text-sm font-bold'
  return (
    <section className="rounded-xl border border-line p-4">
      <h2 className="font-display text-xl font-semibold">Backup</h2>
      <p className="mt-1 text-sm text-muted">Save a copy of your trips, people and photos as a .zip, or load one onto this device.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={`${button} bg-raised hover:bg-line`} onClick={() => void exportNow()}>
          Export
        </button>
        <button className={`${button} bg-raised hover:bg-line`} onClick={() => input.current?.click()}>
          Import…
        </button>
        <input
          ref={input}
          type="file"
          aria-label="Backup file"
          accept=".zip,application/zip,.json,application/json"
          className="hidden"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
      </div>

      {pending && (
        <div className="mt-4 rounded-lg border border-line bg-bg/40 p-3 text-sm" role="group" aria-label="Confirm import">
          <p>
            <span className="font-bold">{pending.name}</span> has {live(pending.backup.data.trips).length} trips and {live(pending.backup.data.people).length}{' '}
            people. This device has {live(data.trips).length} trips.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={`${button} bg-primary text-on-primary`} onClick={() => void confirm('merge')}>
              Merge (keep both)
            </button>
            <button className={`${button} bg-raised hover:bg-line`} onClick={() => void confirm('replace')}>
              Replace this device's data
            </button>
            <button className={`${button} text-muted hover:text-fg`} onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`mt-3 text-sm ${message.tone === 'error' ? 'text-danger' : 'text-ok'}`} role="status">
          {message.text}
        </p>
      )}
    </section>
  )
}
