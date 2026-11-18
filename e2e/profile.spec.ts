import { expect, test } from '@playwright/test'
import { openAddTrip, openYou, saveNewTrip, setTripYear, toStep, tripDetails, tripForm } from './helpers.ts'

async function addTrip(page: import('@playwright/test').Page, query: string, option: RegExp, year: string) {
  await openAddTrip(page)
  const dialog = tripForm(page, 'Add trip')
  await toStep(dialog, 'Route')
  await dialog.getByRole('combobox', { name: /^Add (a|another) destination$/ }).fill(query)
  await dialog.getByRole('option', { name: option }).first().click()
  await toStep(dialog, 'Details')
  await setTripYear(dialog, year)
  await saveNewTrip(dialog)
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

test('the profile: four numbers up front, the rest in one line, and trips over time by month', async ({ page }) => {
  await page.goto('./')
  // Three trips this month (a new trip starts today), and one dated by year only.
  for (const [q, o] of [['moab', /^Moab/], ['zion', /Zion National Park/], ['bryce', /Bryce Canyon/]] as const) {
    const dialog = await openAddTrip(page)
    await toStep(dialog, 'Route')
    await dialog.getByRole('combobox', { name: /^Add (a|another) destination$/ }).fill(q)
    await dialog.getByRole('option', { name: o }).first().click()
    await saveNewTrip(dialog)
    await expect(dialog).toBeHidden()
  }
  await addTrip(page, 'arches', /Arches National Park/, '2019')
  await openYou(page)

  const numbers = page.getByRole('region', { name: 'Your travel in numbers' })
  // Four numbers up front, and four more in the quieter line under them.
  await expect(numbers.getByRole('link')).toHaveCount(8)
  await expect(numbers.getByRole('link', { name: /^4\s*Trips/ })).toBeVisible()
  const more = numbers.getByRole('navigation', { name: 'More numbers' })
  await expect(more.getByRole('link')).toHaveText([/days? traveled/, /mi driven/, /mi flown/, /hikes?/])
  await more.getByRole('link', { name: /hikes?$/ }).click()
  await expect(page).toHaveURL(/#\/you\/stats\/hikes$/)
  await page.goBack()

  // The chart: how many trips it shows, and the year-only one counted under it.
  const chart = page.getByRole('region', { name: 'Trips over time' })
  await expect(chart).toContainText('3 trips in the last 3 years')
  await expect(chart).toContainText('1 trip is dated by year only (2019)')
  // Arrow keys pick a month (the newest first); its trips are listed, each opening on the map.
  await chart.getByLabel('Trips by month. Left and right arrows pick a month.').focus()
  await page.keyboard.press('ArrowLeft')
  const month = chart.getByRole('region', { name: /^Trips in \w{3} \d{4}$/ })
  await expect(month.getByRole('listitem')).toHaveCount(3)
  await month.getByRole('button', { name: /^Zion/ }).click()
  await expect(tripDetails(page, /^Zion/)).toBeVisible()

  await openYou(page)
  await chart.getByRole('radio', { name: 'All' }).click()
  await expect(chart).toContainText(/3 trips since \w{3} \d{4}/)
})
