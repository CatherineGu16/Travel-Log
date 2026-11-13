import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { openParks, openSettings } from './helpers.ts'

/** A fake GitHub with the owner's private data repo and the public app repo. No request leaves the machine. */
function fakeGitHub(owner: string) {
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
      if (url.pathname === `/repos/${owner}/travel-data`) return route.fulfill(json(200, { private: true }))
      const m = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/contents\/(.+)$/)
      if (!m || m[1] !== owner) return route.fulfill(json(404, { message: 'Not Found' }))
      const key = `${m[2]}/${decodeURIComponent(m[3])}`
      const file = files.get(key)
      if (req.method() === 'GET') {
        if (!file) return route.fulfill(json(404, { message: 'Not Found' }))
        return route.fulfill(json(200, { sha: file.sha, encoding: 'base64', content: file.content.toString('base64') }))
      }
      const body = req.postDataJSON() as { content: string; sha?: string }
      if ((file?.sha ?? undefined) !== body.sha) return route.fulfill(json(409, { message: 'sha mismatch' }))
      const sha = `v${++version}`
      files.set(key, { sha, content: Buffer.from(body.content, 'base64') })
      return route.fulfill(json(200, { content: { sha } }))
    })
  }
  return { attach, read: (key: string) => (files.has(key) ? JSON.parse(files.get(key)!.content.toString('utf8')) : null) }
}

async function connect(page: Page, username: string) {
  await openSettings(page)
  const settings = page.getByRole('region', { name: 'Settings', exact: true })
  await settings.getByRole('textbox', { name: 'GitHub username' }).fill(username)
  await settings.getByLabel('Access key').fill('github_pat_test')
  await settings.getByRole('textbox', { name: 'This device', exact: true }).fill('laptop')
  await settings.getByRole('button', { name: 'Connect' }).click()
  await expect(settings.getByText('Last synced just now.')).toBeVisible()
}

const openZion = async (page: Page) => {
  await openParks(page)
  await page.getByRole('listitem', { name: 'Zion' }).getByRole('button', { name: /Zion/ }).click()
  return page.getByRole('dialog', { name: 'Zion National Park' })
}

test("the public repo's owner corrects a suggested hike, and it's shared to the public list", async ({ page, context }) => {
  const gh = fakeGitHub('CatherineGu16')
  await gh.attach(context)
  await page.goto('./')
  await connect(page, 'CatherineGu16')

  const sheet = await openZion(page)
  await sheet.getByRole('button', { name: /Correct the hike suggestions/ }).click()
  await sheet.getByRole('button', { name: 'Edit Angels Landing' }).click()
  const form = sheet.getByRole('group', { name: 'Edit Angels Landing' })
  await form.getByRole('textbox', { name: 'Distance (mi)' }).fill('5.4')
  await form.getByRole('button', { name: 'Save' }).click()

  // The suggestion shows the correction at once.
  await sheet.getByRole('combobox', { name: 'Add a hike' }).fill('angels')
  await expect(sheet.getByRole('option', { name: /^Angels Landing/ })).toContainText('5.4 mi')
  await sheet.getByRole('button', { name: 'Close' }).click()

  // The sync status is in the toolbar (wider screens) or by the Parks button on the map (phones).
  await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Map' }).filter({ visible: true }).click()
  await page.getByRole('button', { name: /Sync now/ }).click()
  await expect.poll(() => gh.read('Travel-Log/src/data/hike-edits.json')?.zion?.['angels-landing']?.distanceMi).toBe(5.4)
})

test("the owner corrects a hike people added: renamed, given a distance, or not suggested any more", async ({ page, context }) => {
  const gh = fakeGitHub('CatherineGu16')
  await gh.attach(context)
  await page.goto('./')
  await connect(page, 'CatherineGu16')

  // Panoramic Point is on the shared list of added hikes (src/data/added-hikes.json) for Kings Canyon.
  await openParks(page)
  await page.getByRole('listitem', { name: 'Kings Canyon' }).getByRole('button', { name: /Kings Canyon/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Kings Canyon National Park' })
  await sheet.getByRole('button', { name: /Correct the hike suggestions/ }).click()
  const added = sheet.getByRole('list', { name: 'Added hikes' })
  await added.getByRole('button', { name: 'Edit Panoramic Point' }).click()
  const form = sheet.getByRole('group', { name: 'Edit Panoramic Point' })
  await form.getByRole('textbox', { name: 'Name' }).fill('Panoramic Point Trail')
  await form.getByRole('textbox', { name: 'Distance (mi)' }).fill('2.5')
  await form.getByLabel('Distance is').selectOption('round trip')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(added.getByRole('listitem')).toContainText(['Panoramic Point Trail'])
  await expect(added).toContainText('corrected')

  // The suggestion shows it at once, renamed and with its distance.
  await sheet.getByRole('combobox', { name: 'Add a hike' }).fill('panoramic')
  await expect(sheet.getByRole('option', { name: /^Panoramic Point Trail/ })).toContainText('2.5 mi')
  await sheet.getByRole('combobox', { name: 'Add a hike' }).fill('')

  // Shared to the public corrections on the next sync, under the name it was added with.
  await sheet.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Map' }).filter({ visible: true }).click()
  await page.getByRole('button', { name: /Sync now/ }).click()
  await expect.poll(() => gh.read('Travel-Log/src/data/hike-edits.json')?.['kings-canyon']?.['added:panoramic point']?.name).toBe('Panoramic Point Trail')

  // "Don't suggest this hike" takes it out of the suggestions.
  await openParks(page)
  await page.getByRole('listitem', { name: 'Kings Canyon' }).getByRole('button', { name: /Kings Canyon/ }).click()
  await sheet.getByRole('button', { name: /Correct the hike suggestions/ }).click()
  await added.getByRole('button', { name: 'Edit Panoramic Point Trail' }).click()
  await sheet.getByRole('group', { name: 'Edit Panoramic Point Trail' }).getByRole('checkbox', { name: "Don't suggest this hike" }).check()
  await sheet.getByRole('group', { name: 'Edit Panoramic Point Trail' }).getByRole('button', { name: 'Save' }).click()
  await sheet.getByRole('combobox', { name: 'Add a hike' }).fill('panoramic')
  await expect(sheet.getByRole('option', { name: /^Panoramic Point/ })).toHaveCount(0)
})

test('nobody else sees the correction tools', async ({ page, context }) => {
  const gh = fakeGitHub('someone')
  await gh.attach(context)
  await page.goto('./')
  await connect(page, 'someone')
  const sheet = await openZion(page)
  await expect(sheet.getByRole('combobox', { name: 'Add a hike' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: /Correct the hike suggestions/ })).toHaveCount(0)
})
