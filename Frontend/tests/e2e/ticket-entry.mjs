import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const base = process.env.PROTOTYPE_URL || 'http://127.0.0.1:5173'
const file = base.startsWith('file:')
const url = path => `${base}${file ? '#' : ''}${path}`
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, offline: file })
const page = await context.newPage()
const errors = []
context.on('page', p => p.on('pageerror', e => errors.push(e.message)))
page.on('pageerror', e => errors.push(e.message))
try {
  await page.goto(url('/login'))
  await page.getByRole('button', { name: 'Sign in with SSO', exact: true }).click()
  await page.getByRole('button', { name: /Hannah Lee/ }).click()
  await page.getByRole('heading', { name: /Welcome back/ }).waitFor()
  await page.goto(url('/dashboard'))
  const tickets = page.locator('main').getByRole('link', { name: 'Ticket Management', exact: true })
  const report = page.getByRole('link', { name: 'Board risk report', exact: true })
  await tickets.waitFor()
  assert.equal(await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Ticket Management', exact: true }).count(), 0)
  assert.equal(await tickets.getAttribute('target'), '_blank')
  assert.equal(await tickets.getAttribute('rel'), 'noopener noreferrer')
  assert.equal(await tickets.locator('svg').count(), 1)
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    const a = await tickets.boundingBox(), b = await report.boundingBox()
    assert(a.x < b.x && Math.abs(a.y - b.y) < 2, `Ticket button immediately left of report at ${width}px`)
    assert.equal(a.height, b.height)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}px`)
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({ path: `/tmp/do-safe-ticket-entry-${file ? 'file' : 'web'}.png` })
  const newTab = context.waitForEvent('page')
  await tickets.click()
  const tab = await newTab
  await tab.getByRole('heading', { name: 'Ticket Management', exact: true }).waitFor()
  assert.equal(await tab.title(), 'Ticket Management')
  assert.equal(await tab.evaluate(() => window.opener), null)
  assert(!tab.url().includes('/login'), 'Existing SSO prototype session reused')
  await tab.getByText('By status', { exact: true }).waitFor()
  await tab.getByText('By priority', { exact: true }).waitFor()
  await tab.getByLabel('Filter tickets by project').waitFor()
  await tab.getByLabel('Filter tickets by status').selectOption('done')
  await tab.getByRole('button', { name: 'Reset filters' }).click()
  assert(page.url().includes('/dashboard'), 'Original dashboard remains open')
  await page.goto(url('/projects'))
  await page.locator('main button.card').first().click()
  const projectTickets = page.getByRole('navigation', { name: 'Project workspace' }).getByRole('link', { name: 'Ticket Management', exact: true })
  assert.equal(await projectTickets.getAttribute('target'), null)
  await projectTickets.click()
  await page.getByRole('heading', { name: 'Ticket Management', exact: true }).waitFor()
  await page.getByText('By status', { exact: true }).waitFor()
  assert.equal(await page.getByLabel('Filter tickets by project').count(), 0)
  assert.equal(await page.title(), 'Ticket Management · DO SAFE Unified', 'Project title unchanged')
  assert.deepEqual(errors, [])
  console.log(`PASS (${file ? 'offline HTML' : 'web'}): sidebar removal, button order/alignment at 1440/768/390px, new tab, exact title, preserved session, existing global dashboard filters, unchanged project navigation/title.`)
} finally { await browser.close() }
