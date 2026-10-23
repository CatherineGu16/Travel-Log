export type ThemePref = 'system' | 'dark' | 'light'

export const THEME_KEY = 'travel.theme'

export function readThemePref(): ThemePref {
  try {
    const v = JSON.parse(localStorage.getItem(THEME_KEY) ?? '"system"')
    return v === 'dark' || v === 'light' ? v : 'system'
  } catch {
    return 'system'
  }
}

/** Sets the theme on <html> and matches the browser/status bar color to the page. */
export function applyTheme(pref: ThemePref) {
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#f4f1e8')
}

/** The theme actually showing: the picked one, or the device's when following the system. */
export function resolvedTheme(): 'dark' | 'light' {
  const picked = document.documentElement.dataset.theme
  if (picked === 'dark' || picked === 'light') return picked
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
