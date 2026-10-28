import { useState, type ReactNode } from 'react'
import { formatDistance, LEG_MODES, legModeInfo, type Leg } from '../lib/legs.ts'
import type { LegMode } from '../lib/types.ts'

/** The rail between two stops, styled like the leg on the map: dashed for flights, dotted when not sure. */
function Rail({ mode }: { mode: LegMode }) {
  const style = mode === 'flight' ? 'border-dashed border-primary' : mode === 'unknown' ? 'border-dotted border-[var(--route)]' : 'border-solid border-[var(--route)]'
  return <span aria-hidden className={`my-1 w-0 shrink-0 border-l-2 ${style}`} />
}

function Label({ leg }: { leg: Leg }) {
  const m = legModeInfo(leg.mode)
  return (
    <>
      <span aria-hidden>{m.icon}</span> <span className="font-bold text-fg">{m.label}</span> · {formatDistance(leg.distanceM)}
      {leg.guessed && <span className="ml-1 rounded bg-raised px-1 text-[0.7rem]">guessed</span>}
    </>
  )
}

/**
 * One leg between two stops. With `onPick`, tapping it opens a one-step mode picker; `children`
 * go after the label (e.g. shaping the route).
 */
export function LegRow({
  leg,
  onPick,
  allowGuess = true,
  children,
}: {
  leg: Leg
  onPick?: (mode: LegMode | null) => void
  /** Offer "Use the guess" once a mode is picked (not for legs that are never guessed). */
  allowGuess?: boolean
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const m = legModeInfo(leg.mode)
  const spoken = `${m.label}${leg.guessed ? ' (guessed)' : ''} from ${leg.from.name} to ${leg.to.name}, ${formatDistance(leg.distanceM)}`
  return (
    <div>
      <div className="flex min-h-11 flex-wrap items-stretch gap-x-2 pl-[1.15rem] text-xs text-muted">
        <Rail mode={leg.mode} />
        {onPick ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${spoken}. Change how you traveled`}
            onClick={() => setOpen(!open)}
            className="min-h-11 rounded-md px-1.5 text-left hover:bg-raised"
          >
            <Label leg={leg} />
          </button>
        ) : (
          <span className="flex items-center px-1.5" aria-label={spoken}>
            <span aria-hidden>
              <Label leg={leg} />
            </span>
          </span>
        )}
        {children}
      </div>
      {onPick && open && (
        <div role="group" aria-label={`How you got from ${leg.from.name} to ${leg.to.name}`} className="flex flex-wrap gap-1.5 pt-1 pb-2 pl-8">
          {LEG_MODES.map((mode) => {
            const on = !leg.guessed && leg.mode === mode.id
            return (
              <button
                key={mode.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  onPick(mode.id)
                  setOpen(false)
                }}
                className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm ${on ? 'border-primary bg-primary font-bold text-on-primary' : 'border-line hover:bg-raised'}`}
              >
                <span aria-hidden>{mode.icon}</span>
                {mode.label}
              </button>
            )
          })}
          {allowGuess && !leg.guessed && (
            <button
              type="button"
              onClick={() => {
                onPick(null)
                setOpen(false)
              }}
              className="min-h-11 rounded-full px-3 text-sm text-muted hover:bg-raised hover:text-fg"
            >
              Use the guess
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function HomeGlyph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 text-[var(--route)] ${className}`} aria-hidden>
      <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="currentColor" />
    </svg>
  )
}
