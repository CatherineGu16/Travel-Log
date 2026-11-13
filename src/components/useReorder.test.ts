import { describe, expect, it } from 'vitest'
import { dropIndex } from './useReorder.ts'

describe('dropIndex', () => {
  // Three places, each 100 px tall: middles at 50, 150, 250.
  const middles = [50, 150, 250]

  it('stays put until the dragged place passes the middle of the next one', () => {
    expect(dropIndex(middles, 0, 50)).toBe(0)
    expect(dropIndex(middles, 0, 149)).toBe(0)
    expect(dropIndex(middles, 1, 151)).toBe(1)
    expect(dropIndex(middles, 1, 149)).toBe(1)
  })

  it('moves down past places whose middle it passes', () => {
    expect(dropIndex(middles, 0, 151)).toBe(1)
    expect(dropIndex(middles, 0, 400)).toBe(2)
  })

  it('moves up past places whose middle it passes', () => {
    expect(dropIndex(middles, 2, 149)).toBe(1)
    expect(dropIndex(middles, 2, -100)).toBe(0)
  })
})
