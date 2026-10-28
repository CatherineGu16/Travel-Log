import * as Dialog from '@radix-ui/react-dialog'
import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { useKeyboardArea } from '../ui/useKeyboardInset.ts'

/** Bottom sheet on phones, side panel from 640px up. Radix handles focus trap, Escape, and scroll lock. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  accent,
  footer,
  toolbar,
  tall = false,
  full = false,
  swipeToClose = false,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  accent?: string
  /** Pinned under the scrolling content, e.g. an Apply button. */
  footer?: ReactNode
  /** Pinned under the title, above the scrolling content, e.g. steps. */
  toolbar?: ReactNode
  /** On phones, always the full sheet height, so it doesn't grow and shrink as its content changes. */
  tall?: boolean
  /** On phones, the whole screen. */
  full?: boolean
  /** On phones, a handle at the top: drag the top of the sheet down to close it. */
  swipeToClose?: boolean
  children: ReactNode
}) {
  // Phones only: while the on-screen keyboard is open, the sheet fills exactly the part of the
  // screen you can still see and scrolls on its own, so its first field is never stranded above
  // the screen. Its buttons hide until the keyboard closes.
  const phone = typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
  const keyboard = useKeyboardArea(open && phone)

  // Dragging the top of the sheet down: it follows your finger, and closes if you pull it far or fast.
  const drag = useRef<{ y: number; at: number } | null>(null)
  const [pulled, setPulled] = useState(0)
  const swipe = swipeToClose && phone
  const startPull = (e: PointerEvent<HTMLElement>) => {
    if (!swipe || (e.target as HTMLElement).closest('button')) return
    drag.current = { y: e.clientY, at: performance.now() }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const movePull = (e: PointerEvent<HTMLElement>) => drag.current && setPulled(Math.max(0, e.clientY - drag.current.y))
  const endPull = (e: PointerEvent<HTMLElement>) => {
    if (!drag.current) return
    const moved = e.clientY - drag.current.y
    const speed = moved / Math.max(1, performance.now() - drag.current.at)
    drag.current = null
    setPulled(0)
    if (moved > 90 || (moved > 20 && speed > 0.6)) onOpenChange(false)
  }
  const pull = { onPointerDown: startPull, onPointerMove: movePull, onPointerUp: endPull, onPointerCancel: endPull }
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 [animation:fade-in_150ms_ease-out]" />
        <Dialog.Content
          style={
            {
              '--accent': accent ?? 'var(--line)',
              ...(keyboard ? { top: keyboard.top, bottom: 'auto', height: keyboard.height, maxHeight: 'none', borderRadius: 0 } : {}),
              ...(pulled ? { transform: `translateY(${pulled}px)`, transition: 'none' } : swipe ? { transition: 'transform 200ms ease-out' } : {}),
            } as unknown as CSSProperties
          }
          className={`fixed inset-x-0 bottom-0 z-50 flex overflow-x-hidden flex-col ${full ? 'h-dvh max-h-dvh pt-[env(safe-area-inset-top)] sm:h-auto sm:max-h-none sm:pt-0' : `max-h-[85dvh] ${tall ? 'h-[85dvh] sm:h-auto' : ''}`} rounded-t-2xl border-t-4 border-[var(--accent)] bg-surface [animation:sheet-up_220ms_cubic-bezier(.2,.8,.2,1)] sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[28rem] sm:rounded-none sm:border-t-0 sm:border-l-4 sm:[animation:sheet-left_220ms_cubic-bezier(.2,.8,.2,1)]`}
        >
          {swipe && (
            <div {...pull} aria-hidden className="flex h-5 shrink-0 touch-none items-end justify-center">
              <span className="h-1.5 w-10 rounded-full bg-line" />
            </div>
          )}
          <div
            {...(swipe ? pull : {})}
            className={`flex items-start gap-2 px-4 pb-3 sm:pt-[max(1rem,env(safe-area-inset-top))] ${swipe ? 'touch-none pt-2' : keyboard ? 'pt-2' : 'pt-4'}`}
          >
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-display text-[1.75rem] leading-tight font-semibold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description asChild>
                  <div className="mt-1 text-sm text-muted">{description}</div>
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">Details</Dialog.Description>
              )}
            </div>
            <Dialog.Close aria-label="Close" className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-raised hover:text-fg">
              <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </Dialog.Close>
          </div>
          {toolbar && <div className="border-b border-line px-4 pb-2">{toolbar}</div>}
          <div
            data-sheet-body
            className={`min-h-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain px-4 ${toolbar ? 'pt-4' : ''} ${footer && !keyboard ? 'pb-4' : 'pb-[max(1.5rem,env(safe-area-inset-bottom))]'}`}
          >
            {children}
          </div>
          {footer && !keyboard && (
            <div className="border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
