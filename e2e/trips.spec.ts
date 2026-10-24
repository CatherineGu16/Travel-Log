import { expect, test, type Page } from '@playwright/test'
import { dateRange, pickDays, setTripYear } from './helpers.ts'

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

  // A new person, added to the Family group on the spot.
  await dialog.getByRole('searchbox', { name: 'Add a person' }).fill('Mom')
  await dialog.getByRole('checkbox', { name: 'Family' }).check()
  await dialog.getByRole('button', { name: 'Add “Mom”' }).click()

  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()

  const card = page.getByRole('region', { name: 'Zion National Park trips' })
  await expect(card).toBeVisible()
  // The route follows the destinations in the order they were added.
  await expect(card.getByRole('list', { name: 'Route' }).getByRole('listitem')).toHaveText([/Zion National Park/, /1\s*Springdale/, /2\s*Las Vegas/])
  await expect(card.getByText('Mom')).toBeAttached()
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
    await setTripYear(dialog, year)
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
    await setTripYear(dialog, year)
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
    await pickDays(row, `Dates at ${name}`, from, to)
  }
  await expect(dateRange(dialog, 'Trip dates')).toContainText('May 1 – 6, 2024')

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

test('trip dates are a range picker: tap the first day, then the last', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  const range = dialog.getByRole('group', { name: /^Trip dates/ })
  await expect(range.getByRole('radiogroup', { name: 'Trip dates precision' }).getByRole('radio')).toHaveText(['Date', 'Month', 'Year'])

  await range.getByRole('combobox', { name: 'Trip dates calendar month' }).selectOption('7')
  await range.getByRole('combobox', { name: 'Trip dates calendar year' }).selectOption('2023')
  await range.getByRole('button', { name: 'July 4, 2023' }).click()
  await range.getByRole('button', { name: 'July 9, 2023' }).click()
  await expect(range).toContainText('Jul 4 – 9, 2023')
  await expect(range.getByRole('button', { name: 'July 6, 2023' })).toHaveAttribute('aria-pressed', 'true')
  await expect(range.getByRole('button', { name: 'July 10, 2023' })).toHaveAttribute('aria-pressed', 'false')

  // Month precision keeps the range as months.
  await range.getByRole('radio', { name: 'Month' }).click()
  await expect(range).toContainText('Jul 2023')
})

test('Friends can be added as one tag, without listing anyone', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await choosePlace(page, DEST, 'chicago', /^Chicago/)
  await dialog.getByRole('group', { name: 'Add a group' }).getByRole('button', { name: '+ Friends' }).click()
  await expect(dialog.getByRole('list', { name: 'Who went' })).toContainText('Friends')
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()

  const card = page.getByRole('region', { name: 'Chicago trips' })
  await expect(card).toContainText('Friends')
})

test('+ Family tags Family and adds each family member; removing the tag removes them', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'People & groups' }).click()
  const people = page.getByRole('dialog', { name: 'People & groups' })
  for (const name of ['Mom', 'Dad']) {
    await people.getByRole('button', { name: '+ Add person' }).click()
    const editor = page.getByRole('dialog', { name: 'Add person' })
    await editor.getByRole('textbox', { name: 'Name' }).fill(name)
    await editor.getByRole('checkbox', { name: 'Family' }).check()
    await editor.getByRole('button', { name: 'Save' }).click()
  }
  await page.getByRole('dialog', { name: 'People & groups' }).getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await dialog.getByRole('group', { name: 'Add a group' }).getByRole('button', { name: '+ Family' }).click()
  const who = dialog.getByRole('list', { name: 'Who went' })
  await expect(who.getByRole('listitem')).toHaveText([/Family/, /Mom/, /Dad/])

  // Someone didn't come: drop just them.
  await who.getByRole('button', { name: 'Remove Dad' }).click()
  await expect(who.getByRole('listitem')).toHaveText([/Family/, /Mom/])

  // Removing the tag removes the family members it added.
  await who.getByRole('button', { name: 'Remove Family' }).click()
  await expect(who).toBeHidden()
})

test('shaping the route between two places bends the dotted line through your taps', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await choosePlace(page, DEST, 'zion', /Zion National Park/)
  await choosePlace(page, DEST, 'Las Vegas', /^Las Vegas\s*NV$/)
  await expect(dialog.getByRole('button', { name: 'Pick on map' })).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Shape the route from Zion National Park to Las Vegas on the map' }).click()
  await expect(dialog).toBeHidden()
  const banner = page.getByRole('region', { name: 'Shape the route' })
  await expect(banner).toContainText('Zion National Park')
  const map = page.locator('[data-testid="map"] canvas')
  const box = (await map.boundingBox())!
  await map.click({ position: { x: box.width / 2, y: box.height * 0.6 } })
  await map.click({ position: { x: box.width / 2 + 30, y: box.height * 0.65 } })
  await banner.getByRole('button', { name: 'Undo' }).click()
  await banner.getByRole('button', { name: 'Done' }).click()

  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: /^Shape the route from Zion/ })).toHaveText('Route bends once · Edit')
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()

  // Saved with the trip.
  await page.getByRole('region', { name: 'Zion National Park trips' }).getByRole('button', { name: /^Edit/ }).click()
  const edit = page.getByRole('dialog', { name: 'Edit trip' })
  await expect(edit.getByRole('button', { name: /^Shape the route from Zion/ })).toHaveText('Route bends once · Edit')
  await edit.getByRole('button', { name: 'Straighten' }).click()
  await expect(edit.getByRole('button', { name: /^Shape the route from Zion/ })).toHaveText('Shape the route on the map')
})
