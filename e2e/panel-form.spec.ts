import { expect, test } from '@playwright/test'
import { openAddTrip, openYou, toStep, tripForm } from './helpers.ts'

test('wider screens: Add trip opens the form in the Trips panel, which stays while you shape a leg', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Phones keep the full-screen form')
  await page.goto('./')
  // Add trip in the toolbar opens the form in the Trips panel.
  const panel = page.getByRole('complementary', { name: 'Trips panel' })
  await page.locator('header').getByRole('button', { name: 'Add trip' }).click()
  const form = panel.getByRole('region', { name: 'Add trip', exact: true })
  await expect(form).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(panel.getByRole('navigation', { name: 'Breadcrumb' })).toHaveText(/Trips\s*›\s*Add trip/)
  // While it's open the panel can't be hidden.
  await expect(panel.getByRole('button', { name: 'Hide trips' })).toHaveCount(0)

  await toStep(form, 'Route')
  for (const [q, o] of [['zion', /Zion National Park/], ['Las Vegas', /^Las Vegas\s*NV$/]] as const) {
    await form.getByRole('combobox', { name: /^Add (a|another) destination$/ }).fill(q)
    await form.getByRole('option', { name: o }).first().click()
  }
  await form.getByRole('button', { name: /^Shape the route from Zion/ }).click()
  const banner = page.getByRole('region', { name: 'Shape the route' })
  await expect(banner).toBeVisible()
  await expect(form).toBeVisible()
  const map = page.locator('[data-testid="map"] canvas')
  const box = (await map.boundingBox())!
  await map.click({ position: { x: box.width * 0.7, y: box.height * 0.5 } })
  await banner.getByRole('button', { name: 'Done' }).click()
  await expect(form.getByRole('button', { name: /^Shape the route from Zion/ })).toHaveText('Bends 1× · Edit')

  // Going to You and back keeps what you entered; Escape (like the ✕) asks before throwing it away.
  await openYou(page)
  await page.getByRole('link', { name: 'Map' }).click()
  await expect(form.getByText('Zion National Park', { exact: true })).toBeVisible()
  await form.getByText('Where you went').click()
  await page.keyboard.press('Escape')
  await form.getByRole('group', { name: 'Discard changes' }).getByRole('button', { name: 'Discard' }).click()
  await expect(form).toBeHidden()
  await expect(panel.getByRole('searchbox', { name: 'Search trips' })).toBeVisible()
})

test('Add trip from the You page opens the form over the map', async ({ page }) => {
  await page.goto('./#/you')
  const form = await openAddTrip(page)
  await expect(form).toBeVisible()
})

test('wider screens: the breadcrumb leaves the trip form, asking first if you changed anything', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Phones keep the full-screen form')
  await page.goto('./')
  const panel = page.getByRole('complementary', { name: 'Trips panel' })
  const crumbs = panel.getByRole('navigation', { name: 'Breadcrumb' })

  // Nothing typed yet: Trips goes straight back to the list.
  let form = await openAddTrip(page)
  await crumbs.getByRole('link', { name: 'Trips' }).click()
  await expect(form).toBeHidden()
  await expect(panel.getByRole('searchbox', { name: 'Search trips' })).toBeVisible()

  // With a change, it asks: keep editing, or discard and go.
  form = await openAddTrip(page)
  await form.getByRole('textbox', { name: 'Title' }).fill('Somewhere')
  await crumbs.getByRole('link', { name: 'Trips' }).click()
  const ask = form.getByRole('group', { name: 'Discard changes' })
  await expect(ask).toContainText('Discard this trip?')
  await ask.getByRole('button', { name: 'Keep editing' }).click()
  await expect(form.getByRole('textbox', { name: 'Title' })).toHaveValue('Somewhere')
  await crumbs.getByRole('link', { name: 'Trips' }).click()
  await ask.getByRole('button', { name: 'Discard' }).click()
  await expect(form).toBeHidden()
  await expect(page).toHaveURL(/#\/trips$/)
})

test('wider screens: the ✕ by the heading cancels the trip form', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Phones have their own ✕')
  await page.goto('./')
  const form = await openAddTrip(page)
  await page.getByRole('complementary', { name: 'Trips panel' }).getByRole('button', { name: 'Cancel add trip' }).click()
  await expect(form).toBeHidden()
})

test('the trip form has two buttons: Cancel or Back, then Next until Notes, where Add trip is', async ({ page }) => {
  await page.goto('./')
  const form = await openAddTrip(page)
  const footer = form.getByRole('button', { name: /^(Cancel|Back|Next: \w+|Add trip)$/ })
  await expect(footer).toHaveText(['Cancel', 'Next: Route'])
  await footer.getByText('Next: Route').click()
  await form.getByRole('combobox', { name: /^Add (a|another) destination$/ }).fill('zion')
  await form.getByRole('option', { name: /Zion National Park/ }).first().click()
  await expect(footer).toHaveText(['Back', 'Next: Notes'])
  await footer.getByText('Next: Notes').click()
  await expect(footer).toHaveText(['Back', 'Add trip'])
})

test('phones: no toolbar, map credits folded, and Add trip slides up over the whole screen with a quick ✕', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Wider screens have the toolbar')
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Travel Log' })).toBeHidden()
  // The map credits start folded into their ⓘ button.
  await expect(page.locator('.maplibregl-ctrl-attrib')).toBeVisible()
  await expect(page.locator('.maplibregl-ctrl-attrib.maplibregl-compact-show')).toHaveCount(0)

  // It covers the tab bar and the Trips sheet; the ✕ cancels it straight away when nothing's changed.
  let form = await openAddTrip(page)
  await expect(page.getByRole('dialog', { name: 'Add trip' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Trips panel' })).toBeHidden()
  await page.getByRole('button', { name: 'Cancel add trip' }).click()
  await expect(form).toBeHidden()
  await expect(page.getByRole('complementary', { name: 'Trips panel' })).toBeVisible()

  form = await openAddTrip(page)
  await expect(form.getByRole('button', { name: 'Next: Route' })).toBeInViewport()
  await toStep(form, 'Route')
  await form.getByRole('combobox', { name: /^Add (a|another) destination$/ }).fill('zion')
  await form.getByRole('option', { name: /Zion National Park/ }).first().click()
  await form.getByRole('button', { name: 'Next: Notes' }).click()
  await expect(form.getByRole('button', { name: 'Add trip', exact: true })).toBeInViewport()
  await form.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(form).toBeHidden()
  // Editing slides up the same way, with Save in reach.
  await page.getByRole('button', { name: 'Edit the stops' }).click()
  await expect(page.getByRole('dialog', { name: 'Edit trip' })).toBeVisible()
  await expect(tripForm(page, 'Edit trip').getByRole('button', { name: 'Save' })).toBeInViewport()
})
