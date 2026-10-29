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
    id: 'parks',
    label: 'Parks',
    icon: <path d="M12 3.5 6.5 11h3L5.5 16.5H11V21h2v-4.5h5.5L14.5 11h3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
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

/** Page links for wider screens, inside the header, with Add trip as a colored circle in the middle. */
export function PageLinks({ page, onAdd }: { page: Page; onAdd: () => void }) {
  const link = (p: (typeof PAGES)[number]) => (
    <a
      key={p.id}
      href={pageHref(p.id)}
      aria-current={p.id === page ? 'page' : undefined}
      className={`min-h-10 rounded-lg px-3 py-2 text-sm font-bold ${p.id === page ? 'bg-raised text-fg' : 'text-muted hover:text-fg'}`}
    >
      {p.label}
    </a>
  )
  return (
    <nav aria-label="Pages" className="hidden items-center gap-0.5 sm:flex">
      {PAGES.slice(0, 2).map(link)}
      <button
        onClick={onAdd}
        aria-label="Add trip"
        title="Add trip"
        className="mx-1.5 grid size-11 place-items-center rounded-full bg-primary text-on-primary shadow-md ring-4 ring-primary/20 transition-transform hover:scale-105 active:scale-95"
      >
        <PlusIcon className="size-6" />
      </button>
      {PAGES.slice(2).map(link)}
    </nav>
  )
}

/** Phones: pages at the bottom in thumb reach, with Add trip as a large raised circle in the center. */
export function TabBar({ page, onAdd }: { page: Page; onAdd: () => void }) {
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
        {PAGES.slice(0, 2).map(tab)}
        <li className="flex flex-1 justify-center">
          <button
            onClick={onAdd}
            aria-label="Add trip"
            className="-mt-6 mb-1 grid size-16 place-items-center rounded-full bg-primary text-on-primary shadow-lg ring-4 ring-surface active:scale-95"
          >
            <PlusIcon className="size-8" />
          </button>
        </li>
        {PAGES.slice(2).map(tab)}
      </ul>
    </nav>
  )
}
