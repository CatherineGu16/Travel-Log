import { useRef, useState, type PointerEvent, type ReactNode } from 'react'

/** One step of the breadcrumb: a link back, or (the last) where you are. */
export type Crumb = { label: string; href?: string }

/** How tall the phone's Trips sheet is: just its title, half the map, or nearly all of it. */
export type SheetSize = 'peek' | 'half' | 'full'

/** The peeking sheet's height; the map above it ends there, so its buttons stay in reach. */
export const PEEK_PX = 72
/** Room left above the full sheet, so a bit of map shows. */
const FULL_GAP_PX = 16
const SIZES: SheetSize[] = ['peek', 'half', 'full']
const HEIGHTS: Record<SheetSize, string> = { peek: `${PEEK_PX}px`, half: '50%', full: `calc(100% - ${FULL_GAP_PX}px)` }

/** Trips › Moab › Moab 2021: where you are in the Trips panel or sheet; each step back is a link. */
function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
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
  )
}

/**
 * Wider screens: Trips as a panel on the left over the map, so the map stays in view. The
 * breadcrumb goes back up; « hides the panel for the full map.
 */
export function TripsPanel({ crumbs, onCollapse, children }: { crumbs: Crumb[]; onCollapse: () => void; children: ReactNode }) {
  return (
    <aside
      aria-label="Trips panel"
      className="absolute top-3 bottom-3 left-3 z-20 flex w-[26rem] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_8px_30px_rgb(0_0_0/0.25)]"
    >
      <div className="flex items-center gap-1 border-b border-line py-1 pr-1 pl-2">
        <Breadcrumb crumbs={crumbs} />
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
export function ShowTripsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-3 left-3 z-10 flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-bold shadow-md hover:bg-raised"
    >
      Show trips
      <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
        <path d="M10 5l5 5-5 5M5 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

/**
 * Phones: Trips as a sheet over the map. Drag its top (or tap the handle) between peeking, half
 * and nearly full height; a quick flick goes to the next size. While it peeks, only the title shows.
 */
export function TripsSheet({ crumbs, size, onSize, children }: { crumbs: Crumb[]; size: SheetSize; onSize: (size: SheetSize) => void; children: ReactNode }) {
  const sheet = useRef<HTMLElement>(null)
  const drag = useRef<{ y: number; height: number; at: number; moved: boolean } | null>(null)
  const dragged = useRef(false)
  const [dragHeight, setDragHeight] = useState<number | null>(null)

  // Tapping the handle: peeking → half → full → peeking.
  const cycle = () => onSize(size === 'peek' ? 'half' : size === 'half' ? 'full' : 'peek')
  const heightsPx = () => {
    const room = sheet.current?.parentElement?.clientHeight ?? window.innerHeight
    return { peek: PEEK_PX, half: room / 2, full: room - FULL_GAP_PX }
  }
  const start = (e: PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('a')) return
    drag.current = { y: e.clientY, height: sheet.current?.offsetHeight ?? PEEK_PX, at: performance.now(), moved: false }
    dragged.current = false
  }
  const move = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    const dy = e.clientY - d.y
    // Held only once it's a drag, so a tap still reaches the handle and the links.
    if (!d.moved && Math.abs(dy) > 6) {
      d.moved = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (d.moved) setDragHeight(Math.min(heightsPx().full, Math.max(PEEK_PX, d.height - dy)))
  }
  const end = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current
    drag.current = null
    if (!d?.moved) return
    dragged.current = true
    setDragHeight(null)
    const dy = e.clientY - d.y
    const speed = dy / Math.max(1, performance.now() - d.at)
    const height = d.height - dy
    const px = heightsPx()
    const at = SIZES.indexOf(size)
    // A flick moves one size that way; a slow drag settles on the nearest.
    const next =
      speed < -0.5
        ? SIZES[Math.min(SIZES.length - 1, at + 1)]
        : speed > 0.5
          ? SIZES[Math.max(0, at - 1)]
          : SIZES.reduce((best, s) => (Math.abs(px[s] - height) < Math.abs(px[best] - height) ? s : best))
    onSize(next)
  }

  return (
    <aside
      ref={sheet}
      aria-label="Trips panel"
      style={{ height: dragHeight ?? HEIGHTS[size] }}
      className={`absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-2xl border-t border-line bg-surface shadow-[0_-6px_24px_rgb(0_0_0/0.18)] ${dragHeight === null ? 'transition-[height] duration-200' : ''}`}
    >
      <div
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={() => (drag.current = null)}
        onClickCapture={(e) => {
          // The click that ends a drag isn't a tap.
          if (dragged.current) {
            e.stopPropagation()
            dragged.current = false
          }
        }}
        // Tapping anywhere on the top (but a link) does what the handle does.
        onClick={(e) => !(e.target as HTMLElement).closest('a, button') && cycle()}
        className="shrink-0 touch-none border-b border-line"
      >
        <button
          onClick={cycle}
          aria-label={size === 'full' ? 'Shrink trips' : 'Expand trips'}
          className="flex h-5 w-full items-end justify-center"
        >
          <span aria-hidden className="h-1.5 w-10 rounded-full bg-line" />
        </button>
        <div className="flex h-12 items-center px-2">
          <Breadcrumb crumbs={crumbs} />
        </div>
      </div>
      <div inert={size === 'peek'} className="flex min-h-0 flex-1 flex-col pb-6">
        {children}
      </div>
    </aside>
  )
}
