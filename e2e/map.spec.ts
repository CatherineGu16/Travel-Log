import { expect, test } from '@playwright/test'

test('the outline map loads with only bundled data, and the globe toggle and US button work', async ({ page }) => {
  const outside: string[] = []
  page.on('request', (r) => {
    const url = new URL(r.url())
    if (url.hostname !== 'localhost') outside.push(r.url())
  })

  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Travel Log' })).toBeVisible()
  // The header is just the title and pages; your numbers are on the You page.
  await expect(page.getByText(/\/ 64 parks/)).toHaveCount(0)
  await expect(page.locator('[data-testid="map"] canvas')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible()

  // The globe is a toggle, remembered on this device.
  const globe = page.getByRole('button', { name: 'Globe view' })
  await expect(globe).toHaveAttribute('aria-pressed', 'false')
  await globe.click()
  await expect(globe).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  // The map's buttons show once it has loaded, which can take a while with every test running at once.
  await expect(globe).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 })
  await globe.click()
  await expect(globe).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Reset to US' }).click()
  await page.getByRole('button', { name: 'Zoom in' }).click()

  // Outline mode is the default: nothing may be fetched from outside the app.
  expect(outside).toEqual([])
})
