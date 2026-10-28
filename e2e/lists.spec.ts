import { expect, test, type Page } from '@playwright/test'
import { setTripYear, toStep } from './helpers.ts'

/** The trip form's place search: "Add a destination", then "Add another destination". */
const DEST = /^Add (a|another) destination$/

async function addTrip(page: Page, opts: { main: [string, RegExp]; year: string; stops?: [string, RegExp][]; family?: string; friend?: string }) {
  await page.getByRole('button', { name: 'Add trip' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await toStep(dialog, 'Route')
  await dialog.getByRole('combobox', { name: DEST }).fill(opts.main[0])
  await dialog.getByRole('option', { name: opts.main[1] }).first().click()
  for (const [q, o] of opts.stops ?? []) {
    await dialog.getByRole('combobox', { name: DEST }).fill(q)
    await dialog.getByRole('option', { name: o }).first().click()
  }
  await toStep(dialog, 'Details')
  // Someone new is added in their group; someone you've added before is just marked as going.
  for (const [name, group] of [
    [opts.family, 'Family'],
    [opts.friend, 'Friends'],
  ] as const) {
    if (!name) continue
    const who = dialog.getByRole('searchbox', { name: 'Add a person' })
    await who.fill(name)
    const existing = dialog.getByRole('button', { name, exact: true })
    if (await existing.count()) await existing.click()
    else {
      await dialog.getByRole('checkbox', { name: group }).check()
      await dialog.getByRole('button', { name: `Add “${name}”` }).click()
    }
    await who.fill('')
  }
  await setTripYear(dialog, opts.year)
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()
  const card = page.getByRole('region', { name: /trips$/ })
  if (await card.count()) await card.getByRole('button', { name: 'Close' }).click()
}

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name }).filter({ visible: true }).click()

test('trips list: search, group, filter by who went, and open a trip on the map', async ({ page }) => {
  await page.goto('./')
  await addTrip(page, { main: ['moab', /^Moab/], year: '2019', family: 'Mom' })
  await addTrip(page, { main: ['chicago', /^Chicago/], year: '2022' })
  await addTrip(page, { main: ['moab', /^Moab/], year: '2024', stops: [['Green River, UT', /^Green River\s*UT$/]], friend: 'Sam' })

  await nav(page, 'Trips')
  await expect(page.getByRole('heading', { name: 'Trips', level: 1 })).toBeVisible()
  await expect(page.getByRole('region', { name: '2024' }).getByRole('button')).toHaveText([/Moab 2024/])
  await expect(page.getByRole('region', { name: '2019' }).getByRole('button')).toHaveText([/Moab 2019/])

  await page.getByRole('searchbox', { name: 'Search trips' }).fill('mom')
  await expect(page.getByRole('main').getByRole('button', { name: /Moab|Chicago/ })).toHaveText([/Moab 2019/])
  await page.getByRole('searchbox', { name: 'Search trips' }).fill('')

  await page.getByRole('combobox', { name: 'Group by' }).selectOption('state')
  await expect(page.getByRole('region', { name: 'Utah' }).getByRole('button')).toHaveCount(2)
  await expect(page.getByRole('region', { name: 'Illinois' }).getByRole('button')).toHaveCount(1)

  // Filtering by a group applies to the list and the map, and is remembered.
  await page.getByRole('button', { name: 'Filter' }).first().click()
  await page.getByRole('dialog', { name: 'Filter trips' }).getByRole('button', { name: 'Friends' }).click()
  await page.getByRole('dialog', { name: 'Filter trips' }).getByRole('button', { name: 'Show 1 trip' }).click()
  await expect(page.getByRole('main').getByRole('button', { name: /Moab|Chicago/ })).toHaveText([/Moab 2024/])
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

test('places list shows main destinations; opening one shows its trips on the map', async ({ page }) => {
  await page.goto('./')
  await addTrip(page, { main: ['moab', /^Moab/], year: '2019' })
  await addTrip(page, { main: ['moab', /^Moab/], year: '2021' })
  await addTrip(page, { main: ['arches', /Arches National Park/], year: '2023', stops: [['Green River, UT', /^Green River\s*UT$/]] })

  await nav(page, 'Places')
  // Stops along the way (Green River) aren't listed; no trip chips, just how many visits.
  const list = page.getByRole('main').getByRole('listitem')
  await expect(list).toHaveText([/Arches National Park/, /Moab.*2 visits/])
  await page.getByRole('combobox', { name: 'Order' }).selectOption('state')
  await expect(page.getByRole('region', { name: 'Utah' })).toBeVisible()

  // Opening a place selects its pin on the map, newest visit first; the other is a tap away.
  await page.getByRole('button', { name: /^Moab/ }).click()
  const card = page.getByRole('region', { name: 'Moab trips' })
  await expect(card).toContainText('2 visits')
  const visits = card.getByRole('radiogroup', { name: 'Visits' })
  await expect(visits.getByRole('radio', { checked: true })).toHaveText(/2021/)
  await visits.getByRole('radio', { name: /2019/ }).click()
  await expect(visits.getByRole('radio', { checked: true })).toHaveText(/2019/)
  await expect(card.getByRole('heading', { name: 'Moab 2019' })).toBeVisible()
})
