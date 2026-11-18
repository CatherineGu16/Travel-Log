import { describe, expect, it } from 'vitest'
import parks from '../data/national-parks.json'
import { badgeArt, strayBadgeFiles } from './parkBadgeArt.ts'

const ids = parks.map((p) => p.id)

describe('park badge art', () => {
  it('every file in src/assets/park-badges is named after a park (or its -outline version)', () => {
    // Every file there, by name (not loaded).
    const files = Object.keys(import.meta.glob('../assets/park-badges/*')).map((path) => path.split('/').pop()!)
    expect(files).toContain('README.md')
    expect(strayBadgeFiles(files, ids)).toEqual([])
  })

  it("names a misnamed file, and ignores anything that isn't an image", () => {
    expect(strayBadgeFiles(['zion.svg', 'zion-outline.png', 'Zoin.svg', 'grand-teton.webp', 'README.md', 'yosemite-outlined.svg'], ids)).toEqual(['Zoin', 'yosemite-outlined'])
  })

  it('a park without a file has no art, so it shows the placeholder', () => {
    expect(badgeArt('not-a-park')).toEqual({ color: null, outline: null })
  })
})
