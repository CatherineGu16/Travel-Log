import { expect, test } from '@playwright/test'
import { openYou, setTripYear, toStep, tripDetails } from './helpers.ts'

async function addTrip(page: import('@playwright/test').Page, query: string, option: RegExp, year: string) {
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await toStep(dialog, 'Route')
  await dialog.getByRole('combobox', { name: /^Add (a|another) destination$/ }).fill(query)
  await dialog.getByRole('option', { name: option }).first().click()
  await toStep(dialog, 'Details')
  await setTripYear(dialog, year)
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()
}

test('your name and photo head the You page, and stay after a reload', async ({ page, isMobile }) => {
  await page.goto('./')
  // Buttons show the hand cursor.
  const add = page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first()
  expect(await add.evaluate((el) => getComputedStyle(el).cursor)).toBe('pointer')
  // There's no Parks tab: parks are a section of You.
  await expect(page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Parks' })).toHaveCount(0)

  await openYou(page)
  const card = page.getByRole('region', { name: 'Your profile' })
  await card.getByRole('button', { name: 'Add your name and photo' }).click()
  const editor = page.getByRole('dialog', { name: 'Edit profile' })
  await editor.getByRole('textbox', { name: 'Name' }).fill('Sam Rivers')
  await editor.getByRole('radio', { name: 'Emoji' }).click()
  await editor.getByRole('radio', { name: '🥾' }).click()
  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(editor).toBeHidden()
  await expect(card.getByRole('heading', { name: 'Sam Rivers' })).toBeVisible()
  await expect(card).toContainText('🥾')

  await page.reload()
  await expect(card.getByRole('heading', { name: 'Sam Rivers' })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Edit profile' })).toBeVisible()
  if (!isMobile) await expect(page.getByRole('link', { name: 'Your profile' })).toContainText('🥾')
})

test('a recently earned award opens over the profile, not the Achievements section', async ({ page }) => {
  await page.goto('./')
  await addTrip(page, 'moab', /^Moab/, '2019')
  await addTrip(page, 'lisbon', /^Lisbon/, '2021')
  await openYou(page)
  await page.getByRole('region', { name: 'Recently earned' }).getByRole('link', { name: /Countries/ }).click()
  await expect(page.getByRole('dialog', { name: 'Countries' })).toBeVisible()
  await expect(page).toHaveURL(/#\/you\/earned\/[^/]+$/)
  // Still on the profile behind it (hidden from screen readers while the panel is open).
  await expect(page.getByRole('link', { name: 'Profile', exact: true, includeHidden: true })).toHaveAttribute('aria-current', 'page')
  await page.goBack()
  await expect(page.getByRole('dialog', { name: 'Countries' })).toBeHidden()
  await expect(page.getByRole('region', { name: 'Your travel in numbers' })).toBeVisible()
})

test('your numbers open what they count, and achievements open their details', async ({ page }) => {
  await page.goto('./')
  await addTrip(page, 'moab', /^Moab/, '2019')
  await addTrip(page, 'zion', /Zion National Park/, '2022')
  await openYou(page)
  const numbers = page.getByRole('region', { name: 'Your travel in numbers' })

  // States: each state opens to its trips, and a trip opens on the map.
  await numbers.getByRole('link', { name: /States/ }).click()
  await expect(page).toHaveURL(/#\/you\/stats\/states$/)
  const states = page.getByRole('dialog', { name: 'States' })
  await states.getByText('Utah').click()
  await states.getByRole('button', { name: /Zion 2022/ }).click()
  await expect(tripDetails(page, 'Zion 2022')).toBeVisible()

  // National parks opens the parks checklist; Back returns to the profile.
  await page.goto('./#/you')
  await numbers.getByRole('link', { name: /National parks/ }).click()
  await expect(page.getByRole('region', { name: 'National parks' })).toContainText('1 / 64 visited')
  await page.goBack()
  await expect(numbers).toBeVisible()

  // Parks achievements list the parks that count, checked off once visited.
  await page.goto('./#/you/achievements/parks-mighty-5')
  const mighty = page.getByRole('dialog', { name: "Utah's Mighty 5" }).getByRole('region', { name: 'Parks' })
  await expect(mighty.getByRole('listitem')).toHaveCount(5)
  await expect(mighty.getByRole('listitem', { name: 'Zion' }).getByLabel('Visited')).toBeVisible()
  await expect(mighty.getByRole('listitem', { name: 'Arches' }).getByLabel('Not visited')).toBeVisible()
  await page.goto('./#/you')

  // An achievement opens its details: each tier, and what's left to reach it.
  await page.getByRole('link', { name: 'See all achievements →' }).click()
  await page.getByRole('listitem', { name: 'Trips logged' }).getByRole('link').click()
  const detail = page.getByRole('dialog', { name: 'Trips logged' })
  await expect(detail.getByRole('listitem', { name: 'Bronze' })).toContainText('8 to go')
  await page.goBack()
  await expect(detail).toBeHidden()
  await expect(page).toHaveURL(/#\/you\/achievements$/)
})
