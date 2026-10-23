import { describe, expect, it } from 'vitest'
import { formatDateRange, formatPartialDate } from './partialDate.ts'

describe('formatPartialDate', () => {
  it('formats each precision', () => {
    expect(formatPartialDate('2023-07-04')).toBe('Jul 4, 2023')
    expect(formatPartialDate('2023-07')).toBe('Jul 2023')
    expect(formatPartialDate('2023')).toBe('2023')
  })
})

describe('formatDateRange', () => {
  it('keeps ranges short', () => {
    expect(formatDateRange('2023-07-04', '2023-07-09')).toBe('Jul 4 – 9, 2023')
    expect(formatDateRange('2023-07-30', '2023-08-02')).toBe('Jul 30 – Aug 2, 2023')
    expect(formatDateRange('2023-07', '2023-08')).toBe('Jul – Aug 2023')
    expect(formatDateRange('2023-12-30', '2024-01-02')).toBe('Dec 30, 2023 – Jan 2, 2024')
    expect(formatDateRange('2019', '2020')).toBe('2019 – 2020')
  })

  it('shows one date when there is no end, and marks approximate dates', () => {
    expect(formatDateRange('2019-05', null)).toBe('May 2019')
    expect(formatDateRange('2019', null, true)).toBe('~2019')
  })
})
