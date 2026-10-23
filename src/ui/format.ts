import { formatPartialDate } from '../lib/partialDate.ts'

/** "just now", "5 min ago", "3 hr ago", then the date. */
export function timeAgo(iso: string, now: Date): string {
  const mins = Math.round((now.getTime() - Date.parse(iso)) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  if (mins < 24 * 60) return `${Math.round(mins / 60)} hr ago`
  const d = new Date(iso)
  return formatPartialDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
}
