import type { ReactNode } from 'react'
import { pageHref } from '../ui/route.ts'

/** One step of the panel's breadcrumb: a link back, or (the last) where you are. */
export type Crumb = { label: string; href?: string }

/**
 * Wider screens: Trips as a panel on the left over the map, so the map stays in view. The
 * breadcrumb (Trips › Moab › Moab 2021) goes back up; « hides the panel for the full map.
 */
export function TripsPanel({ crumbs, onCollapse, children }: { crumbs: Crumb[]; onCollapse: () => void; children: ReactNode }) {
  return (
    <aside
      aria-label="Trips panel"
      className="absolute top-20 bottom-3 left-3 z-20 flex w-[26rem] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_8px_30px_rgb(0_0_0/0.25)]"
    >
      <div className="flex items-center gap-1 border-b border-line py-1 pr-1 pl-2">
        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-0.5 text-sm">
            {crumbs.map((c, i) => (
              <li key={i} className={`flex items-center gap-0.5 ${c.href ? 'shrink-0' : 'min-w-0'}`}>
                {i > 0 && (
                  <span aria-hidden className="px-0.5 text-muted">
                    ›
                  </span>
                )}
                {c.href ? (
                  <a href={c.href} className="flex min-h-10 max-w-40 items-center truncate rounded-lg px-2 font-bold text-primary hover:bg-raised">
                    {c.label}
                  </a>
                ) : (
                  <span aria-current="page" className="truncate px-2 font-bold">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <button
          onClick={onCollapse}
          aria-label="Hide trips"
          title="Hide trips (full map)"
          className="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-raised hover:text-fg"
        >
          <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
            <path d="M10 5 5 10l5 5M15 5l-5 5 5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {children}
    </aside>
  )
}

/** Wider screens, with the Trips panel hidden: a tab on the left of the map to bring it back. */
export function ShowTripsButton() {
  return (
    <a
      href={pageHref('trips')}
      className="absolute top-20 left-3 z-10 flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-bold shadow-md hover:bg-raised"
    >
      Show trips
      <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
        <path d="M10 5l5 5-5 5M5 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  )
}
