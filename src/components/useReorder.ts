import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'

/** How close to the top or bottom of the scrolling list a dragged item starts it scrolling, and how fast. */
const EDGE_PX = 56
const SCROLL_PX = 10

type Drag = {
  from: number
  to: number
  pointerId: number
  startY: number
  y: number
  startScroll: number
  /** Each item's middle and height when the drag started, in the list's own coordinates. */
  middles: number[]
  height: number
  scroller: HTMLElement | null
}

/** The nearest parent that scrolls up and down, so a drag near its edge can scroll it. */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return null
}

/** Where `from` lands in a list of `count` items: before every item whose middle is below the dragged item's middle. */
export function dropIndex(middles: number[], from: number, middle: number): number {
  let to = 0
  middles.forEach((m, i) => {
    if (i !== from && m < middle) to++
  })
  return to
}

/**
 * Reordering a list by drag handles: hold an item's handle and drag it up or down (the others
 * make room as it passes them, and the list scrolls near its edges); let go to drop it there. On
 * a keyboard, the handle moves its item with the up and down arrows.
 */
export function useReorder(count: number, onMove: (from: number, to: number) => void) {
  const items = useRef<(HTMLElement | null)[]>([])
  const drag = useRef<Drag | null>(null)
  const [shown, setShown] = useState<{ from: number; to: number; dy: number; height: number } | null>(null)
  const frame = useRef(0)

  const update = () => {
    const d = drag.current
    if (!d) return
    const dy = d.y - d.startY + (d.scroller ? d.scroller.scrollTop - d.startScroll : 0)
    d.to = dropIndex(d.middles, d.from, d.middles[d.from] + dy)
    setShown({ from: d.from, to: d.to, dy, height: d.height })
  }
  // While the pointer is near the top or bottom of the scrolling list, keep scrolling it.
  const scrollTick = () => {
    const d = drag.current
    if (!d?.scroller) return
    const box = d.scroller.getBoundingClientRect()
    const by = d.y < box.top + EDGE_PX ? -SCROLL_PX : d.y > box.bottom - EDGE_PX ? SCROLL_PX : 0
    if (!by) return
    const before = d.scroller.scrollTop
    d.scroller.scrollTop += by
    if (d.scroller.scrollTop !== before) update()
    frame.current = requestAnimationFrame(scrollTick)
  }
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const finish = (drop: boolean) => {
    const d = drag.current
    drag.current = null
    cancelAnimationFrame(frame.current)
    setShown(null)
    if (drop && d && d.to !== d.from) onMove(d.from, d.to)
  }

  /** Props for item i's handle (a button). */
  const handle = (i: number) => ({
    'data-reorder-handle': true,
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return
      e.preventDefault()
      const rects = items.current.slice(0, count).map((el) => el?.getBoundingClientRect())
      if (rects.some((r) => !r)) return
      const scroller = scrollParent(items.current[i])
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = {
        from: i,
        to: i,
        pointerId: e.pointerId,
        startY: e.clientY,
        y: e.clientY,
        startScroll: scroller?.scrollTop ?? 0,
        middles: rects.map((r) => r!.top + r!.height / 2),
        height: rects[i]!.height,
        scroller,
      }
      update()
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const d = drag.current
      if (!d || e.pointerId !== d.pointerId) return
      d.y = e.clientY
      update()
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(scrollTick)
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => drag.current?.pointerId === e.pointerId && finish(true),
    onPointerCancel: (e: PointerEvent<HTMLElement>) => drag.current?.pointerId === e.pointerId && finish(false),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : null
      if (to === null) return
      e.preventDefault()
      if (to < 0 || to >= count) return
      onMove(i, to)
      // The handle keeps the keyboard focus as its item moves.
      requestAnimationFrame(() => items.current[to]?.querySelector<HTMLElement>('[data-reorder-handle]')?.focus())
    },
  })

  /** Ref and style for item i: the dragged one follows the pointer, the ones it passes make room. */
  const item = (i: number): { ref: (el: HTMLElement | null) => void; style: CSSProperties | undefined } => {
    const ref = (el: HTMLElement | null) => {
      items.current[i] = el
    }
    if (!shown) return { ref, style: undefined }
    const { from, to, dy, height } = shown
    if (i === from) return { ref, style: { transform: `translateY(${dy}px)`, position: 'relative', zIndex: 10 } }
    const by = from < i && i <= to ? -height : to <= i && i < from ? height : 0
    return { ref, style: { transform: by ? `translateY(${by}px)` : undefined, transition: 'transform 150ms ease' } }
  }

  return { handle, item, dragging: shown?.from ?? null }
}
