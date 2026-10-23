import type { Locator } from '@playwright/test'

/** Sets the trip's dates to one whole year, using the range picker's year mode. */
export async function setTripYear(dialog: Locator, year: string) {
  await dialog.getByRole('radiogroup', { name: 'Trip dates precision' }).getByRole('radio', { name: 'Year' }).click()
  for (const which of ['start', 'end']) {
    const input = dialog.getByRole('textbox', { name: `Trip dates ${which}` })
    await input.fill(year)
    await input.press('Enter')
  }
}
