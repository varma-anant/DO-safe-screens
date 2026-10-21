// DO SAFE intelligence assistant — DEMO implementation.
// Deterministic intent matching + structured queries over the local demo dataset.
// It does not call any language model. A production implementation can replace `demoProvider`
// with an LLM-backed provider that implements the same `IntelligenceProvider` interface
// (retrieval over the same records, citations returned in `records` / `evidence`).
import type { Database, Provenance, SearchEntityType } from '@/types'
import { getDb } from '@/stores/db'
import { isOpen, FINDING_STATUS } from '@/utils/labels'
import { aiRiskScore, computeScenario, isOverdue, postureScore, totalALE, vendorRiskBand } from '@/utils/risk'
import { scoreFindings } from '@/utils/derive'
import { fmtMoney, fmtPct, plural } from '@/utils/format'
import { latency } from './core'

export interface IntelRecord {
  type: SearchEntityType
  id: string
  label: string
  meta?: string
  domain?: string
}
export interface IntelResponse {
  intent: string
  title: string
  answer: string[]
  records: IntelRecord[]
  evidence: { label: string; detail: string; provenance: Provenance }[]
  nextActions: { label: string; to: string }[]
  engine: 'deterministic-demo'
  supported: boolean
}

export interface IntelligenceProvider {
  ask(question: string): Promise<IntelResponse>
}

export const SUGGESTED_QUESTIONS = [
  'What are our most critical vulnerabilities?',
  'Which application has the highest risk?',
  'Which vendors require attention?',
  'Show unresolved critical findings.',
  'Which AI systems have configuration issues?',
  'What remediation tasks are overdue?',
  'Summarize the current security posture.',
  'Which findings are actively exploited (KEV)?',
  'Tell me about CVE-2021-44228',
  'Where is shadow AI being used?',
  'What is our estimated annual loss?',
  'Why were findings marked as false positives?',
]

type Handler = (db: Database, q: string) => Omit<IntelResponse, 'engine' | 'supported'>

const base = (db: Database) => scoreFindings(db.findings, db.assets, db.services, db.settings.weights)
const fRec = (f: Database['findings'][number], meta?: string): IntelRecord => ({ type: 'finding', id: f.id, label: f.title, meta, domain: f.domain })

const INTENTS: { name: string; match: RegExp; handle: Handler }[] = [
  {
    name: 'cve-lookup',
    match: /cve-\d{4}-\d{4,7}/i,
    handle: (db, q) => {
      const id = q.match(/cve-\d{4}-\d{4,7}/i)![0].toUpperCase()
      const k = db.knowledge.find((x) => x.externalId === id)
      const fs = db.findings.filter((f) => f.cveId === id)
      if (!k)
        return { intent: 'cve-lookup', title: id, answer: [`${id} is not in the DO SAFE knowledge library snapshot, and no Northstar findings reference it.`, 'The demo library only contains CVEs referenced by demo findings. A production deployment would query NVD / vendor advisories.'], records: [], evidence: [], nextActions: [{ label: 'Open knowledge library', to: '/intelligence/library' }] }
      const open = fs.filter((f) => isOpen(f.status))
      return {
        intent: 'cve-lookup',
        title: `${id} — ${k.name}`,
        answer: [k.summary, `CVSS ${k.cvss?.score} (${k.cvss?.source}); ${k.kev ? 'listed in CISA KEV (known exploited)' : 'not listed in CISA KEV in this snapshot'}; weakness ${k.cweIds?.join(', ') || 'not mapped'}.`, `Northstar impact: ${plural(fs.length, 'finding')} on ${plural(new Set(fs.map((f) => f.assetId)).size, 'asset')}; ${open.length} still open.`],
        records: [{ type: 'knowledge', id: k.id, label: `${k.externalId} knowledge record` }, ...fs.slice(0, 8).map((f) => fRec(f, `${db.assets.find((a) => a.id === f.assetId)?.name} · ${FINDING_STATUS[f.status].label}`))],
        evidence: [{ label: 'NVD / CISA KEV summary', detail: `${k.source} · EPSS ${fmtPct(k.epss?.score ?? 0, 1)} (illustrative snapshot)`, provenance: 'external' }],
        nextActions: [{ label: 'Open knowledge record', to: `/intelligence/library/${k.id}` }, ...(open[0] ? [{ label: `Investigate ${open[0].id}`, to: `/exposures/vulnerabilities/${open[0].id}` }] : [])],
      }
    },
  },
  {
    name: 'kev',
    match: /\bkev\b|actively exploited|known exploited|exploited in the wild/i,
    handle: (db) => {
      const rows = base(db).filter((r) => r.f.kev && isOpen(r.f.status)).sort((a, b) => b.score - a.score)
      return {
        intent: 'kev',
        title: 'Open findings with known exploitation (CISA KEV)',
        answer: [`${rows.length} open findings reference CVEs listed in the CISA KEV catalog snapshot, across ${new Set(rows.map((r) => r.f.cveId)).size} distinct CVEs.`, `${rows.filter((r) => r.asset?.internetExposed).length} of them are on internet-facing assets and should be prioritized for emergency patching.`],
        records: rows.slice(0, 8).map((r) => fRec(r.f, `${r.f.cveId} · risk ${r.score} · ${r.asset?.name}`)),
        evidence: [{ label: 'CISA KEV catalog snapshot', detail: 'KEV flags come from the demo knowledge library (public catalog summary).', provenance: 'external' }],
        nextActions: [{ label: 'Open KEV view', to: '/exposures/vulnerabilities?kev=KEV&status=new,triaged,in_validation,validated,in_remediation,pending_verification' }, { label: 'Run Remediation Orchestrator', to: '/intelligence/agents/AGT-07' }],
      }
    },
  },
  {
    name: 'critical-vulns',
    match: /(most )?critical vulnerabilit|top (risks|vulnerabilit|exposures)|riskiest (finding|vulnerab)/i,
    handle: (db) => {
      const rows = base(db).filter((r) => isOpen(r.f.status) && r.f.domain === 'vulnerability').sort((a, b) => b.score - a.score).slice(0, 6)
      return {
        intent: 'critical-vulns',
        title: 'Most critical vulnerabilities (by dynamic risk score)',
        answer: [`Ranked by DO SAFE's dynamic risk score, which combines CVSS, EPSS (illustrative), KEV listing, exploit maturity, internet exposure, asset and business-service criticality, and compensating controls.`, `The top item is ${rows[0].f.id} (${rows[0].f.title}) on ${rows[0].asset?.name}, supporting ${rows[0].service?.name}, with risk score ${rows[0].score}.`, `${rows.filter((r) => r.f.kev).length} of the top ${rows.length} are KEV-listed; ${rows.filter((r) => r.f.ticketIds.length === 0).length} have no remediation ticket yet.`],
        records: rows.map((r) => fRec(r.f, `risk ${r.score} · ${r.asset?.name} · ${FINDING_STATUS[r.f.status].label}`)),
        evidence: rows.slice(0, 3).map((r) => ({ label: `${r.f.id} evidence`, detail: `${r.f.evidence.length} evidence items from ${r.f.sourceIntegrationId.replace('INT-', '')}; ${r.f.detectionMethod}`, provenance: 'observed' as Provenance })),
        nextActions: [{ label: `Investigate ${rows[0].f.id}`, to: `/exposures/vulnerabilities/${rows[0].f.id}` }, { label: 'Tune prioritization weights', to: '/exposures/prioritization' }],
      }
    },
  },
  {
    name: 'unresolved-critical',
    match: /unresolved critical|open critical|critical findings/i,
    handle: (db) => {
      const rows = base(db).filter((r) => isOpen(r.f.status) && r.f.severity === 'critical').sort((a, b) => b.score - a.score)
      const noTicket = rows.filter((r) => !r.f.ticketIds.length)
      return {
        intent: 'unresolved-critical',
        title: `${rows.length} unresolved critical findings`,
        answer: [`There are ${rows.length} open critical findings across ${new Set(rows.map((r) => r.f.businessServiceId)).size} applications. ${rows.filter(isOverdueRow).length} are past their SLA target date.`, `${noTicket.length} have no remediation ticket; ${rows.filter((r) => r.f.status === 'in_remediation').length} are actively being remediated.`],
        records: rows.slice(0, 10).map((r) => fRec(r.f, `${r.service?.name} · ${FINDING_STATUS[r.f.status].label}${isOverdue(r.f) ? ' · overdue' : ''}`)),
        evidence: [{ label: 'Finding lifecycle data', detail: 'Status, owners and target dates from DO SAFE finding records.', provenance: 'observed' }],
        nextActions: [{ label: 'Open critical findings view', to: '/operations/findings?severity=critical&status=new,triaged,in_validation,validated,in_remediation,pending_verification' }, { label: 'Remediation Center', to: '/operations/remediation' }],
      }
    },
  },
  {
    name: 'service-risk',
    match: /(business service|application).*(risk|highest)|highest risk.*service|which service/i,
    handle: (db) => {
      const rows = db.services.map((s) => {
        const ale = db.scenarios.filter((x) => x.businessServiceId === s.id).reduce((a, x) => a + computeScenario(x, db.findings).ale, 0)
        const open = db.findings.filter((f) => f.businessServiceId === s.id && isOpen(f.status))
        return { s, ale, crit: open.filter((f) => f.severity === 'critical').length, open: open.length }
      }).sort((a, b) => b.ale - a.ale)
      const top = rows[0]
      return {
        intent: 'service-risk',
        title: `Highest-risk application: ${top.s.name}`,
        answer: [`${top.s.name} carries the highest illustrative estimated annual loss (${fmtMoney(top.ale)}), with ${top.crit} open critical and ${top.open} total open findings.`, `Ranking by open critical exposure alone would put ${[...rows].sort((a, b) => b.crit - a.crit)[0].s.name} first — financial ranking weights scenario likelihood and loss magnitude.`],
        records: rows.map((r) => ({ type: 'service' as const, id: r.s.id, label: r.s.name, meta: `ALE ${fmtMoney(r.ale)} · ${r.crit} critical · ${r.open} open` })),
        evidence: [{ label: 'CRQ scenarios', detail: 'Illustrative model: ALE = AEP × loss per event, adjusted for linked findings and controls.', provenance: 'inferred' }],
        nextActions: [{ label: `Open ${top.s.name}`, to: `/applications/${top.s.id}` }, { label: 'Risk scenarios', to: '/crq/scenarios' }],
      }
    },
  },
  {
    name: 'vendors',
    match: /vendor|third[- ]part|supplier/i,
    handle: (db) => {
      const rows = db.vendors.filter((v) => v.lifecycle !== 'offboarded').map((v) => ({ v, alerts: db.monitoringAlerts.filter((a) => a.vendorId === v.id && a.status === 'open'), items: db.tickets.filter((t) => t.vendorId === v.id && !['done', 'cancelled'].includes(t.status)).length })).filter((r) => r.alerts.length || ['high', 'critical'].includes(vendorRiskBand(r.v.residualRisk))).sort((a, b) => b.v.residualRisk + b.alerts.length * 5 - (a.v.residualRisk + a.alerts.length * 5))
      return {
        intent: 'vendors',
        title: `${rows.length} vendors require attention`,
        answer: [`${rows.length} third parties have high/critical residual risk or open monitoring alerts.`, rows[0] ? `Highest priority: ${rows[0].v.name} (${rows[0].v.category}) — residual risk ${rows[0].v.residualRisk}/100${rows[0].alerts[0] ? `, alert: “${rows[0].alerts[0].title}”` : ''}.` : ''],
        records: rows.slice(0, 8).map((r) => ({ type: 'vendor' as const, id: r.v.id, label: r.v.name, meta: `residual ${r.v.residualRisk} · ${r.alerts.length} alerts · ${r.items} open items` })),
        evidence: rows.slice(0, 3).flatMap((r) => r.alerts.slice(0, 1).map((a) => ({ label: `${r.v.name}: ${a.type}`, detail: `${a.detail} (source: ${a.source})`, provenance: 'observed' as Provenance }))),
        nextActions: [{ label: 'Vendor overview', to: '/tprm' }, { label: 'Monitoring alerts', to: '/tprm/monitoring' }],
      }
    },
  },
  {
    name: 'ai-config',
    match: /ai system.*(config|issue|misconfig)|configuration issues|ai config/i,
    handle: (db) => {
      const rows = db.aiSystems.map((a) => ({ a, fails: a.configChecks.filter((c) => c.result === 'fail') })).filter((r) => r.fails.length).sort((a, b) => b.fails.length - a.fails.length)
      return {
        intent: 'ai-config',
        title: `${rows.length} AI systems have failing configuration checks`,
        answer: [`${rows.reduce((s, r) => s + r.fails.length, 0)} failing checks across ${rows.length} AI systems.`, rows[0] ? `${rows[0].a.name}: ${rows[0].fails.map((f) => f.check.toLowerCase()).join('; ')}.` : ''],
        records: rows.map((r) => ({ type: 'aiSystem' as const, id: r.a.id, label: r.a.name, meta: `${r.fails.length} failing · risk ${aiRiskScore(r.a, db.findings)}` })),
        evidence: rows.slice(0, 3).map((r) => ({ label: `${r.a.name}`, detail: r.fails.map((f) => `${f.check}: ${f.detail}`).join(' · '), provenance: 'observed' as Provenance })),
        nextActions: [{ label: 'AI configuration risks', to: '/ai-security/config-risks' }, ...(rows[0] ? [{ label: `Open ${rows[0].a.name}`, to: `/ai-security/systems/${rows[0].a.id}` }] : [])],
      }
    },
  },
  {
    name: 'shadow-ai',
    match: /shadow ai|unsanctioned|unauthori[sz]ed ai/i,
    handle: (db) => {
      const rows = db.aiSystems.filter((a) => a.approval === 'unsanctioned' || (a.approval === 'prohibited' && a.users > 0))
      return {
        intent: 'shadow-ai',
        title: `${rows.length} shadow AI applications in use`,
        answer: [`${rows.reduce((s, a) => s + a.users, 0)} users are using ${rows.length} unsanctioned or prohibited AI applications.`, 'Detections come from SSE traffic, IdP OAuth grants, EDR browser extension inventory and code platform app installs — no single source sees all of them.'],
        records: rows.map((a) => ({ type: 'aiSystem' as const, id: a.id, label: a.name, meta: `${a.users} users · via ${a.discoveredVia.join(', ')}` })),
        evidence: rows.slice(0, 3).map((a) => ({ label: a.name, detail: a.signals.find((s) => s.dimension === 'Live activity')?.detail ?? '', provenance: 'observed' as Provenance })),
        nextActions: [{ label: 'Shadow AI', to: '/ai-security/shadow-ai' }, { label: 'Governance reviews', to: '/ai-security/governance' }],
      }
    },
  },
  {
    name: 'overdue',
    match: /overdue|past due|late remediation|sla/i,
    handle: (db) => {
      const t = db.tickets.filter((x) => !['done', 'cancelled'].includes(x.status) && new Date(x.dueDate) < new Date()).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      const f = db.findings.filter(isOverdue)
      return {
        intent: 'overdue',
        title: `${t.length} overdue remediation tickets · ${f.length} findings past SLA`,
        answer: [`${t.length} remediation tickets are past their due date (${t.filter((x) => x.priority === 'P1').length} P1). ${f.length} open findings are past their severity SLA target.`, `${t.filter((x) => x.status === 'blocked').length} overdue tickets are blocked — usually change-freeze or vendor dependency.`],
        records: t.slice(0, 10).map((x) => ({ type: 'ticket' as const, id: x.id, label: x.title, meta: `${x.priority} · due ${x.dueDate.slice(0, 10)} · ${x.status.replace('_', ' ')}` })),
        evidence: [{ label: 'Ticket due dates', detail: 'Due dates and status from DO SAFE tickets (Jira sync simulated).', provenance: 'observed' }],
        nextActions: [{ label: 'Overdue remediation view', to: '/operations/remediation?sla=Overdue' }, { label: 'Remediation Center', to: '/operations/remediation' }],
      }
    },
  },
  {
    name: 'ale',
    match: /annual loss|\bale\b|financial|loss exposure|quantif/i,
    handle: (db) => {
      const rows = db.scenarios.map((s) => ({ s, r: computeScenario(s, db.findings) })).sort((a, b) => b.r.ale - a.r.ale)
      const ale = totalALE(db.scenarios, db.findings)
      const red = rows.reduce((a, x) => a + (x.r.ale - x.r.aleRemediated), 0)
      return {
        intent: 'ale',
        title: `Estimated annual loss: ${fmtMoney(ale)} (illustrative)`,
        answer: [`Across ${rows.length} modelled scenarios, illustrative ALE is ${fmtMoney(ale)} (range ${fmtMoney(rows.reduce((a, x) => a + x.r.aleLow, 0))}–${fmtMoney(rows.reduce((a, x) => a + x.r.aleHigh, 0))}).`, `Largest scenario: ${rows[0].s.name} (${fmtMoney(rows[0].r.ale)}). Remediating linked open high/critical findings would reduce ALE by about ${fmtMoney(red)}.`, 'These are illustrative estimates from a simplified documented model, not validated actuarial figures.'],
        records: rows.slice(0, 6).map((x) => ({ type: 'scenario' as const, id: x.s.id, label: x.s.name, meta: `ALE ${fmtMoney(x.r.ale)} · AEP ${fmtPct(x.r.aep, 1)}` })),
        evidence: [{ label: 'CRQ model', detail: 'ALE = effective AEP × most-likely loss per event; documented assumptions per scenario.', provenance: 'inferred' }],
        nextActions: [{ label: 'CRQ overview', to: '/crq' }, { label: 'Investment analysis', to: '/crq/investments' }],
      }
    },
  },
  {
    name: 'false-positives',
    match: /false positive/i,
    handle: (db) => {
      const fps = db.findings.filter((f) => f.status === 'false_positive')
      const reasons = Object.entries(fps.reduce<Record<string, number>>((a, f) => { const r = f.fpReviews[f.fpReviews.length - 1].reason; a[r] = (a[r] ?? 0) + 1; return a }, {})).sort((a, b) => b[1] - a[1])
      return {
        intent: 'false-positives',
        title: `${fps.length} findings confirmed as false positives`,
        answer: [`Each false positive has a recorded analyst decision with reason, supporting evidence, reviewer and timestamp. Most common reasons: ${reasons.slice(0, 3).map(([r, n]) => `${r} (${n})`).join(', ')}.`, 'False positives are never set automatically — the False Positive Review Assistant only prepares evidence packets for analysts.'],
        records: fps.slice(0, 8).map((f) => fRec(f, `${f.fpReviews[f.fpReviews.length - 1].reason}`)),
        evidence: fps.slice(0, 2).map((f) => ({ label: `${f.id} decision`, detail: f.fpReviews[f.fpReviews.length - 1].analystNotes, provenance: 'human-reviewed' as Provenance })),
        nextActions: [{ label: 'False positives view', to: '/operations/findings?status=false_positive' }],
      }
    },
  },
  {
    name: 'incidents',
    match: /incident/i,
    handle: (db) => {
      const act = db.incidents.filter((i) => i.status !== 'closed')
      return {
        intent: 'incidents',
        title: `${act.length} active incidents`,
        answer: [`${act.length} incidents are active (${act.filter((i) => i.severity === 'critical').length} critical). ${db.incidents.filter((i) => i.status === 'closed').length} have been closed with resolution summaries.`],
        records: act.map((i) => ({ type: 'incident' as const, id: i.id, label: i.title, meta: `${i.severity} · ${i.status}` })),
        evidence: [],
        nextActions: [{ label: 'Incidents', to: '/operations/incidents' }],
      }
    },
  },
  {
    name: 'posture',
    match: /posture|summar|overview|how are we|status of security|risk overview/i,
    handle: (db) => {
      const open = db.findings.filter((f) => isOpen(f.status))
      const ale = totalALE(db.scenarios, db.findings)
      const hv = db.vendors.filter((v) => v.lifecycle !== 'offboarded' && ['high', 'critical'].includes(vendorRiskBand(v.residualRisk)))
      const shadow = db.aiSystems.filter((a) => a.approval === 'unsanctioned')
      return {
        intent: 'posture',
        title: `Security posture summary — score ${postureScore(db.findings)}/100`,
        answer: [
          `Exposure: ${open.length} open findings — ${open.filter((f) => f.severity === 'critical').length} critical, ${open.filter((f) => f.kev).length} KEV-listed, ${db.findings.filter(isOverdue).length} past SLA.`,
          `Financial: illustrative estimated annual loss ${fmtMoney(ale)}; highest-loss scenario is ${[...db.scenarios].sort((a, b) => computeScenario(b, db.findings).ale - computeScenario(a, db.findings).ale)[0].name}.`,
          `Third parties: ${hv.length} vendors at high/critical residual risk; ${db.monitoringAlerts.filter((a) => a.status === 'open').length} open monitoring alerts.`,
          `AI: ${shadow.length} shadow AI apps; ${db.aiSystems.filter((a) => a.governanceStatus === 'non_compliant').length} AI systems non-compliant.`,
          `Operations: ${db.incidents.filter((i) => i.status !== 'closed').length} active incidents; ${db.tickets.filter((t) => !['done', 'cancelled'].includes(t.status)).length} open remediation tickets.`,
        ],
        records: [...open.filter((f) => f.kev && f.severity === 'critical').slice(0, 3).map((f) => fRec(f, 'critical · KEV')), ...hv.slice(0, 2).map((v) => ({ type: 'vendor' as const, id: v.id, label: v.name, meta: `residual ${v.residualRisk}` })), ...shadow.slice(0, 2).map((a) => ({ type: 'aiSystem' as const, id: a.id, label: a.name, meta: 'shadow AI' }))],
        evidence: [{ label: 'Aggregated from all modules', detail: 'Findings, CRQ scenarios, vendors, AI systems, incidents and tickets in the demo dataset.', provenance: 'inferred' }],
        nextActions: [{ label: 'Executive dashboard', to: '/dashboard' }, { label: 'Board risk report', to: '/crq/report' }],
      }
    },
  },
]

function isOverdueRow(r: { f: Database['findings'][number] }) {
  return isOverdue(r.f)
}

export const demoProvider: IntelligenceProvider = {
  async ask(question: string) {
    await latency(3)
    const db = getDb()
    const intent = INTENTS.find((i) => i.match.test(question))
    if (!intent)
      return {
        intent: 'unsupported',
        title: 'This demo assistant has limited capabilities',
        answer: ['The prototype assistant answers a defined set of questions using deterministic intent matching over the demo dataset — it is not a live language model and cannot answer open-ended questions.', 'Try one of the suggested questions, or search records with ⌘K.'],
        records: [],
        evidence: [],
        nextActions: [{ label: 'Open global search', to: '#search' }],
        engine: 'deterministic-demo',
        supported: false,
      }
    return { ...intent.handle(db, question), engine: 'deterministic-demo', supported: true }
  },
}
