import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastAction } from './toastContext.ts'

interface ToastMessage {
  id: number
  text: string
  actions: ToastAction[]
}

const VISIBLE_MS = 6000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const seq = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const [paused, setPaused] = useState(false)

  const show = useCallback((text: string, actions: ToastAction[] = []) => {
    setToast({ id: ++seq.current, text, actions })
  }, [])

  useEffect(() => {
    if (!toast || paused) return
    timer.current = window.setTimeout(() => setToast(null), VISIBLE_MS)
    return () => window.clearTimeout(timer.current)
  }, [toast, paused])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/*
        Above panels (z-50) and menus (z-60). Phones show it at the top: bottom panels and the tab
        bar own the bottom edge, and a toast there covered their buttons. Bottom panels stop at 85%
        height, so the top strip is always free. From 640px panels open from the side, so it goes
        back to the bottom, above the tab bar until desktop.
      */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:top-auto sm:bottom-0 sm:pt-0 sm:pb-[calc(env(safe-area-inset-bottom)+4.5rem)] lg:pb-4"
      >
        {toast && (
          <div
            key={toast.id}
            role="status"
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-xl bg-toast py-2 pr-2 pl-4 text-sm text-white shadow-[0_8px_30px_rgb(0_0_0/0.35)] [animation:fade-in_150ms_ease-out]"
          >
            <span className="mr-auto py-1.5">{toast.text}</span>
            {toast.actions.map((a) => (
              <button
                key={a.label}
                className="min-h-10 shrink-0 rounded-lg px-3 font-bold text-[var(--toast-action)] hover:bg-white/10"
                onClick={() => {
                  // Close first, so an action that shows its own message (e.g. "Can't undo") isn't wiped.
                  setToast(null)
                  a.onClick()
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
