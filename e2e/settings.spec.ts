import { expect, test, type Page } from '@playwright/test'

/** The trip form's place search: "Add a destination", then "Add another destination". */
const DEST = /^Add (a|another) destination$/

async function addTrip(page: Page, query: string, option: RegExp) {
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await dialog.getByRole('combobox', { name: DEST }).fill(query)
  await dialog.getByRole('option', { name: option }).first().click()
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()
}

const openSettings = async (page: Page) => {
  await page.getByRole('button', { name: 'Settings' }).click()
  return page.getByRole('dialog', { name: 'Settings' })
}

test('export a backup and import it on another device', async ({ page, browser }) => {
  await page.goto('./')
  await addTrip(page, 'moab', /^Moab/)
  await addTrip(page, 'zion', /Zion National Park/)

  const settings = await openSettings(page)
  const [file] = await Promise.all([page.waitForEvent('download'), settings.getByRole('button', { name: 'Export' }).click()])
  expect(file.suggestedFilename()).toMatch(/^travel-log-\d{4}-\d{2}-\d{2}\.zip$/)
  const path = await file.path()

  const other = await (await browser.newContext()).newPage()
  await other.goto('./')
  const otherSettings = await openSettings(other)
  await otherSettings.getByLabel('Backup file').setInputFiles(path)
  await expect(otherSettings.getByRole('group', { name: 'Confirm import' })).toContainText('has 2 trips')
  await otherSettings.getByRole('button', { name: 'Merge (keep both)' }).click()
  await expect(otherSettings.getByRole('status')).toContainText('Imported 2 trips')
  await otherSettings.getByRole('button', { name: 'Close' }).click()
  await other.reload()
  await other.goto('./#/trips')
  await expect(other.getByRole('button', { name: /Moab/ })).toBeVisible()
  await expect(other.getByRole('button', { name: /Zion/ })).toBeVisible()
  await other.context().close()
})

test('the detailed map setting adds OpenFreeMap tiles and Photon search; outline contacts nobody', async ({ page }) => {
  const outside: string[] = []
  page.on('request', (r) => {
    if (new URL(r.url()).hostname !== 'localhost') outside.push(new URL(r.url()).hostname)
  })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const cors = { 'access-control-allow-origin': '*' }
  // A stand-in OpenFreeMap: a style with a background, a fill, a label with an icon, and a shield.
  await page.route('https://tiles.openfreemap.org/**', (route) => {
    if (route.request().url().includes('/styles/'))
      return route.fulfill({
        headers: cors,
        contentType: 'application/json',
        body: JSON.stringify({
          version: 8,
          sources: { openmaptiles: { type: 'vector', tiles: ['https://tiles.openfreemap.org/t/{z}/{x}/{y}.pbf'], maxzoom: 14 } },
          layers: [
            { id: 'background', type: 'background', paint: { 'background-color': '#eeeeee' } },
            { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': '#99ccff' } },
            {
              id: 'label_city',
              type: 'symbol',
              source: 'openmaptiles',
              'source-layer': 'place',
              layout: { 'text-field': '{name}', 'text-font': ['Noto Sans Regular'], 'icon-image': 'dot' },
            },
            { id: 'highway-shield-us', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', layout: { 'icon-image': 'shield' } },
          ],
        }),
      })
    return route.fulfill({ status: 204, headers: cors })
  })
  await page.route('https://photon.komoot.io/**', (route) =>
    route.fulfill({
      headers: cors,
      contentType: 'application/json',
      body: JSON.stringify({
        features: [
          {
            properties: { name: 'Angels Landing', county: 'Washington', state: 'Utah', countrycode: 'US' },
            geometry: { coordinates: [-112.948, 37.2693] },
          },
        ],
      }),
    }),
  )

  await page.goto('./')
  await expect(page.locator('[data-testid="map"] canvas')).toBeVisible()
  await page.getByRole('button', { name: 'Zoom in' }).click()
  expect(outside).toEqual([])

  const settings = await openSettings(page)
  await settings.getByRole('radio', { name: 'Detailed' }).click()
  await expect(settings).toContainText('OpenFreeMap')
  await settings.getByRole('button', { name: 'Close' }).click()
  await expect.poll(() => outside.includes('tiles.openfreemap.org')).toBe(true)

  // Place search now also finds landmarks online.
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await dialog.getByRole('combobox', { name: DEST }).fill('Angels Landing')
  await dialog.getByRole('option', { name: /Angels Landing.*Washington, UT.*OSM/ }).click()
  const row = dialog.getByRole('listitem', { name: 'Angels Landing' })
  await expect(row).toContainText('UT')
  // A landmark inside a park offers to count the trip as a park visit.
  await expect(row.getByRole('status')).toContainText('inside Zion National Park')
  expect(errors).toEqual([])
})
