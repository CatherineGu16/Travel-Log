import { expect, test, type BrowserContext, type Page } from '@playwright/test'

/**
 * A fake GitHub for the browser: the repo check, travel.json (with sha conflicts) and binary photo
 * files, shared by every device in the test. No request leaves the machine.
 */
function fakeGitHub() {
  const files = new Map<string, { sha: string; content: Buffer }>()
  let version = 0
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type, x-github-api-version, accept',
    'access-control-allow-methods': 'GET, PUT, OPTIONS',
  }
  const json = (status: number, body: unknown) => ({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) })

  async function attach(context: BrowserContext) {
    await context.route('https://api.github.com/**', async (route) => {
      const req = route.request()
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      const url = new URL(req.url())
      if (url.pathname === '/repos/me/travel-data') return route.fulfill(json(200, { private: true }))
      const path = decodeURIComponent(url.pathname.replace('/repos/me/travel-data/contents/', ''))
      const file = files.get(path)
      if (req.method() === 'GET') {
        if (!file) return route.fulfill(json(404, { message: 'Not Found' }))
        if ((req.headers().accept ?? '').includes('raw')) return route.fulfill({ status: 200, headers: cors, body: file.content })
        return route.fulfill(json(200, { sha: file.sha, encoding: 'base64', content: file.content.toString('base64') }))
      }
      const body = req.postDataJSON() as { content: string; sha?: string }
      if ((file?.sha ?? undefined) !== body.sha) return route.fulfill(json(409, { message: 'sha mismatch' }))
      const sha = `v${++version}`
      files.set(path, { sha, content: Buffer.from(body.content, 'base64') })
      return route.fulfill(json(200, { content: { sha } }))
    })
  }
  return { attach, files, travel: () => JSON.parse(files.get('travel.json')!.content.toString('utf8')) }
}

// A 1×1 PNG.
const PHOTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

async function connect(page: Page, device: string) {
  await page.getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  await settings.getByRole('textbox', { name: 'GitHub username' }).fill('me')
  await settings.getByLabel('Access key').fill('github_pat_test')
  await settings.getByRole('textbox', { name: 'This device', exact: true }).fill(device)
  await settings.getByRole('button', { name: 'Connect' }).click()
  await expect(settings.getByText('Last synced just now.')).toBeVisible()
  await settings.getByRole('button', { name: 'Close' }).click()
}

async function addTrip(page: Page, main: [string, RegExp], who?: string) {
  await page.getByRole('button', { name: 'Add trip' }).filter({ visible: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add trip' })
  await dialog.getByRole('combobox', { name: 'Main destination' }).fill(main[0])
  await dialog.getByRole('option', { name: main[1] }).first().click()
  if (who) {
    await dialog.getByRole('searchbox', { name: 'Add a person' }).fill(who)
    await dialog.getByRole('button', { name: who, exact: true }).click()
  }
  await dialog.getByRole('button', { name: 'Add trip', exact: true }).click()
  await expect(dialog).toBeHidden()
}

const synced = (page: Page) => expect(page.getByRole('button', { name: 'Synced. Sync now' })).toBeVisible({ timeout: 15_000 })

test('a trip and a photo avatar added on the phone appear on the PC, and edits from both merge', async ({ page: phone, browser }) => {
  test.setTimeout(90_000)
  const gh = fakeGitHub()
  await gh.attach(phone.context())
  await phone.goto('./')
  await connect(phone, 'Phone')

  // Phone: a person with a photo avatar, then a trip with them.
  await phone.getByRole('button', { name: 'People & groups' }).click()
  const people = phone.getByRole('dialog', { name: 'People & groups' })
  await people.getByRole('button', { name: '+ Add person' }).click()
  const editor = phone.getByRole('dialog', { name: 'Add person' })
  await editor.getByRole('textbox', { name: 'Name' }).fill('Mom')
  await editor.getByRole('radio', { name: 'Photo' }).click()
  await editor.getByLabel('Photo', { exact: true }).setInputFiles({ name: 'mom.png', mimeType: 'image/png', buffer: PHOTO })
  await expect(editor.locator('img')).toHaveCount(1) // the cropped preview
  await editor.getByRole('button', { name: 'Save' }).click()
  await phone.getByRole('dialog', { name: 'People & groups' }).getByRole('button', { name: 'Close' }).click()
  await addTrip(phone, ['moab', /^Moab/], 'Mom')
  await synced(phone)

  // The photo went up before the travel.json that points to it.
  const mom = gh.travel().people.find((p: { name: string }) => p.name === 'Mom')
  expect(mom.avatar.kind).toBe('photo')
  expect(gh.files.has(`avatars/${mom.id}.jpg`)).toBe(true)

  // PC: connect, and the trip and Mom's photo are there.
  const pcContext = await browser.newContext()
  await gh.attach(pcContext)
  const pc = await pcContext.newPage()
  await pc.goto('./')
  await connect(pc, 'PC')
  await pc.goto('./#/trips')
  await expect(pc.getByRole('button', { name: /Moab/ })).toBeVisible()
  await pc.getByRole('button', { name: 'People & groups' }).click()
  await expect(pc.getByRole('dialog', { name: 'People & groups' }).locator('img')).toHaveCount(1)
  await pc.getByRole('dialog', { name: 'People & groups' }).getByRole('button', { name: 'Close' }).click()

  // Both devices add a trip; after syncing, both have both.
  await addTrip(phone, ['chicago', /^Chicago/])
  await addTrip(pc, ['denver', /^Denver/])
  await synced(phone)
  await synced(pc)
  await phone.reload()
  await synced(phone)
  for (const device of [phone, pc]) {
    await device.goto('./#/trips')
    for (const title of [/Moab/, /Chicago/, /Denver/]) await expect(device.getByRole('button', { name: title })).toBeVisible()
  }
  expect(gh.travel().trips.map((t: { title: string }) => t.title).sort()).toEqual(expect.arrayContaining([expect.stringMatching(/Chicago/), expect.stringMatching(/Denver/), expect.stringMatching(/Moab/)]))
  await pcContext.close()
})
