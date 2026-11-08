import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { ToastContext, ToastDismissContext, type ToastAction, type ToastOptions } from './toastContext.ts'

interface ToastMessage {
  id: number
  text: string
  actions: ToastAction[]
  long: boolean
}

/** A confirmation ("Added Zion 2024") shows for a moment; problems and removals (Undo is the way back) stay longer. */
const SHORT_MS = 800
const LONG_MS = 5000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const seq = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const [paused, setPaused] = useState(false)

  const show = useCallback((text: string, actions: ToastAction[] = [], options: ToastOptions = {}) => {
    setPaused(false)
    setToast({ id: ++seq.current, text, actions, long: !!options.long })
  }, [])

  const dismiss = useCallback(() => setToast(null), [])

  useEffect(() => {
    if (!toast || paused) return
    timer.current = window.setTimeout(() => setToast(null), toast.long ? LONG_MS : SHORT_MS)
    return () => window.clearTimeout(timer.current)
  }, [toast, paused])

  // Swiping the message down or sideways dismisses it.
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [pulled, setPulled] = useState<{ x: number; y: number } | null>(null)
  const endPull = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current
    drag.current = null
    setPulled(null)
    if (d && (Math.abs(e.clientX - d.x) > 60 || e.clientY - d.y > 30)) setToast(null)
  }

  return (
    <ToastContext.Provider value={show}>
      <ToastDismissContext.Provider value={dismiss}>{children}</ToastDismissContext.Provider>
      {/*
        Above panels (z-50) and menus (z-60), at the bottom of the screen: on phones just above the
        tab bar, on wider screens near the bottom edge.
      */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+4.75rem)] sm:pb-4"
      >
        {toast && (
          <div
            key={toast.id}
            role="status"
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest('button')) return
              drag.current = { x: e.clientX, y: e.clientY }
              e.currentTarget.setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => drag.current && setPulled({ x: e.clientX - drag.current.x, y: Math.max(0, e.clientY - drag.current.y) })}
            onPointerUp={endPull}
            onPointerCancel={endPull}
            style={pulled ? { transform: `translate(${pulled.x}px, ${pulled.y}px)`, opacity: 1 - Math.min(0.6, Math.abs(pulled.x) / 200) } : undefined}
            className="pointer-events-auto flex w-full max-w-md touch-none items-center gap-1 rounded-xl bg-toast py-1.5 pr-1.5 pl-4 text-sm text-white shadow-[0_8px_30px_rgb(0_0_0/0.35)] [animation:toast-up_180ms_ease-out]"
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
            <button onClick={() => setToast(null)} aria-label="Dismiss" className="grid size-10 shrink-0 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white">
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
