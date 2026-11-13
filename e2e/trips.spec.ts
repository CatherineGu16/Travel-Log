import { expect, test, type Page } from '@playwright/test'
import { dateRange, openAddTrip, openDates, openPeople, openPlaceTrips, openSettings, openTrips, openYou, pickDays, saveNewTrip, setTripYear, toStep, tripDetails, tripForm } from './helpers.ts'

/** The trip form's place search: "Add a destination", then "Add another destination". */
const DEST = /^Add (a|another) destination$/

async function choosePlace(page: Page, field: string | RegExp, query: string, option: RegExp) {
  // The trip form: a sheet on phones, in the Trips panel on wider screens.
  const dialog = page.getByRole('dialog').or(page.getByRole('complementary', { name: 'Trips panel' }))
  await dialog.getByRole('combobox', { name: field }).fill(query)
  await dialog.getByRole('option', { name: option }).first().click()
}

test('log a multi-stop family trip, see it on the map, and it survives a reload', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('[data-testid="map"] canvas')).toBeVisible()

  await openAddTrip(page)
  const dialog = tripForm(page, 'Add trip')
  await toStep(dialog, 'Route')
  await choosePlace(page, DEST, 'zion', /Zion National Park/)
  await choosePlace(page, DEST, 'Springdale, UT', /^Springdale\s*UT$/)
  await choosePlace(page, DEST, 'Las Vegas', /^Las Vegas\s*NV$/)

  // Who went is on the Details step. A new person, added to the Family group on the spot.
  await toStep(dialog, 'Details')
  await dialog.getByRole('searchbox', { name: 'Add a person' }).fill('Mom')
  await dialog.getByRole('checkbox', { name: 'Family' }).check()
  await dialog.getByRole('button', { name: 'Add “Mom”' }).click()

  await saveNewTrip(dialog)
  await expect(dialog).toBeHidden()

  // Saved, the trip opens with all its details; the stops follow the order they were added.
  const detail = tripDetails(page, /^Zion/)
  await expect(detail.getByRole('list', { name: 'Stops' }).getByRole('listitem')).toHaveText([/Zion National Park/, /1\s*Springdale/, /2\s*Las Vegas/])
  await expect(detail.getByText('Mom')).toBeVisible()

  // Its pin (here from Most visited) shows the trip as a card first, even when it's the only one;
  // the card opens the details.
  await openPlaceTrips(page, /^Zion/)
  const cards = page.getByRole('region', { name: 'Zion National Park trips' }).getByRole('listitem')
  await expect(cards).toHaveCount(1)
  await expect(page.getByRole('list', { name: 'Stops' })).toBeHidden()
  await cards.getByRole('button').click()
  await expect(detail.getByRole('list', { name: 'Stops' })).toBeVisible()
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
    await openAddTrip(page)
    const dialog = tripForm(page, 'Add trip')
    await toStep(dialog, 'Route')
    await choosePlace(page, DEST, 'moab', /^Moab/)
    await toStep(dialog, 'Details')
    await setTripYear(dialog, year)
    await saveNewTrip(dialog)
    await expect(dialog).toBeHidden()
  }
  // Its pin now has two trips: a card for each, newest first.
  await openPlaceTrips(page, /^Moab/)
  await expect(page.getByRole('complementary', { name: 'Trips panel' }).getByText('2 visits')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Moab trips' }).getByRole('listitem')).toHaveText([/^Moab 2024/, /^Moab 2019/])
})

test('a pin with two trips lists them as cards; a card shows its route and opens the trip', async ({ page }) => {
  await page.goto('./')
  const trips: [string, [string, RegExp][]][] = [
    ['2019', [['Green River, UT', /^Green River\s*UT$/]]],
    ['2024', [['Monticello, UT', /^Monticello\s*UT$/], ['Blanding', /^Blanding\s*UT$/]]],
  ]
  for (const [year, stops] of trips) {
    await openAddTrip(page)
    const dialog = tripForm(page, 'Add trip')
    await toStep(dialog, 'Route')
    await choosePlace(page, DEST, 'moab', /^Moab/)
    for (const [q, o] of stops) await choosePlace(page, DEST, q, o)
    await toStep(dialog, 'Details')
    await setTripYear(dialog, year)
    await saveNewTrip(dialog)
    await expect(dialog).toBeHidden()
  }

  await openPlaceTrips(page, /^Moab/)
  const cards = page.getByRole('region', { name: 'Moab trips' }).getByRole('listitem')
  // Each card shows its places in order, newest first.
  await expect(cards.nth(0)).toContainText(/Moab\s*›\s*1\s*Monticello\s*›\s*2\s*Blanding/)
  await expect(cards.nth(1)).toContainText('Green River')
  // Pointing at a card puts its route on the map. (The test's pointer is moved on purpose: where it
  // was left after the last tap would otherwise count as pointing at a card.)
  await cards.nth(0).getByRole('button').hover()
  await expect(cards.nth(0)).toContainText('On the map')
  await cards.nth(1).getByRole('button').hover()
  await expect(cards.nth(1)).toContainText('On the map')
  await expect(cards.nth(0)).not.toContainText('On the map')

  // Tapping it opens the trip, with its details right there.
  await cards.nth(1).getByRole('button').click()
  const detail = tripDetails(page, 'Moab 2019')
  await expect(detail.getByText('Main destination')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveText(/Trips\s*›\s*Moab\s*›\s*Moab 2019/)
  await detail.getByRole('button', { name: '2024' }).click()
  await expect(tripDetails(page, 'Moab 2024')).toBeVisible()
})

test('a trip with two main destinations, each with its own dates', async ({ page }) => {
  await page.goto('./')
  await openAddTrip(page)
  const dialog = tripForm(page, 'Add trip')
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
  await saveNewTrip(dialog)
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
  await openAddTrip(page)
  const dialog = tripForm(page, 'Add trip')
  const range = dialog.getByRole('group', { name: /^Trip dates/ })
  // Folded away until you tap it.
  await expect(range.getByRole('radiogroup', { name: 'Trip dates precision' })).toHaveCount(0)
  await openDates(dialog, 'Trip dates')
  await expect(range.getByRole('radiogroup', { name: 'Trip dates precision' }).getByRole('radio')).toHaveText(['Date', 'Month', 'Year'])

  await range.getByRole('combobox', { name: 'Trip dates calendar month' }).selectOption('7')
  await range.getByRole('combobox', { name: 'Trip dates calendar year' }).selectOption('2023')
  await range.getByRole('button', { name: 'July 4, 2023' }).click()
  await range.getByRole('button', { name: 'July 9, 2023' }).click()
  // It stays open until Done, so a mistaken tap can be fixed: another tap starts over.
  await range.getByRole('button', { name: 'July 5, 2023' }).click()
  await range.getByRole('button', { name: 'July 9, 2023' }).click()
  await expect(range.getByRole('button', { name: 'July 4, 2023' })).toHaveAttribute('aria-pressed', 'false')
  // Done folds it away, showing the range.
  await range.getByRole('button', { name: 'Done with Trip dates' }).click()
  await expect(range.getByRole('button', { name: /^Change Trip dates/ })).toHaveText(/Jul 5 – 9, 2023/)
  await openDates(dialog, 'Trip dates')
  await expect(range.getByRole('button', { name: 'July 6, 2023' })).toHaveAttribute('aria-pressed', 'true')
  await expect(range.getByRole('button', { name: 'July 10, 2023' })).toHaveAttribute('aria-pressed', 'false')

  // Cancel leaves the dates as they were.
  await range.getByRole('button', { name: 'July 20, 2023' }).click()
  await range.getByRole('button', { name: 'Cancel Trip dates' }).click()
  await expect(range.getByRole('button', { name: /^Change Trip dates/ })).toHaveText(/Jul 5 – 9, 2023/)
  await openDates(dialog, 'Trip dates')

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

  await openAddTrip(page)
  const dialog = tripForm(page, 'Add trip')
  // Somewhere to go first, so the Notes step (where tags are) opens.
  await toStep(dialog, 'Route')
  await choosePlace(page, DEST, 'zion', /Zion National Park/)
  await toStep(dialog, 'Details')
  const groups = dialog.getByRole('group', { name: 'Groups' })
  const others = dialog.getByRole('list', { name: 'Also going' })
  await expect(groups.getByRole('button')).toHaveText(['Family', 'Friends'])
  // People not in a group aren't listed until you search for them.
  await expect(dialog.getByRole('button', { name: 'Jordan' })).toHaveCount(0)

  // A group is one chip: on brings everyone in it, without listing them one by one, and tags the
  // trip with it; off takes them and the tag off.
  const family = groups.getByRole('button', { name: 'Family' })
  const familyTag = dialog.getByRole('button', { name: 'Remove the Family tag' })
  await family.click()
  await expect(family).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog).toContainText('3 people')
  await expect(others).toHaveCount(0)
  await toStep(dialog, 'Notes')
  await expect(familyTag).toHaveCount(1)
  await toStep(dialog, 'Details')
  await family.click()
  await expect(family).toHaveAttribute('aria-pressed', 'false')
  await expect(dialog).not.toContainText('3 people')
  await toStep(dialog, 'Notes')
  await expect(familyTag).toHaveCount(0)
  await toStep(dialog, 'Details')

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

test('shaping the route between two places bends the dotted line through your taps', async ({ page, isMobile }) => {
  await page.goto('./')
  await openAddTrip(page)
  const dialog = tripForm(page, 'Add trip')
  await toStep(dialog, 'Route')
  await choosePlace(page, DEST, 'zion', /Zion National Park/)
  await choosePlace(page, DEST, 'Las Vegas', /^Las Vegas\s*NV$/)
  await expect(dialog.getByRole('button', { name: 'Pick on map' })).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Shape the route from Zion National Park to Las Vegas on the map' }).click()
  // Phones: the form steps aside while you shape; wider, it stays in the panel beside the map.
  if (isMobile) await expect(dialog).toBeHidden()
  else await expect(dialog).toBeVisible()
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
  await saveNewTrip(dialog)
  await expect(dialog).toBeHidden()

  // Saved with the trip, which opens with its details; its stops' Edit opens the Route step.
  await tripDetails(page, /^Zion/).getByRole('button', { name: 'Edit the stops' }).click()
  const edit = tripForm(page, 'Edit trip')
  await toStep(edit, 'Route')
  await expect(edit.getByRole('button', { name: /^Shape the route from Zion/ })).toHaveText('Bends 1× · Edit')
  await edit.getByRole('button', { name: 'Straighten' }).click()
  await expect(edit.getByRole('button', { name: /^Shape the route from Zion/ })).toHaveText('Shape on map')
})

test('notes, rating and tags are their own step and show on the trip', async ({ page }) => {
  await page.goto('./')
  await openAddTrip(page)
  const dialog = tripForm(page, 'Add trip')
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
  await saveNewTrip(dialog)
  await expect(dialog).toBeHidden()

  // Saved, the trip opens with all its details.
  const detail = tripDetails(page, /Zion/)
  await expect(detail).toContainText('Sunrise at Canyon Overlook')
  await expect(detail).toContainText('camping')
  await expect(detail).toContainText('Day 5: home.')
  await expect(detail.getByLabel('4 out of 5 stars')).toBeVisible()
  // The stops, not how you traveled between them.
  await expect(detail).not.toContainText('Flight')
  await expect(detail.getByRole('region', { name: 'Notes' })).toBeVisible()

})

test('legs between stops: guessed from distance, changed with a tap, and filterable', async ({ page }) => {
  await page.goto('./')
  await openAddTrip(page)
  const dialog = tripForm(page, 'Add trip')
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
  await saveNewTrip(dialog)
  await expect(dialog).toBeHidden()

  // The trip's details list just the places, not how you traveled between them.
  const route = tripDetails(page, /Los Angeles/).getByRole('list', { name: 'Stops' })
  await expect(route.getByRole('listitem')).toHaveText([/Los Angeles/, /Las Vegas/, /Seattle/])
  await expect(route).not.toContainText('Train')

  // No chip on the row; the Flight filter finds the trip, Road trip doesn't.
  await page.goto('./#/trips')
  const row = page.getByRole('button', { name: /Los Angeles/ })
  await expect(row).not.toContainText('Flight')
  // The filter opens in place under the search; "Show N trips" folds it away.
  const filterBy = async (mode: RegExp) => {
    await page.getByRole('button', { name: /^Filter/ }).first().click()
    const filters = page.getByRole('region', { name: 'Filter trips' })
    await filters.getByRole('button', { name: mode }).click()
    await filters.getByRole('button', { name: /^Show \d+ trips?$/ }).click()
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

  await openAddTrip(page)
  const dialog = tripForm(page, 'Add trip')
  // The route starts and ends at home.
  await toStep(dialog, 'Route')
  await expect(dialog.getByRole('button', { name: 'Change where the trip started (Pasadena)' })).toBeVisible()
  await choosePlace(page, DEST, 'Las Vegas', /^Las Vegas\s*NV$/)
  await choosePlace(page, DEST, 'zion', /Zion National Park/)

  // Each place's marker says whether it's a main pin or a numbered stop; tap it to switch.
  const zion = dialog.getByRole('button', { name: 'Make Zion National Park a main destination' })
  await expect(zion).toHaveText('1')
  await zion.click()
  await expect(dialog.getByRole('button', { name: 'Zion National Park is a main destination' })).toHaveAttribute('aria-pressed', 'true')

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
  await saveNewTrip(dialog)
  await expect(dialog).toBeHidden()

  // The trip's stops are the places, without home.
  const route = tripDetails(page, /Las Vegas & Zion/).getByRole('list', { name: 'Stops' })
  await expect(route.getByRole('listitem')).toHaveText([/Las Vegas/, /Zion National Park/])

  // Every leg a drive, home included: a road trip.
  await page.goto('./#/trips')
  await page.getByRole('button', { name: /^Filter/ }).first().click()
  await page.getByRole('region', { name: 'Filter trips' }).getByRole('button', { name: /Road trip/ }).click()
  await page.getByRole('region', { name: 'Filter trips' }).getByRole('button', { name: /^Show \d+ trips?$/ }).click()
  await expect(page.getByRole('button', { name: /Las Vegas & Zion/ })).toHaveCount(1)

  // Moving home doesn't move this trip; new trips start at the new home.
  await openSettings(page)
  await settings.getByRole('combobox', { name: 'Change home' }).fill('Denver')
  await settings.getByRole('option', { name: /^Denver\s*CO$/ }).first().click()
  await expect(settings).toContainText('Trips can start and end at Denver')
  await openTrips(page)
  await page.getByRole('button', { name: /Las Vegas & Zion/ }).click()
  const card = tripDetails(page, /Las Vegas & Zion/)

  // Editing: the trip shows its own start, not the new home, and can switch to it.
  await card.getByRole('button', { name: 'Edit the stops' }).click()
  const edit = tripForm(page, 'Edit trip')
  await toStep(edit, 'Route')
  await expect(edit.getByLabel(/^Drive from Pasadena to Las Vegas/)).toBeVisible()
  await edit.getByRole('button', { name: 'Change where the trip started (Pasadena)' }).click()
  await edit.getByRole('button', { name: 'Use home (Denver)' }).click()
  await edit.getByRole('button', { name: 'Save' }).click()
  await card.getByRole('button', { name: 'Edit the stops' }).click()
  await toStep(tripForm(page, 'Edit trip'), 'Route')
  await expect(tripForm(page, 'Edit trip').getByRole('button', { name: 'Change where the trip started (Denver)' })).toBeVisible()
})

test('a destination can be swapped for another place from its row', async ({ page }) => {
  await page.goto('./')
  await openAddTrip(page)
  const dialog = tripForm(page, 'Add trip')
  await toStep(dialog, 'Route')
  await choosePlace(page, DEST, 'Las Vegas', /^Las Vegas\s*NV$/)
  await choosePlace(page, DEST, 'Reno', /^Reno\s*NV$/)
  // New places go after the last one, above the way back.
  const places = dialog.getByRole('region', { name: 'Where you went' }).getByRole('listitem')
  await expect(places).toHaveText([/Las Vegas/, /Reno/])

  const reno = dialog.getByRole('listitem', { name: 'Reno' })
  await reno.getByRole('button', { name: 'More for Reno' }).click()
  await page.getByRole('menuitem', { name: 'Change place or note' }).click()
  await reno.getByRole('combobox', { name: 'Change to another place' }).fill('Henderson, NV')
  await reno.getByRole('option', { name: /^Henderson\s*NV$/ }).first().click()
  await expect(places).toHaveText([/Las Vegas/, /Henderson/])

  // The ⋯ menu has no Move up / Move down: places are reordered by their drag handles.
  await dialog.getByRole('button', { name: 'More for Las Vegas' }).click()
  await expect(page.getByRole('menuitem')).toHaveText(['Change place or note', 'Remove Las Vegas'])
  await page.keyboard.press('Escape')
})

test('route places: drag handles reorder them, the name is edited in place', async ({ page }) => {
  await page.goto('./')
  const dialog = await openAddTrip(page)
  await toStep(dialog, 'Route')
  await choosePlace(page, DEST, 'Las Vegas', /^Las Vegas\s*NV$/)
  await choosePlace(page, DEST, 'Reno', /^Reno\s*NV$/)
  await choosePlace(page, DEST, 'bryce', /Bryce Canyon National Park/)
  const places = dialog.getByRole('region', { name: 'Where you went' }).getByRole('listitem')
  await expect(places).toHaveText([/Las Vegas/, /Reno/, /Bryce/])

  // Drag Bryce's handle up above Las Vegas.
  const handle = dialog.getByRole('button', { name: /^Reorder Bryce Canyon National Park/ })
  const from = (await handle.boundingBox())!
  const to = (await dialog.getByRole('listitem', { name: 'Las Vegas' }).boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2, to.y + 4, { steps: 10 })
  await page.mouse.up()
  await expect(places).toHaveText([/Bryce/, /Las Vegas/, /Reno/])
  // Letting go where it started changes nothing.
  const reno = dialog.getByRole('button', { name: /^Reorder Reno/ })
  const at = (await reno.boundingBox())!
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2)
  await page.mouse.down()
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2 + 5, { steps: 3 })
  await page.mouse.up()
  await expect(places).toHaveText([/Bryce/, /Las Vegas/, /Reno/])

  // The arrow keys move a place too, keeping the focus on its handle.
  await reno.focus()
  await page.keyboard.press('ArrowUp')
  await expect(places).toHaveText([/Bryce/, /Reno/, /Las Vegas/])
  await expect(reno).toBeFocused()

  // Tap a new place's name to rename it right there; Enter keeps it, Escape puts the old one back.
  await dialog.getByRole('button', { name: 'Rename Reno' }).click()
  const name = dialog.getByRole('textbox', { name: 'Reno name' })
  await name.fill('Reno Airport hotel')
  await name.press('Enter')
  await expect(places).toHaveText([/Bryce/, /Reno Airport hotel/, /Las Vegas/])
  await dialog.getByRole('button', { name: 'Rename Las Vegas' }).click()
  await dialog.getByRole('textbox', { name: 'Las Vegas name' }).fill('Somewhere else')
  await dialog.getByRole('textbox', { name: 'Las Vegas name' }).press('Escape')
  await expect(dialog).toBeVisible()
  await expect(places).toHaveText([/Bryce/, /Reno Airport hotel/, /Las Vegas/])
  // A park keeps its name: its title opens "Change place or note" instead.
  await dialog.getByRole('button', { name: 'Bryce Canyon National Park: change place or note' }).click()
  await expect(dialog.getByRole('combobox', { name: 'Change to another place' })).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: /name$/ })).toHaveCount(0)

  // The marker switches main and stop; the only main place (the first one added) can't stop being one.
  await expect(dialog.getByRole('button', { name: 'Las Vegas is a main destination' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Make Reno Airport hotel a main destination' }).click()
  await expect(dialog.getByRole('button', { name: 'Las Vegas is a main destination' })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Las Vegas is a main destination' }).click()
  await expect(dialog.getByRole('button', { name: 'Make Las Vegas a main destination' })).toHaveAttribute('aria-pressed', 'false')
})

test('cities abroad: biggest first, narrowed by country, and grouped by country', async ({ page }) => {
  await page.goto('./')
  await openAddTrip(page)
  const dialog = tripForm(page, 'Add trip')
  await toStep(dialog, 'Route')
  const search = dialog.getByRole('combobox', { name: DEST })
  await search.fill('Lisbon')
  await expect(dialog.getByRole('option').first()).toHaveText(/^Lisbon\s*Portugal$/)
  await search.fill('Porto, Portugal')
  await expect(dialog.getByRole('option').first()).toHaveText(/^Porto\s*Portugal$/)
  await search.fill('Lisbon')
  await dialog.getByRole('option', { name: /^Lisbon\s*Portugal$/ }).click()
  await choosePlace(page, DEST, 'Porto, Portugal', /^Porto\s*Portugal$/)
  await saveNewTrip(dialog)
  await expect(dialog).toBeHidden()
  await expect(tripDetails(page, /^Lisbon/)).toBeVisible()

  await page.goto('./#/trips')
  await page.getByRole('combobox', { name: 'Group by' }).selectOption('state')
  await expect(page.getByRole('heading', { name: /^Portugal/ })).toBeVisible()
})

test('stop dates from a strip of the trip days, shown as day numbers; details link to each step', async ({ page }) => {
  await page.goto('./')
  await openAddTrip(page)
  const dialog = tripForm(page, 'Add trip')
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
  // Nothing changes until Done.
  await expect(zion.getByRole('button', { name: /^Add dates/ })).toBeVisible()
  await zionDays.getByRole('button', { name: 'Done with the dates at Zion National Park' }).click()
  await expect(zionDays).toBeHidden()
  await expect(zion.getByRole('button', { name: /^Dates at Zion/ })).toHaveText(/Days 1–3 · May 1 – 3, 2024/)

  // The next stop picks up where the last left off.
  const bryce = dialog.getByRole('listitem', { name: 'Bryce Canyon National Park' })
  await bryce.getByRole('button', { name: /^Add dates/ }).click()
  const bryceDays = bryce.getByRole('group', { name: 'Days at Bryce Canyon National Park' })
  await bryceDays.getByRole('button', { name: /^Day 3,/ }).click()
  await bryceDays.getByRole('button', { name: /^Day 6,/ }).click()
  await bryceDays.getByRole('button', { name: 'Done with the dates at Bryce Canyon National Park' }).click()
  await expect(bryce.getByRole('button', { name: /^Dates at Bryce/ })).toHaveText(/Days 3–6/)
  await dialog.getByRole('button', { name: 'Next: Notes' }).click()
  await dialog.getByRole('textbox', { name: 'Add a tag' }).fill('canyons')
  await dialog.getByRole('textbox', { name: 'Add a tag' }).press('Enter')
  await saveNewTrip(dialog)
  await expect(dialog).toBeHidden()
  // Two parks on one trip earns a tier, announced with the save (Undo still there).
  // (One check: the message only shows for a moment.)
  await expect(page.getByRole('status')).toContainText(/🏅 Bronze · Park Hopper\s*Undo/)

  // Saved, the trip opens with its details: how long, each stop's days, and Edit on each part.
  const detail = tripDetails(page, /Zion/)
  // How long it was is under the trip's title, at the top of the Trips panel or sheet.
  await expect(page.getByRole('complementary', { name: 'Trips panel' })).toContainText('6 days')
  await expect(detail).toContainText('Days 1–3 · May 1 – 3, 2024')
  await detail.getByRole('button', { name: 'Edit the stops' }).click()
  const edit = tripForm(page, 'Edit trip')
  await expect(edit.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: 'Route', exact: true })).toHaveAttribute('aria-current', 'step')
  await page.keyboard.press('Escape')
  await expect(edit).toBeHidden()

  // The trip is still open. A tag shows your trips with that tag; Delete removes the trip, with Undo.
  await tripDetails(page, /Zion/).getByRole('button', { name: 'Show trips tagged canyons' }).click()
  await expect(page.getByRole('button', { name: 'Filter, 1 on' }).first()).toBeVisible()
  await page.getByRole('button', { name: /Zion 2024/ }).click()
  await tripDetails(page, /Zion/).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('status')).toContainText('Deleted')
})

test('dragging a bend never adds another, however quickly you let go; a tap after still adds one', async ({ page }) => {
  await page.goto('./')
  const dialog = await openAddTrip(page)
  await toStep(dialog, 'Route')
  await choosePlace(page, DEST, 'zion', /Zion National Park/)
  await choosePlace(page, DEST, 'Las Vegas', /^Las Vegas\s*NV$/)
  await dialog.getByRole('button', { name: 'Shape the route from Zion National Park to Las Vegas on the map' }).click()
  const banner = page.getByRole('region', { name: 'Shape the route' })
  const map = page.locator('[data-testid="map"] canvas')
  const box = (await map.boundingBox())!
  let x = box.x + box.width / 2
  let y = box.y + box.height * 0.6
  await page.mouse.click(x, y)
  await page.waitForTimeout(300)
  // Drag the dot around, letting go the moment it lands each time, and back and forth by a hair.
  // iPhones follow a finger lifted after a drag with a press and a click right where it let go
  // (before the dot may be drawn there): that click mustn't add a bend either.
  for (const [dx, dy] of [[-50, -30], [40, 10], [2, 1], [-30, 25], [1, 0], [60, -20]]) {
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + dx, y + dy, { steps: 2 })
    await page.mouse.up()
    x += dx
    y += dy
    await page.mouse.click(x, y)
  }
  await banner.getByRole('button', { name: 'Done' }).click()
  await expect(dialog.getByRole('button', { name: /^Shape the route from Zion/ })).toHaveText('Bends 1× · Edit')

  // A tap on the map a moment after a drag is a new bend.
  await dialog.getByRole('button', { name: /^Shape the route from Zion/ }).click()
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 20, y + 20, { steps: 2 })
  await page.mouse.up()
  await page.waitForTimeout(700)
  // (Right of the middle: on wider screens the left of the map is under the Trips panel.)
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.3)
  await banner.getByRole('button', { name: 'Done' }).click()
  await expect(dialog.getByRole('button', { name: /^Shape the route from Zion/ })).toHaveText('Bends 2× · Edit')
})

test('shaping a leg can follow the way you came, then take more taps', async ({ page }) => {
  await page.goto('./')
  await openAddTrip(page)
  const dialog = tripForm(page, 'Add trip')
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
    await openAddTrip(page)
    const dialog = tripForm(page, 'Add trip')
    await dialog.getByRole('textbox', { name: 'Title' }).fill(title)
    await dialog.getByRole('group', { name: 'Groups' }).getByRole('button', { name: /^Family/ }).click()
    await toStep(dialog, 'Route')
    await choosePlace(page, DEST, query, option)
    await toStep(dialog, 'Notes')
    if (title === 'First') {
      // Turning Family on in who went tagged the trip Family; new tags are typed.
      await expect(dialog.getByRole('button', { name: 'Remove the Family tag' })).toBeVisible()
      await dialog.getByRole('textbox', { name: 'Add a tag' }).fill('road food')
      await dialog.getByRole('textbox', { name: 'Add a tag' }).press('Enter')
    } else {
      // The second trip is offered the tags from the first.
      await dialog.getByRole('group', { name: "Tags you've used" }).getByRole('button', { name: '+ road food' }).click()
    }
    await saveNewTrip(dialog)
    await expect(dialog).toBeHidden()
  }

  const detail = tripDetails(page, 'Second')
  await expect(detail.getByRole('list', { name: 'Tags' })).toHaveText(/road food/)
  // Who went lists the people, not the group they're in.
  const who = detail.getByRole('heading', { name: 'Who went' }).locator('xpath=../following-sibling::ul')
  await expect(who.getByRole('listitem')).toHaveText([/Mom/, /Dad/])
})
