import type { Database, KnowledgeRecord } from '@/types'
import { createClock, createRng, pad } from './rng'
import { INTEGRATIONS, SERVICES, USERS } from './reference'
import { ALL_STATIC_KNOWLEDGE } from './knowledge'
import { generateAssets } from './assets'
import { generateFindings, SLA_DAYS } from './findings'
import { generateVendors, scoreAssessment } from './tprm'
import { generateAISystems, generateGovernanceReviews } from './ai'
import { generateControls, generateScenarios, INVESTMENTS } from './crq'
import { generateAgents } from './agents'
import { buildAccessRequests, buildApplications, buildInvitations, buildProjects, buildSupportTickets, treasuryAssets } from './projects'
import { generateAttackPaths, generateAudit, generateDataQuality, generateEvents, generateIncidents, generateIngestion, generateNotifications, generateTickets } from './ops'

export const DB_VERSION = 7
export const SEED = 20261020

export const DEFAULT_WEIGHTS = { cvss: 22, epss: 14, kev: 14, exploit: 8, internet: 14, assetCriticality: 12, serviceCriticality: 12, compensating: 8 }

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

/** Builds the full simulated dataset. Content is deterministic; timestamps are relative to `anchor`. */
export function buildDatabase(anchor = new Date()): Database {
  const rng = createRng(SEED)
  const clock = createClock(anchor)
  const users = clone(USERS)
  const services = clone(SERVICES)
  const integrations = clone(INTEGRATIONS)
  const knowledge: KnowledgeRecord[] = clone(ALL_STATIC_KNOWLEDGE).map((k) => ({ ...k, lastUpdated: clock.ago(rng.int(1, 6)) }))
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? id

  const assets = generateAssets(rng, clock)
  const { vendors, assessments, alerts } = generateVendors(rng, clock)
  const aiSystems = generateAISystems(rng, clock)
  const findings = generateFindings({ rng, clock, services, knowledge, userName }, assets, aiSystems)

  for (const a of assessments) {
    if (a.status === 'completed') {
      const v = vendors.find((x) => x.id === a.vendorId)!
      a.result = { ...scoreAssessment(a.answers, !!v.isAIProvider), generatedAt: a.completedAt!, provenance: 'human-reviewed' }
    }
  }

  const tickets = generateTickets(rng, clock, findings, vendors, assessments)
  const events = generateEvents(rng, clock, findings, assets, aiSystems)
  const incidents = generateIncidents(clock, findings, events, assets)
  const attackPaths = generateAttackPaths(clock, findings, assets)

  const governanceReviews = generateGovernanceReviews(clock)
  for (const g of governanceReviews) g.findingId = findings.find((f) => f.aiSystemId === g.aiSystemId)?.id

  const controls = generateControls(rng, clock)
  const scenarios = generateScenarios(findings)
  for (const s of scenarios) s.params.controlEffectiveness = Object.fromEntries(s.controls.map((c) => [c.controlId, controls.find((x) => x.id === c.controlId)!.effectiveness]))
  const { agents, executions } = generateAgents(rng, clock)
  const pending = executions.find((e) => e.status === 'awaiting_approval')
  if (pending?.approval) {
    const candidates = findings.filter((f) => f.status === 'validated' && f.ticketIds.length === 0 && f.domain !== 'ai').slice(0, 4)
    pending.approval.payload = { findingIds: candidates.map((f) => f.id) }
    pending.outputs = [{ label: `${candidates.length} remediation tickets drafted (pending approval)` }, ...candidates.map((f) => ({ label: `Draft ticket for ${f.id}: ${f.title}`, recordId: f.id, recordType: 'finding' as const }))]
  }

  const ingestionRuns = generateIngestion(rng, clock, integrations, findings, assets)
  for (const i of integrations) if (i.status === 'connected' && i.config) i.config.testedAt = clock.ago(rng.int(5, 60))
  for (const i of integrations) if (i.config && i.status !== 'available') i.config.testResult = i.status === 'error' ? 'failure' : 'success'
  const dataQuality = generateDataQuality(rng, clock, assets, findings)

  // Internal learning records — derived from resolved findings and analyst false-positive decisions.
  let ik = 1
  const byTemplate = new Map<string, typeof findings>()
  for (const f of findings.filter((x) => x.status === 'resolved')) byTemplate.set(f.templateKey, [...(byTemplate.get(f.templateKey) ?? []), f])
  for (const [, list] of byTemplate) {
    const f = list[0]
    knowledge.push({
      id: `KB-INT-${pad(ik, 3)}`,
      type: 'INTERNAL',
      externalId: `NS-RES-${pad(ik++, 3)}`,
      name: `Resolution pattern: ${f.title}`,
      summary: `Confirmed root cause: ${f.rootCause.confirmed ?? 'not recorded'}. Resolved by: ${f.remediation.recommended} Verified via ${f.remediation.verificationRequirements[0] ?? 'rescan'}. Applied to ${list.length} finding(s).`,
      derivedFromFindingIds: list.map((x) => x.id),
      cweIds: f.cweIds,
      lastUpdated: list[list.length - 1].resolvedAt!,
      source: 'Northstar internal learning (resolved findings)',
    })
  }
  const fps = findings.filter((x) => x.status === 'false_positive')
  const byReason = new Map<string, typeof findings>()
  for (const f of fps) byReason.set(f.fpReviews[0].reason, [...(byReason.get(f.fpReviews[0].reason) ?? []), f])
  for (const [reason, list] of byReason) {
    knowledge.push({
      id: `KB-INT-${pad(ik, 3)}`,
      type: 'INTERNAL',
      externalId: `NS-FP-${pad(ik++, 3)}`,
      name: `False-positive pattern: ${reason}`,
      summary: `${list.length} analyst-confirmed false positive(s) share this rationale. Example notes: "${list[0].fpReviews[0].analystNotes}" Used by the False Positive Review Assistant to prepare (not decide) future evidence packets.`,
      derivedFromFindingIds: list.map((x) => x.id),
      lastUpdated: list[0].fpReviews[0].decidedAt,
      source: 'Northstar internal learning (false-positive decisions)',
    })
  }

  const audit = generateAudit(rng, clock, findings, tickets, incidents, alerts)
  const notifications = generateNotifications(clock, findings, incidents)
  // Generated last so the deterministic IDs of everything above stay stable.
  const allAssets = [...assets, ...treasuryAssets(clock, assets.length + 1)]

  return {
    version: DB_VERSION,
    users,
    projects: buildProjects(clock),
    accessRequests: buildAccessRequests(clock),
    invitations: buildInvitations(clock),
    supportTickets: buildSupportTickets(clock),
    services: buildApplications(services, allAssets, findings, clock),
    assets: allAssets,
    knowledge,
    findings,
    attackPaths,
    events,
    incidents,
    tickets,
    vendors,
    assessments,
    monitoringAlerts: alerts,
    aiSystems,
    governanceReviews,
    controls,
    scenarios,
    investments: clone(INVESTMENTS),
    agents,
    executions,
    integrations,
    ingestionRuns,
    dataQuality,
    audit,
    notifications,
    settings: { weights: { ...DEFAULT_WEIGHTS }, currentUserId: 'USR-006', authenticated: false, workspace: 'northstar', orgName: 'Northstar Financial Services', currentProjectId: null, identity: { provider: 'Corporate SSO (Okta, simulated)', mfaRequired: true, sessionTimeoutHours: 8, stepUpForApprovals: true }, seededAt: clock.anchor.toISOString(), latencyMs: 180, slaDays: { ...SLA_DAYS } },
  }
}

export const ACME_USERS: Database['users'] = [
  { id: 'ACM-001', name: 'Alex Rivera', role: 'Platform Administrator', team: 'IT Security', email: 'alex.rivera@acme.example', initials: 'AR', orgRole: 'admin', status: 'active', mfaEnabled: true, demoLogin: true },
  { id: 'ACM-002', name: 'Jordan Blake', role: 'Security Analyst', team: 'IT Security', email: 'jordan.blake@acme.example', initials: 'JB', orgRole: 'analyst', status: 'active', mfaEnabled: true },
]

/**
 * A brand-new customer workspace with nothing set up: used to demonstrate first-time onboarding
 * (declare assets → map → connect → test run → full run).
 */
export function buildEmptyDatabase(anchor = new Date()): Database {
  const full = buildDatabase(anchor)
  const clock = createClock(anchor)
  const users = clone(ACME_USERS)
  return {
    ...full,
    users,
    projects: [],
    accessRequests: [],
    invitations: [],
    supportTickets: [],
    services: [],
    assets: [],
    knowledge: full.knowledge.filter((k) => k.type !== 'INTERNAL'),
    findings: [],
    attackPaths: [],
    events: [],
    incidents: [],
    tickets: [],
    vendors: [],
    assessments: [],
    monitoringAlerts: [],
    aiSystems: [],
    governanceReviews: [],
    scenarios: [],
    investments: [],
    agents: full.agents.map((a) => ({ ...a, status: 'idle', warnings: [], lastRunAt: clock.ago(0, 1) })),
    executions: [],
    integrations: full.integrations.map((i) => (i.category === 'Threat intelligence' && i.vendor.includes('public') ? { ...i, recordsIngested: 0, lastSyncAt: clock.ago(0, 1), syncHistory: [] } : { ...i, status: 'available', config: undefined, recordsIngested: 0, health: 0, syncHistory: [], lastSyncAt: undefined })),
    ingestionRuns: [],
    dataQuality: [],
    audit: [{ id: 'AUD-ACM-1', at: clock.ago(0, 1), actorId: 'ACM-001', action: 'workspace created', entityType: 'settings', entityId: 'workspace', details: 'Acme Corporation workspace provisioned', module: 'Platform' }],
    notifications: [{ id: 'NTF-ACM-1', at: clock.ago(0, 1), title: 'Welcome to DO SAFE', body: 'Start by telling us what you want to secure.', link: '/onboarding', severity: 'info', read: false }],
    settings: { ...full.settings, currentUserId: 'ACM-001', workspace: 'acme', orgName: 'Acme Corporation', currentProjectId: null, recentRecords: [] },
  }
}
