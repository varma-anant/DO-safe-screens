// Referential-integrity and volume checks for the simulated dataset. Run: npm run validate:seed
import { buildDatabase } from '../src/data/seed'

const db = buildDatabase(new Date('2026-10-20T09:00:00Z'))
const errors: string[] = []
const ids = <T extends { id: string }>(arr: T[]) => new Set(arr.map((x) => x.id))
const assetIds = ids(db.assets)
const serviceIds = ids(db.services)
const findingIds = ids(db.findings)
const vendorIds = ids(db.vendors)
const aiIds = ids(db.aiSystems)
const ticketIds = ids(db.tickets)
const incidentIds = ids(db.incidents)
const eventIds = ids(db.events)
const userIds = new Set([...db.users.map((u) => u.id), 'SYSTEM'])
const kbExt = new Set(db.knowledge.map((k) => k.externalId))
const integrationIds = ids(db.integrations)

const check = (cond: boolean, msg: string) => !cond && errors.push(msg)

for (const a of db.assets) {
  check(serviceIds.has(a.businessServiceId), `${a.id}: bad service`)
  check(userIds.has(a.ownerId), `${a.id}: bad owner`)
  a.sourceIntegrationIds.forEach((s) => check(integrationIds.has(s), `${a.id}: bad source ${s}`))
}
for (const f of db.findings) {
  check(!!f.assetId || !!f.aiSystemId, `${f.id}: no asset or AI system`)
  if (f.assetId) check(assetIds.has(f.assetId), `${f.id}: bad asset`)
  if (f.aiSystemId) check(aiIds.has(f.aiSystemId), `${f.id}: bad AI system`)
  if (f.businessServiceId) check(serviceIds.has(f.businessServiceId), `${f.id}: bad service`)
  if (f.cveId) check(kbExt.has(f.cveId), `${f.id}: CVE ${f.cveId} not in knowledge library`)
  f.cweIds.forEach((c) => check(kbExt.has(c), `${f.id}: ${c} not in library`))
  f.attackIds.forEach((c) => check(kbExt.has(c), `${f.id}: ${c} not in library`))
  f.owaspIds.forEach((c) => check(kbExt.has(c), `${f.id}: ${c} not in library`))
  f.ticketIds.forEach((t) => check(ticketIds.has(t), `${f.id}: bad ticket ${t}`))
  f.incidentIds.forEach((t) => check(incidentIds.has(t), `${f.id}: bad incident ${t}`))
  f.eventIds.forEach((t) => check(eventIds.has(t), `${f.id}: bad event ${t}`))
  f.relatedFindingIds.forEach((t) => check(findingIds.has(t), `${f.id}: bad related ${t}`))
  check(integrationIds.has(f.sourceIntegrationId), `${f.id}: bad source`)
  if (f.status === 'false_positive') check(f.fpReviews.length > 0, `${f.id}: FP without review`)
  if (f.status === 'resolved') check(!!f.resolvedAt, `${f.id}: resolved without date`)
}
for (const t of db.tickets) {
  if (t.findingId) check(findingIds.has(t.findingId), `${t.id}: bad finding`)
  if (t.vendorId) check(vendorIds.has(t.vendorId), `${t.id}: bad vendor`)
  check(!!t.findingId || !!t.vendorId || !!t.aiSystemId || !!t.incidentId, `${t.id}: orphan ticket`)
}
for (const i of db.incidents) {
  i.findingIds.forEach((x) => check(findingIds.has(x), `${i.id}: bad finding`))
  i.eventIds.forEach((x) => check(eventIds.has(x), `${i.id}: bad event`))
}
for (const a of db.assessments) check(vendorIds.has(a.vendorId), `${a.id}: bad vendor`)
for (const ai of db.aiSystems) if (ai.vendorId) check(vendorIds.has(ai.vendorId), `${ai.id}: bad vendor`)
for (const g of db.governanceReviews) check(aiIds.has(g.aiSystemId), `${g.id}: bad AI system`)
for (const s of db.scenarios) {
  check(serviceIds.has(s.businessServiceId), `${s.id}: bad service`)
  s.findingIds.forEach((x) => check(findingIds.has(x), `${s.id}: bad finding`))
  s.vendorIds.forEach((x) => check(vendorIds.has(x), `${s.id}: bad vendor`))
}
for (const p of db.attackPaths) p.steps.forEach((s) => check(assetIds.has(s.assetId), `${p.id}: bad asset`))
for (const m of db.monitoringAlerts) check(vendorIds.has(m.vendorId), `${m.id}: bad vendor`)

const counts = {
  assets: db.assets.length,
  findings: db.findings.length,
  aiFindings: db.findings.filter((f) => f.domain === 'ai').length,
  vendors: db.vendors.length,
  aiSystems: db.aiSystems.length,
  scenarios: db.scenarios.length,
  events: db.events.length,
  incidents: db.incidents.length,
  tickets: db.tickets.length,
  knowledge: db.knowledge.length,
  executions: db.executions.length,
  integrations: db.integrations.length,
  audit: db.audit.length,
}
console.log(counts)
const status: Record<string, number> = {}
db.findings.forEach((f) => (status[f.status] = (status[f.status] ?? 0) + 1))
console.log('finding status', status)
check(counts.assets >= 100, 'need 100+ assets')
check(counts.findings >= 150, 'need 150+ findings')
check(counts.vendors >= 20, 'need 20+ vendors')
check(counts.aiSystems >= 15, 'need 15+ AI systems')
console.log('JSON size (KB):', Math.round(JSON.stringify(db).length / 1024))
if (errors.length) {
  console.error(`✗ ${errors.length} integrity errors`)
  console.error(errors.slice(0, 40).join('\n'))
  process.exit(1)
}
console.log('✓ Referential integrity OK')
