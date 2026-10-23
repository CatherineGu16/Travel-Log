import type { Map as MapLibreMap } from 'maplibre-gl'

const W = 30
const H = 40
const PIN_PATH = 'M15 1.5C7.5 1.5 1.5 7.4 1.5 14.8c0 9.6 11.6 22.3 12.4 23.2a1.5 1.5 0 0 0 2.2 0c.8-.9 12.4-13.6 12.4-23.2C28.5 7.4 22.5 1.5 15 1.5z'

/** Draws a teardrop pin at the device's pixel ratio, so it stays sharp on phones. */
function drawPin(fill: string, stroke: string): ImageData {
  const ratio = Math.max(2, Math.ceil(window.devicePixelRatio || 1))
  const canvas = document.createElement('canvas')
  canvas.width = W * ratio
  canvas.height = H * ratio
  const ctx = canvas.getContext('2d')!
  ctx.scale(ratio, ratio)
  const path = new Path2D(PIN_PATH)
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 3
  ctx.shadowOffsetY = 1
  ctx.fillStyle = fill
  ctx.fill(path)
  ctx.shadowColor = 'transparent'
  ctx.lineWidth = 1.5
  ctx.strokeStyle = stroke
  ctx.stroke(path)
  ctx.beginPath()
  ctx.arc(15, 14.5, 5, 0, Math.PI * 2)
  ctx.fillStyle = stroke
  ctx.fill()
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

export const PIN_IMAGES = { accent: 'pin-accent', park: 'pin-park' } as const

/** Adds the pin images, or repaints them in new colors (e.g. after a theme change). */
export function setPinImages(map: MapLibreMap, colors: { accent: string; park: string; center: string }) {
  const ratio = Math.max(2, Math.ceil(window.devicePixelRatio || 1))
  for (const [key, name] of Object.entries(PIN_IMAGES)) {
    const image = drawPin(colors[key as keyof typeof PIN_IMAGES], colors.center)
    if (map.hasImage(name)) map.updateImage(name, image)
    else map.addImage(name, image, { pixelRatio: ratio })
  }
}

const TREE = 'M12 4.5 7.2 11h2.6L6.5 15.5h4.3V19h2.4v-3.5h4.3L14.2 11h2.6Z'

/** A round badge with a tree: filled for parks you've visited, outlined for ones you haven't. */
function drawParkBadge(visited: boolean, colors: { park: string; muted: string; surface: string }): ImageData {
  const S = 24
  const ratio = Math.max(2, Math.ceil(window.devicePixelRatio || 1))
  const canvas = document.createElement('canvas')
  canvas.width = S * ratio
  canvas.height = S * ratio
  const ctx = canvas.getContext('2d')!
  ctx.scale(ratio, ratio)
  ctx.beginPath()
  ctx.arc(12, 12, 10.5, 0, Math.PI * 2)
  ctx.fillStyle = visited ? colors.park : colors.surface
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = visited ? colors.surface : colors.muted
  ctx.stroke()
  ctx.fillStyle = visited ? colors.surface : colors.muted
  ctx.fill(new Path2D(TREE))
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

export const PARK_IMAGES = { visited: 'park-visited', notVisited: 'park-not-visited' } as const

export function setParkImages(map: MapLibreMap, colors: { park: string; muted: string; surface: string }) {
  const ratio = Math.max(2, Math.ceil(window.devicePixelRatio || 1))
  for (const [name, visited] of [
    [PARK_IMAGES.visited, true],
    [PARK_IMAGES.notVisited, false],
  ] as const) {
    const image = drawParkBadge(visited, colors)
    if (map.hasImage(name)) map.updateImage(name, image)
    else map.addImage(name, image, { pixelRatio: ratio })
  }
}
