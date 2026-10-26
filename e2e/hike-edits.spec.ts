import { expect, test, type BrowserContext, type Page } from '@playwright/test'

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
  await page.getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  await settings.getByRole('textbox', { name: 'GitHub username' }).fill(username)
  await settings.getByLabel('Access key').fill('github_pat_test')
  await settings.getByRole('textbox', { name: 'This device', exact: true }).fill('laptop')
  await settings.getByRole('button', { name: 'Connect' }).click()
  await expect(settings.getByText('Last synced just now.')).toBeVisible()
  await settings.getByRole('button', { name: 'Close' }).click()
}

const openZion = async (page: Page) => {
  await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Parks' }).filter({ visible: true }).click()
  await page.getByRole('listitem', { name: 'Zion' }).getByRole('button', { name: /Zion/ }).click()
  return page.getByRole('dialog', { name: 'Zion National Park' })
}

test("the public repo's owner corrects a suggested hike, and it's shared to the public list", async ({ page, context }) => {
  const gh = fakeGitHub('CatherineGu16')
  await gh.attach(context)
  await page.goto('./')
  await connect(page, 'CatherineGu16')

  const sheet = await openZion(page)
  await sheet.getByRole('button', { name: /Correct the NPS hike info/ }).click()
  await sheet.getByRole('button', { name: 'Edit Angels Landing' }).click()
  const form = sheet.getByRole('group', { name: 'Edit Angels Landing' })
  await form.getByRole('textbox', { name: 'Distance (mi)' }).fill('5.4')
  await form.getByRole('button', { name: 'Save' }).click()

  // The suggestion shows the correction at once.
  await sheet.getByRole('combobox', { name: 'Add a hike' }).fill('angels')
  await expect(sheet.getByRole('option', { name: /^Angels Landing/ })).toContainText('5.4 mi')
  await sheet.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: /Sync now/ }).click()
  await expect.poll(() => gh.read('Travel-Log/src/data/hike-edits.json')?.zion?.['angels-landing']?.distanceMi).toBe(5.4)
})

test('nobody else sees the correction tools', async ({ page, context }) => {
  const gh = fakeGitHub('someone')
  await gh.attach(context)
  await page.goto('./')
  await connect(page, 'someone')
  const sheet = await openZion(page)
  await expect(sheet.getByRole('combobox', { name: 'Add a hike' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: /Correct the NPS hike info/ })).toHaveCount(0)
})
