import { expect, test } from '@playwright/test'
import { openSettings, toStep, tripDetails } from './helpers.ts'

test('a trip’s details have their own address: reload keeps them open, Back closes them', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await toStep(dialog, 'Route')
  await dialog.getByRole('combobox', { name: /^Add (a|another) destination$/ }).fill('moab')
  await dialog.getByRole('option', { name: /^Moab/ }).first().click()
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()

  // After saving, the place's trips are open over the map (Trips › Moab).
  const card = page.getByRole('region', { name: 'Moab trips' })
  await card.getByRole('button', { name: /^Details of Moab/ }).click()
  const detail = tripDetails(page, /^Moab( \d{4})?$/)
  await expect(detail).toBeVisible()
  await expect(page).toHaveURL(/#\/trips\/at\/[^/]+\/[^/]+$/)
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveText(/^Trips\s*›\s*Moab\s*›\s*Moab/)

  const address = page.url()
  await page.reload()
  await expect(detail).toBeVisible()
  await page.goBack()
  await expect(detail).toBeHidden()
  await expect(card).toBeVisible()

  // Opened straight from its address, the breadcrumb goes up a level.
  await page.goto(address)
  await expect(detail).toBeVisible()
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Moab' }).click()
  await expect(page).toHaveURL(/#\/trips\/at\/[^/]+$/)
  await expect(card).toBeVisible()
  await expect(detail).toBeHidden()
})

test('phones: Trips is a sheet over the map, peeking until you tap or drag it up', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Wider screens have the Trips panel')
  await page.goto('./')
  const sheet = page.getByRole('complementary', { name: 'Trips panel' })
  // There's no Trips tab: Trips is on the map.
  await expect(page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Trips' })).toHaveCount(0)
  const peeking = (await sheet.boundingBox())!.height
  expect(peeking).toBeLessThan(100)

  // Tap the handle: half (the list, at its own address), then nearly full, then back to peeking.
  await sheet.getByRole('button', { name: 'Expand trips' }).click()
  await expect(page).toHaveURL(/#\/trips$/)
  await expect(sheet.getByRole('searchbox', { name: 'Search trips' })).toBeVisible()
  await sheet.getByRole('button', { name: 'Expand trips' }).click()
  await expect.poll(async () => (await sheet.boundingBox())!.height).toBeGreaterThan(page.viewportSize()!.height * 0.6)
  await sheet.getByRole('button', { name: 'Shrink trips' }).click()
  await expect(page).toHaveURL(/#\/$/)
  await expect.poll(async () => (await sheet.boundingBox())!.height).toBeLessThan(100)

  // Or drag its top up, slowly: it settles at the nearest height.
  const box = (await sheet.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + 40)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y - 250, { steps: 25 })
  await page.waitForTimeout(300)
  await page.mouse.move(box.x + box.width / 2, box.y - 252, { steps: 2 })
  await page.mouse.up()
  await expect(sheet.getByRole('searchbox', { name: 'Search trips' })).toBeVisible()
  await expect(page).toHaveURL(/#\/trips$/)
})

test('wider screens: Trips is a panel over the map that hides for the full map', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Phones have the Trips sheet')
  await page.goto('./#/trips')
  const panel = page.getByRole('complementary', { name: 'Trips panel' })
  await expect(panel.getByRole('searchbox', { name: 'Search trips' })).toBeVisible()
  await expect(page.locator('[data-testid="map"] canvas')).toBeVisible()
  await panel.getByRole('button', { name: 'Hide trips' }).click()
  await expect(panel).toBeHidden()
  await page.getByRole('button', { name: 'Show trips' }).click()
  await expect(panel).toBeVisible()
})

test('the You sections have their own addresses; Back moves between them', async ({ page }) => {
  await page.goto('./')
  const settings = await openSettings(page)
  await expect(settings.getByRole('region', { name: 'Home' })).toBeVisible()
  await expect(page).toHaveURL(/#\/you\/settings$/)
  await page.goBack()
  await expect(settings).toBeHidden()
  await expect(page.getByRole('region', { name: 'Profile' })).toBeVisible()
  await expect(page).toHaveURL(/#\/you$/)

  await page.goto('./#/you/people')
  await expect(page.getByRole('region', { name: 'People & groups' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'You sections' }).getByRole('link', { name: 'People & groups' })).toHaveAttribute('aria-current', 'page')

  await page.goto('./#/you/achievements')
  await expect(page.getByRole('radiogroup', { name: 'Show achievements' })).toBeVisible()
})
