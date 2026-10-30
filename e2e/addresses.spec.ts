import { expect, test } from '@playwright/test'
import { openSettings, toStep, tripDetails } from './helpers.ts'

test('a trip’s details have their own address: reload keeps them open, Back closes them', async ({ page, isMobile }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await toStep(dialog, 'Route')
  await dialog.getByRole('combobox', { name: /^Add (a|another) destination$/ }).fill('moab')
  await dialog.getByRole('option', { name: /^Moab/ }).first().click()
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()

  // The pin card on a phone; wider, the place's trips in the Trips panel (Trips › Moab).
  const card = page.getByRole('region', { name: 'Moab trips' })
  await card.getByRole('button', { name: /^Details of Moab/ }).click()
  const detail = tripDetails(page, /^Moab( \d{4})?$/)
  await expect(detail).toBeVisible()
  await expect(page).toHaveURL(isMobile ? /#\/trips\/[^/]+$/ : /#\/trips\/at\/[^/]+\/[^/]+$/)
  if (!isMobile) await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveText(/^Trips\s*›\s*Moab\s*›\s*Moab/)

  const address = page.url()
  await page.reload()
  await expect(detail).toBeVisible()
  await page.goBack()
  await expect(detail).toBeHidden()
  await expect(card).toBeVisible()

  // Opened straight from its address, closing it goes up a level.
  await page.goto(address)
  await expect(detail).toBeVisible()
  if (isMobile) {
    await detail.getByRole('button', { name: 'Close' }).click()
    await expect(page).toHaveURL(/#\/trips$/)
  } else {
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Moab' }).click()
    await expect(page).toHaveURL(/#\/trips\/at\/[^/]+$/)
    await expect(card).toBeVisible()
  }
  await expect(detail).toBeHidden()
})

test('wider screens: Trips is a panel over the map that hides for the full map', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Phones get the Trips sheet in a later step')
  await page.goto('./#/trips')
  const panel = page.getByRole('complementary', { name: 'Trips panel' })
  await expect(panel.getByRole('searchbox', { name: 'Search trips' })).toBeVisible()
  await expect(page.locator('[data-testid="map"] canvas')).toBeVisible()
  await panel.getByRole('button', { name: 'Hide trips' }).click()
  await expect(panel).toBeHidden()
  await expect(page).toHaveURL(/#\/$/)
  await page.getByRole('link', { name: 'Show trips' }).click()
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
