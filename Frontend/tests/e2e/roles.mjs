// Read restrictions by job: areas outside a person's job stay closed even when the URL is typed directly,
// searched for, or asked about; executives get the business view of a problem; a job change takes effect.
// Requires the dev server on :5173 and Playwright (npm i -D playwright && npx playwright install chromium).
import { chromium } from 'playwright'
import { signIn } from './login.mjs'
const base = 'http://localhost:5173'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); page.setDefaultTimeout(10000)
const errors = []
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 200)} @ ${page.url()}`) })
const ok = (c, m) => console.log(`${c ? '✓' : '✗'} ${m}`)
const step = async (name, fn) => { try { await fn() } catch (e) { await page.screenshot({ path: `fail5-${name}.png` }); console.log('✗', name, e.message.split('\n').slice(0, 2).join(' | ')) } }
const signOut = () => page.evaluate(() => { const k = 'do-safe-unified-demo-db'; const v = localStorage.getItem(k); if (!v) return; const s = JSON.parse(v); s.state.db.settings.authenticated = false; localStorage.setItem(k, JSON.stringify(s)) })
const as = async (name) => { await signOut(); await signIn(page, base, name, 'Northstar'); await page.getByRole('heading', { name: /Welcome back/ }).waitFor() }
const restricted = async (path, area) => {
  await page.goto(base + path)
  await page.getByRole('heading', { name: new RegExp(`${area} isn’t part of your job`) }).waitFor()
  return true
}
const opens = async (path) => {
  await page.goto(base + path); await page.locator('main h1').first().waitFor()
  return !(await page.getByText('isn’t part of your job').count())
}

await page.goto(base + '/login'); await page.evaluate(() => localStorage.clear())

await step('Executive', async () => {
  await as('Elena Marsh')
  ok(await restricted('/integrations', 'Integrations'), 'Executive: integrations closed even by URL')
  await page.goto(base + '/operations/findings/FND-1001'); await page.getByText('Business view').waitFor()
  ok(!(await page.getByRole('tab', { name: /Source & Evidence/ }).count()), 'Executive: finding page shows the business view, no raw evidence')
  ok(await opens('/crq'), 'Executive: can open financial risk')
})

await step('Analyst', async () => {
  await as('Priya Raman')
  ok(await restricted('/crq/scenarios', 'Financial risk'), 'Analyst: financial risk closed even by URL')
  ok(await restricted('/tprm/vendors', 'Vendor risk'), 'Analyst: vendor risk closed even by URL')
  await page.goto(base + '/home'); await page.locator('main h1').first().waitFor()
  await page.keyboard.press('Meta+k'); await page.getByLabel('Search query').fill('Orbit')
  await page.waitForTimeout(400)
  ok((await page.getByRole('dialog').innerText()).includes('No results for'), 'Analyst: search reveals nothing about suppliers (not even their fix tasks)')
  await page.keyboard.press('Escape')
  await page.goto(base + '/intelligence?q=' + encodeURIComponent('What is our annual loss exposure?'))
  await page.getByText(/Financial risk isn’t part of your job/).first().waitFor({ timeout: 15000 })
  ok(true, 'Analyst: assistant won’t answer about financial risk')
})

await step('Owner', async () => {
  await as('Jonas Weber')
  ok(await restricted('/dashboard', 'The executive dashboard'), 'Application owner: executive dashboard closed')
})

await step('Employee', async () => {
  await as('Ravi Shah')
  ok(await restricted('/operations/findings', 'Security problems'), 'Employee: security problems closed even by URL')
  ok(await restricted('/exposures/prioritization', 'Security problems'), 'Employee: prioritization closed even by URL')
})

await step('JobChange', async () => {
  await as('Hannah Lee')
  await page.goto(base + '/admin/people')
  await page.getByLabel('Job for Priya Raman').selectOption('vendor_risk'); await page.waitForTimeout(800)
  await as('Priya Raman')
  ok(await opens('/tprm/vendors'), 'Admin changes a person’s job → their access changes immediately')
})

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'No console errors')
await browser.close()
