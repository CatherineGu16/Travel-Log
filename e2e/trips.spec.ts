import { expect, test, type Page } from '@playwright/test'
import { dateRange, openDates, pickDays, setTripYear, toStep } from './helpers.ts'

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
    await row.getByRole('button', { name: /Add dates/ }).click()
    await row.getByRole('checkbox', { name: 'I know when I was here' }).check()
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

test('who went: people sorted under their groups, each marked as going or not', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'People & groups' }).click()
  const people = page.getByRole('dialog', { name: 'People & groups' })
  for (const [name, group] of [
    ['Mom', 'Family'],
    ['Dad', 'Family'],
    ['Sam', 'Friends'],
  ]) {
    await people.getByRole('button', { name: '+ Add person' }).click()
    const editor = page.getByRole('dialog', { name: 'Add person' })
    await editor.getByRole('textbox', { name: 'Name' }).fill(name)
    await editor.getByRole('checkbox', { name: group }).check()
    await editor.getByRole('button', { name: 'Save' }).click()
  }
  await page.getByRole('dialog', { name: 'People & groups' }).getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  const family = dialog.getByRole('group', { name: 'Family' })
  const friends = dialog.getByRole('group', { name: 'Friends' })
  await expect(family.getByRole('button')).toHaveText([/Dad/, /Mom/])
  await expect(friends.getByRole('button')).toHaveText([/Sam/])
  // Groups only sort people: nothing adds a whole group.
  await expect(dialog.getByRole('button', { name: /^\+ (Family|Friends)$/ })).toHaveCount(0)

  const mom = family.getByRole('button', { name: 'Mom' })
  await mom.click()
  await expect(mom).toHaveAttribute('aria-pressed', 'true')
  await expect(family.getByRole('button', { name: 'Dad' })).toHaveAttribute('aria-pressed', 'false')
  await expect(dialog).toContainText('1 person')
  await mom.click()
  await expect(mom).toHaveAttribute('aria-pressed', 'false')

  // Someone new goes in whichever groups you pick, and is marked as going.
  await dialog.getByRole('searchbox', { name: 'Add a person' }).fill('Alex')
  await dialog.getByRole('checkbox', { name: 'Friends' }).check()
  await dialog.getByRole('button', { name: 'Add “Alex”' }).click()
  await expect(friends.getByRole('button')).toHaveText([/Alex/, /Sam/])
  await expect(friends.getByRole('button', { name: 'Alex' })).toHaveAttribute('aria-pressed', 'true')
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
  await dialog.getByRole('textbox', { name: 'Tags' }).fill('camping, desert')
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
  const route = page.getByRole('region', { name: 'Los Angeles trips' }).getByRole('list', { name: 'Route' })
  await expect(route).toContainText('Train to')
  await expect(route).toContainText('Flight to')

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

test('a road trip from home that comes back the same way, with two main pins', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
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
  await dialog.getByRole('checkbox', { name: 'Came back the same way' }).check()
  await expect(dialog).toContainText('Back the same way')
  // Home is reached from the first stop, along the way back.
  await dialog.getByRole('button', { name: /^Flight from Las Vegas to Pasadena/ }).click()
  await dialog.getByRole('group', { name: 'How you got from Las Vegas to Pasadena' }).getByRole('button', { name: 'Drive' }).click()
  await expect(dialog.getByLabel(/^Drive from Las Vegas to Pasadena/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()

  const route = page.getByRole('region', { name: 'Las Vegas trips' }).getByRole('list', { name: 'Route' })
  await expect(route).toContainText('Pasadena')
  await expect(route).toContainText('same way back')

  // Every leg a drive, home included: a road trip.
  await page.goto('./#/trips')
  await page.getByRole('button', { name: /^Filter/ }).first().click()
  await page.getByRole('dialog', { name: /Filter/ }).getByRole('button', { name: /Road trip/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /Las Vegas & Zion/ })).toHaveCount(1)

  // Moving home doesn't move this trip; new trips start at the new home.
  await page.getByRole('button', { name: 'Settings' }).click()
  await settings.getByRole('combobox', { name: 'Change home' }).fill('Denver')
  await settings.getByRole('option', { name: /^Denver\s*CO$/ }).first().click()
  await expect(settings).toContainText('Trips can start and end at Denver')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /Las Vegas & Zion/ }).click()
  const card = page.getByRole('region', { name: 'Las Vegas trips' })
  await expect(card.getByRole('list', { name: 'Route' })).toContainText('Pasadena')
  await expect(card.getByRole('list', { name: 'Route' })).not.toContainText('Denver')

  // Editing: the trip shows its own start, and can switch to the new home.
  await card.getByRole('button', { name: /^Edit/ }).click()
  const edit = page.getByRole('dialog', { name: 'Edit trip' })
  await toStep(edit, 'Route')
  await expect(edit.getByLabel(/^Drive from Pasadena to Las Vegas/)).toBeVisible()
  await edit.getByRole('button', { name: 'Change where the trip started (Pasadena)' }).click()
  await edit.getByRole('button', { name: 'Use home (Denver)' }).click()
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(card.getByRole('list', { name: 'Route' })).toContainText('Denver')
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
  await reno.getByRole('button', { name: /Add dates/ }).click()
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
