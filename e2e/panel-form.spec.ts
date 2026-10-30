import { expect, test } from '@playwright/test'
import { openAddTrip, openYou, toStep } from './helpers.ts'

test('wider screens: Add trip opens the form in the Trips panel, which stays while you shape a leg', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Phones keep the full-screen form')
  await page.goto('./')
  // Add trip in the toolbar opens the form in the Trips panel.
  const panel = page.getByRole('complementary', { name: 'Trips panel' })
  await page.locator('header').getByRole('button', { name: 'Add trip' }).click()
  const form = panel.getByRole('region', { name: 'Add trip', exact: true })
  await expect(form).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(panel.getByRole('navigation', { name: 'Breadcrumb' })).toHaveText(/Trips\s*›\s*Add trip/)
  // While it's open the panel can't be hidden.
  await expect(panel.getByRole('button', { name: 'Hide trips' })).toHaveCount(0)

  await toStep(form, 'Route')
  for (const [q, o] of [['zion', /Zion National Park/], ['Las Vegas', /^Las Vegas\s*NV$/]] as const) {
    await form.getByRole('combobox', { name: /^Add (a|another) destination$/ }).fill(q)
    await form.getByRole('option', { name: o }).first().click()
  }
  await form.getByRole('button', { name: /^Shape the route from Zion/ }).click()
  const banner = page.getByRole('region', { name: 'Shape the route' })
  await expect(banner).toBeVisible()
  await expect(form).toBeVisible()
  const map = page.locator('[data-testid="map"] canvas')
  const box = (await map.boundingBox())!
  await map.click({ position: { x: box.width * 0.7, y: box.height * 0.5 } })
  await banner.getByRole('button', { name: 'Done' }).click()
  await expect(form.getByRole('button', { name: /^Shape the route from Zion/ })).toHaveText('Bends 1× · Edit')

  // Going to You and back keeps what you entered; Escape closes the form.
  await openYou(page)
  await page.getByRole('link', { name: 'Map' }).click()
  await expect(form.getByText('Zion National Park', { exact: true })).toBeVisible()
  await form.getByText('Where you went').click()
  await page.keyboard.press('Escape')
  await expect(form).toBeHidden()
  await expect(panel.getByRole('searchbox', { name: 'Search trips' })).toBeVisible()
})

test('Add trip from the You page opens the form over the map', async ({ page }) => {
  await page.goto('./#/you')
  const form = await openAddTrip(page)
  await expect(form).toBeVisible()
})
