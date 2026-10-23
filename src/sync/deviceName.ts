/** A default name for this device, shown in GitHub's history of saves. */
export function guessDeviceName(ua = navigator.userAgent, touch = navigator.maxTouchPoints): string {
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'Windows PC'
  if (/Macintosh/.test(ua)) return 'Mac'
  return 'Browser'
}
