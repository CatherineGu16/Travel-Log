import type { Locator, Page } from '@playwright/test'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Goes to a step of the trip form: Details, Route or Notes. */
export const toStep = (dialog: Locator, name: 'Details' | 'Route' | 'Notes') =>
  dialog.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name, exact: true }).click()

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A date range picker, found by its label ("Trip dates", "Dates at Zion National Park"). */
export const dateRange = (scope: Locator, label: string) => scope.getByRole('group', { name: new RegExp(`^${escape(label)}`) })

/** Opens a date range picker's calendar if it's folded away. */
export async function openDates(scope: Locator, label: string) {
  const toggle = dateRange(scope, label).getByRole('button', { name: new RegExp(`^Change ${escape(label)}`) })
  if (await toggle.count()) await toggle.click()
}

/** Picks a range of days ("2024-05-01" to "2024-05-03") by tapping the first day, then the last. */
export async function pickDays(scope: Locator, label: string, from: string, to: string) {
  await openDates(scope, label)
  const picker = dateRange(scope, label)
  for (const date of [from, to]) {
    const [y, m, d] = date.split('-').map(Number)
    await picker.getByRole('combobox', { name: `${label} calendar year` }).selectOption(String(y))
    await picker.getByRole('combobox', { name: `${label} calendar month` }).selectOption(String(m))
    await picker.getByRole('button', { name: `${MONTHS[m - 1]} ${d}, ${y}`, exact: true }).click()
  }
}

/** Sets the trip's dates to one whole year, using the range picker's year mode. */
export async function setTripYear(dialog: Locator, year: string) {
  await openDates(dialog, 'Trip dates')
  const picker = dateRange(dialog, 'Trip dates')
  await picker.getByRole('radiogroup', { name: 'Trip dates precision' }).getByRole('radio', { name: 'Year' }).click()
  const button = picker.getByRole('button', { name: year, exact: true })
  // The grid shows twelve years at a time.
  for (let i = 0; i < 10 && !(await button.count()); i++) {
    const first = Number((await picker.getByRole('button', { name: /^\d{4}$/ }).first().textContent()) ?? 0)
    await picker.getByRole('button', { name: Number(year) < first ? 'Previous years' : 'Next years' }).click()
  }
  // Tapped twice: the first and the last year.
  await button.click()
  await button.click()
}

/** A trip's details: a full-screen sheet on phones, in the Trips panel over the map on wider screens. */
export const tripDetails = (page: Page, name: string | RegExp) =>
  page.getByRole('dialog', { name }).or(page.getByRole('complementary', { name: 'Trips panel' }).getByRole('region', { name, exact: true }))

/** Goes to the You page (its Profile). */
export const openYou = (page: Page) => page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'You' }).filter({ visible: true }).click()

/** Goes to a section of the You page by its menu (tabs on phones), and returns the section. */
export async function openYouSection(page: Page, name: 'Profile' | 'Achievements' | 'People & groups' | 'Settings') {
  await openYou(page)
  await page.getByRole('navigation', { name: 'You sections' }).getByRole('link', { name, exact: true }).click()
  return page.getByRole('region', { name, exact: true })
}

/** Opens People & groups (on the You page). */
export const openPeople = (page: Page) => openYouSection(page, 'People & groups')

/** Opens Settings (on the You page), where sync, Home, map detail and backups live. */
export const openSettings = (page: Page) => openYouSection(page, 'Settings')
