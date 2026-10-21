// End-to-end workflows A–H, agent approval gate, search and persistence.
// Requires the dev server on :5173 and Playwright (npm i -D playwright && npx playwright install chromium).
import { chromium } from 'playwright'
import { signIn } from './login.mjs'
const base = 'http://localhost:5173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage(); page.setDefaultTimeout(6000)
const errors = []
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
page.on('console', async (m) => { if (m.type() === 'error') { const args = await Promise.all(m.args().map((a) => a.jsonValue().catch(() => '?'))); errors.push(`[console] ${m.text().slice(0, 120)} :: ${JSON.stringify(args.slice(1, 3)).slice(0, 300)} @ ${page.url()}`) } })
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('do-safe-unified-demo-db')).state.db)
const ok = (cond, msg) => console.log(`${cond ? '✓' : '✗'} ${msg}`)
const step = async (name, fn) => { try { await fn() } catch (e) { await page.screenshot({ path: 'fail-' + name + '.png' }); console.log('✗', name, e.message.split('\n').slice(0,3).join(' | ')) } }

await signIn(page, base)
await page.goto(base + '/dashboard'); await page.waitForLoadState('networkidle')
// speed up: set latency to 0 via settings API in localStorage
await page.evaluate(() => { const k = 'do-safe-unified-demo-db'; const s = JSON.parse(localStorage.getItem(k)); s.state.db.settings.latencyMs = 20; localStorage.setItem(k, JSON.stringify(s)) })
await page.reload(); await page.waitForLoadState('networkidle')

// ---------------- Workflow A
await step('A', async () => {
  let d = await db()
  const f = d.findings.find((x) => x.severity === 'critical' && x.domain === 'vulnerability' && ['triaged', 'validated', 'new'].includes(x.status) && x.ticketIds.length === 0)
  await page.goto(`${base}/exposures/vulnerabilities/${f.id}`); await page.waitForSelector('main h1')
  for (const t of ['Classification', 'Source & Evidence', 'AI Analysis']) { await page.getByRole('tab', { name: new RegExp(t) }).click(); await page.waitForTimeout(150) }
  await page.getByRole('button', { name: 'Create remediation ticket' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Create ticket' }).click()
  await page.waitForURL(/operations\/tickets\/TKT-/)
  const tid = page.url().split('/').pop()
  d = await db(); ok(d.findings.find((x) => x.id === f.id).status === 'in_remediation' && d.findings.find((x) => x.id === f.id).ticketIds.includes(tid), `A: ticket ${tid} created, ${f.id} in remediation`)
  await page.getByRole('button', { name: 'Start work' }).click(); await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Submit verification' }).click()
  await page.getByRole('dialog').locator('textarea').fill('Rescan scan-ID 88231 shows log4j-core 2.17.1 deployed; OOB canary negative.')
  await page.getByRole('dialog').getByRole('button', { name: 'Record verification' }).click(); await page.waitForTimeout(900)
  d = await db(); const ff = d.findings.find((x) => x.id === f.id)
  ok(ff.status === 'resolved' && d.tickets.find((t) => t.id === tid).status === 'done', `A: verification resolved finding (${ff.status})`)
  ok(d.audit.some((a) => a.entityId === tid && a.action.includes('verification passed')), 'A: audit records verification')
})

// ---------------- Workflow B
await step('B', async () => {
  let d = await db()
  const f = d.findings.find((x) => x.status === 'triaged' && x.domain !== 'ai')
  await page.goto(`${base}/operations/findings/${f.id}`); await page.waitForSelector('main h1')
  await page.getByRole('button', { name: 'Review as False Positive' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.locator('select').first().selectOption('Version not affected')
  await dlg.getByRole('checkbox').first().click()
  const tas = dlg.locator('textarea')
  await tas.nth(0).fill('Package changelog shows distro backport of upstream fix.')
  await tas.nth(1).fill('The installed package includes the upstream patch via distribution backport; scanner matched upstream version string only.')
  await dlg.getByRole('checkbox').last().click()
  await dlg.getByRole('button', { name: /Record false-positive decision/ }).click(); await page.waitForTimeout(700)
  d = await db(); const ff = d.findings.find((x) => x.id === f.id)
  ok(ff.status === 'false_positive' && ff.fpReviews.length === 1 && ff.evidence.length === f.evidence.length, 'B: FP decision recorded, original evidence preserved')
  await page.getByRole('tab', { name: /History/ }).click(); await page.waitForTimeout(200)
  ok(await page.getByText('False-positive decision history').isVisible(), 'B: decision history visible')
  await page.getByRole('button', { name: 'Reopen' }).click()
  await page.getByRole('dialog').locator('textarea').fill('New authenticated scan shows vulnerable library loaded at runtime.')
  await page.getByRole('dialog').getByRole('button', { name: 'Reopen finding' }).click(); await page.waitForTimeout(700)
  d = await db(); const f2 = d.findings.find((x) => x.id === f.id)
  ok(f2.status === 'triaged' && f2.fpReviews.length === 2 && f2.fpReviews[1].decision === 'reopened', 'B: reopened with versioned history')
})

// ---------------- Workflow C
await step('C', async () => {
  await page.goto(`${base}/tprm/vendors`); await page.waitForSelector('main h1')
  await page.getByLabel('Search table').fill('Cascade'); await page.getByText('Cascade HR Cloud').click(); await page.waitForURL(/VEN-/)
  const vid = page.url().split('/').pop()
  await page.getByRole('button', { name: /Start assessment|Continue assessment/ }).click(); await page.waitForURL(/assessments\/ASM-/)
  await page.getByText(/of 18 questions answered/).waitFor()
  const sections = page.locator('main button').filter({ hasText: /\d+\/\d+$/ })
  const n = await sections.count()
  for (let s = 0; s < n; s++) {
    await sections.nth(s).click(); await page.waitForTimeout(80)
    const groups = page.getByRole('radiogroup')
    const g = await groups.count()
    for (let k = 0; k < g; k++) await groups.nth(k).getByRole('radio', { name: k % 4 === 1 ? 'No' : 'Yes' }).click()
  }
  await page.getByRole('button', { name: 'Save progress' }).click(); await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Submit assessment' }).click(); await page.waitForTimeout(500)
  await page.getByRole('button', { name: /Generate risk assessment/ }).click(); await page.waitForTimeout(1500)
  let d = await db(); const aid = page.url().split('/').pop(); const a = d.assessments.find((x) => x.id === aid)
  ok(a.status === 'completed' && a.result && a.result.gaps.length > 0, `C: assessment completed (score ${a.result?.score}, ${a.result?.gaps.length} gaps)`)
  await page.getByRole('button', { name: 'Create remediation items' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /Create \d+ item/ }).click(); await page.waitForTimeout(800)
  d = await db(); const v = d.vendors.find((x) => x.id === vid)
  ok(d.tickets.some((t) => t.assessmentId === aid), 'C: vendor remediation items created')
  ok(['remediation', 'active'].includes(v.lifecycle) && v.residualRisk !== v.inherentRisk, `C: vendor status updated (${v.lifecycle}, residual ${v.residualRisk}/inherent ${v.inherentRisk})`)
  const t = d.tickets.find((x) => x.assessmentId === aid)
  await page.goto(`${base}/operations/tickets/${t.id}`); await page.waitForSelector('main h1')
  await page.getByPlaceholder('Vendor message (simulated portal response)').fill('Acknowledged; fix scheduled.')
  await page.getByRole('button', { name: 'Record' }).click(); await page.waitForTimeout(500)
  d = await db(); ok(d.tickets.find((x) => x.id === t.id).vendorResponse.status === 'acknowledged', 'C: vendor response tracked')
})

// ---------------- Workflow D
await step('D', async () => {
  await page.goto(`${base}/ai-security/shadow-ai`); await page.waitForSelector('main h1')
  await page.getByRole('link', { name: 'Investigate finding' }).first().click(); await page.waitForURL(/ai-security\/findings/)
  await page.getByRole('tab', { name: /Source & Evidence/ }).click(); await page.waitForTimeout(200)
  await page.goto(`${base}/ai-security/shadow-ai`); await page.waitForSelector('main h1')
  await page.getByRole('button', { name: 'Create governance review' }).first().click()
  const dlg = page.getByRole('dialog')
  await dlg.getByRole('button', { name: 'AI Acceptable Use Policy §3.2' }).click()
  await dlg.getByRole('button', { name: 'Open review' }).click(); await page.waitForURL(/governance\/GOV-/)
  const gid = page.url().split('/').pop()
  await page.locator('textarea').first().fill('Approved with conditions: route through enterprise assistant; block file uploads.')
  await page.getByRole('button', { name: 'Record decision' }).click(); await page.waitForTimeout(600)
  const d = await db(); const g = d.governanceReviews.find((x) => x.id === gid)
  ok(g.status === 'approved_with_conditions' && !!g.decision, `D: governance review ${gid} decided`)
  ok(d.aiSystems.find((a) => a.id === g.aiSystemId).history.length > 1, 'D: AI system activity history preserved')
})

// ---------------- Workflow E
await step('E', async () => {
  let d = await db(); const f = d.findings.find((x) => x.status === 'in_remediation' && x.incidentIds.length === 0 && x.domain === 'vulnerability')
  await page.goto(`${base}/operations/findings/${f.id}`); await page.waitForSelector('main h1')
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Escalate to incident' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.locator('select').nth(1).selectOption({ index: 1 })
  await dlg.getByRole('button', { name: 'Create incident' }).click(); await page.waitForURL(/incidents\/INC-/)
  const iid = page.url().split('/').pop()
  await page.getByPlaceholder('Add an investigation note…').fill('Checked web logs; no exploitation indicators.')
  await page.getByRole('button', { name: 'Add note' }).click(); await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Add task' }).click()
  const t = page.getByRole('dialog')
  await t.getByPlaceholder('e.g. Rotate service account credentials').fill('Patch and rotate credentials')
  await t.locator('select').selectOption({ index: 1 })
  await t.locator('input[type=date]').fill('2030-01-01')
  await t.getByRole('button', { name: 'Add task' }).click(); await page.waitForTimeout(400)
  await page.getByRole('button', { name: /Move to/ }).click(); await page.waitForTimeout(300)
  for (const b of await page.getByRole('button', { name: /Toggle task/ }).all()) { await b.click(); await page.waitForTimeout(150) }
  await page.getByRole('button', { name: 'Close incident' }).first().click()
  await page.getByRole('dialog').locator('textarea').fill('No exploitation occurred. Patched within SLA; credentials rotated; monitoring added for recurrence.')
  await page.getByRole('dialog').getByRole('button', { name: 'Close incident' }).click(); await page.waitForTimeout(600)
  d = await db(); const inc = d.incidents.find((x) => x.id === iid)
  ok(inc.status === 'closed' && inc.notes.length === 1 && inc.tasks.length === 1 && !!inc.resolutionSummary, `E: incident ${iid} closed with resolution`)
  ok(d.findings.find((x) => x.id === f.id).incidentIds.includes(iid), 'E: finding linked to incident')
})

// ---------------- Workflow F
await step('F', async () => {
  await page.goto(`${base}/applications/SVC-PAY`); await page.waitForSelector('main h1')
  await page.getByRole('tab', { name: /Risk & dependencies/ }).click(); await page.waitForTimeout(150)
  await page.locator('main a[href^="/crq/scenarios/"]').first().click(); await page.waitForURL(/crq\/scenarios\//)
  const before = await page.locator('text=Simulated ALE').locator('..').locator('..').innerText()
  await page.getByRole('checkbox').first().check()
  const thumb = page.getByRole('slider').first(); await thumb.focus(); for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(200)
  const after = await page.locator('text=Simulated ALE').locator('..').locator('..').innerText()
  ok(before !== after, 'F: simulation recalculated')
  await page.getByRole('button', { name: 'Save simulation' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click(); await page.waitForTimeout(500)
  const d = await db(); ok(d.scenarios.find((s) => s.id === page.url().split('/').pop()).savedSimulations.length > 0, 'F: simulation saved')
})

// ---------------- Workflow G
await step('G', async () => {
  await page.goto(`${base}/intelligence`); await page.waitForSelector('main h1')
  await page.getByRole('button', { name: 'What are our most critical vulnerabilities?' }).click()
  await page.getByText('Supporting records').first().waitFor({ timeout: 5000 })
  ok(true, 'G: structured response with supporting records')
  await page.getByText('Evidence & sources').first().waitFor()
  await page.locator('a[href*="/exposures/vulnerabilities/FND-"]').first().click(); await page.waitForURL(/vulnerabilities\/FND-/)
  await page.getByRole('tab', { name: /Remediation/ }).click()
  ok(await page.getByText('Recommended remediation').isVisible(), 'G: navigated cited finding → remediation')
  await page.goto(`${base}/intelligence`); await page.getByLabel('Ask a question').fill('what is the weather'); await page.getByRole('button', { name: 'Ask', exact: true }).click()
  await page.getByText('limited capabilities').first().waitFor({ timeout: 5000 }); ok(true, 'G: unsupported question explained')
})

// ---------------- Workflow H
await step('H', async () => {
  await page.goto(`${base}/integrations`); await page.waitForSelector('main h1')
  await page.getByText('Microsoft Defender for Cloud').click(); await page.waitForURL(/INT-MSD/)
  await page.getByPlaceholder('e.g. Azure tenant northstar-prod').fill('Azure tenant northstar-prod')
  await page.getByRole('button', { name: 'Save configuration' }).click(); await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Test connection' }).click(); await page.waitForTimeout(1000)
  await page.getByRole('button', { name: 'Enable integration' }).click(); await page.waitForTimeout(1200)
  const d = await db(); const i = d.integrations.find((x) => x.id === 'INT-MSD')
  const imported = d.findings.filter((f) => f.sourceIntegrationId === 'INT-MSD')
  ok(i.status === 'connected' && imported.length > 0 && d.ingestionRuns.some((r) => r.integrationId === 'INT-MSD'), `H: connected, ${imported.length} findings imported with run`)
  ok(await page.getByText(/Findings sourced from Microsoft/).isVisible(), 'H: imported findings visible')
})

// ---------------- Agents + approval gate
await step('Agents', async () => {
  await page.goto(`${base}/intelligence/agents/AGT-07`); await page.waitForSelector('main h1')
  await page.getByRole('button', { name: 'Run demo' }).click(); await page.waitForTimeout(5500)
  let d = await db(); const e = d.executions.find((x) => x.agentId === 'AGT-07' && x.trigger === 'Manual (Run Demo)')
  ok(e && e.status === 'awaiting_approval', `Agents: simulated run reached approval gate (${e?.status})`)
  const before = d.tickets.length
  await page.goto(`${base}/operations/approvals`); await page.waitForSelector('main h1')
  await page.getByRole('button', { name: 'Approve' }).first().click(); await page.waitForTimeout(800)
  d = await db(); ok(d.tickets.length > before, `Agents: approval created ${d.tickets.length - before} tickets`)
})

// ---------------- Global search & reset
await step('Search', async () => {
  await page.goto(`${base}/dashboard`); await page.waitForSelector('main h1')
  await page.keyboard.press('Meta+k'); await page.getByLabel('Search query').fill('Orbit')
  await page.keyboard.press('Enter'); await page.waitForURL(/tprm\/vendors\/VEN-018/); ok(true, 'Search: Orbit → vendor profile')
})
await step('Persistence', async () => {
  await page.reload(); await page.waitForSelector('main h1')
  const d = await db(); ok(d.integrations.find((x) => x.id === 'INT-MSD').status === 'connected', 'Persistence: state survives reload')
})
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'No console errors')
await browser.close()
