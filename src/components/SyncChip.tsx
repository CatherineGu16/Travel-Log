import { useSync, useSyncState } from '../store/useTravel.ts'

const LABEL = {
  syncing: 'Syncing',
  pending: 'Saving',
  synced: 'Synced',
  offline: 'Offline',
  error: 'Sync problem',
} as const

/** Header status. Tap to sync now, or to open Settings when something needs fixing. */
export function SyncChip({ onSettings }: { onSettings: () => void }) {
  const sync = useSync()
  const { status, uploading } = useSyncState()
  if (status === 'off') return null

  const problem = status === 'error'
  const dot = problem ? 'bg-danger' : status === 'synced' ? 'bg-ok' : status === 'offline' ? 'bg-muted' : 'bg-primary animate-pulse'
  return (
    <button
      onClick={() => (problem ? onSettings() : void sync.syncNow())}
      aria-label={problem ? 'Sync problem. Open Settings' : `${LABEL[status]}. Sync now`}
      className={`flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-sm sm:px-3 ${problem ? 'border-danger/40 bg-danger/15 font-bold text-danger' : 'border-line text-muted hover:bg-raised hover:text-fg'}`}
    >
      <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
      {/* Phones show just the dot; the label is still read out. */}
      <span className="sr-only sm:not-sr-only">{uploading > 0 ? `Uploading ${uploading} ${uploading === 1 ? 'photo' : 'photos'}` : LABEL[status]}</span>
    </button>
  )
}
