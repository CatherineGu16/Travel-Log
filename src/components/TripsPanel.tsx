import { useRef, useState, type PointerEvent, type ReactNode } from 'react'

/** One step of the breadcrumb: a link back, or (the last) where you are. `onClick` handles the link itself (the trip form asks before leaving). */
export type Crumb = { label: string; href?: string; onClick?: () => void }

/** How tall the phone's Trips sheet is: just its title, half the map, or nearly all of it. */
export type SheetSize = 'peek' | 'half' | 'full'

/** The peeking sheet's height (its handle, title and subtitle); the map above it ends there, so its buttons stay in reach. */
export const PEEK_PX = 84
/** Room left above the full sheet, so a bit of map shows. */
const FULL_GAP_PX = 16
const SIZES: SheetSize[] = ['peek', 'half', 'full']
const HEIGHTS: Record<SheetSize, string> = { peek: `${PEEK_PX}px`, half: '50%', full: `calc(100% - ${FULL_GAP_PX}px)` }

/**
 * The top of the Trips panel or sheet: where you came from as small links (Trips › Moab), then
 * where you are as the title, with a line under it ("3 trips", "2 visits · UT", a trip's dates).
 * It's one breadcrumb, read as "Trips › Moab › Moab 2021". Wider screens put the title on its own
 * line under the links; phones keep it on one line.
 */
function PanelHeading({ crumbs, subtitle, stacked }: { crumbs: Crumb[]; subtitle?: string; stacked: boolean }) {
  const back = crumbs.slice(0, -1)
  const here = crumbs.at(-1)
  return (
    <div className="min-w-0 flex-1">
      <nav aria-label="Breadcrumb">
        <ol className={`flex min-w-0 items-baseline ${stacked ? 'flex-wrap' : ''}`}>
          {back.map((c, i) => (
            <li key={i} className="flex shrink-0 items-baseline text-sm">
              {c.href ? (
                <a
                  href={c.href}
                  onClick={
                    c.onClick &&
                    ((e) => {
                      e.preventDefault()
                      c.onClick!()
                    })
                  }
                  className="-mx-1 max-w-40 truncate rounded px-1 font-bold text-primary hover:bg-raised"
                >
                  {c.label}
                </a>
              ) : (
                <span className="max-w-40 truncate font-bold text-muted">{c.label}</span>
              )}
              <span aria-hidden className="px-1.5 text-muted">
                ›
              </span>
            </li>
          ))}
          {here && (
            <li className={`min-w-0 ${stacked ? 'basis-full' : 'flex-1'}`}>
              <span aria-current="page" className={`block truncate font-display leading-tight font-semibold ${stacked ? 'text-2xl' : 'text-xl'}`}>
                {here.label}
              </span>
            </li>
          )}
        </ol>
      </nav>
      {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
    </div>
  )
}

/** The tab on the edge of the panel (or of the map, while it's hidden) that hides or shows the Trips panel. */
function EdgeTab({ open, onClick, className }: { open: boolean; onClick: () => void; className: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={open ? 'Hide trips' : 'Show trips'}
      title={open ? 'Hide trips (full map)' : 'Show trips'}
      className={`flex h-12 items-center gap-1 rounded-r-xl border border-l-0 border-line bg-surface text-sm font-bold text-muted shadow-md hover:text-fg ${className}`}
    >
      {!open && <span className="pl-3">Trips</span>}
      <svg viewBox="0 0 20 20" className={`size-5 ${open ? 'mx-1.5' : 'mr-2'}`} aria-hidden>
        <path d={open ? 'm12 5-5 5 5 5' : 'm8 5 5 5-5 5'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

/**
 * Wider screens: Trips as a panel on the left over the map, so the map stays in view: the heading
 * (breadcrumb, title, subtitle), then the view. The tab on its edge hides it for the full map
 * (left out while the trip form is open, so it can't be hidden mid-edit).
 */
export function TripsPanel({
  crumbs,
  subtitle,
  onCollapse,
  hidden = false,
  children,
}: {
  crumbs: Crumb[]
  subtitle?: string
  onCollapse?: () => void
  hidden?: boolean
  children: ReactNode
}) {
  return (
    <aside aria-label="Trips panel" hidden={hidden} className="absolute top-3 bottom-3 left-3 z-20 flex w-[26rem] max-w-[calc(100%-4.5rem)]">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_8px_30px_rgb(0_0_0/0.25)]">
        <div className="border-b border-line px-4 py-3">
          <PanelHeading crumbs={crumbs} subtitle={subtitle} stacked />
        </div>
        {children}
      </div>
      {onCollapse && <EdgeTab open onClick={onCollapse} className="absolute top-4 left-full -ml-px" />}
    </aside>
  )
}

/** Wider screens, with the Trips panel hidden: the same tab, on the left edge of the map, brings it back. */
export function ShowTripsButton({ onClick }: { onClick: () => void }) {
  return <EdgeTab open={false} onClick={onClick} className="absolute top-7 left-0 z-10" />
}

/**
 * Phones: Trips as a sheet over the map. Drag its top (or tap the handle) between peeking, half
 * and nearly full height; a quick flick goes to the next size. While it peeks, only the title shows.
 */
export function TripsSheet({
  crumbs,
  subtitle,
  size,
  onSize,
  children,
}: {
  crumbs: Crumb[]
  subtitle?: string
  size: SheetSize
  onSize: (size: SheetSize) => void
  children: ReactNode
}) {
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
          className="flex h-4 w-full items-end justify-center"
        >
          <span aria-hidden className="h-1.5 w-10 rounded-full bg-line" />
        </button>
        <div className="flex h-[3.75rem] items-center px-4">
          <PanelHeading crumbs={crumbs} subtitle={subtitle} stacked={false} />
        </div>
      </div>
      <div inert={size === 'peek'} className="flex min-h-0 flex-1 flex-col pb-6">
        {children}
      </div>
    </aside>
  )
}
