import { expect, test, type Page } from '@playwright/test'

async function choosePlace(page: Page, field: string | RegExp, query: string, option: RegExp) {
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
  // The main destination is slotted into the route where it adds the least distance.
  await expect(card.getByRole('list', { name: 'Route' }).getByRole('listitem')).toHaveText([/Zion National Park/, /1\s*Springdale/, /2\s*Las Vegas/])
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
  await expect(card.getByRole('radio')).toHaveText([/2024\s*Moab 2024/, /2019\s*Moab 2019/])
})

test('picking a stacked date shows that trip’s route, and details show other visits', async ({ page }) => {
  await page.goto('./')
  const trips: [string, [string, RegExp][]][] = [
    ['2019', [['Green River, UT', /^Green River\s*UT$/]]],
    ['2024', [['Monticello, UT', /^Monticello\s*UT$/], ['Blanding', /^Blanding\s*UT$/]]],
  ]
  for (const [year, stops] of trips) {
    await page.getByRole('button', { name: 'Add trip' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add trip' })
    await choosePlace(page, 'Main destination', 'moab', /^Moab/)
    for (const [q, o] of stops) await choosePlace(page, /^Add (a|another) stop$/, q, o)
    await dialog.getByRole('radio', { name: 'Year' }).first().click()
    const yearInput = dialog.getByRole('textbox', { name: 'Start year' })
    await yearInput.fill(year)
    await yearInput.press('Enter')
    await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
    await expect(dialog).toBeHidden()
    if (year === '2019') await page.getByRole('region', { name: 'Moab trips' }).getByRole('button', { name: 'Close' }).click()
  }

  const card = page.getByRole('region', { name: 'Moab trips' })
  const route = card.getByRole('list', { name: 'Route' })
  await expect(card.getByRole('radio', { name: /2024/ })).toBeChecked()
  await expect(route).toContainText('Monticello')
  await expect(route).toContainText('Blanding')

  await card.getByRole('radio', { name: /2019/ }).click()
  await expect(route).toContainText('Green River')
  await expect(route).not.toContainText('Blanding')

  await card.getByRole('button', { name: 'Details' }).click()
  const detail = page.getByRole('dialog', { name: 'Moab 2019' })
  await expect(detail.getByText('Main destination')).toBeVisible()
  await detail.getByRole('button', { name: '2024' }).click()
  await expect(page.getByRole('dialog', { name: 'Moab 2024' })).toBeVisible()
})
