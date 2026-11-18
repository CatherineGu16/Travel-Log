// Your badge art (src/assets/park-badges/, see its README): each file's built URL, by file name.
// Only the URLs are bundled; an image loads when its badge is shown.
const files = import.meta.glob<string>('../assets/park-badges/*.{svg,png,webp}', { eager: true, query: '?url', import: 'default' })
const byName = new Map(Object.entries(files).map(([path, url]) => [baseName(path), url]))

/** "../assets/park-badges/zion-outline.svg" → "zion-outline". */
function baseName(path: string): string {
  return path.split('/').pop()!.replace(/\.(svg|png|webp)$/i, '')
}

/** A park's badge files: the colored (earned) one and, if you made one, the not-visited one. Null until added. */
export interface BadgeArt {
  color: string | null
  outline: string | null
}

export const badgeArt = (parkId: string): BadgeArt => ({ color: byName.get(parkId) ?? null, outline: byName.get(`${parkId}-outline`) ?? null })

/** Badge files not named after a park ("<id>" or "<id>-outline"), so a typo doesn't leave a park on its placeholder. */
export function strayBadgeFiles(fileNames: string[], parkIds: string[]): string[] {
  const ids = new Set(parkIds)
  return fileNames
    .filter((f) => /\.(svg|png|webp)$/i.test(f))
    .map(baseName)
    .filter((name) => !ids.has(name.replace(/-outline$/, '')))
}
