// Customer journey: login → first-run landing → protect an application (access review, coverage gate,
// test run fails → fix from the result → passes) → “Protection is on” → overview, plus role restrictions.
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
  await page.getByRole('heading', { name: /Let’s protect your first application/ }).waitFor()
  ok(await page.getByText('How DO SAFE protects you').isVisible(), 'Landing: explains what DO SAFE does, with real examples')
  ok((await main().getByText(/^\d min$/).count()) === 7, 'Landing: shows the same 7 steps as the wizard, with time estimates')
  await main().getByRole('button', { name: /Our website or customer portal/ }).click()
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
  await page.getByRole('button', { name: /Go to my security overview/ }).click()
  await page.getByText('Am I protected?').waitFor()
  ok(await page.getByText('Is anything urgent?').isVisible() && await page.getByText('What should I do next?').isVisible(), 'Overview: answers protected / urgent / next')
})

await step('Roles', async () => {
  await signOut()
  await signIn(page, base, 'Ravi Shah', 'Northstar')
  ok(!(await page.locator('aside').getByText('User management').count()), 'Viewer: User management hidden from navigation')
  await page.goto(base + '/admin'); await page.getByText('User management is restricted').waitFor()
  ok(true, 'Viewer: /admin is restricted')
  await page.goto(base + '/onboarding?new=1'); await page.getByText(/Setting up protection needs an administrator or project owner/).waitFor()
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
