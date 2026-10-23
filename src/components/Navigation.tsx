import type { ReactNode } from 'react'
import { pageHref, type Page } from '../ui/route.ts'

const PAGES: { id: Page; label: string; icon: ReactNode }[] = [
  {
    id: 'map',
    label: 'Map',
    icon: <path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5ZM9 4v13.5M15 6.5V20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
  },
  {
    id: 'trips',
    label: 'Trips',
    icon: <path d="M5 6h14M5 12h14M5 18h9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  },
  {
    id: 'places',
    label: 'Places',
    icon: (
      <>
        <path d="M12 3a6 6 0 0 1 6 6c0 4.5-6 11.5-6 11.5S6 13.5 6 9a6 6 0 0 1 6-6z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="9" r="2" fill="currentColor" />
      </>
    ),
  },
  {
    id: 'parks',
    label: 'Parks',
    icon: <path d="M12 3.5 6.5 11h3L5.5 16.5H11V21h2v-4.5h5.5L14.5 11h3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
  },
]

/** Page links for wider screens, shown inside the header. */
export function PageLinks({ page, pages = PAGES }: { page: Page; pages?: typeof PAGES }) {
  return (
    <nav aria-label="Pages" className="hidden gap-0.5 sm:flex">
      {pages.map((p) => (
        <a
          key={p.id}
          href={pageHref(p.id)}
          aria-current={p.id === page ? 'page' : undefined}
          className={`min-h-10 rounded-lg px-3 py-2 text-sm font-bold ${p.id === page ? 'bg-raised text-fg' : 'text-muted hover:text-fg'}`}
        >
          {p.label}
        </a>
      ))}
    </nav>
  )
}

/** Phones: pages and Add at the bottom, in thumb reach. Wider screens use the header links. */
export function TabBar({ page, onAdd, pages = PAGES }: { page: Page; onAdd: () => void; pages?: typeof PAGES }) {
  return (
    <nav aria-label="Pages" className="z-30 shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden">
      <ul className="mx-auto flex max-w-md">
        {pages.map((p) => (
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
        ))}
        <li className="flex-1">
          <button onClick={onAdd} className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs font-bold text-muted">
            <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Add trip
          </button>
        </li>
      </ul>
    </nav>
  )
}
