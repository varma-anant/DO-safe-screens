// Job-based experiences: each job gets its own home and menu, sees only its areas, and restricted areas stay closed
// even when the URL is typed directly, searched for, or asked about.
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
const signOut = () => page.evaluate(() => { const k = 'do-safe-unified-demo-db'; const s = JSON.parse(localStorage.getItem(k)); s.state.db.settings.authenticated = false; localStorage.setItem(k, JSON.stringify(s)) })
const nav = async () => (await page.locator('aside nav[aria-label="Primary"] a').allInnerTexts()).map((t) => t.trim().split('\n')[0])
const restricted = async (path, area) => {
  await page.goto(base + path)
  await page.getByRole('heading', { name: new RegExp(`${area} isn’t part of your job`) }).waitFor()
  return true
}
const asEmail = async (email) => {
  await signOut(); await page.goto(base + '/login')
  await page.getByLabel('Work email').fill(email); await page.getByLabel('Password').fill('demo1234')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.waitForURL(/home/)
}

await page.goto(base + '/login'); await page.evaluate(() => localStorage.clear())

await step('Executive', async () => {
  await signIn(page, base, 'Elena Marsh', 'Northstar')
  await page.getByText('Decisions waiting for you', { exact: true }).waitFor()
  ok(await page.getByText('Where is the business most exposed?').isVisible(), 'Executive: home leads with business exposure and decisions')
  const n = await nav()
  ok(n.includes('Dashboard') && !n.includes('User management') && !n.includes('Asset mapping'), `Executive: menu is business-focused (${n.join(', ')})`)
  ok(await restricted('/admin/people', 'User management').catch(() => false) || await page.getByText('User management is restricted').isVisible(), 'Executive: cannot manage users')
  ok(await restricted('/integrations', 'Integrations'), 'Executive: integrations closed even by URL')
  await page.goto(base + '/operations/findings/FND-1001'); await page.getByText('Business view').waitFor()
  ok(!(await page.getByRole('tab', { name: /Source & Evidence/ }).count()), 'Executive: finding page shows the business view, no raw evidence')
  await page.goto(base + '/crq'); await page.locator('main h1').first().waitFor()
  ok(!(await page.getByText('isn’t part of your job').count()), 'Executive: can open financial risk')
})

await step('Admin', async () => {
  await signOut(); await signIn(page, base, 'Hannah Lee', 'Northstar')
  await page.getByText('Data-source health').waitFor()
  ok(await page.getByText('Tools that need attention').isVisible(), 'Platform admin: home leads with platform health')
  ok((await nav()).includes('User management'), 'Platform admin: full workspace menu')
})

await step('Analyst', async () => {
  await signOut(); await signIn(page, base, 'Priya Raman', 'Northstar')
  await page.getByRole('heading', { name: 'Your queue' }).waitFor()
  ok(await page.getByRole('link', { name: /Start with the highest-priority issue/ }).isVisible(), 'Analyst: home is a work queue with one clear starting point')
  const n = await nav()
  ok(!n.includes('Dashboard') && n.includes('Prioritization'), `Analyst: menu is work-focused (${n.join(', ')})`)
  const sidebar = await page.locator('aside').innerText()
  ok(!sidebar.includes('Treasury Portal Launch'), 'Analyst: sees only projects they work on')
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
  await signOut(); await signIn(page, base, 'Jonas Weber', 'Northstar')
  await page.getByText(/is \d+% protected/).first().waitFor()
  ok(await page.getByRole('heading', { name: /Your fix tasks/ }).isVisible(), 'Application owner: home shows how protected their apps are and their tasks')
  ok(await restricted('/dashboard', 'The executive dashboard'), 'Application owner: executive dashboard closed')
})

await step('Employee', async () => {
  await signOut(); await signIn(page, base, 'Ravi Shah', 'Northstar')
  await page.getByText(/security task|no security tasks/).first().waitFor()
  const n = await nav()
  ok(n.length === 3 && n.includes('Home') && n.includes('Requests'), `Employee: minimal menu (${n.join(', ')})`)
  ok(await restricted('/operations/findings', 'Security problems'), 'Employee: security problems closed even by URL')
  ok(await restricted('/exposures/prioritization', 'Security problems'), 'Employee: prioritization closed even by URL')
})

await step('Specialists', async () => {
  await asEmail('aisha.bello@northstar.example')
  await page.getByText(/Active incidents/).first().waitFor()
  ok(true, 'Incident responder: home leads with active incidents')
  await asEmail('marcus.chen@northstar.example')
  await page.getByText('High-risk suppliers').waitFor()
  ok(await restricted('/crq', 'Financial risk'), 'Vendor risk manager: supplier home; financial risk closed')
  await asEmail('sofia.alvarez@northstar.example')
  await page.getByText('Unapproved AI tools').waitFor()
  ok(true, 'AI governance: home leads with unapproved AI and reviews')
  await asEmail('david.okafor@northstar.example')
  await page.getByText('Biggest loss scenarios').waitFor()
  ok(true, 'Risk manager: home leads with loss scenarios')
})

await step('JobChange', async () => {
  await signOut(); await signIn(page, base, 'Hannah Lee', 'Northstar')
  await page.goto(base + '/admin/people')
  await page.getByLabel('Job for Tomás Ribeiro').selectOption('vendor_risk'); await page.waitForTimeout(800)
  await asEmail('tomas.ribeiro@northstar.example')
  await page.getByText('High-risk suppliers').waitFor()
  ok(true, 'Admin changes a person’s job → their home and access change immediately')
})

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'No console errors')
await browser.close()
