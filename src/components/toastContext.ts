import { createContext, useContext } from 'react'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  /** Stays a few seconds instead of a moment: problems, and removals whose Undo is the way back. */
  long?: boolean
}

export const ToastContext = createContext<(text: string, actions?: ToastAction[], options?: ToastOptions) => void>(() => {})

export const useToast = () => useContext(ToastContext)

/** Hides the message showing now, e.g. when a full-screen panel opens over the strip it uses. */
export const ToastDismissContext = createContext<() => void>(() => {})
export const useDismissToast = () => useContext(ToastDismissContext)
