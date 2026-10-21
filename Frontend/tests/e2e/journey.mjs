// v2 customer journey: login → first-run landing → onboard (test run fails → fix → passes) → full run, plus role restrictions.
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
const signOut = () => page.evaluate(() => { const k = 'do-safe-unified-demo-db'; const s = JSON.parse(localStorage.getItem(k)); s.state.db.settings.authenticated = false; localStorage.setItem(k, JSON.stringify(s)) })
const main = () => page.locator('main')

await page.goto(base + '/login'); await page.evaluate(() => localStorage.clear())

await step('Auth', async () => {
  await page.goto(base + '/applications'); await page.waitForURL(/\/login\?next=/)
  ok(true, 'Auth: protected route redirects to login')
})

await step('Journey', async () => {
  await signIn(page, base, 'Alex Rivera', 'Acme')
  await page.getByRole('heading', { name: /What do you want to secure/ }).waitFor()
  ok(true, 'Landing: empty workspace asks what to secure')
  await main().getByRole('button', { name: /Web application/ }).click()
  await page.getByLabel('Project name').fill('Customer Portal')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Application name').fill('Customer Portal Web')
  await page.getByLabel('Owner').selectOption({ index: 1 })
  await page.getByLabel('What does it do?').fill('Customer self-service portal for orders and billing')
  await page.getByRole('button', { name: 'Create application' }).click()
  await page.getByRole('button', { name: /Add \d+ selected/ }).click()
  await page.getByRole('button', { name: /Continue to mapping/ }).click()
  await page.getByRole('button', { name: 'Suggest links' }).click()
  await page.getByRole('button', { name: /Save map & continue/ }).click()
  await page.getByRole('heading', { name: /Connect sources to the assets/ }).waitFor()
  let app = (await db()).services.find((s) => s.name === 'Customer Portal Web')
  ok(app.assetLinks.length > 0, `Map: ${app.assetLinks.length} asset links saved`)

  // Partial coverage on a source that isn't connected → the test run must fail.
  await main().locator('[role=checkbox]').first().click()
  await page.getByRole('button', { name: /Save & continue to test run/ }).click()
  await page.getByRole('button', { name: /Start test run/ }).click()
  await page.getByText('Test run · failed').waitFor({ timeout: 15000 })
  ok((await db()).services.find((s) => s.id === app.id).status === 'test_failed', 'Test run: fails for unassigned/disconnected sources')
  ok(await page.getByRole('button', { name: /Continue to full run/ }).isDisabled(), 'Test run: full run blocked until the test passes')

  await main().getByRole('button', { name: 'Connect sources', exact: true }).last().click()
  await page.getByRole('button', { name: /Recommend coverage/ }).click()
  for (let i = 0; i < 8; i++) {
    const b = main().getByRole('button', { name: 'Connect', exact: true })
    if (!(await b.count())) break
    await b.first().click(); await page.waitForTimeout(1500)
  }
  await page.getByRole('button', { name: /Save & continue to test run/ }).click()
  await page.getByRole('button', { name: /Run the test again/ }).click()
  await page.getByText('Test run · passed').waitFor({ timeout: 15000 })
  ok(true, 'Test run: passes after fixing coverage')

  await page.getByRole('button', { name: /Continue to full run/ }).click()
  await page.getByRole('button', { name: /Start full run/ }).click()
  await page.getByText('Full run · completed').waitFor({ timeout: 20000 })
  const d = await db()
  app = d.services.find((s) => s.id === app.id)
  ok(app.status === 'active', 'Full run: application is now a SAFE application')
  ok(d.findings.some((f) => f.businessServiceId === app.id), `Full run: ${d.findings.filter((f) => f.businessServiceId === app.id).length} findings published`)
  await page.goto(base + '/applications'); await main().getByText('Customer Portal Web').first().waitFor()
  ok(true, 'SAFE applications: lists the new application')
})

await step('Roles', async () => {
  await signOut()
  await signIn(page, base, 'Ravi Shah', 'Northstar')
  ok(!(await page.locator('aside').getByText('User management').count()), 'Viewer: User management hidden from navigation')
  await page.goto(base + '/admin'); await page.getByText('User management is restricted').waitFor()
  ok(true, 'Viewer: /admin is restricted')
  await page.goto(base + '/onboarding?new=1'); await page.getByText(/Onboarding needs Administrator or Project Owner access/).waitFor()
  ok(true, 'Viewer: onboarding is restricted')
  const visible = (await db()).projects.length
  const sidebar = await page.locator('aside').innerText()
  ok(!sidebar.includes('Customer Data & Analytics'), `Viewer: sees only member projects (workspace has ${visible})`)

  await signOut()
  await signIn(page, base, 'Hannah Lee', 'Northstar')
  await page.goto(base + '/admin/people'); await main().getByRole('heading', { name: 'People' }).waitFor()
  await page.getByLabel('Role for Ravi Shah').selectOption('analyst'); await page.waitForTimeout(800)
  ok((await db()).users.find((u) => u.name === 'Ravi Shah').orgRole === 'analyst', 'Admin: changed a person’s organization role')
})

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'No console errors')
await browser.close()
