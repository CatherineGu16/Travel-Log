import { expect, test, type Page } from '@playwright/test'
import { dateRange, openDates, openPeople, openSettings, openYou, pickDays, setTripYear, toStep } from './helpers.ts'

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

  await page.getByRole('button', { name: 'Add trip' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await toStep(dialog, 'Route')
  await choosePlace(page, DEST, 'zion', /Zion National Park/)
  await choosePlace(page, DEST, 'Springdale, UT', /^Springdale\s*UT$/)
  await choosePlace(page, DEST, 'Las Vegas', /^Las Vegas\s*NV$/)

  // Who went is on the Details step. A new person, added to the Family group on the spot.
  await toStep(dialog, 'Details')
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
  // Your numbers, on the You page.
  await openYou(page)
  const numbers = page.getByRole('region', { name: 'Your travel in numbers' })
  await expect(numbers).toContainText('2 / 50States')
  await expect(numbers).toContainText('1 / 64National parks')

  // Everything is still there after a reload.
  await page.reload()
  await expect(numbers).toContainText('2 / 50States')
  await expect(numbers).toContainText('1 / 64National parks')
  await openPeople(page)
  await expect(page.getByRole('region', { name: 'People & groups' }).getByText('Mom')).toHaveCount(2) // in People and in the Family group
})

test('a second trip to the same place stacks on its pin', async ({ page }) => {
  await page.goto('./')
  for (const year of ['2019', '2024']) {
    await page.getByRole('button', { name: 'Add trip' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add trip' })
    await toStep(dialog, 'Route')
    await choosePlace(page, DEST, 'moab', /^Moab/)
    await toStep(dialog, 'Details')
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
    await toStep(dialog, 'Route')
    await choosePlace(page, DEST, 'moab', /^Moab/)
    for (const [q, o] of stops) await choosePlace(page, DEST, q, o)
    await toStep(dialog, 'Details')
    await setTripYear(dialog, year)
    await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
    await expect(dialog).toBeHidden()
    if (year === '2019') await page.getByRole('region', { name: 'Moab trips' }).getByRole('button', { name: 'Close' }).click()
  }

  const card = page.getByRole('region', { name: 'Moab trips' })
  await expect(card.getByRole('radio', { name: /2024/ })).toBeChecked()
  const route2024 = card.getByRole('list', { name: 'Route of Moab 2024' })
  await expect(route2024).toContainText('Monticello')
  await expect(route2024).toContainText('Blanding')

  await card.getByRole('radio', { name: /2019/ }).click()
  await expect(card.getByRole('radio', { name: /2019/ })).toBeChecked()
  await expect(card.getByRole('list', { name: 'Route of Moab 2019' })).toContainText('Green River')
  await expect(card.getByRole('list', { name: 'Route of Moab 2019' })).not.toContainText('Blanding')

  await card.getByRole('button', { name: 'Details of Moab 2019' }).click()
  const detail = page.getByRole('dialog', { name: 'Moab 2019' })
  await expect(detail.getByText('Main destination')).toBeVisible()
  await detail.getByRole('button', { name: '2024' }).click()
  await expect(page.getByRole('dialog', { name: 'Moab 2024' })).toBeVisible()
})

test('a trip with two main destinations, each with its own dates', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await toStep(dialog, 'Route')
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
    // A new trip's dates come from its stops, so each stop gets the calendar.
    await row.getByRole('button', { name: /^Add dates/ }).click()
    await pickDays(row, `Dates at ${name}`, from, to)
  }
  await toStep(dialog, 'Details')
  await expect(dateRange(dialog, 'Trip dates')).toContainText('May 1 – 6, 2024')
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()

  // The parks checklist shows the days at Zion, not the whole trip.
  await page.goto('./#/parks')
  await expect(page.getByRole('listitem', { name: 'Zion' })).toContainText('May 1 – 3, 2024')

  await page.goto('./#/trips')
  const row = page.getByRole('button', { name: /Zion & Las Vegas 2024/ })
  await expect(row).toContainText('Zion National Park & Las Vegas')
  // A short hop is guessed as a drive, so it's a road trip, but rows don't say so: the filter does.
  await expect(row).not.toContainText('Road trip')
})

test('trip dates are a range picker: tap the first day, then the last', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  const range = dialog.getByRole('group', { name: /^Trip dates/ })
  // Folded away until you tap it.
  await expect(range.getByRole('radiogroup', { name: 'Trip dates precision' })).toHaveCount(0)
  await openDates(dialog, 'Trip dates')
  await expect(range.getByRole('radiogroup', { name: 'Trip dates precision' }).getByRole('radio')).toHaveText(['Date', 'Month', 'Year'])

  await range.getByRole('combobox', { name: 'Trip dates calendar month' }).selectOption('7')
  await range.getByRole('combobox', { name: 'Trip dates calendar year' }).selectOption('2023')
  await range.getByRole('button', { name: 'July 4, 2023' }).click()
  await range.getByRole('button', { name: 'July 9, 2023' }).click()
  // The last day folds it away again, showing the range.
  await expect(range.getByRole('button', { name: /^Change Trip dates/ })).toHaveText(/Jul 4 – 9, 2023/)
  await openDates(dialog, 'Trip dates')
  await expect(range.getByRole('button', { name: 'July 6, 2023' })).toHaveAttribute('aria-pressed', 'true')
  await expect(range.getByRole('button', { name: 'July 10, 2023' })).toHaveAttribute('aria-pressed', 'false')

  // Month precision keeps the range as months.
  await range.getByRole('radio', { name: 'Month' }).click()
  await expect(range).toContainText('Jul 2023')
})

test('who went: groups are on or off, anyone else is searched for and added', async ({ page }) => {
  await page.goto('./')
  await openPeople(page)
  const people = page.getByRole('region', { name: 'People & groups' })
  for (const [name, group] of [
    ['Mom', 'Family'],
    ['Dad', 'Family'],
    ['Sis', 'Family'],
    ['Alexa', 'Friends'],
    ['Jordan', null],
  ] as const) {
    await people.getByRole('button', { name: '+ Add person' }).click()
    const editor = page.getByRole('region', { name: 'Add person' })
    await editor.getByRole('textbox', { name: 'Name' }).fill(name)
    if (group) await editor.getByRole('checkbox', { name: group }).check()
    await editor.getByRole('button', { name: 'Save' }).click()
  }

  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  const groups = dialog.getByRole('group', { name: 'Groups' })
  const others = dialog.getByRole('list', { name: 'Also going' })
  await expect(groups.getByRole('button')).toHaveText(['Family', 'Friends'])
  // People not in a group aren't listed until you search for them.
  await expect(dialog.getByRole('button', { name: 'Jordan' })).toHaveCount(0)

  // A group is one chip: on brings everyone in it, without listing them one by one; off takes them off.
  const family = groups.getByRole('button', { name: 'Family' })
  await family.click()
  await expect(family).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog).toContainText('3 people')
  await expect(others).toHaveCount(0)
  await family.click()
  await expect(family).toHaveAttribute('aria-pressed', 'false')
  await expect(dialog).not.toContainText('3 people')

  // Anyone else: search, tap, and they're listed with ×.
  const search = dialog.getByRole('searchbox', { name: 'Add a person' })
  await search.fill('jor')
  await dialog.getByRole('group', { name: 'Matching people' }).getByRole('button', { name: 'Jordan' }).click()
  await search.fill('')
  await expect(others.getByRole('listitem')).toHaveText([/Jordan/])

  // A near miss is offered before adding someone new; someone new goes in the groups you pick.
  await search.fill('Alexx')
  await expect(dialog.getByRole('group', { name: 'Did you mean' }).getByRole('button', { name: 'Alexa' })).toBeVisible()
  await search.fill('Robin')
  await dialog.getByRole('checkbox', { name: 'Friends' }).check()
  await dialog.getByRole('button', { name: 'Add “Robin” as someone new' }).click()
  await expect(others.getByRole('listitem')).toHaveText([/Jordan/, /Robin/])
  await others.getByRole('button', { name: 'Remove Jordan' }).click()
  await expect(others.getByRole('listitem')).toHaveText([/Robin/])
})

test('shaping the route between two places bends the dotted line through your taps', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await toStep(dialog, 'Route')
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
  // Tapping the dot doesn't add another; dragging it moves it (still one bend).
  await page.waitForTimeout(300)
  await map.click({ position: { x: box.width / 2, y: box.height * 0.6 } })
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.6)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height * 0.5, { steps: 6 })
  await page.mouse.up()
  await banner.getByRole('button', { name: 'Done' }).click()

  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: /^Shape the route from Zion/ })).toHaveText('Bends 1× · Edit')
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()

  // Saved with the trip.
  await page.getByRole('region', { name: 'Zion National Park trips' }).getByRole('button', { name: /^Edit/ }).click()
  const edit = page.getByRole('dialog', { name: 'Edit trip' })
  await toStep(edit, 'Route')
  await expect(edit.getByRole('button', { name: /^Shape the route from Zion/ })).toHaveText('Bends 1× · Edit')
  await edit.getByRole('button', { name: 'Straighten' }).click()
  await expect(edit.getByRole('button', { name: /^Shape the route from Zion/ })).toHaveText('Shape on map')
})

test('notes, rating and tags are their own step and show on the trip', async ({ page, isMobile }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await toStep(dialog, 'Route')
  await choosePlace(page, DEST, 'zion', /Zion National Park/)
  await dialog.getByRole('button', { name: 'Next: Notes' }).click()
  // The description grows with what you type instead of scrolling inside itself.
  const description = dialog.getByRole('textbox', { name: 'Description' })
  const before = (await description.boundingBox())!.height
  await description.fill('Day 1: Angels Landing.\nDay 2: The Narrows.\nDay 3: Kolob Canyons.\nDay 4: Emerald Pools.\nDay 5: home.')
  expect((await description.boundingBox())!.height).toBeGreaterThan(before * 1.5)
  await dialog.getByRole('textbox', { name: 'Highlights' }).fill('Sunrise at Canyon Overlook')
  await dialog.getByRole('button', { name: '4 stars' }).click()
  // Tags are chips: type one and press Enter (or a comma).
  const tag = dialog.getByRole('textbox', { name: 'Add a tag' })
  await tag.fill('camping')
  await tag.press('Enter')
  await tag.pressSequentially('desert,')
  await expect(dialog.getByRole('list', { name: 'Tags on this trip' }).getByRole('listitem')).toHaveText(['camping', 'desert'])
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()

  await page.getByRole('region', { name: 'Zion National Park trips' }).getByRole('button', { name: /Details/ }).click()
  const detail = page.getByRole('dialog', { name: /Zion/ })
  await expect(detail).toContainText('Sunrise at Canyon Overlook')
  await expect(detail).toContainText('camping')
  await expect(detail).toContainText('Day 5: home.')
  await expect(detail.getByLabel('4 out of 5 stars')).toBeVisible()
  // The stops, not how you traveled between them.
  await expect(detail).not.toContainText('Flight')
  await expect(detail.getByRole('region', { name: 'Notes' })).toBeVisible()

  if (isMobile) {
    // The whole screen on a phone; pull the top down to close it.
    const box = (await detail.boundingBox())!
    expect(box.height).toBeGreaterThan((page.viewportSize()!.height ?? 0) * 0.95)
    await page.mouse.move(box.x + box.width / 2, box.y + 10)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + 250, { steps: 8 })
    await page.mouse.up()
    await expect(detail).toBeHidden()
  }
})

test('legs between stops: guessed from distance, changed with a tap, and filterable', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  // Details first; Next moves on to the route.
  await dialog.getByRole('button', { name: 'Next: Route' }).click()
  await choosePlace(page, DEST, 'Los Angeles', /^Los Angeles\s*CA$/)
  await choosePlace(page, DEST, 'Las Vegas', /^Las Vegas\s*NV$/)
  await choosePlace(page, DEST, 'Seattle', /^Seattle\s*WA$/)

  const drive = dialog.getByRole('button', { name: /^Drive \(guessed\) from Los Angeles to Las Vegas, \d+ mi/ })
  await expect(drive).toBeVisible()
  await expect(dialog.getByRole('button', { name: /^Flight \(guessed\) from Las Vegas to Seattle/ })).toBeVisible()
  // Flights aren't shaped on the map; drives are.
  await expect(dialog.getByRole('button', { name: /^Shape the route from Las Vegas to Seattle/ })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: /^Shape the route from Los Angeles to Las Vegas/ })).toBeVisible()

  await drive.click()
  await dialog.getByRole('group', { name: 'How you got from Los Angeles to Las Vegas' }).getByRole('button', { name: 'Train' }).click()
  await expect(dialog.getByRole('button', { name: /^Train from Los Angeles to Las Vegas/ })).toBeVisible()
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()

  // The pin card shows how you went between stops.
  // The pin card lists just the places, not how you traveled between them.
  const route = page.getByRole('region', { name: 'Los Angeles trips' }).getByRole('list', { name: /^Route/ })
  await expect(route.getByRole('listitem')).toHaveText([/Los Angeles/, /Las Vegas/, /Seattle/])
  await expect(route).not.toContainText('Train')

  // No chip on the row; the Flight filter finds the trip, Road trip doesn't.
  await page.goto('./#/trips')
  const row = page.getByRole('button', { name: /Los Angeles/ })
  await expect(row).not.toContainText('Flight')
  const filterBy = async (mode: RegExp) => {
    await page.getByRole('button', { name: /^Filter/ }).first().click()
    await page.getByRole('dialog', { name: /Filter/ }).getByRole('button', { name: mode }).click()
    await page.keyboard.press('Escape')
  }
  await filterBy(/Road trip/)
  await expect(row).toHaveCount(0)
  await filterBy(/Flight/)
  await expect(row).toHaveCount(1)
})

test('a road trip from home with two main pins; changing home leaves it alone', async ({ page }) => {
  await page.goto('./')
  // Home is in Settings.
  await openSettings(page)
  const settings = page.getByRole('region', { name: 'Home' })
  await settings.getByRole('combobox', { name: 'Set home' }).fill('Pasadena')
  await settings.getByRole('option', { name: /^Pasadena\s*CA$/ }).first().click()
  await expect(settings).toContainText('Trips can start and end at Pasadena')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  // The route starts and ends at home.
  await toStep(dialog, 'Route')
  await expect(dialog.getByRole('button', { name: 'Change where the trip started (Pasadena)' })).toBeVisible()
  await choosePlace(page, DEST, 'Las Vegas', /^Las Vegas\s*NV$/)
  await choosePlace(page, DEST, 'zion', /Zion National Park/)

  // Each place says whether it's a main pin or a stop; tap to change.
  const zion = dialog.getByRole('button', { name: 'Make Zion National Park a main destination' })
  await expect(zion).toHaveText(/Stop/)
  await zion.click()
  await expect(dialog.getByRole('button', { name: 'Zion National Park is a main destination' })).toHaveText(/Main/)

  // Getting there and back is a flight unless you say otherwise: tap the leg to change it.
  await dialog.getByRole('button', { name: /^Flight from Pasadena to Las Vegas/ }).click()
  await dialog.getByRole('group', { name: 'How you got from Pasadena to Las Vegas' }).getByRole('button', { name: 'Drive' }).click()
  await expect(dialog.getByLabel(/^Drive from Pasadena to Las Vegas/)).toBeVisible()
  // Home again from the last place (the drive back follows the way there on the map). A flight
  // can't be shaped; a drive can, like any other leg.
  await expect(dialog.getByRole('button', { name: 'Shape the route from Zion National Park to Pasadena on the map' })).toHaveCount(0)
  await dialog.getByRole('button', { name: /^Flight from Zion National Park to Pasadena/ }).click()
  await dialog.getByRole('group', { name: 'How you got from Zion National Park to Pasadena' }).getByRole('button', { name: 'Drive' }).click()
  await expect(dialog.getByLabel(/^Drive from Zion National Park to Pasadena/)).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Shape the route from Pasadena to Las Vegas on the map' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Shape the route from Zion National Park to Pasadena on the map' }).click()
  const banner = page.getByRole('region', { name: 'Shape the route' })
  await banner.getByRole('button', { name: /Follow the way you came/ }).click()
  await banner.getByRole('button', { name: 'Done' }).click()
  await expect(dialog.getByRole('button', { name: 'Shape the route from Zion National Park to Pasadena on the map' })).toHaveText(/^Bends \d+× · Edit$/)
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()

  // The pin card lists the places, without home.
  const route = page.getByRole('region', { name: 'Las Vegas trips' }).getByRole('list', { name: /^Route/ })
  await expect(route.getByRole('listitem')).toHaveText([/Las Vegas/, /Zion National Park/])

  // Every leg a drive, home included: a road trip.
  await page.goto('./#/trips')
  await page.getByRole('button', { name: /^Filter/ }).first().click()
  await page.getByRole('dialog', { name: /Filter/ }).getByRole('button', { name: /Road trip/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /Las Vegas & Zion/ })).toHaveCount(1)

  // Moving home doesn't move this trip; new trips start at the new home.
  await openSettings(page)
  await settings.getByRole('combobox', { name: 'Change home' }).fill('Denver')
  await settings.getByRole('option', { name: /^Denver\s*CO$/ }).first().click()
  await expect(settings).toContainText('Trips can start and end at Denver')
  await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Trips' }).filter({ visible: true }).click()
  await page.getByRole('button', { name: /Las Vegas & Zion/ }).click()
  const card = page.getByRole('region', { name: 'Las Vegas trips' })

  // Editing: the trip shows its own start, not the new home, and can switch to it.
  await card.getByRole('button', { name: /^Edit/ }).click()
  const edit = page.getByRole('dialog', { name: 'Edit trip' })
  await toStep(edit, 'Route')
  await expect(edit.getByLabel(/^Drive from Pasadena to Las Vegas/)).toBeVisible()
  await edit.getByRole('button', { name: 'Change where the trip started (Pasadena)' }).click()
  await edit.getByRole('button', { name: 'Use home (Denver)' }).click()
  await edit.getByRole('button', { name: 'Save' }).click()
  await card.getByRole('button', { name: /^Edit/ }).click()
  await toStep(page.getByRole('dialog', { name: 'Edit trip' }), 'Route')
  await expect(page.getByRole('dialog', { name: 'Edit trip' }).getByRole('button', { name: 'Change where the trip started (Denver)' })).toBeVisible()
})

test('a destination can be swapped for another place from its row', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await toStep(dialog, 'Route')
  await choosePlace(page, DEST, 'Las Vegas', /^Las Vegas\s*NV$/)
  await choosePlace(page, DEST, 'Reno', /^Reno\s*NV$/)
  // New places go after the last one, above the way back.
  const places = dialog.getByRole('region', { name: 'Where you went' }).getByRole('listitem')
  await expect(places).toHaveText([/Las Vegas/, /Reno/])

  const reno = dialog.getByRole('listitem', { name: 'Reno' })
  await reno.getByRole('button', { name: 'Reno: change place, name or note' }).click()
  await reno.getByRole('combobox', { name: 'Change to another place' }).fill('Henderson, NV')
  await reno.getByRole('option', { name: /^Henderson\s*NV$/ }).first().click()
  await expect(places).toHaveText([/Las Vegas/, /Henderson/])
})

test('cities abroad: biggest first, narrowed by country, and grouped by country', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await toStep(dialog, 'Route')
  const search = dialog.getByRole('combobox', { name: DEST })
  await search.fill('Lisbon')
  await expect(dialog.getByRole('option').first()).toHaveText(/^Lisbon\s*Portugal$/)
  await search.fill('Porto, Portugal')
  await expect(dialog.getByRole('option').first()).toHaveText(/^Porto\s*Portugal$/)
  await search.fill('Lisbon')
  await dialog.getByRole('option', { name: /^Lisbon\s*Portugal$/ }).click()
  await choosePlace(page, DEST, 'Porto, Portugal', /^Porto\s*Portugal$/)
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('region', { name: 'Lisbon trips' })).toBeVisible()

  await page.goto('./#/trips')
  await page.getByRole('combobox', { name: 'Group by' }).selectOption('state')
  await expect(page.getByRole('heading', { name: /^Portugal/ })).toBeVisible()
})

test('stop dates from a strip of the trip days, shown as day numbers; details link to each step', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await pickDays(dialog, 'Trip dates', '2024-05-01', '2024-05-06')
  await toStep(dialog, 'Route')
  await choosePlace(page, DEST, 'zion', /Zion National Park/)
  await choosePlace(page, DEST, 'bryce', /Bryce Canyon National Park/)

  // Tap the day you got there, then the day you left.
  const zion = dialog.getByRole('listitem', { name: 'Zion National Park' })
  await zion.getByRole('button', { name: /^Add dates/ }).click()
  const zionDays = zion.getByRole('group', { name: 'Days at Zion National Park' })
  await expect(zionDays.getByRole('button', { name: /^Day \d+,/ })).toHaveCount(6)
  await zionDays.getByRole('button', { name: /^Day 1,/ }).click()
  await zionDays.getByRole('button', { name: /^Day 3,/ }).click()
  await expect(zionDays).toBeHidden()
  await expect(zion.getByRole('button', { name: /^Dates at Zion/ })).toHaveText(/Days 1–3 · May 1 – 3, 2024/)

  // The next stop picks up where the last left off.
  const bryce = dialog.getByRole('listitem', { name: 'Bryce Canyon National Park' })
  await bryce.getByRole('button', { name: /^Add dates/ }).click()
  const bryceDays = bryce.getByRole('group', { name: 'Days at Bryce Canyon National Park' })
  await bryceDays.getByRole('button', { name: /^Day 3,/ }).click()
  await bryceDays.getByRole('button', { name: /^Day 6,/ }).click()
  await expect(bryce.getByRole('button', { name: /^Dates at Bryce/ })).toHaveText(/Days 3–6/)
  await dialog.getByRole('button', { name: 'Next: Notes' }).click()
  await dialog.getByRole('textbox', { name: 'Add a tag' }).fill('canyons')
  await dialog.getByRole('textbox', { name: 'Add a tag' }).press('Enter')
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()
  // Two parks on one trip earns a tier, announced with the save (Undo still there).
  await expect(page.getByRole('status')).toContainText('🏅 Bronze · Park Hopper')
  await expect(page.getByRole('status').getByRole('button', { name: 'Undo' })).toBeVisible()

  // Details: how long, a map, each stop's days, and Edit on each part.
  await page.getByRole('region', { name: /trips$/ }).getByRole('button', { name: 'Details' }).click()
  const detail = page.getByRole('dialog', { name: /Zion/ })
  await expect(detail).toContainText('6 days')
  await expect(detail.getByRole('img', { name: /^Map of the route/ })).toBeVisible()
  await expect(detail).toContainText('Days 1–3 · May 1 – 3, 2024')
  await detail.getByRole('button', { name: 'Edit the stops' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit trip' })
  await expect(edit.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: 'Route', exact: true })).toHaveAttribute('aria-current', 'step')
  await page.keyboard.press('Escape')
  await expect(edit).toBeHidden()

  // A tag shows your trips with that tag; Delete removes the trip, with Undo.
  await page.getByRole('region', { name: /trips$/ }).getByRole('button', { name: 'Details' }).click()
  await page.getByRole('dialog', { name: /Zion/ }).getByRole('button', { name: 'Show trips tagged canyons' }).click()
  await expect(page.getByRole('button', { name: 'Filter, 1 on' }).first()).toBeVisible()
  await page.getByRole('button', { name: /Zion 2024/ }).click()
  await page.getByRole('region', { name: /trips$/ }).getByRole('button', { name: 'Details' }).click()
  await page.getByRole('dialog', { name: /Zion/ }).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('status')).toContainText('Deleted')
})

test('shaping a leg can follow the way you came, then take more taps', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await toStep(dialog, 'Route')
  await choosePlace(page, DEST, 'Las Vegas', /^Las Vegas\s*NV$/)
  await choosePlace(page, DEST, 'bryce', /Bryce Canyon National Park/)
  await choosePlace(page, DEST, 'St. George, UT', /^St\.? George\s*UT$/)

  // The first leg has nothing behind it to follow.
  await dialog.getByRole('button', { name: /^Shape the route from Las Vegas to Bryce/ }).click()
  const banner = page.getByRole('region', { name: 'Shape the route' })
  await expect(banner.getByRole('button', { name: /Follow the way you came/ })).toHaveCount(0)
  await banner.getByRole('button', { name: 'Cancel' }).click()

  // The way back to St. George: along the way up, off where it's closest.
  await dialog.getByRole('button', { name: /^Shape the route from Bryce Canyon National Park to St/ }).click()
  await banner.getByRole('button', { name: /Follow the way you came/ }).click()
  await expect(banner.getByRole('button', { name: 'Undo' })).toBeEnabled()
  const map = page.locator('[data-testid="map"] canvas')
  const box = (await map.boundingBox())!
  await map.click({ position: { x: box.width / 2, y: box.height * 0.7 } })
  await banner.getByRole('button', { name: 'Undo' }).click()
  await banner.getByRole('button', { name: 'Done' }).click()
  await expect(dialog.getByRole('button', { name: /^Shape the route from Bryce Canyon National Park to St/ })).toHaveText('Bends 1× · Edit')
})

test('tags you have used before are chips to add; who went in the details is just people', async ({ page }) => {
  await page.goto('./')
  await openPeople(page)
  const people = page.getByRole('region', { name: 'People & groups' })
  for (const name of ['Mom', 'Dad']) {
    await people.getByRole('button', { name: '+ Add person' }).click()
    const editor = page.getByRole('region', { name: 'Add person' })
    await editor.getByRole('textbox', { name: 'Name' }).fill(name)
    await editor.getByRole('checkbox', { name: 'Family' }).check()
    await editor.getByRole('button', { name: 'Save' }).click()
  }

  for (const [query, option, title] of [
    ['moab', /^Moab/, 'First'],
    ['chicago', /^Chicago/, 'Second'],
  ] as const) {
    await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Add trip' })
    await dialog.getByRole('textbox', { name: 'Title' }).fill(title)
    await dialog.getByRole('group', { name: 'Groups' }).getByRole('button', { name: /^Family/ }).click()
    await toStep(dialog, 'Route')
    await choosePlace(page, DEST, query, option)
    await toStep(dialog, 'Notes')
    if (title === 'First') {
      // Your group names are offered as tags; new ones are typed.
      await dialog.getByRole('group', { name: "Tags you've used" }).getByRole('button', { name: '+ Family' }).click()
      await dialog.getByRole('textbox', { name: 'Add a tag' }).fill('road food')
      await dialog.getByRole('textbox', { name: 'Add a tag' }).press('Enter')
    } else {
      // The second trip is offered the tags from the first.
      await dialog.getByRole('group', { name: "Tags you've used" }).getByRole('button', { name: '+ road food' }).click()
    }
    await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
    await expect(dialog).toBeHidden()
  }

  await page.getByRole('region', { name: 'Chicago trips' }).getByRole('button', { name: /^Details/ }).click()
  const detail = page.getByRole('dialog', { name: 'Second' })
  await expect(detail.getByRole('list', { name: 'Tags' })).toHaveText(/road food/)
  // Who went lists the people, not the group they're in.
  const who = detail.getByRole('heading', { name: 'Who went' }).locator('xpath=../following-sibling::ul')
  await expect(who.getByRole('listitem')).toHaveText([/Mom/, /Dad/])
})
