// Protecting an application end to end: Home → Create project → parts → map → tools (access review, coverage gate)
// → test run fails → fix from the result → passes → “Protection is on” → back to Home.
// Requires the dev server on :5173 and Playwright (npm i -D playwright && npx playwright install chromium).
import { chromium } from 'playwright'
import { signIn } from './login.mjs'
const base = 'http://localhost:5173'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); page.setDefaultTimeout(10000)
const errors = []
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 200)} @ ${page.url()}`) })
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('do-safe-unified-demo-db')).state.db)
const ok = (c, m) => console.log(`${c ? '✓' : '✗'} ${m}`)
const step = async (name, fn) => { try { await fn() } catch (e) { await page.screenshot({ path: `fail4-${name}.png` }); console.log('✗', name, e.message.split('\n').slice(0, 2).join(' | ')) } }
const main = () => page.locator('main')

await page.goto(base + '/login'); await page.evaluate(() => localStorage.clear())

await step('Auth', async () => {
  await page.goto(base + '/applications'); await page.waitForURL(/\/login\?next=/)
  ok(true, 'Auth: protected route redirects to login')
})

await step('Journey', async () => {
  await signIn(page, base, 'Alex Rivera', 'Acme')
  await page.getByRole('heading', { name: /Welcome back/ }).waitFor()
  await main().getByRole('link', { name: 'Create project' }).click()
  await page.getByLabel('Project name').fill('Customer Portal')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('What do you call it?').fill('Customer Portal Web')
  await page.getByLabel('What does it do, in one sentence?').fill('Customers log in to see orders and pay invoices')
  await page.getByRole('button', { name: 'Save and continue' }).click()
  await page.getByRole('heading', { name: 'What is it made of?' }).waitFor()
  ok(await page.getByText(/these are not discovered/).isVisible(), 'Parts: suggestions are labelled honestly as a template')
  await page.getByRole('button', { name: /Add 7 parts and continue/ }).click()
  await page.getByText('We drew a suggested map for you').waitFor()
  ok(true, 'Map: starts from a suggested map instead of a blank canvas')
  await page.getByRole('button', { name: /Looks right — continue/ }).click()
  await page.getByRole('heading', { name: 'Connect your security tools' }).waitFor()
  let app = (await db()).services.find((s) => s.name === 'Customer Portal Web')
  ok(app.assetLinks.length > 0, `Map: ${app.assetLinks.length} connections saved`)

  // Continuing with tools not yet connected asks for explicit confirmation.
  await page.getByRole('button', { name: /Continue to test run/ }).click()
  const confirm = page.getByRole('dialog', { name: /Some parts won’t be checked yet/ })
  await confirm.waitFor()
  ok(true, 'Coverage gate: unconnected tools need an explicit “Continue anyway”')
  await confirm.getByRole('button', { name: 'Continue anyway' }).click()
  await page.getByRole('button', { name: /Start test run/ }).click()
  await page.getByText('Test run · needs attention').waitFor({ timeout: 15000 })
  ok((await db()).services.find((s) => s.id === app.id).status === 'test_failed', 'Test run: fails when tools aren’t connected')
  ok(await page.getByRole('button', { name: 'Continue', exact: true }).isDisabled(), 'Test run: protection stays locked until the test passes')

  // Fix straight from the result: each repair button opens the access review.
  let reviewed = false
  for (let i = 0; i < 6; i++) {
    const fix = page.getByRole('region', { name: 'How to fix it' }).getByRole('button', { name: /^Connect / })
    if (!(await fix.count())) break
    await fix.first().click()
    const d = page.getByRole('dialog')
    if (!reviewed) {
      const text = await d.innerText()
      reviewed = text.includes('What DO SAFE will read') && text.includes('What DO SAFE can change') && text.includes('What DO SAFE never touches')
    }
    await d.getByRole('button', { name: 'Allow read-only access' }).click()
    await d.getByText('Connected with read-only access').waitFor({ timeout: 15000 })
    await d.getByRole('button', { name: 'Done' }).click()
  }
  ok(reviewed, 'Access review: read / change / never-touches shown before connecting')
  const conn = (await db()).integrations.filter((i) => i.config?.authMethod === 'Read-only authorization (simulated)')
  ok(conn.length > 0 && conn.every((i) => i.config.scope.includes('Customer Portal Web')), `Access review: ${conn.length} tools connected read-only, scoped to the application`)
  await page.getByRole('button', { name: /Run the test again/ }).click()
  await page.getByText('Test run · passed').waitFor({ timeout: 15000 })
  ok(true, 'Test run: passes after fixing from the result screen')

  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Turn on protection', exact: true }).click()
  await page.getByRole('heading', { name: 'Protection is on' }).waitFor({ timeout: 20000 })
  const d = await db()
  app = d.services.find((s) => s.id === app.id)
  ok(app.status === 'active', 'Protection is on: application is protected')
  ok(await page.getByText('7 of 7', { exact: true }).isVisible(), 'Protection is on: shows parts checked, tools, last and next check')
  ok(d.findings.some((f) => f.businessServiceId === app.id), `Protection is on: ${d.findings.filter((f) => f.businessServiceId === app.id).length} problems explained in plain words`)
  await page.getByRole('button', { name: /Go to Home/ }).click()
  await page.getByRole('heading', { name: /Welcome back/ }).waitFor()
  ok(true, 'Finish: returns to Home')
})

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'No console errors')
await browser.close()
