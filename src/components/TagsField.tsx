import { useState } from 'react'

/**
 * A trip's tags as chips. Tags you've used before (and your group names, like Family) are offered as
 * chips to tap; type a new one and press Enter (or a comma) to add it. × removes a tag.
 */
export function TagsField({ value, suggestions, onChange }: { value: string[]; suggestions: string[]; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState('')
  const has = (tag: string) => value.some((t) => t.toLowerCase() === tag.toLowerCase())
  const add = (raw: string) => {
    const tag = raw.trim()
    if (tag && !has(tag)) onChange([...value, tag])
    setText('')
  }
  const q = text.trim().toLowerCase()
  const offered = suggestions.filter((s) => !has(s) && (!q || s.toLowerCase().includes(q)))
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-bold">Tags</legend>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Tags on this trip">
          {value.map((t) => (
            <li key={t} className="flex items-center gap-0.5 rounded-full bg-primary/10 py-0.5 pr-0.5 pl-3 text-sm font-bold">
              {t}
              <button
                type="button"
                aria-label={`Remove the ${t} tag`}
                onClick={() => onChange(value.filter((x) => x !== t))}
                className="grid size-7 place-items-center rounded-full text-muted hover:bg-line hover:text-fg"
              >
                <svg viewBox="0 0 20 20" className="size-3.5" aria-hidden>
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        aria-label="Add a tag"
        value={text}
        placeholder="Add a tag, e.g. camping"
        onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value.slice(0, -1)) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add(text)
          } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={() => text.trim() && add(text)}
        className="h-10 w-full rounded-lg border border-line bg-bg px-3 text-base"
      />
      {(offered.length > 0 || (q && !has(q))) && (
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Tags you've used">
          {q && !has(q) && !suggestions.some((s) => s.toLowerCase() === q) && (
            <button type="button" onClick={() => add(text)} className="min-h-8 rounded-full border border-dashed border-primary px-3 text-sm font-bold text-primary">
              + Add “{text.trim()}”
            </button>
          )}
          {offered.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="min-h-8 rounded-full border border-line px-3 text-sm text-muted hover:border-muted hover:text-fg">
              + {s}
            </button>
          ))}
        </div>
      )}
    </fieldset>
  )
}
