import { useState } from 'react'
import type { ParksMode } from '../map/MapView.tsx'

const MODES: { id: ParksMode; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'all', label: 'All' },
  { id: 'visited', label: 'Visited' },
  { id: 'not-visited', label: 'Not visited' },
]

/** The map's National parks layer: off, or all / visited / not-visited parks, with your progress. */
export function ParksLayerControl({ mode, onChange, visited, total }: { mode: ParksMode; onChange: (m: ParksMode) => void; visited: number; total: number }) {
  const [open, setOpen] = useState(false)
  const on = mode !== 'off'
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-bold shadow-sm ${on ? 'border-park bg-park text-white' : 'border-line bg-surface text-fg hover:bg-raised'}`}
      >
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
          <path d="M12 3.5 6.5 11h3L5.5 16.5H11V21h2v-4.5h5.5L14.5 11h3Z" fill="currentColor" />
        </svg>
        Parks
      </button>
      {open && (
        <div role="dialog" aria-label="National parks layer" className="absolute top-12 left-0 z-30 w-64 rounded-xl border border-line bg-surface p-3 shadow-lg sm:right-0 sm:left-auto">
          <p className="mb-2 text-sm">
            <span className="font-bold text-park">{visited}</span> / {total} national parks visited
          </p>
          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-raised">
            <div className="h-full rounded-full bg-park" style={{ width: `${(visited / total) * 100}%` }} />
          </div>
          <div role="radiogroup" aria-label="Show parks" className="grid grid-cols-2 gap-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={mode === m.id}
                onClick={() => {
                  onChange(m.id)
                  setOpen(false)
                }}
                className={`min-h-10 rounded-lg text-sm ${mode === m.id ? 'bg-raised font-bold' : 'text-muted hover:bg-raised hover:text-fg'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
