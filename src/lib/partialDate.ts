import type { PartialDate } from './types.ts'

const PARTIAL_DATE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/

export type DatePrecision = 'year' | 'month' | 'day'

export function isPartialDate(value: string): value is PartialDate {
  return PARTIAL_DATE.test(value)
}

export function precisionOf(date: PartialDate): DatePrecision {
  return date.length === 4 ? 'year' : date.length === 7 ? 'month' : 'day'
}

/**
 * Orders partial dates. A less precise date sorts before more precise dates it contains
 * ("2021" < "2021-03" < "2021-03-05"), which is what plain string comparison gives us.
 */
export function comparePartialDates(a: PartialDate, b: PartialDate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function todayIso(now: Date = new Date()): PartialDate {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const parts = (d: PartialDate) => ({
  y: d.slice(0, 4),
  m: d.length >= 7 ? MONTHS[Number(d.slice(5, 7)) - 1] : null,
  d: d.length === 10 ? String(Number(d.slice(8, 10))) : null,
})

/** "2023-07-04" → "Jul 4, 2023", "2023-07" → "Jul 2023", "2023" → "2023". */
export function formatPartialDate(date: PartialDate): string {
  const { y, m, d } = parts(date)
  if (d) return `${m} ${d}, ${y}`
  if (m) return `${m} ${y}`
  return y
}

/**
 * A trip's dates, as short as they can be: "Jul 4 – 9, 2023", "Jul 30 – Aug 2, 2023",
 * "Jul – Aug 2023", "2019 – 2020". Approximate dates get a leading "~".
 */
export function formatDateRange(start: PartialDate, end: PartialDate | null, approximate = false): string {
  const prefix = approximate ? '~' : ''
  if (!end || end === start) return prefix + formatPartialDate(start)
  const a = parts(start)
  const b = parts(end)
  const samePrecision = precisionOf(start) === precisionOf(end)
  if (samePrecision && a.y === b.y) {
    if (a.d && b.d) return `${prefix}${a.m} ${a.d} – ${a.m === b.m ? '' : `${b.m} `}${b.d}, ${a.y}`
    if (a.m && b.m) return `${prefix}${a.m} – ${b.m} ${a.y}`
  }
  return `${prefix}${formatPartialDate(start)} – ${formatPartialDate(end)}`
}

export const yearOf = (date: PartialDate) => date.slice(0, 4)
