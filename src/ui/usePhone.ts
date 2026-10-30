import { useSyncExternalStore } from 'react'

const PHONE = '(max-width: 639px)'
const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(PHONE)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/** Whether the screen is phone-sized (Tailwind's below-`sm`), following rotation and resizing. */
export const usePhone = () => useSyncExternalStore(subscribe, () => window.matchMedia(PHONE).matches)
