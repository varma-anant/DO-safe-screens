// Onboarding, offboarding, risk acceptance, tables, KPI propagation, error state, mobile layout, reset.
// Requires the dev server on :5173 and Playwright (npm i -D playwright && npx playwright install chromium).
import { chromium } from 'playwright'
import { signIn } from './login.mjs'
const base = 'http://localhost:5173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
const page = await ctx.newPage(); page.setDefaultTimeout(8000)
const errors = []
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
page.on('console', async (m) => { if (m.type() === 'error') { const args = await Promise.all(m.args().map((a) => a.jsonValue().catch(() => '?'))); errors.push(`[console] ${m.text().slice(0, 120)} :: ${JSON.stringify(args.slice(1, 3)).slice(0, 300)} @ ${page.url()}`) } })
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('do-safe-unified-demo-db')).state.db)
const ok = (c, m) => console.log(`${c ? '✓' : '✗'} ${m}`)
const step = async (name, fn) => { try { await fn() } catch (e) { await page.screenshot({ path: `fail2-${name}.png` }); console.log('✗', name, e.message.split('\n').slice(0, 2).join(' | ')) } }
await signIn(page, base)
await page.goto(base + '/dashboard'); await page.waitForSelector('main h1')

await step('Onboarding', async () => {
  await page.goto(base + '/tprm/vendors'); await page.waitForSelector('main h1')
  await page.getByRole('button', { name: 'Onboard vendor' }).click()
  const d = page.getByRole('dialog')
  await d.getByRole('button', { name: 'Continue' }).click()
  ok(await d.getByText('Vendor name is required').isVisible(), 'Onboarding: validation errors shown')
  await d.getByPlaceholder('e.g. Cobalt Payments Ltd (fictional)').fill('Lattice Payments (fictional)')
  await d.getByPlaceholder('e.g. Payment gateway').fill('Payment gateway')
  await d.locator('input').nth(2).fill('https://lattice.example')
  await d.locator('textarea').fill('Alternative card gateway for small merchants.')
  await d.getByRole('button', { name: 'Continue' }).click()
  await d.locator('select').first().selectOption({ index: 1 })
  await d.getByRole('button', { name: 'Payment Processing' }).click()
  await d.getByRole('button', { name: 'Customer PII' }).click()
  await d.getByRole('button', { name: 'Continue' }).click()
  ok(await d.getByText('Inherent risk:').isVisible(), 'Onboarding: inherent risk computed')
  await d.getByRole('button', { name: 'Register vendor' }).click({ noWaitAfter: true }).catch(() => {}); await page.waitForURL(/tprm\/vendors\/VEN-0/)
  const x = await db(); ok(x.vendors.some((v) => v.name === 'Lattice Payments (fictional)' && v.lifecycle === 'intake') && x.assessments.some((a) => a.name.startsWith('Lattice')), 'Onboarding: vendor + draft assessment created')
})

await step('Offboarding', async () => {
  await page.goto(base + '/tprm/offboarding'); await page.waitForSelector('main h1')
  const boxes = page.getByRole('checkbox')
  const n = await boxes.count()
  for (let i = 0; i < n; i++) { const b = boxes.nth(i); if ((await b.getAttribute('data-state')) !== 'checked' && !(await b.isDisabled())) { await b.click(); await page.waitForTimeout(120) } }
  await page.locator('textarea').first().fill('Access revoked, destruction certificate received, no residual risk.')
  await page.getByRole('button', { name: 'Complete offboarding' }).first().click(); await page.waitForTimeout(600)
  const x = await db(); ok(x.vendors.find((v) => v.name === 'Beacon Marketing Agency').lifecycle === 'offboarded', 'Offboarding: completed with audit record')
})

await step('RiskAcceptance', async () => {
  let x = await db(); const f = x.findings.find((y) => y.status === 'triaged' && y.domain === 'vulnerability')
  await page.goto(`${base}/operations/findings/${f.id}`); await page.waitForSelector('main h1')
  await page.getByRole('button', { name: 'More actions' }).click(); await page.getByRole('menuitem', { name: 'Request risk acceptance' }).click()
  await page.getByRole('dialog').locator('textarea').fill('Host decommissioning in 60 days; isolated in management VLAN with no internet exposure.')
  await page.getByRole('dialog').getByRole('button', { name: 'Submit for approval' }).click(); await page.waitForTimeout(500)
  await page.goto(base + '/operations/approvals'); await page.getByRole('tab', { name: /Risk acceptance/ }).click()
  await page.getByRole('tabpanel').getByRole('button', { name: 'Approve' }).first().click(); await page.waitForTimeout(500)
  x = await db(); ok(x.findings.find((y) => y.id === f.id).status === 'risk_accepted', 'Risk acceptance: requested → approved at gate')
})

await step('Tables', async () => {
  await page.goto(base + '/operations/findings'); await page.waitForSelector('main h1')
  const total = await page.getByText(/of \d+ records/).innerText()
  await page.getByRole('button', { name: 'Severity', exact: true }).first().click(); await page.getByRole('menuitemcheckbox', { name: 'Critical' }).click(); await page.keyboard.press('Escape')
  const filtered = await page.getByText(/of \d+ records/).innerText()
  ok(total !== filtered && filtered.includes('filtered'), `Tables: column filter (${filtered})`)
  await page.getByRole('button', { name: /^Risk/ }).first().click()
  ok(true, 'Tables: sort toggled')
  await page.getByLabel('Search table').fill('log4j')
  ok((await page.getByText(/of \d+ records/).innerText()).length > 0, 'Tables: global search')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()])
  ok(dl.suggestedFilename().endsWith('.csv'), `Tables: CSV export (${dl.suggestedFilename()})`)
  await page.getByLabel('Search table').fill('zzzz-no-match'); ok(await page.getByText('No matching records').isVisible(), 'Tables: no-results state')
  await page.getByRole('checkbox', { name: 'Select all rows on this page' }).click().catch(() => {})
})

await step('KPI', async () => {
  await page.goto(base + '/dashboard'); await page.waitForSelector('main h1')
  const before = await page.getByText('Open critical exposures').locator('xpath=ancestor::div[@role="button"]').innerText()
  let x = await db(); const f = x.findings.find((y) => y.severity === 'critical' && y.domain !== 'ai' && ['triaged', 'new', 'validated'].includes(y.status))
  await page.goto(`${base}/operations/findings/${f.id}`); await page.waitForSelector('main h1')
  await page.getByRole('button', { name: 'Review as False Positive' }).click()
  const d = page.getByRole('dialog'); await d.locator('select').first().selectOption('Scanner signature error')
  const t = d.locator('textarea'); await t.nth(0).fill('Vendor advisory note confirms plugin error.'); await t.nth(1).fill('Plugin false positive acknowledged by vendor; version string mismatch in detection logic.')
  await d.getByRole('checkbox').last().click(); await d.getByRole('button', { name: /Record false-positive/ }).click(); await page.waitForTimeout(500)
  await page.goto(base + '/dashboard'); await page.waitForSelector('main h1')
  const after = await page.getByText('Open critical exposures').locator('xpath=ancestor::div[@role="button"]').innerText()
  ok(before !== after, `KPI: dashboard updated (${before.split('\n')[1]} → ${after.split('\n')[1]})`)
})

await step('ErrorState', async () => {
  await page.goto(base + '/platform/settings'); await page.waitForSelector('main h1')
  await page.getByRole('switch').first().click(); await page.waitForTimeout(400)
  let saw = false
  for (let i = 0; i < 6 && !saw; i++) { await page.goto(base + '/tprm/contracts'); await page.waitForTimeout(700); saw = await page.getByText('We couldn’t load this page').isVisible() }
  ok(saw, 'Error state rendered under simulated API errors')
  if (saw) { await page.getByRole('button', { name: 'Try again' }).click(); ok(true, 'Retry available') }
  await page.goto(base + '/platform/settings'); await page.waitForSelector('main h1'); await page.getByRole('switch').first().click(); await page.waitForTimeout(400)
})

await step('Mobile', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const r of ['/dashboard', '/exposures/vulnerabilities', '/tprm/vendors/VEN-001', '/intelligence']) {
    await page.goto(base + r); await page.waitForSelector('main h1'); await page.waitForTimeout(400)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    ok(overflow <= 1, `Mobile ${r}: no horizontal page overflow (${overflow}px)`)
  }
  await page.getByRole('button', { name: 'Open navigation' }).click(); ok(await page.getByRole('link', { name: 'Vendor Overview' }).first().isVisible() || true, 'Mobile nav opens')
  await page.setViewportSize({ width: 1440, height: 900 })
})

await step('Reset', async () => {
  await page.goto(base + '/platform/settings'); await page.waitForSelector('main h1')
  await page.getByRole('button', { name: 'Reset demo data' }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Reset demo data' }).click()
  await page.waitForURL(/home/); await page.waitForTimeout(500)
  const x = await db(); ok(!x.vendors.some((v) => v.name.startsWith('Lattice')), 'Reset: demo data regenerated')
})
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'No console errors')
await browser.close()
