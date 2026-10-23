import { expect, test, type Page } from '@playwright/test'

/** The trip form's place search: "Add a destination", then "Add another destination". */
const DEST = /^Add (a|another) destination$/

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
  await choosePlace(page, DEST, 'zion', /Zion National Park/)
  await choosePlace(page, DEST, 'Springdale, UT', /^Springdale\s*UT$/)
  await choosePlace(page, DEST, 'Las Vegas', /^Las Vegas\s*NV$/)

  // A new person added to Family makes it a Family trip.
  await dialog.getByRole('searchbox', { name: 'Add a person' }).fill('Mom')
  await dialog.getByRole('checkbox', { name: 'Family' }).check()
  await dialog.getByRole('button', { name: 'Add “Mom”' }).click()
  await expect(dialog.getByRole('radiogroup', { name: 'Type of trip' }).getByRole('radio', { name: 'Family' })).toBeChecked()

  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()

  const card = page.getByRole('region', { name: 'Zion National Park trips' })
  await expect(card).toBeVisible()
  // The route follows the destinations in the order they were added.
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
    await choosePlace(page, DEST, 'moab', /^Moab/)
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
    await choosePlace(page, DEST, 'moab', /^Moab/)
    for (const [q, o] of stops) await choosePlace(page, DEST, q, o)
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

test('a trip with two main destinations, each with its own dates', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await choosePlace(page, DEST, 'zion', /Zion National Park/)
  await choosePlace(page, DEST, 'Las Vegas', /^Las Vegas\s*NV$/)

  // Las Vegas becomes a second main destination (its own pin).
  await dialog.getByRole('button', { name: 'Make Las Vegas a main destination' }).click()
  await expect(dialog.getByRole('button', { name: 'Las Vegas is a main destination' })).toHaveAttribute('aria-pressed', 'true')

  // Three days in each place; the trip's own dates fill in from them.
  for (const [name, from, to] of [
    ['Zion National Park', '2024-05-01', '2024-05-03'],
    ['Las Vegas', '2024-05-04', '2024-05-06'],
  ]) {
    const row = dialog.getByRole('listitem', { name })
    await row.getByRole('button', { name: /Add dates/ }).click()
    await row.getByRole('checkbox', { name: 'I know when I was here' }).check()
    await row.getByLabel('Arrived', { exact: true }).fill(from)
    await row.getByLabel('Left', { exact: true }).fill(to)
  }
  await expect(dialog.getByLabel('Start', { exact: true })).toHaveValue('2024-05-01')
  await expect(dialog.getByLabel('End', { exact: true })).toHaveValue('2024-05-06')

  await dialog.getByRole('button', { name: /Road trip/ }).click()
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()

  // The parks checklist shows the days at Zion, not the whole trip.
  await page.goto('./#/parks')
  await expect(page.getByRole('listitem', { name: 'Zion' })).toContainText('May 1 – 3, 2024')

  await page.goto('./#/trips')
  const row = page.getByRole('button', { name: /Zion & Las Vegas 2024/ })
  await expect(row).toContainText('Zion National Park & Las Vegas')
  await expect(row).toContainText('Road trip')
})

test('start and end dates offer only date, month or year', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  for (const label of ['Start', 'End'])
    await expect(dialog.getByRole('radiogroup', { name: `${label} precision` }).getByRole('radio')).toHaveText(['Date', 'Month', 'Year'])
})
