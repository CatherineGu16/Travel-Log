import { expect, test } from '@playwright/test'
import { openSettings, toStep } from './helpers.ts'

test('a trip’s details have their own address: reload keeps them open, Back closes them', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await toStep(dialog, 'Route')
  await dialog.getByRole('combobox', { name: /^Add (a|another) destination$/ }).fill('moab')
  await dialog.getByRole('option', { name: /^Moab/ }).first().click()
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()

  const card = page.getByRole('region', { name: 'Moab trips' })
  await card.getByRole('button', { name: /^Details of Moab/ }).click()
  const detail = page.getByRole('dialog', { name: /^Moab/ })
  await expect(detail).toBeVisible()
  await expect(page).toHaveURL(/#\/trips\/[^/]+$/)

  const address = page.url()
  await page.reload()
  await expect(detail).toBeVisible()
  // Opened from the map, closing it goes Back to the map.
  await detail.getByRole('button', { name: 'Close' }).click()
  await expect(detail).toBeHidden()
  await expect(card).toBeVisible()

  // Opened straight from its address, closing it leaves you on Trips.
  await page.goto(address)
  await expect(detail).toBeVisible()
  await detail.getByRole('button', { name: 'Close' }).click()
  await expect(page).toHaveURL(/#\/trips$/)
  await expect(detail).toBeHidden()

  await page.goto('./#/trips')
  await page.getByRole('button', { name: /Moab/ }).first().click()
  await card.getByRole('button', { name: /^Details of Moab/ }).click()
  await expect(detail).toBeVisible()
  await page.goBack()
  await expect(detail).toBeHidden()
  await expect(card).toBeVisible()
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
