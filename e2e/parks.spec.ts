import { expect, test, type Page } from '@playwright/test'

/** The trip form's place search: "Add a destination", then "Add another destination". */
const DEST = /^Add (a|another) destination$/

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name }).filter({ visible: true }).click()

async function saveYear(page: Page, year: string) {
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await dialog.getByRole('radio', { name: 'Year' }).first().click()
  const input = dialog.getByRole('textbox', { name: 'Start year' })
  await input.fill(year)
  await input.press('Enter')
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()
}

test('parks checklist: log a visit with hikes, then check off more hikes', async ({ page }) => {
  await page.goto('./')
  await nav(page, 'Parks')
  await expect(page.getByText('0 / 64 visited')).toBeVisible()

  // "Log a visit" opens Add trip with the park filled in, and its hikes to check off.
  await page.getByRole('listitem', { name: 'Zion' }).getByRole('button', { name: 'Log a visit' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await expect(dialog.getByText('Zion National Park', { exact: true })).toBeVisible()
  await dialog.getByRole('checkbox', { name: 'Angels Landing' }).check()
  await saveYear(page, '2023')

  await nav(page, 'Parks')
  await expect(page.getByText('1 / 64 visited')).toBeVisible()
  const zion = page.getByRole('listitem', { name: 'Zion' })
  await expect(zion.getByLabel('Visited')).toBeVisible()
  await expect(zion).toContainText('Hikes 1 / 17')

  // In the park sheet, checking a hike adds it to your (only) visit; custom hikes work too.
  await zion.getByRole('button', { name: /Zion/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Zion National Park' })
  await expect(sheet.getByRole('checkbox', { name: 'Angels Landing' })).toBeChecked()
  await sheet.getByRole('checkbox', { name: 'The Narrows' }).check()
  await expect(sheet.getByRole('checkbox', { name: 'The Narrows' })).toBeChecked()
  await sheet.getByRole('textbox', { name: "Add a hike that isn't listed" }).fill('Secret slot canyon')
  await sheet.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(sheet.getByRole('checkbox', { name: 'Secret slot canyon' })).toBeChecked()
  await expect(sheet.getByText('2 / 17')).toBeVisible()
  await sheet.getByRole('button', { name: 'Close' }).click()
  await expect(zion).toContainText('Hikes 2 / 17 +1')

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
  await dialog.getByRole('combobox', { name: DEST }).fill('Yosemite Valley')
  await dialog.getByRole('option', { name: /^Yosemite Valley\s*CA$/ }).click()
  await expect(dialog.getByRole('status')).toContainText('inside Yosemite National Park')
  await dialog.getByRole('button', { name: 'Link to park' }).click()
  await expect(dialog.getByText('Yosemite National Park', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('region', { name: 'Hikes' })).toBeVisible()
  await saveYear(page, '2022')
  await expect(page.getByRole('region', { name: 'Yosemite National Park trips' })).toBeVisible()
  await expect(page.getByText(/^1\s*\/ 64 parks$/).filter({ visible: true })).toHaveCount(1)
})
