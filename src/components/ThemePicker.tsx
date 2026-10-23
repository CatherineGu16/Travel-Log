import { useEffect } from 'react'
import { applyTheme, readThemePref, THEME_KEY, type ThemePref } from '../ui/theme.ts'
import { usePersistentState } from '../ui/usePersistentState.ts'

const OPTIONS: { id: ThemePref; label: string }[] = [
  { id: 'system', label: 'Match device' },
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
]

export function ThemePicker() {
  const [pref, setPref] = usePersistentState<ThemePref>(THEME_KEY, readThemePref())
  useEffect(() => {
    applyTheme(pref)
  }, [pref])

  return (
    <section className="rounded-xl border border-line p-4">
      <h2 className="font-display text-xl font-semibold">Appearance</h2>
      <div role="radiogroup" aria-label="Theme" className="mt-3 flex w-fit rounded-lg bg-bg p-0.5">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={pref === o.id}
            onClick={() => setPref(o.id)}
            className={`min-h-10 rounded-md px-3 text-sm ${pref === o.id ? 'bg-raised font-bold text-fg' : 'text-muted hover:text-fg'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </section>
  )
}
