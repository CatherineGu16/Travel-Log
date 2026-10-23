import { useEffect, useState } from 'react'

/**
 * On phones the on-screen keyboard covers the bottom of the page without resizing it (iOS
 * Safari). This tracks the visible area, so a bottom sheet can sit just above the keyboard and fit
 * what's left, instead of the browser scrolling the whole page to show the field you tapped.
 */
export function useKeyboardInset(active: boolean): { bottom: number; height: number | null } {
  const [inset, setInset] = useState<{ bottom: number; height: number | null }>({ bottom: 0, height: null })
  useEffect(() => {
    const vv = window.visualViewport
    if (!active || !vv) return
    const update = () => {
      const bottom = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
      setInset(bottom > 40 ? { bottom, height: Math.round(vv.height) } : { bottom: 0, height: null })
      // iOS still scrolls the page behind the sheet to reveal a focused field; put it back.
      if (bottom > 40 && (window.scrollY || document.documentElement.scrollTop)) window.scrollTo(0, 0)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      setInset({ bottom: 0, height: null })
    }
  }, [active])
  return inset
}
