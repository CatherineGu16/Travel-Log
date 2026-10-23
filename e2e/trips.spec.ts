import { expect, test, type Page } from '@playwright/test'

async function choosePlace(page: Page, field: string, query: string, option: RegExp) {
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: field }).fill(query)
  await dialog.getByRole('option', { name: option }).first().click()
}

test('log a multi-stop family trip, see it on the map, and it survives a reload', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('[data-testid="map"] canvas')).toBeVisible()
  await expect(page.getByText('0 / 50 states')).toBeVisible()

  await page.getByRole('button', { name: 'Add trip' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await choosePlace(page, 'Main destination', 'zion', /Zion National Park/)
  await choosePlace(page, 'Add a stop', 'Springdale, UT', /^Springdale\s*UT$/)
  await choosePlace(page, 'Add another stop', 'Las Vegas', /^Las Vegas\s*NV$/)

  // A new person added to Family turns on the Family switch.
  await dialog.getByRole('searchbox', { name: 'Add a person' }).fill('Mom')
  await dialog.getByRole('checkbox', { name: 'Family' }).check()
  await dialog.getByRole('button', { name: 'Add “Mom”' }).click()
  await expect(dialog.getByRole('switch')).toBeChecked()

  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()

  const card = page.getByRole('region', { name: 'Zion National Park trips' })
  await expect(card).toBeVisible()
  await expect(card.getByText('Stops: Springdale → Las Vegas')).toBeVisible()
  await expect(card.getByText('Family')).toBeVisible()
  await expect(page.getByText('2 / 50 states')).toBeVisible()
  await expect(page.getByText(/^1\s*\/ 64 parks$/)).toBeVisible()

  // Everything is still there after a reload.
  await page.reload()
  await expect(page.getByText('2 / 50 states')).toBeVisible()
  await expect(page.getByText(/^1\s*\/ 64 parks$/)).toBeVisible()
  await page.getByRole('button', { name: 'People & groups' }).click()
  await expect(page.getByRole('dialog').getByText('Mom')).toHaveCount(2) // in People and in the Family group
})

test('a second trip to the same place stacks on its pin', async ({ page }) => {
  await page.goto('./')
  for (const year of ['2019', '2024']) {
    await page.getByRole('button', { name: 'Add trip' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add trip' })
    await choosePlace(page, 'Main destination', 'moab', /^Moab/)
    await dialog.getByRole('radio', { name: 'Year' }).first().click()
    const yearInput = dialog.getByRole('textbox', { name: 'Start year' })
    await yearInput.fill(year)
    await yearInput.press('Enter')
    await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
    await expect(dialog).toBeHidden()
    if (year === '2019') await page.getByRole('region', { name: 'Moab trips' }).getByRole('button', { name: 'Close' }).click()
  }
  const card = page.getByRole('region', { name: 'Moab trips' })
  await expect(card.getByText('2 visits')).toBeVisible()
  await expect(card.getByRole('heading', { level: 3 })).toHaveText(['Moab 2024', 'Moab 2019'])
})
