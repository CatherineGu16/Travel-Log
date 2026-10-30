import type { ReactNode } from 'react'
import { pageHref, type Page } from '../ui/route.ts'

const PAGES: { id: Page; label: string; icon: ReactNode }[] = [
  {
    id: 'map',
    label: 'Map',
    icon: <path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5ZM9 4v13.5M15 6.5V20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
  },
  {
    id: 'you',
    label: 'You',
    icon: (
      <>
        <circle cx="12" cy="8.5" r="3.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4.5 20.5c.9-4 3.8-6.2 7.5-6.2s6.6 2.2 7.5 6.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  },
]

const PlusIcon = ({ className }: { className: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
)

/** Trips live on the map, so their addresses count as the Map page. */
const current = (page: Page): Page => (page === 'trips' ? 'map' : page)

/**
 * The toolbar across the top, the same on every page: the title, then (wider screens) the Map tab,
 * and on the right the sync status and your photo (which opens You, so You needs no tab here).
 * Add trip is in the Trips panel on wider screens and the tab bar on phones. Controls are 36 px tall.
 */
export function TopBar({ page: shown, sync, you }: { page: Page; sync: ReactNode; you: ReactNode }) {
  const page = current(shown)
  return (
    <header className="z-30 shrink-0 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <h1 className="font-display text-xl font-semibold tracking-wide whitespace-nowrap sm:text-2xl">Travel Log</h1>
        <nav aria-label="Pages" className="ml-3 hidden items-center gap-1 sm:flex">
          {PAGES.filter((p) => p.id !== 'you').map((p) => (
            <a
              key={p.id}
              href={pageHref(p.id)}
              aria-current={p.id === page ? 'page' : undefined}
              className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-bold ${p.id === page ? 'bg-raised text-fg' : 'text-muted hover:bg-raised hover:text-fg'}`}
            >
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                {p.icon}
              </svg>
              {p.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {sync}
          {you}
        </div>
      </div>
    </header>
  )
}

/** Phones: pages at the bottom in thumb reach, with Add trip as a large raised circle between them. */
export function TabBar({ page: shown, onAdd }: { page: Page; onAdd: () => void }) {
  const page = current(shown)
  const tab = (p: (typeof PAGES)[number]) => (
    <li key={p.id} className="flex-1">
      <a
        href={pageHref(p.id)}
        aria-current={p.id === page ? 'page' : undefined}
        className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-bold ${p.id === page ? 'text-primary' : 'text-muted'}`}
      >
        <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
          {p.icon}
        </svg>
        {p.label}
      </a>
    </li>
  )
  return (
    <nav aria-label="Pages" className="z-30 shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden">
      <ul className="mx-auto flex max-w-md items-end">
        {tab(PAGES[0])}
        <li className="flex flex-1 justify-center">
          <button
            onClick={onAdd}
            aria-label="Add trip"
            className="-mt-6 mb-1 grid size-16 place-items-center rounded-full bg-primary text-on-primary shadow-lg ring-4 ring-surface active:scale-95"
          >
            <PlusIcon className="size-8" />
          </button>
        </li>
        {tab(PAGES[1])}
      </ul>
    </nav>
  )
}
