import { useEffect, useState } from 'react'

/** The part of the screen you can see while the on-screen keyboard is open. */
export interface VisibleArea {
  /** From the top of the page (iPhone Safari pans the page up when you tap a field). */
  top: number
  height: number
}

/** Smaller than this, a shrink of the visible area is browser chrome, not a keyboard. */
const KEYBOARD_MIN_PX = 120

/**
 * On iPhones the on-screen keyboard covers the page without resizing it, and Safari pans the page
 * up to show the field you tapped. A bottom sheet then ends up partly off the top of the screen,
 * and since the page behind it can't scroll you can't get back to its first field. This tracks the
 * visible area while the keyboard is open, so the sheet can fill exactly that and scroll on its
 * own. Null while the keyboard is closed.
 */
export function useKeyboardArea(active: boolean, viewport: VisualViewport | null = typeof window !== 'undefined' ? window.visualViewport : null) {
  const [area, setArea] = useState<VisibleArea | null>(null)
  useEffect(() => {
    if (!active || !viewport) return
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const covered = window.innerHeight - viewport.height
        setArea(covered > KEYBOARD_MIN_PX ? { top: Math.round(viewport.offsetTop), height: Math.round(viewport.height) } : null)
      })
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      cancelAnimationFrame(frame)
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      setArea(null)
    }
  }, [active, viewport])
  return area
}
