import { useState, type FormEvent } from 'react'
import { useSync, useSyncState } from '../store/useTravel.ts'
import { guessDeviceName } from '../sync/deviceName.ts'
import { timeAgo } from '../ui/format.ts'

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'
const NEW_REPO_URL = 'https://github.com/new'

export function SyncPanel() {
  const sync = useSync()
  const state = useSyncState()
  const [busy, setBusy] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  // Read once when Settings opens; a sync finishing later still reads as "just now".
  const [openedAt] = useState(() => new Date())
  const [form, setForm] = useState({ owner: '', repo: 'travel-data', token: '', deviceName: guessDeviceName() })

  async function connect(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await sync.connect({ ...form, owner: form.owner.trim(), repo: form.repo.trim(), token: form.token.trim(), path: 'travel.json' })
      setForm((f) => ({ ...f, token: '' }))
    } catch {
      // Shown from sync state.
    } finally {
      setBusy(false)
    }
  }

  const input = 'mt-1.5 h-11 w-full rounded-lg border border-line bg-bg px-3 text-base'
  const error = state.error && (
    <p role="alert" className="mt-3 rounded-lg bg-danger/15 p-3 text-sm text-danger">
      {state.error}
    </p>
  )

  if (state.config) {
    return (
      <section className="rounded-xl border border-line p-4">
        <h2 className="font-display text-xl font-semibold">Sync</h2>
        <p className="mt-1 text-sm">
          Syncing with <span className="font-bold">{state.config.owner}/{state.config.repo}</span> as {state.config.deviceName}.
        </p>
        <p className="mt-1 text-sm text-muted">Hikes you type in are also added (name and park only) to the suggestions in {__PUBLIC_REPO__}.</p>
        <p className="mt-1 text-sm text-muted" aria-live="polite">
          {state.status === 'syncing'
            ? 'Syncing…'
            : state.status === 'offline'
              ? 'Offline. Changes will sync when you reconnect.'
              : state.status === 'pending'
                ? 'Changes waiting to sync.'
                : state.uploading > 0
                  ? `Uploading ${state.uploading} ${state.uploading === 1 ? 'photo' : 'photos'}…`
                  : state.lastSyncedAt
                  ? `Last synced ${timeAgo(state.lastSyncedAt, openedAt)}.`
                  : 'Not synced yet.'}
        </p>
        {error}
        {state.shareError && (
          <p role="alert" className="mt-3 rounded-lg bg-raised p-3 text-sm">
            {state.shareError} Your travels still synced. To share hikes you add, give the access key Contents: Read and write on{' '}
            {__PUBLIC_REPO__} too.
          </p>
        )}
        {state.errorKind === 'auth' && (
          <p className="mt-2 text-sm">
            Create a new access key on GitHub, then disconnect and connect again with it.{' '}
            <a className="font-bold underline" href={TOKEN_URL} target="_blank" rel="noreferrer">
              Create a key
            </a>
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => void sync.syncNow()}
            disabled={state.status === 'syncing'}
            className="min-h-11 rounded-lg bg-raised px-4 text-sm font-bold hover:bg-line disabled:opacity-50"
          >
            Sync now
          </button>
          {confirmDisconnect ? (
            <>
              <button
                onClick={() => {
                  sync.disconnect()
                  setConfirmDisconnect(false)
                }}
                className="min-h-11 rounded-lg px-4 text-sm font-bold text-danger hover:bg-raised"
              >
                Disconnect this device
              </button>
              <button onClick={() => setConfirmDisconnect(false)} className="min-h-11 rounded-lg px-4 text-sm font-bold text-muted hover:text-fg">
                Keep syncing
              </button>
            </>
          ) : (
            <button onClick={() => setConfirmDisconnect(true)} className="min-h-11 rounded-lg px-4 text-sm font-bold text-muted hover:bg-raised hover:text-fg">
              Disconnect…
            </button>
          )}
        </div>
        {confirmDisconnect && (
          <p className="mt-2 text-sm text-muted">This device forgets the access key. Your trips stay here and on GitHub.</p>
        )}
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-line p-4">
      <h2 className="font-display text-xl font-semibold">Sync across devices</h2>
      <p className="mt-1 text-sm text-muted">
        Keeps your trips the same on your phone, tablet and computer by saving them to a private GitHub repo that only you can see.
      </p>
      <details className="mt-3 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-bold">First time? Set up GitHub (about 5 minutes)</summary>
        <ol className="mt-1 list-decimal space-y-2 pl-5">
          <li>
            <a className="font-bold underline" href={NEW_REPO_URL} target="_blank" rel="noreferrer">
              Create a new repo
            </a>{' '}
            named <code className="rounded bg-raised px-1">travel-data</code>. Choose <span className="font-bold">Private</span>. Leave everything
            else empty.
          </li>
          <li>
            <a className="font-bold underline" href={TOKEN_URL} target="_blank" rel="noreferrer">
              Create a fine-grained access key
            </a>
            . Under Repository access pick <span className="font-bold">Only select repositories</span> and choose travel-data and{' '}
            {__PUBLIC_REPO__.split('/')[1]} (so hikes you add are shared as suggestions). Under
            Permissions, set <span className="font-bold">Contents</span> to <span className="font-bold">Read and write</span>. Pick an expiration
            date, then copy the key.
          </li>
          <li>Paste it below. Do this once on each device. On iPhone and iPad, do it inside the installed app, not in Safari.</li>
        </ol>
      </details>
      <form onSubmit={(e) => void connect(e)} className="mt-3 space-y-3">
        <label className="block text-sm">
          <span className="font-bold">GitHub username</span>
          <input
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={form.owner}
            onChange={(e) => setForm({ ...form, owner: e.target.value })}
            className={input}
          />
        </label>
        <label className="block text-sm">
          <span className="font-bold">Private repo</span>
          <input
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={form.repo}
            onChange={(e) => setForm({ ...form, repo: e.target.value })}
            className={input}
          />
        </label>
        <label className="block text-sm">
          <span className="font-bold">Access key</span>
          <input
            required
            type="password"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={form.token}
            onChange={(e) => setForm({ ...form, token: e.target.value })}
            placeholder="github_pat_…"
            className={`${input} placeholder:text-muted`}
          />
          <span className="mt-1 block text-muted">Stays on this device and is only sent to GitHub.</span>
        </label>
        <label className="block text-sm">
          <span className="font-bold">This device</span>
          <input required value={form.deviceName} onChange={(e) => setForm({ ...form, deviceName: e.target.value })} className={input} />
        </label>
        <button disabled={busy} className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary disabled:opacity-60">
          {busy ? 'Connecting…' : 'Connect'}
        </button>
      </form>
      {error}
    </section>
  )
}
