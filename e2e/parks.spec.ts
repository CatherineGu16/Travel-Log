import { expect, test, type Page } from '@playwright/test'
import { openYou, setTripYear, toStep } from './helpers.ts'

/** The trip form's place search: "Add a destination", then "Add another destination". */
const DEST = /^Add (a|another) destination$/

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name }).filter({ visible: true }).click()

async function saveYear(page: Page, year: string) {
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await toStep(dialog, 'Details')
  await setTripYear(dialog, year)
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()
}

test('parks checklist: log a visit with hikes, then add more hikes', async ({ page }) => {
  await page.goto('./')
  await nav(page, 'Parks')
  await expect(page.getByText('0 / 64 visited')).toBeVisible()

  // "Log a visit" opens Add trip with the park filled in; hikes are added by name, with suggestions.
  await page.getByRole('listitem', { name: 'Zion' }).getByRole('button', { name: 'Log a visit' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await toStep(dialog, 'Route')
  await expect(dialog.getByText('Zion National Park', { exact: true })).toBeVisible()
  await toStep(dialog, 'Notes')
  await dialog.getByRole('combobox', { name: 'Add a hike in Zion' }).fill('angels')
  await dialog.getByRole('option', { name: /^Angels Landing/ }).click()
  await expect(dialog.getByRole('button', { name: 'Remove Angels Landing' })).toBeVisible()
  await saveYear(page, '2023')

  await nav(page, 'Parks')
  await expect(page.getByText('1 / 64 visited')).toBeVisible()
  const zion = page.getByRole('listitem', { name: 'Zion' })
  await expect(zion.getByLabel('Visited')).toBeVisible()
  await expect(zion).toContainText('1 hike')

  // In the park sheet, a hike you add goes on your (only) visit: an NPS suggestion, or your own.
  await zion.getByRole('button', { name: /Zion/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Zion National Park' })
  const done = sheet.getByRole('region', { name: 'Hikes' })
  await expect(done.getByText('Angels Landing', { exact: true })).toBeVisible()
  const add = sheet.getByRole('combobox', { name: 'Add a hike' })
  await add.fill('narr')
  await sheet.getByRole('option', { name: /^The Narrows/ }).click()
  await add.fill('Secret slot canyon')
  await sheet.getByRole('option', { name: 'Add “Secret slot canyon”' }).click()
  await expect(done.getByText('Secret slot canyon', { exact: true })).toBeVisible()
  await expect(done.getByText('The Narrows', { exact: true })).toBeVisible()
  // What you've done isn't suggested again.
  await add.fill('angels')
  await expect(sheet.getByRole('option', { name: /^Angels Landing/ })).toHaveCount(0)
  await add.fill('')
  await done.getByRole('button', { name: 'Remove The Narrows' }).click()
  await expect(done.getByText('The Narrows', { exact: true })).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Close' }).click()
  await expect(zion).toContainText('2 hikes')

  // The map's parks layer shows your progress.
  await nav(page, 'Map')
  await page.getByRole('button', { name: 'Parks', exact: true }).click()
  const layer = page.getByRole('dialog', { name: 'National parks layer' })
  await expect(layer).toContainText('1 / 64 national parks visited')
  await layer.getByRole('radio', { name: 'Visited', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Parks', exact: true })).toBeVisible()
})

test('a town inside a park offers to link the trip to the park', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add trip' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await toStep(dialog, 'Route')
  await dialog.getByRole('combobox', { name: DEST }).fill('Yosemite Valley')
  await dialog.getByRole('option', { name: /^Yosemite Valley\s*CA$/ }).click()
  await expect(dialog.getByRole('status')).toContainText('inside Yosemite National Park')
  await dialog.getByRole('button', { name: 'Link to park' }).click()
  await expect(dialog.getByText('Yosemite National Park', { exact: true })).toBeVisible()
  await toStep(dialog, 'Notes')
  await expect(dialog.getByRole('region', { name: 'Hikes' })).toBeVisible()
  await saveYear(page, '2022')
  await expect(page.getByRole('region', { name: 'Yosemite National Park trips' })).toBeVisible()
  await openYou(page)
  await expect(page.getByRole('region', { name: 'Your travel in numbers' })).toContainText('1 / 64National parks')
})
