import { useEffect, useState } from 'react'

/** useState remembered per device. Storage can be blocked (private mode), so every access is guarded. */
export function usePersistentState<T>(key: string, initial: T, revive: (stored: unknown) => T = (s) => s as T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : revive(JSON.parse(raw))
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Not remembered on this device; still works for this visit.
    }
  }, [key, value])
  return [value, setValue] as const
}
