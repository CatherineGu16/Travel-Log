import { expect, test } from '@playwright/test'

test('the outline map loads with only bundled data, and the globe and US buttons work', async ({ page }) => {
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

  await page.getByRole('button', { name: 'Show the whole globe' }).click()
  await page.getByRole('button', { name: 'Reset to US' }).click()
  await page.getByRole('button', { name: 'Zoom in' }).click()

  // Outline mode is the default: nothing may be fetched from outside the app.
  expect(outside).toEqual([])
})
