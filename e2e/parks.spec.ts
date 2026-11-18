import { expect, test, type Page } from '@playwright/test'
import { openAddTrip, openParks, openYou, saveNewTrip, setTripYear, toStep, tripDetails, tripForm } from './helpers.ts'

/** The trip form's place search: "Add a destination", then "Add another destination". */
const DEST = /^Add (a|another) destination$/

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name }).filter({ visible: true }).click()

async function saveYear(page: Page, year: string) {
  const dialog = tripForm(page, 'Add trip')
  await toStep(dialog, 'Details')
  await setTripYear(dialog, year)
  await saveNewTrip(dialog)
  await expect(dialog).toBeHidden()
}

test('park badges: log a visit with hikes, then add more hikes', async ({ page }) => {
  await page.goto('./')
  await openParks(page)
  await expect(page.getByText('0 / 64 visited')).toBeVisible()
  // Every park is a badge, outlined (not visited) until you've been.
  const grid = page.getByRole('region', { name: 'National parks' })
  await expect(grid.getByRole('button', { name: /, not visited$/ })).toHaveCount(64)

  // A badge opens the park; its "Log a visit" opens Add trip with the park filled in. Hikes are
  // added by name, with suggestions.
  await page.getByRole('listitem', { name: 'Zion' }).getByRole('button', { name: 'Zion, not visited' }).click()
  await page.getByRole('dialog', { name: 'Zion National Park' }).getByRole('button', { name: 'Log a visit' }).first().click()
  const dialog = tripForm(page, 'Add trip')
  await toStep(dialog, 'Route')
  await expect(dialog.getByText('Zion National Park', { exact: true })).toBeVisible()
  await toStep(dialog, 'Notes')
  await dialog.getByRole('combobox', { name: 'Add a hike in Zion' }).fill('angels')
  await dialog.getByRole('option', { name: /^Angels Landing/ }).click()
  await expect(dialog.getByRole('button', { name: 'Remove Angels Landing' })).toBeVisible()
  await saveYear(page, '2023')

  await openParks(page)
  await expect(page.getByText('1 / 64 visited')).toBeVisible()
  const zion = page.getByRole('listitem', { name: 'Zion' })
  // Its badge is in color now, with the year and your hikes under it.
  await expect(zion.getByRole('button', { name: 'Zion, visited once' })).toBeVisible()
  await expect(zion).toContainText('2023 · 1 hike')
  await expect(grid.getByRole('button', { name: /, not visited$/ })).toHaveCount(63)

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
  await openAddTrip(page)
  const dialog = tripForm(page, 'Add trip')
  await toStep(dialog, 'Route')
  await dialog.getByRole('combobox', { name: DEST }).fill('Yosemite Valley')
  await dialog.getByRole('option', { name: /^Yosemite Valley\s*CA$/ }).click()
  await expect(dialog.getByRole('status')).toContainText('inside Yosemite National Park')
  await dialog.getByRole('button', { name: 'Link to park' }).click()
  await expect(dialog.getByText('Yosemite National Park', { exact: true })).toBeVisible()
  await toStep(dialog, 'Notes')
  await expect(dialog.getByRole('region', { name: 'Hikes' })).toBeVisible()
  await saveYear(page, '2022')
  await expect(tripDetails(page, /Yosemite/)).toBeVisible()
  await openYou(page)
  await expect(page.getByRole('region', { name: 'Your travel in numbers' })).toContainText('1 / 64National parks')
})

test('park badges: visits counted, a trip dated ahead is upcoming, and Recent puts the newest first', async ({ page }) => {
  await page.goto('./')
  for (const [park, option, year] of [
    ['zion', /Zion National Park/, '2019'],
    ['zion', /Zion National Park/, '2023'],
    ['arches', /Arches National Park/, '2021'],
    ['yosemite', /Yosemite National Park/, '2099'],
  ] as const) {
    const dialog = await openAddTrip(page)
    await toStep(dialog, 'Route')
    await dialog.getByRole('combobox', { name: DEST }).fill(park)
    await dialog.getByRole('option', { name: option }).first().click()
    await saveYear(page, year)
  }
  await openParks(page)
  await expect(page.getByText('2 / 64 visited')).toBeVisible()
  const grid = page.getByRole('region', { name: 'National parks' })
  // Two trips to Zion: "×2" on its badge.
  await expect(grid.getByRole('button', { name: 'Zion, visited 2 times' })).toContainText('×2')
  // A trip dated in the future doesn't color its badge yet.
  await expect(grid.getByRole('button', { name: 'Yosemite, upcoming, 2099' })).toContainText('Upcoming · 2099')

  await page.getByRole('combobox', { name: 'Order' }).selectOption('recent')
  await expect(grid.getByRole('listitem').first()).toHaveAccessibleName('Zion')
  await expect(grid.getByRole('listitem').nth(1)).toHaveAccessibleName('Arches')
})
