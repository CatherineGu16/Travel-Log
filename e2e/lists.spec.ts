import { expect, test, type Page } from '@playwright/test'

/** The trip form's place search: "Add a destination", then "Add another destination". */
const DEST = /^Add (a|another) destination$/

async function addTrip(page: Page, opts: { main: [string, RegExp]; year: string; stops?: [string, RegExp][]; family?: string; type?: 'Family' | 'Friends' | 'Work' }) {
  await page.getByRole('button', { name: 'Add trip' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await dialog.getByRole('combobox', { name: DEST }).fill(opts.main[0])
  await dialog.getByRole('option', { name: opts.main[1] }).first().click()
  for (const [q, o] of opts.stops ?? []) {
    await dialog.getByRole('combobox', { name: DEST }).fill(q)
    await dialog.getByRole('option', { name: o }).first().click()
  }
  if (opts.family) {
    const who = dialog.getByRole('searchbox', { name: 'Add a person' })
    await who.fill(opts.family)
    const existing = dialog.getByRole('button', { name: opts.family, exact: true })
    if (await existing.count()) await existing.click()
    else {
      await dialog.getByRole('checkbox', { name: 'Family' }).check()
      await dialog.getByRole('button', { name: `Add “${opts.family}”` }).click()
    }
  }
  if (opts.type) await dialog.getByRole('radiogroup', { name: 'Type of trip' }).getByRole('radio', { name: opts.type }).click()
  await dialog.getByRole('radio', { name: 'Year' }).first().click()
  const year = dialog.getByRole('textbox', { name: 'Start year' })
  await year.fill(opts.year)
  await year.press('Enter')
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()
  const card = page.getByRole('region', { name: /trips$/ })
  if (await card.count()) await card.getByRole('button', { name: 'Close' }).click()
}

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name }).filter({ visible: true }).click()

test('trips list: search, group, filter by trip type, and open a trip on the map', async ({ page }) => {
  await page.goto('./')
  await addTrip(page, { main: ['moab', /^Moab/], year: '2019', family: 'Mom' })
  await addTrip(page, { main: ['chicago', /^Chicago/], year: '2022' })
  await addTrip(page, { main: ['moab', /^Moab/], year: '2024', stops: [['Green River, UT', /^Green River\s*UT$/]], type: 'Friends' })

  await nav(page, 'Trips')
  await expect(page.getByRole('heading', { name: 'Trips', level: 1 })).toBeVisible()
  await expect(page.getByRole('region', { name: '2024' }).getByRole('button')).toHaveText([/Moab 2024/])
  await expect(page.getByRole('region', { name: '2019' }).getByRole('button')).toHaveText([/Moab 2019.*Family/])

  await page.getByRole('searchbox', { name: 'Search trips' }).fill('mom')
  await expect(page.getByRole('main').getByRole('button', { name: /Moab|Chicago/ })).toHaveText([/Moab 2019/])
  await page.getByRole('searchbox', { name: 'Search trips' }).fill('')

  await page.getByRole('combobox', { name: 'Group by' }).selectOption('state')
  await expect(page.getByRole('region', { name: 'Utah' }).getByRole('button')).toHaveCount(2)
  await expect(page.getByRole('region', { name: 'Illinois' }).getByRole('button')).toHaveCount(1)

  // The trip-type filter applies to the list and the map, and is remembered.
  await page.getByRole('button', { name: 'Filter' }).first().click()
  await page.getByRole('dialog', { name: 'Filter trips' }).getByRole('radio', { name: 'Friends' }).click()
  await page.getByRole('dialog', { name: 'Filter trips' }).getByRole('button', { name: 'Show 1 trip' }).click()
  await expect(page.getByRole('main').getByRole('button', { name: /Moab|Chicago/ })).toHaveText([/Moab 2024.*Friends/])
  await page.reload()
  await expect(page.getByRole('button', { name: 'Filter, 1 on' }).first()).toBeVisible()

  // Opening a trip goes to the map with its pin selected and route drawn.
  await page.getByRole('button', { name: /Moab 2024/ }).click()
  const card = page.getByRole('region', { name: 'Moab trips' })
  await expect(card).toBeVisible()
  await expect(card.getByRole('list', { name: 'Route' })).toContainText('Green River')
  // With the filter on, only the Friends visit is on the pin.
  await expect(card.getByText('1 visit')).toBeVisible()
})

test('places list shows every place with its visits stacked', async ({ page }) => {
  await page.goto('./')
  await addTrip(page, { main: ['moab', /^Moab/], year: '2019' })
  await addTrip(page, { main: ['arches', /Arches National Park/], year: '2023', stops: [['moab', /^Moab/]] })

  await nav(page, 'Places')
  const moab = page.getByRole('list', { name: 'Visits to Moab' })
  await expect(moab.getByRole('button')).toHaveText([/2023\s*Arches 2023/, /2019\s*Moab 2019/])
  await page.getByRole('combobox', { name: 'Order' }).selectOption('state')
  await expect(page.getByRole('region', { name: 'Utah' })).toBeVisible()

  await moab.getByRole('button', { name: /Arches 2023/ }).click()
  await expect(page.getByRole('region', { name: 'Arches National Park trips' })).toBeVisible()
})
