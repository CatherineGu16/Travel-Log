const SIZE = 256

/**
 * Turns a picked photo into a square 256 px avatar. Drawing it onto a canvas and re-encoding drops
 * every bit of EXIF data, including GPS location. JPEG rather than WebP: iPhone Safari can't encode
 * WebP from a canvas.
 */
export async function photoToAvatar(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  // Center crop to a square.
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read that photo."))), 'image/jpeg', 0.85),
  )
}
