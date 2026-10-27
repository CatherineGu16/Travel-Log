import { expect, test } from '@playwright/test'

test('the outline map loads with only bundled data, and the globe toggle and US button work', async ({ page }) => {
  const outside: string[] = []
  page.on('request', (r) => {
    const url = new URL(r.url())
    if (url.hostname !== 'localhost') outside.push(r.url())
  })

  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Travel Log' })).toBeVisible()
  await expect(page.getByText('/ 64 parks')).toBeVisible()
  await expect(page.locator('[data-testid="map"] canvas')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible()

  // The globe is a toggle, remembered on this device.
  const globe = page.getByRole('button', { name: 'Globe view' })
  await expect(globe).toHaveAttribute('aria-pressed', 'false')
  await globe.click()
  await expect(globe).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(globe).toHaveAttribute('aria-pressed', 'true')
  await globe.click()
  await expect(globe).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Reset to US' }).click()
  await page.getByRole('button', { name: 'Zoom in' }).click()

  // Outline mode is the default: nothing may be fetched from outside the app.
  expect(outside).toEqual([])
})
