import { createContext, useContext } from 'react'

export interface ToastAction {
  label: string
  onClick: () => void
}

export const ToastContext = createContext<(text: string, actions?: ToastAction[]) => void>(() => {})

export const useToast = () => useContext(ToastContext)

/** Hides the message showing now, e.g. when a full-screen panel opens over the strip it uses. */
export const ToastDismissContext = createContext<() => void>(() => {})
export const useDismissToast = () => useContext(ToastDismissContext)
