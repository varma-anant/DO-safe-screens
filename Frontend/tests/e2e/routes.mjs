// Loads each route and reports page errors / console errors. Usage: node tests/e2e/routes.mjs "/dashboard,/exposures"
import { chromium } from 'playwright'
const base = 'http://localhost:5173'
const routes = process.argv[2] ? process.argv[2].split(',') : ['/dashboard']
const shot = process.argv[3]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text().slice(0, 300)}`) })
for (const r of routes) {
  const before = errors.length
  await page.goto(base + r, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const h = await page.locator('main h1').first().textContent().catch(() => '(no h1)')
  const body = await page.locator('main').innerText().catch(() => '')
  console.log(`${r} → h1="${h}" textLen=${body.length}${errors.length > before ? ' ERRORS:' : ''}`)
  errors.slice(before).forEach((e) => console.log('   ', e))
  if (shot) await page.screenshot({ path: `${shot}${r.replace(/\//g, '_') || '_root'}.png`, fullPage: false })
}
await browser.close()
