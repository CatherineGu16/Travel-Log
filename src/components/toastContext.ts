import { createContext, useContext } from 'react'

export interface ToastAction {
  label: string
  onClick: () => void
}

export const ToastContext = createContext<(text: string, actions?: ToastAction[]) => void>(() => {})

export const useToast = () => useContext(ToastContext)
