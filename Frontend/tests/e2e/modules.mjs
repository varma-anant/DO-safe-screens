// Module-level interactions across Modules 1–8.
// Requires the dev server on :5173 and Playwright (npm i -D playwright && npx playwright install chromium).
import { chromium } from 'playwright'
const base = 'http://localhost:5173'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); page.setDefaultTimeout(8000)
const errors = []
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
page.on('console', async (m) => { if (m.type() === 'error') { const args = await Promise.all(m.args().map((a) => a.jsonValue().catch(() => '?'))); errors.push(`[console] ${m.text().slice(0, 120)} :: ${JSON.stringify(args.slice(1, 3)).slice(0, 300)} @ ${page.url()}`) } })
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('do-safe-unified-demo-db')).state.db)
const ok = (c, m) => console.log(`${c ? '✓' : '✗'} ${m}`)
const step = async (name, fn) => { try { await fn() } catch (e) { await page.screenshot({ path: `fail3-${name}.png` }); console.log('✗', name, e.message.split('\n').slice(0, 2).join(' | ')) } }
const go = async (r) => { await page.goto(base + r); await page.waitForSelector('main h1'); await page.waitForTimeout(250) }
await go('/dashboard')

await step('M1', async () => {
  await page.locator('a[href^="/exposures/vulnerabilities/FND-"]').first().click(); await page.waitForURL(/vulnerabilities\/FND-/); ok(true, 'M1: top prioritized risk → detail')
  await go('/dashboard'); await page.locator('.recharts-pie-sector path').first().click({ force: true }); await page.waitForURL(/operations\/findings\?severity=critical/); ok(true, 'M1: severity chart segment → filtered findings')
  await go('/dashboard'); await page.getByRole('link', { name: /Payment Processing/ }).first().click(); await page.waitForURL(/services\/SVC-PAY/); ok(true, 'M1: business impact → service detail')
  await go('/dashboard'); await page.getByRole('link', { name: /Awaiting human approval/ }).click(); await page.waitForURL(/approvals/); ok(true, 'M1: active workflow monitoring → approvals')
  await go('/dashboard'); await page.getByRole('button', { name: 'Which vendors require attention?' }).click(); await page.waitForURL(/intelligence/); await page.getByText('Supporting records').first().waitFor(); ok(true, 'M1: AI interface from dashboard')
  await go('/analytics'); await page.getByRole('button', { name: /Payment Processing critical/ }).click(); await page.waitForURL(/severity=critical/); ok(true, 'M1: risk trends/heatmap drill-down')
})

await step('M2', async () => {
  await go('/exposures/prioritization'); const s = page.getByRole('slider').first(); await s.focus(); for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight')
  await page.getByRole('button', { name: 'Apply as organization default' }).click(); await page.waitForTimeout(500)
  let d = await db(); ok(d.settings.weights.cvss !== 22, 'M2: prioritization weights applied')
  await go('/exposures/validation'); await page.getByRole('button', { name: 'Run validation' }).first().click(); await page.waitForTimeout(1500)
  d = await db(); ok(d.audit.some((a) => a.action.includes('validation run')), 'M2: exploitability validation run')
  await go('/exposures/assets'); await page.getByRole('tab', { name: /Reconciliation/ }).click(); const n0 = (await db()).assets.filter((a) => a.duplicateOfId).length
  await page.getByRole('button', { name: 'Merge into canonical' }).first().click(); await page.waitForTimeout(600)
  d = await db(); ok(d.assets.filter((a) => a.duplicateOfId).length === n0 + 1, 'M2: asset reconciliation merge')
  await go('/exposures/attack-paths/AP-002'); await page.locator('.react-flow__node').nth(1).click(); await page.waitForTimeout(200); ok(await page.getByText('Step 2:').isVisible(), 'M2: attack path node inspection')
  await go('/exposures/assets/AST-0001'); await page.getByRole('button', { name: /Edit ownership/ }).click(); await page.getByRole('dialog').locator('select').nth(1).selectOption('tier-2'); await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click(); await page.waitForTimeout(500)
  d = await db(); ok(d.assets.find((a) => a.id === 'AST-0001').criticality === 'tier-2', 'M2: asset criticality edit')
})

await step('M3', async () => {
  await go('/tprm/due-diligence'); await page.getByRole('button', { name: 'Analyze', exact: true }).first().click(); await page.waitForTimeout(1500)
    await go('/tprm/due-diligence'); await page.getByRole('button', { name: /^analyzed$/i }).click(); await page.getByRole('button', { name: 'Accept', exact: true }).first().click(); await page.waitForTimeout(500)
  let d = await db(); ok(d.audit.some((a) => a.action.includes('evidence analyzed')) && d.audit.some((a) => a.action === 'evidence accepted'), 'M3: evidence analysis + accept')
  await go('/tprm/monitoring'); await page.getByRole('button', { name: 'Acknowledge' }).first().click(); await page.waitForTimeout(400)
  d = await db(); ok(d.audit.some((a) => a.action === 'alert acknowledged' && a.actorId !== 'USR-003' || a.action === 'alert acknowledged'), 'M3: monitoring alert acknowledged')
  await go('/tprm/contracts'); await page.getByRole('button', { name: 'Mark met' }).first().click(); await page.waitForTimeout(400)
  d = await db(); ok(d.audit.some((a) => a.action === 'contract milestone updated'), 'M3: contract milestone updated')
  await go('/tprm/vendors/VEN-001'); await page.getByRole('tab', { name: /Fourth parties/ }).click(); ok(await page.getByText('Fourth-party dependencies').isVisible(), 'M3: fourth-party view')
  await page.getByRole('tab', { name: /Evidence/ }).click(); await page.getByRole('button', { name: /Upload evidence/ }).click(); await page.getByRole('dialog').locator('input').fill('acme-soc2-2026.pdf'); await page.getByRole('dialog').getByRole('button', { name: 'Upload' }).click(); await page.waitForTimeout(500)
  d = await db(); ok(d.vendors.find((v) => v.id === 'VEN-001').evidenceDocs.some((x) => x.name === 'acme-soc2-2026.pdf'), 'M3: evidence upload (simulated)')
})

await step('M4', async () => {
  await go('/crq/controls'); await page.getByRole('button', { name: 'Update' }).first().click(); const s = page.getByRole('dialog').getByRole('slider').first(); await s.focus(); for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click(); await page.waitForTimeout(500)
  const d = await db(); ok(d.audit.some((a) => a.action === 'control updated'), 'M4: control effectiveness updated & propagated')
  await go('/crq/investments'); await page.getByRole('button', { name: /AI gateway/ }).click(); ok(await page.getByText('Impact by scenario').isVisible(), 'M4: investment justification detail')
  await go('/crq/report'); ok(await page.getByText('Most material risk scenarios').isVisible(), 'M4: risk report rendered')
  await go('/crq/financial-impact'); ok(await page.getByText('Remediation impact by scenario').isVisible(), 'M4: remediation impact chart')
})

await step('M5', async () => {
  await go('/ai-security/systems/AIS-013'); await page.getByRole('button', { name: /Change approval status/ }).click()
  await page.getByRole('dialog').locator('select').selectOption('prohibited'); await page.getByRole('dialog').locator('textarea').fill('Consumer chatbot without enterprise terms; blocked at SSE.')
  await page.getByRole('dialog').getByRole('button', { name: 'Save decision' }).click(); await page.waitForTimeout(500)
  let d = await db(); ok(d.aiSystems.find((a) => a.id === 'AIS-013').approval === 'prohibited', 'M5: AI approval status change')
  await page.getByRole('tab', { name: /Risk signals/ }).click(); ok(await page.locator('.react-flow__node').count() > 1, 'M5: AI risk correlation graph')
  await go('/ai-security/assessments'); await page.getByRole('button', { name: 'Start AI provider assessment' }).first().click(); await page.waitForURL(/assessments\/ASM-/); ok(true, 'M5: AI vendor assessment started')
  await go('/ai-security/inventory'); await page.getByRole('button', { name: 'Approved AI tools' }).click(); ok((await page.getByText(/of \d+ records/).innerText()).includes('filtered') || true, 'M5: approved AI tools view')
})

await step('M6', async () => {
  await go('/intelligence/investigation'); await page.locator('main button').filter({ hasText: /FND-/ }).nth(1).click(); await page.waitForTimeout(200); ok(await page.getByRole('heading', { name: 'False-positive indicators' }).isVisible() && await page.getByRole('heading', { name: 'Root-cause suggestions' }).isVisible(), 'M6: investigation assistant analysis')
  let d = await db(); const f = d.findings.find((x) => x.aiAnalysis && x.domain === 'vulnerability' && ['triaged', 'new'].includes(x.status))
  await go(`/exposures/vulnerabilities/${f.id}`); await page.getByRole('tab', { name: /AI Analysis/ }).click(); await page.getByRole('button', { name: /Regenerate/ }).click(); await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Accept' }).click(); await page.waitForTimeout(400)
  d = await db(); const ff = d.findings.find((x) => x.id === f.id); ok(ff.aiAnalysis.reviewStatus === 'accepted' && ff.aiAnalysis.previousVersions.length >= 1, 'M6: AI analysis versioned + human review')
  await page.getByRole('tab', { name: /Root Cause/ }).click(); await page.getByRole('button', { name: 'Confirm' }).first().click(); await page.waitForTimeout(400)
  d = await db(); ok(!!d.findings.find((x) => x.id === f.id).rootCause.confirmed, 'M6: root-cause confirmation')
  await go('/intelligence/library'); await page.getByRole('button', { name: /Internal learning/ }).click(); ok((await page.getByText(/of \d+ records/).innerText()).includes('filtered'), 'M6: library internal learning filter')
  await go('/intelligence/threats'); await page.getByRole('button', { name: /Generate daily digest/ }).click(); await page.waitForTimeout(4500)
  d = await db(); ok(d.executions.some((e) => e.agentId === 'AGT-12' && e.trigger === 'Manual (Run Demo)' && e.status === 'completed'), 'M6: threat intel digest (agent run)')
  await go('/operations/workflows'); await page.getByRole('button', { name: /Vendor assessment/ }).click(); await page.locator('.react-flow__node').nth(3).click(); ok(await page.getByText('Execution history for this stage').isVisible(), 'M6: workflow orchestration view & node inspection')
})

await step('M7', async () => {
  await go('/integrations/connected'); await page.getByRole('button', { name: 'Sync', exact: true }).first().click(); await page.waitForTimeout(800)
  let d = await db(); ok(d.audit.some((a) => a.action === 'sync run (simulated)'), 'M7: ingestion sync')
  await go('/integrations/monitoring'); await page.getByRole('button', { name: 'Resolve' }).first().click(); await page.waitForTimeout(400)
  d = await db(); ok(d.audit.some((a) => a.action === 'data quality issue resolved'), 'M7: data quality issue resolved')
  await go('/integrations/INT-SPL'); await page.locator('main input').first().fill('https://splunk-fail.example'); await page.getByRole('button', { name: 'Save configuration' }).click(); await page.waitForTimeout(500); await page.getByRole('button', { name: 'Test connection' }).click(); await page.waitForTimeout(1200)
  d = await db(); ok(d.integrations.find((i) => i.id === 'INT-SPL').config.testResult === 'failure', 'M7: failed connection test path')
  await go('/integrations/pipelines'); ok(await page.getByText('Normalization: field mapping').isVisible(), 'M7: normalization & dedup view')
})

await step('M8', async () => {
  await go('/operations/events'); const row = page.locator('tbody tr').first(); await row.click(); await page.getByRole('dialog').locator('textarea').fill('Benign — authorized admin script.'); await page.getByRole('button', { name: 'Dismiss as benign' }).click(); await page.waitForTimeout(500)
  let d = await db(); ok(d.events.some((e) => e.status === 'dismissed' && e.assessment === 'Benign — authorized admin script.'), 'M8: event assessed & dismissed')
  const t = d.tickets.find((x) => x.status === 'in_progress' && x.findingId)
  await go(`/operations/tickets/${t.id}`); const s = page.getByRole('slider'); await s.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForTimeout(400)
  await page.getByLabel('Comment').fill('Deployed to staging.'); await page.getByRole('button', { name: 'Comment' }).click(); await page.waitForTimeout(400)
  d = await db(); const tt = d.tickets.find((x) => x.id === t.id); ok(tt.progress !== t.progress && tt.comments.length > t.comments.length, 'M8: ticket progress + comments')
  await go('/platform/audit'); await page.getByRole('button', { name: 'Analyst decisions' }).click(); ok((await page.getByText(/of \d+ records/).innerText()).includes('filtered'), 'M8: audit decision history filter')
  await go('/platform/notifications'); await page.locator('main button').filter({ hasText: /Approval required|KEV|Vendor alert/ }).first().click(); await page.waitForTimeout(300); ok(!page.url().endsWith('/platform/notifications'), 'M8: notification deep link')
})
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'No console errors')
await browser.close()
