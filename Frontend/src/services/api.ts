// REST-shaped demo data-access layer. Each function maps to a plausible future endpoint
// (e.g. getFindings → GET /api/v1/findings). All data is local and simulated.
import type {
  Agent, AgentExecution, AIApproval, AISystem, Asset, Assessment, AssessmentAnswer, Control, Database, DemoSettings, EvidenceDoc, EventStatus, FalsePositiveReason, Finding,
  FindingStatus, GovernanceReview, Incident, IncidentTask, Integration, ScenarioParams, SearchEntityType, Ticket, TicketType, Vendor, VendorLifecycle,
} from '@/types'
import { getDb, useDbStore } from '@/stores/db'
import { FINDING_TEMPLATES } from '@/data/seed/templates'
import { scoreAssessment } from '@/data/seed/tprm'
import { AGENT_PLAYBOOKS } from '@/data/seed/agents'
import { MODEL_ID, MODEL_VERSION } from '@/data/seed/findings'
import { FINDING_STATUS } from '@/utils/labels'
import { actor, audit, commit, DemoApiError, requireCap, historyEntry, latency, mustFind, nextId, notify, now, replace, uid, userName, type CollectionKey, type CollectionMap } from './core'
import { plural } from '@/utils/format'
import { restrictForViewer } from './visibility'

export type { CollectionKey, CollectionMap }

const addDays = (iso: string, d: number) => new Date(new Date(iso).getTime() + d * 86_400_000).toISOString()
const SLA = () => getDb().settings.slaDays

// ===================================================================== Reads

const loaded = new Set<string>()
export async function list<K extends CollectionKey>(key: K): Promise<CollectionMap[K]> {
  // First load uses full simulated latency (shows loading states); refreshes after mutations are quick.
  await latency(loaded.has(key) ? 0.15 : 1)
  loaded.add(key)
  const db = getDb()
  return restrictForViewer(key, db[key], db)
}
export async function getSettings() {
  await latency(0.3)
  return getDb().settings
}

export const getFindings = () => list('findings')
export const getAssets = () => list('assets')
export const getVendors = () => list('vendors')
export const getAISystems = () => list('aiSystems')
export const getIncidents = () => list('incidents')
export const getTickets = () => list('tickets')
export const getAuditEvents = () => list('audit')
export async function getFindingById(id: string) {
  await latency()
  return getDb().findings.find((f) => f.id === id) ?? null
}
export async function getVendorById(id: string) {
  await latency()
  return getDb().vendors.find((v) => v.id === id) ?? null
}

// ===================================================================== Findings

function patchFinding(db: Database, id: string, fn: (f: Finding) => Finding): Database {
  const f = mustFind(db.findings, id, 'Finding')
  return { ...db, findings: replace(db.findings, fn(f)) }
}

const moduleFor = (f: Finding) => (f.domain === 'ai' ? 'AI-SPM' : 'CTEM') as 'AI-SPM' | 'CTEM'

export async function updateFinding(id: string, patch: Partial<Finding>, summary = 'Finding updated') {
  requireCap('triage_findings')
  await latency()
  commit((db) => {
    const next = patchFinding(db, id, (f) => ({ ...f, ...patch, history: [...f.history, historyEntry('comment', summary)] }))
    return audit(next, { action: 'finding updated', entityType: 'finding', entityId: id, details: summary, module: moduleFor(mustFind(db.findings, id, 'Finding')) })
  })
}

export async function assignFinding(id: string, ownerId: string, targetDate?: string) {
  requireCap('triage_findings')
  await latency()
  commit((db) => {
    const f0 = mustFind(db.findings, id, 'Finding')
    let next = patchFinding(db, id, (f) => ({ ...f, ownerId, targetDate: targetDate ?? f.targetDate, status: f.status === 'new' ? 'triaged' : f.status, history: [...f.history, historyEntry('assigned', `Owner assigned: ${userName(ownerId)}${targetDate ? ` · target ${targetDate.slice(0, 10)}` : ''}`)] }))
    next = audit(next, { action: 'owner assigned', entityType: 'finding', entityId: id, details: `${userName(ownerId)}`, module: moduleFor(f0) })
    return notify(next, { title: 'Finding assigned', body: `${id} assigned to ${userName(ownerId)}`, link: `/operations/findings/${id}`, severity: f0.severity })
  })
}

export async function changeFindingStatus(id: string, status: FindingStatus, note?: string) {
  requireCap('triage_findings')
  await latency()
  commit((db) => {
    const f0 = mustFind(db.findings, id, 'Finding')
    if (status === 'false_positive') throw new DemoApiError('False-positive status requires an explicit review decision.')
    if (status === 'resolved') throw new DemoApiError('Resolution requires verification evidence (submit verification on the remediation ticket).')
    const next = patchFinding(db, id, (f) => ({ ...f, status, history: [...f.history, historyEntry('status_change', `Status: ${FINDING_STATUS[f.status].label} → ${FINDING_STATUS[status].label}`, note)] }))
    return audit(next, { action: 'status changed', entityType: 'finding', entityId: id, details: `${f0.status} → ${status}${note ? ` (${note})` : ''}`, module: moduleFor(f0) })
  })
}

export async function addInvestigationNote(id: string, text: string) {
  requireCap('triage_findings')
  await latency(0.5)
  commit((db) => {
    const next = patchFinding(db, id, (f) => ({ ...f, rootCause: { ...f.rootCause, notes: [...f.rootCause.notes, { id: uid('N'), authorId: actor(), at: now(), text }] }, history: [...f.history, historyEntry('comment', 'Investigation note added', text)] }))
    return audit(next, { action: 'note added', entityType: 'finding', entityId: id, details: text.slice(0, 80), module: 'Operations' })
  })
}

export async function addHypothesis(id: string, statement: string) {
  requireCap('triage_findings')
  await latency(0.5)
  commit((db) => {
    const next = patchFinding(db, id, (f) => ({ ...f, rootCause: { ...f.rootCause, hypotheses: [...f.rootCause.hypotheses, { id: uid('RC'), statement, likelihood: 'possible', supportingEvidenceIds: [], status: 'open', provenance: 'human-reviewed' }] }, history: [...f.history, historyEntry('comment', 'Root-cause hypothesis added', statement)] }))
    return audit(next, { action: 'hypothesis added', entityType: 'finding', entityId: id, details: statement.slice(0, 80), module: 'Operations' })
  })
}

export async function setHypothesisStatus(id: string, hypId: string, status: 'confirmed' | 'rejected' | 'open') {
  requireCap('triage_findings')
  await latency(0.5)
  commit((db) => {
    let stmt = ''
    const next = patchFinding(db, id, (f) => {
      const hypotheses = f.rootCause.hypotheses.map((h) => {
        if (h.id !== hypId) return h
        stmt = h.statement
        return { ...h, status, provenance: 'human-reviewed' as const }
      })
      const confirmed = status === 'confirmed' ? stmt : f.rootCause.confirmed === stmt ? undefined : f.rootCause.confirmed
      return { ...f, rootCause: { ...f.rootCause, hypotheses, confirmed }, history: [...f.history, historyEntry('classified', `Root-cause hypothesis ${status}`, stmt)] }
    })
    return audit(next, { action: `root cause ${status}`, entityType: 'finding', entityId: id, details: stmt.slice(0, 80), module: 'Operations' })
  })
}

export async function reviewAIAnalysis(id: string, decision: 'accepted' | 'rejected' | 'needs_more_info', comment?: string) {
  requireCap('triage_findings')
  await latency(0.5)
  commit((db) => {
    const next = patchFinding(db, id, (f) => ({ ...f, aiAnalysis: f.aiAnalysis ? { ...f.aiAnalysis, reviewStatus: decision, reviewedById: actor(), reviewedAt: now() } : f.aiAnalysis, history: [...f.history, historyEntry('ai_analysis', `AI analysis review: ${decision.replace(/_/g, ' ')}`, comment)] }))
    return audit(next, { action: 'AI analysis reviewed', entityType: 'finding', entityId: id, details: decision, module: 'Intelligence' })
  })
}

/** Simulated AI investigation refresh — produces a new versioned analysis and keeps the previous one. */
export async function regenerateAIAnalysis(id: string) {
  requireCap('triage_findings')
  await latency(4)
  commit((db) => {
    const next = patchFinding(db, id, (f) => {
      const prev = f.aiAnalysis
      const conf = Math.min(0.97, (prev?.confidence ?? 0.7) + (f.validation.status === 'exploitable' ? 0.04 : 0.01))
      return {
        ...f,
        aiAnalysis: {
          summary: `${f.title}. Current status: ${FINDING_STATUS[f.status].label}. ${f.validation.status !== 'not_started' ? `Validation result: ${f.validation.status.replace('_', ' ')}. ` : ''}${f.rootCause.confirmed ? `Confirmed root cause: ${f.rootCause.confirmed} ` : `Leading hypothesis: ${f.rootCause.hypotheses[0]?.statement ?? 'none recorded'} `}Recommended action: ${f.remediation.recommended}`,
          keyObservations: [
            `${plural(f.evidence.length, 'evidence item')}; ${f.evidence.filter((e) => e.reliability === 'high').length} high reliability.`,
            f.cveId ? `${f.cveId}${f.kev ? ' (CISA KEV listed)' : ''}.` : 'No CVE applies.',
            `${plural(f.ticketIds.length, 'linked ticket')}; ${plural(f.incidentIds.length, 'linked incident')}.`,
          ],
          evidenceRefs: f.evidence.map((e) => e.id),
          knowledgeRefs: [f.cveId, ...f.cweIds, ...f.attackIds, ...f.owaspIds].filter(Boolean) as string[],
          modelId: MODEL_ID,
          modelVersion: MODEL_VERSION,
          assessedAt: now(),
          confidence: Number(conf.toFixed(2)),
          confidenceFactors: prev?.confidenceFactors ?? [],
          missingInformation: f.missingEvidence,
          reviewStatus: 'pending_review',
          previousVersions: prev ? [{ modelVersion: prev.modelVersion, assessedAt: prev.assessedAt, confidence: prev.confidence, summary: prev.summary }, ...prev.previousVersions] : [],
        },
        history: [...f.history, historyEntry('ai_analysis', `AI investigation summary regenerated (${MODEL_VERSION}, simulated)`)],
      }
    })
    return audit(next, { action: 'AI analysis generated (simulated)', entityType: 'finding', entityId: id, details: MODEL_VERSION, module: 'Intelligence' })
  })
}

export async function submitFalsePositiveReview(id: string, input: { reason: FalsePositiveReason; supportingEvidence: string; analystNotes: string; reviewerId: string }) {
  requireCap('triage_findings')
  await latency()
  commit((db) => {
    const f0 = mustFind(db.findings, id, 'Finding')
    const version = f0.fpReviews.length + 1
    let next = patchFinding(db, id, (f) => ({
      ...f,
      status: 'false_positive',
      fpReviews: [...f.fpReviews, { id: `FPR-${id.slice(4)}-${version}`, ...input, decidedAt: now(), decision: 'confirmed_false_positive', version, previousStatus: f.status }],
      remediation: { ...f.remediation, status: 'not_applicable' },
      history: [...f.history, historyEntry('false_positive_review', `Confirmed false positive (decision v${version}): ${input.reason}`, input.analystNotes, input.reviewerId)],
    }))
    // Open tickets linked to the finding are cancelled, not deleted.
    next = { ...next, tickets: next.tickets.map((t) => (t.findingId === id && !['done', 'cancelled'].includes(t.status) ? { ...t, status: 'cancelled', updatedAt: now(), history: [...t.history, historyEntry('status_change', 'Cancelled — linked finding confirmed false positive')] } : t)) }
    return audit(next, { action: 'false positive confirmed', entityType: 'finding', entityId: id, details: `${input.reason} · reviewer ${userName(input.reviewerId)}`, module: moduleFor(f0) })
  })
}

export async function reopenFinding(id: string, reason: string) {
  requireCap('triage_findings')
  await latency()
  commit((db) => {
    const f0 = mustFind(db.findings, id, 'Finding')
    const version = f0.fpReviews.length + 1
    const wasFP = f0.status === 'false_positive'
    let next = patchFinding(db, id, (f) => ({
      ...f,
      status: 'triaged',
      resolvedAt: undefined,
      remediation: { ...f.remediation, status: 'not_started' },
      fpReviews: wasFP ? [...f.fpReviews, { id: `FPR-${id.slice(4)}-${version}`, reason: f.fpReviews[f.fpReviews.length - 1]?.reason ?? 'Scanner signature error', supportingEvidence: '—', analystNotes: reason, reviewerId: actor(), decidedAt: now(), decision: 'reopened', version, previousStatus: f.status }] : f.fpReviews,
      riskAcceptance: f.status === 'risk_accepted' ? undefined : f.riskAcceptance,
      history: [...f.history, historyEntry('reopened', `Finding reopened (was ${FINDING_STATUS[f.status].label})`, reason)],
    }))
    next = audit(next, { action: 'finding reopened', entityType: 'finding', entityId: id, details: reason, module: moduleFor(f0) })
    return notify(next, { title: 'Finding reopened', body: `${id} reopened: ${reason}`, link: `/operations/findings/${id}`, severity: f0.severity })
  })
}

export async function runValidation(id: string) {
  requireCap('triage_findings')
  await latency(5)
  commit((db) => {
    const f0 = mustFind(db.findings, id, 'Finding')
    const a = f0.assetId ? db.assets.find((x) => x.id === f0.assetId) : undefined
    const blockedByControl = f0.compensatingControlsInPlace > 0 && f0.exploitMaturity !== 'weaponized'
    const reachable = !!a?.internetExposed || f0.domain === 'identity' || f0.domain === 'misconfiguration' || f0.domain === 'ai' || f0.exploitMaturity !== 'none'
    const status = blockedByControl ? 'not_exploitable' : reachable ? 'exploitable' : 'inconclusive'
    const method = f0.domain === 'vulnerability' ? (a?.internetExposed ? 'Safe exploit simulation' : 'Reachability analysis') : 'Configuration verification'
    const summary = status === 'exploitable'
      ? `${method}: vulnerable condition reachable${a?.internetExposed ? ' from the internet' : ' from adjacent network zones'}; no effective compensating control observed. (Simulated validation — no exploit executed.)`
      : status === 'not_exploitable'
        ? `${method}: compensating control prevents the exploit precondition. Consider false-positive review or risk acceptance. (Simulated.)`
        : `${method}: reachability could not be established with available data. Additional evidence required. (Simulated.)`
    let next = patchFinding(db, id, (f) => ({
      ...f,
      status: status === 'exploitable' ? 'validated' : f.status === 'in_validation' || f.status === 'new' ? 'triaged' : f.status,
      validation: { status, method, reachable, controlsObserved: blockedByControl ? ['Compensating control (WAF / network isolation)'] : [], summary, validatedAt: now(), validatedById: actor(), provenance: 'simulated' },
      history: [...f.history, historyEntry('validated', `Exploitability validation: ${status.replace('_', ' ')}`, summary)],
    }))
    next = audit(next, { action: 'validation run (simulated)', entityType: 'finding', entityId: id, details: status, module: 'CTEM' })
    return next
  })
}

export async function startValidation(id: string) {
  requireCap('triage_findings')
  await latency(0.5)
  commit((db) => {
    const next = patchFinding(db, id, (f) => ({ ...f, status: 'in_validation', validation: { status: 'in_progress', method: 'Reachability analysis', provenance: 'simulated' }, history: [...f.history, historyEntry('status_change', 'Queued for exploitability validation')] }))
    return audit(next, { action: 'validation queued', entityType: 'finding', entityId: id, details: 'Queued', module: 'CTEM' })
  })
}

export async function requestRiskAcceptance(id: string, justification: string, expiresAt: string) {
  requireCap('triage_findings')
  await latency()
  commit((db) => {
    const next = patchFinding(db, id, (f) => ({ ...f, riskAcceptance: { requestedById: actor(), requestedAt: now(), justification, expiresAt, status: 'pending' }, history: [...f.history, historyEntry('risk_acceptance', 'Risk acceptance requested', justification)] }))
    const n = audit(next, { action: 'risk acceptance requested', entityType: 'finding', entityId: id, details: justification.slice(0, 80), module: 'Operations' })
    return notify(n, { title: 'Approval required', body: `Risk acceptance requested for ${id}`, link: '/operations/approvals', severity: 'info' })
  })
}

export async function decideRiskAcceptance(id: string, approve: boolean) {
  requireCap('approve_high_impact')
  await latency()
  commit((db) => {
    const next = patchFinding(db, id, (f) => {
      if (!f.riskAcceptance) throw new DemoApiError('No pending risk acceptance')
      return {
        ...f,
        status: approve ? 'risk_accepted' : f.status,
        riskAcceptance: { ...f.riskAcceptance, status: approve ? 'approved' : 'rejected', decidedById: actor(), decidedAt: now() },
        history: [...f.history, historyEntry('risk_acceptance', `Risk acceptance ${approve ? 'approved' : 'rejected'} by ${userName(actor())}`)],
      }
    })
    return audit(next, { action: `risk acceptance ${approve ? 'approved' : 'rejected'}`, entityType: 'finding', entityId: id, details: '', module: 'Operations' })
  })
}

// ===================================================================== Tickets & remediation

export interface CreateTicketInput {
  title: string
  description: string
  type: TicketType
  priority: Ticket['priority']
  assigneeId?: string
  dueDate: string
  findingId?: string
  vendorId?: string
  aiSystemId?: string
  incidentId?: string
  assessmentId?: string
}

function buildTicket(db: Database, input: CreateTicketInput, idOverride?: string): Ticket {
  const id = idOverride ?? nextId(db.tickets, 'TKT')
  return {
    id,
    ...input,
    status: 'open',
    reporterId: actor(),
    createdAt: now(),
    updatedAt: now(),
    progress: 0,
    comments: [],
    externalRef: input.type === 'vendor' ? undefined : `SEC-${5000 + Number(id.slice(4))}`,
    vendorResponse: input.vendorId ? { status: 'awaiting' } : undefined,
    history: [historyEntry('ticket_created', `Ticket created${input.findingId ? ` from ${input.findingId}` : input.assessmentId ? ` from ${input.assessmentId}` : input.incidentId ? ` from ${input.incidentId}` : ''}`)],
  }
}

function linkTicket(db: Database, t: Ticket): Database {
  let next: Database = { ...db, tickets: [t, ...db.tickets] }
  if (t.findingId) {
    next = patchFinding(next, t.findingId, (f) => ({
      ...f,
      ticketIds: [...f.ticketIds, t.id],
      ownerId: t.assigneeId ?? f.ownerId,
      targetDate: t.dueDate,
      status: ['new', 'triaged', 'in_validation', 'validated'].includes(f.status) ? 'in_remediation' : f.status,
      remediation: { ...f.remediation, status: 'planned' },
      history: [...f.history, historyEntry('ticket_created', `Remediation ticket ${t.id} created`, t.assigneeId ? `Assigned to ${userName(t.assigneeId)}` : undefined)],
    }))
  }
  if (t.vendorId) next = { ...next, vendors: next.vendors.map((v) => (v.id === t.vendorId ? { ...v, lifecycle: v.lifecycle === 'active' ? 'remediation' : v.lifecycle, history: [...v.history, historyEntry('ticket_created', `Remediation item ${t.id} created`)] } : v)) }
  next = audit(next, { action: 'ticket created', entityType: 'ticket', entityId: t.id, details: t.title, module: t.vendorId ? 'TPRM' : t.aiSystemId ? 'AI-SPM' : 'Operations' })
  if (t.assigneeId) next = notify(next, { title: 'Ticket assigned', body: `${t.id}: ${t.title} → ${userName(t.assigneeId)}`, link: `/operations/tickets/${t.id}`, severity: 'info' })
  return next
}

export async function createTicket(input: CreateTicketInput) {
  requireCap('manage_tickets')
  await latency()
  let created: Ticket | undefined
  commit((db) => {
    created = buildTicket(db, input)
    return linkTicket(db, created)
  })
  return created!
}

export async function updateTicket(id: string, patch: Partial<Ticket>, summary: string) {
  requireCap('manage_tickets')
  await latency(0.6)
  commit((db) => {
    const t0 = mustFind(db.tickets, id, 'Ticket')
    const t = { ...t0, ...patch, updatedAt: now(), history: [...t0.history, historyEntry('remediation_update', summary)] }
    let next: Database = { ...db, tickets: replace(db.tickets, t) }
    if (t.findingId) {
      next = patchFinding(next, t.findingId, (f) => ({
        ...f,
        ownerId: patch.assigneeId ?? f.ownerId,
        targetDate: patch.dueDate ?? f.targetDate,
        status: patch.status === 'pending_verification' ? 'pending_verification' : patch.status === 'in_progress' && f.status === 'pending_verification' ? 'in_remediation' : f.status,
        remediation: { ...f.remediation, status: patch.status === 'pending_verification' ? 'awaiting_verification' : patch.status === 'in_progress' || (patch.progress ?? 0) > 0 ? 'in_progress' : f.remediation.status },
        history: [...f.history, historyEntry('remediation_update', `${t.id}: ${summary}`)],
      }))
    }
    return audit(next, { action: 'ticket updated', entityType: 'ticket', entityId: id, details: summary, module: t.vendorId ? 'TPRM' : 'Operations' })
  })
}

export async function addTicketComment(id: string, text: string) {
  requireCap('manage_tickets')
  await latency(0.4)
  commit((db) => {
    const t0 = mustFind(db.tickets, id, 'Ticket')
    const next = { ...db, tickets: replace(db.tickets, { ...t0, updatedAt: now(), comments: [...t0.comments, { id: uid('C'), authorId: actor(), at: now(), text }] }) }
    return audit(next, { action: 'comment added', entityType: 'ticket', entityId: id, details: text.slice(0, 80), module: 'Operations' })
  })
}

export async function submitVerification(ticketId: string, v: { evidence: string; method: NonNullable<Ticket['verification']>['method']; result: 'passed' | 'failed' }) {
  requireCap('manage_tickets')
  await latency(1.5)
  commit((db) => {
    const t0 = mustFind(db.tickets, ticketId, 'Ticket')
    const passed = v.result === 'passed'
    const t: Ticket = {
      ...t0,
      status: passed ? 'done' : 'in_progress',
      progress: passed ? 100 : Math.min(t0.progress, 70),
      updatedAt: now(),
      verification: { ...v, verifiedById: actor(), verifiedAt: now() },
      vendorResponse: t0.vendorResponse && passed ? { ...t0.vendorResponse, status: 'remediated' } : t0.vendorResponse,
      history: [...t0.history, historyEntry('verification', `Verification ${v.result} (${v.method})`, v.evidence)],
    }
    let next: Database = { ...db, tickets: replace(db.tickets, t) }
    if (t.findingId) {
      next = patchFinding(next, t.findingId, (f) => {
        const otherOpen = next.tickets.filter((x) => f.ticketIds.includes(x.id) && x.id !== t.id && !['done', 'cancelled'].includes(x.status)).length
        const resolve = passed && otherOpen === 0
        return {
          ...f,
          status: resolve ? 'resolved' : passed ? f.status : 'in_remediation',
          resolvedAt: resolve ? now() : f.resolvedAt,
          remediation: { ...f.remediation, status: resolve ? 'verified' : passed ? f.remediation.status : 'in_progress' },
          rootCause: resolve && !f.rootCause.confirmed && f.rootCause.hypotheses[0] ? { ...f.rootCause, confirmed: f.rootCause.hypotheses[0].statement, hypotheses: f.rootCause.hypotheses.map((h, i) => (i === 0 ? { ...h, status: 'confirmed' as const } : h)) } : f.rootCause,
          history: [...f.history, historyEntry('verification', resolve ? `Verification passed — finding resolved (${t.id})` : passed ? `Verification passed on ${t.id}; other tickets still open` : `Verification failed on ${t.id} — returned to remediation`, v.evidence)],
        }
      })
      const f = next.findings.find((x) => x.id === t.findingId)!
      if (f.status === 'resolved') {
        next = { ...next, attackPaths: next.attackPaths.map((p) => (p.steps.some((s) => s.findingId === f.id) && p.steps.filter((s) => s.findingId).every((s) => next.findings.find((x) => x.id === s.findingId)?.status === 'resolved') ? { ...p, status: 'mitigated' } : p)) }
        next = notify(next, { title: 'Finding resolved', body: `${f.id} verified and resolved.`, link: `/operations/findings/${f.id}`, severity: 'low' })
      }
    }
    if (t.vendorId && passed) {
      const remaining = next.tickets.filter((x) => x.vendorId === t.vendorId && !['done', 'cancelled'].includes(x.status)).length
      if (remaining === 0) next = { ...next, vendors: next.vendors.map((v2) => (v2.id === t.vendorId && v2.lifecycle === 'remediation' ? { ...v2, lifecycle: 'active', residualRisk: Math.max(10, v2.residualRisk - 8), history: [...v2.history, historyEntry('status_change', 'All remediation items verified — vendor returned to Active')] } : v2)) }
      else next = { ...next, vendors: next.vendors.map((v2) => (v2.id === t.vendorId ? { ...v2, residualRisk: Math.max(10, v2.residualRisk - 3) } : v2)) }
    }
    return audit(next, { action: `verification ${v.result}`, entityType: 'ticket', entityId: ticketId, details: `${v.method}: ${v.evidence.slice(0, 60)}`, module: t.vendorId ? 'TPRM' : 'Operations' })
  })
}

export async function recordVendorResponse(ticketId: string, status: NonNullable<Ticket['vendorResponse']>['status'], message: string) {
  requireCap('manage_tickets')
  await latency(0.6)
  commit((db) => {
    const t0 = mustFind(db.tickets, ticketId, 'Ticket')
    const t: Ticket = { ...t0, updatedAt: now(), vendorResponse: { status, message, respondedAt: now() }, status: status === 'remediated' ? 'pending_verification' : status === 'acknowledged' ? 'in_progress' : t0.status, progress: status === 'remediated' ? 90 : status === 'acknowledged' ? Math.max(t0.progress, 30) : t0.progress, history: [...t0.history, historyEntry('remediation_update', `Vendor response recorded: ${status}`, message)] }
    const next = { ...db, tickets: replace(db.tickets, t) }
    return audit(next, { action: 'vendor response recorded', entityType: 'ticket', entityId: ticketId, details: status, module: 'TPRM' })
  })
}

// ===================================================================== Events & incidents

export async function updateEventStatus(id: string, status: EventStatus, assessment?: string) {
  requireCap('triage_findings')
  await latency(0.6)
  commit((db) => {
    const e = mustFind(db.events, id, 'Event')
    const next = { ...db, events: replace(db.events, { ...e, status, assessment: assessment ?? e.assessment }) }
    return audit(next, { action: `event ${status}`, entityType: 'event', entityId: id, details: assessment ?? e.title, module: 'Operations' })
  })
}

export interface CreateIncidentInput {
  title: string
  severity: Incident['severity']
  category: string
  summary: string
  investigatorId?: string
  findingIds: string[]
  eventIds: string[]
}

export async function createIncident(input: CreateIncidentInput) {
  requireCap('triage_findings')
  await latency()
  let created: Incident | undefined
  commit((db) => {
    const id = nextId(db.incidents, 'INC', 3)
    const findings = input.findingIds.map((fid) => mustFind(db.findings, fid, 'Finding'))
    const events = input.eventIds.map((eid) => mustFind(db.events, eid, 'Event'))
    const assetIds = [...new Set([...findings.map((f) => f.assetId), ...events.map((e) => e.assetId)].filter(Boolean) as string[])]
    const inc: Incident = {
      id,
      ...input,
      status: input.investigatorId ? 'investigating' : 'open',
      createdById: actor(),
      createdAt: now(),
      updatedAt: now(),
      assetIds,
      aiSystemIds: [...new Set([...findings.map((f) => f.aiSystemId), ...events.map((e) => e.aiSystemId)].filter(Boolean) as string[])],
      businessServiceIds: [...new Set([...findings.map((f) => f.businessServiceId), ...assetIds.map((a) => db.assets.find((x) => x.id === a)?.businessServiceId)].filter(Boolean) as string[])],
      tasks: [],
      notes: [],
      timeline: [historyEntry('incident_created', `Incident declared${input.findingIds[0] ? ` from ${input.findingIds[0]}` : input.eventIds[0] ? ` from ${input.eventIds[0]}` : ''}`), ...(input.investigatorId ? [historyEntry('assigned', `Investigator assigned: ${userName(input.investigatorId)}`)] : [])],
    }
    created = inc
    let next: Database = { ...db, incidents: [inc, ...db.incidents] }
    for (const fid of input.findingIds) next = patchFinding(next, fid, (f) => ({ ...f, incidentIds: [...f.incidentIds, id], history: [...f.history, historyEntry('incident_created', `Escalated to incident ${id}`)] }))
    next = { ...next, events: next.events.map((e) => (input.eventIds.includes(e.id) ? { ...e, status: 'escalated', incidentId: id } : e)) }
    next = audit(next, { action: 'incident created', entityType: 'incident', entityId: id, details: input.title, module: 'Operations' })
    return notify(next, { title: 'Incident declared', body: `${id}: ${input.title}`, link: `/operations/incidents/${id}`, severity: input.severity })
  })
  return created!
}

function patchIncident(db: Database, id: string, fn: (i: Incident) => Incident) {
  return { ...db, incidents: replace(db.incidents, fn(mustFind(db.incidents, id, 'Incident'))) }
}

export async function updateIncident(id: string, patch: Partial<Incident>, summary: string) {
  requireCap('triage_findings')
  await latency(0.6)
  commit((db) => audit(patchIncident(db, id, (i) => ({ ...i, ...patch, updatedAt: now(), timeline: [...i.timeline, historyEntry(patch.status ? 'status_change' : patch.investigatorId ? 'assigned' : 'comment', summary)] })), { action: 'incident updated', entityType: 'incident', entityId: id, details: summary, module: 'Operations' }))
}

export async function addIncidentNote(id: string, text: string) {
  requireCap('triage_findings')
  await latency(0.4)
  commit((db) => audit(patchIncident(db, id, (i) => ({ ...i, updatedAt: now(), notes: [...i.notes, { id: uid('N'), authorId: actor(), at: now(), text }], timeline: [...i.timeline, historyEntry('comment', 'Investigation note added', text)] })), { action: 'incident note added', entityType: 'incident', entityId: id, details: text.slice(0, 80), module: 'Operations' }))
}

export async function addIncidentTask(id: string, task: Omit<IncidentTask, 'id' | 'status'>) {
  requireCap('triage_findings')
  await latency(0.4)
  commit((db) => audit(patchIncident(db, id, (i) => ({ ...i, updatedAt: now(), tasks: [...i.tasks, { ...task, id: uid('T'), status: 'todo' }], timeline: [...i.timeline, historyEntry('comment', `Response task added: ${task.title}`, `Assigned to ${userName(task.assigneeId)}`)] })), { action: 'incident task added', entityType: 'incident', entityId: id, details: task.title, module: 'Operations' }))
}

export async function updateIncidentTask(id: string, taskId: string, status: IncidentTask['status']) {
  requireCap('triage_findings')
  await latency(0.3)
  commit((db) => audit(patchIncident(db, id, (i) => ({ ...i, updatedAt: now(), tasks: i.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)), timeline: [...i.timeline, historyEntry('comment', `Task "${i.tasks.find((t) => t.id === taskId)?.title}" → ${status.replace('_', ' ')}`)] })), { action: 'incident task updated', entityType: 'incident', entityId: id, details: status, module: 'Operations' }))
}

export async function closeIncident(id: string, resolutionSummary: string) {
  requireCap('triage_findings')
  await latency()
  commit((db) => {
    const i0 = mustFind(db.incidents, id, 'Incident')
    if (i0.tasks.some((t) => t.status !== 'done')) throw new DemoApiError('All response tasks must be completed before closing the incident.')
    const next = patchIncident(db, id, (i) => ({ ...i, status: 'closed', closedAt: now(), updatedAt: now(), resolutionSummary, timeline: [...i.timeline, historyEntry('status_change', 'Incident closed with resolution summary', resolutionSummary)] }))
    return audit(next, { action: 'incident closed', entityType: 'incident', entityId: id, details: resolutionSummary.slice(0, 80), module: 'Operations' })
  })
}

// ===================================================================== Assets

export async function updateAsset(id: string, patch: Partial<Asset>, summary: string) {
  requireCap('triage_findings')
  await latency(0.6)
  commit((db) => audit({ ...db, assets: replace(db.assets, { ...mustFind(db.assets, id, 'Asset'), ...patch }) }, { action: 'asset updated', entityType: 'asset', entityId: id, details: summary, module: 'CTEM' }))
}

export async function mergeAsset(duplicateId: string, intoId: string) {
  requireCap('triage_findings')
  await latency()
  commit((db) => {
    const dup = mustFind(db.assets, duplicateId, 'Asset')
    const orig = mustFind(db.assets, intoId, 'Asset')
    let next: Database = {
      ...db,
      assets: db.assets.map((a) => (a.id === duplicateId ? { ...a, duplicateOfId: intoId, possibleDuplicateOfId: undefined, tags: a.tags.filter((t) => t !== 'reconciliation-candidate') } : a.id === intoId ? { ...a, sourceIntegrationIds: [...new Set([...a.sourceIntegrationIds, ...dup.sourceIntegrationIds])], lastSeen: dup.lastSeen > a.lastSeen ? dup.lastSeen : a.lastSeen } : a)),
      findings: db.findings.map((f) => (f.assetId === duplicateId ? { ...f, assetId: intoId, history: [...f.history, historyEntry('reclassified', `Asset reconciled: ${dup.name} merged into ${orig.name}`)] } : f)),
      dataQuality: db.dataQuality.map((q) => (q.entityId === duplicateId && q.status === 'open' ? { ...q, status: 'resolved' } : q)),
    }
    next = audit(next, { action: 'assets merged', entityType: 'asset', entityId: intoId, details: `${dup.name} (${duplicateId}) merged into ${orig.name}`, module: 'CTEM' })
    return next
  })
}

export async function dismissDuplicate(duplicateId: string) {
  requireCap('triage_findings')
  await latency(0.6)
  commit((db) => {
    const next = { ...db, assets: db.assets.map((a) => (a.id === duplicateId ? { ...a, possibleDuplicateOfId: undefined, tags: a.tags.filter((t) => t !== 'reconciliation-candidate') } : a)), dataQuality: db.dataQuality.map((q) => (q.entityId === duplicateId && q.status === 'open' ? { ...q, status: 'ignored' as const } : q)) }
    return audit(next, { action: 'duplicate dismissed', entityType: 'asset', entityId: duplicateId, details: 'Marked as distinct asset', module: 'CTEM' })
  })
}

export async function setAttackPathStatus(id: string, status: 'active' | 'mitigated' | 'accepted', note: string) {
  requireCap('triage_findings')
  await latency(0.6)
  commit((db) => {
    const p = mustFind(db.attackPaths, id, 'Attack path')
    return audit({ ...db, attackPaths: replace(db.attackPaths, { ...p, status }) }, { action: `attack path ${status}`, entityType: 'asset', entityId: p.targetAssetId, details: `${id}: ${note}`, module: 'CTEM' })
  })
}

// ===================================================================== Third-party risk

export interface OnboardVendorInput {
  name: string
  category: string
  description: string
  website: string
  tier: Vendor['tier']
  relationshipOwnerId: string
  businessServiceIds: string[]
  dataAccess: string[]
  integrationAccess: string[]
  isAIProvider: boolean
  contractValue: number
}

export function computeInherentRisk(input: Pick<OnboardVendorInput, 'tier' | 'dataAccess' | 'isAIProvider' | 'integrationAccess'>) {
  const tier = { 'tier-1': 90, 'tier-2': 70, 'tier-3': 45, 'tier-4': 25 }[input.tier]
  const data = input.dataAccess.some((d) => /Cardholder|Biometric|Government|PII/i.test(d)) ? 30 : input.dataAccess.some((d) => /Confidential|Account|Employee/i.test(d)) ? 18 : 6
  const access = input.integrationAccess.length ? 4 : 0
  return Math.min(98, Math.round(tier * 0.6 + data + (input.isAIProvider ? 6 : 0) + access))
}

export async function onboardVendor(input: OnboardVendorInput) {
  requireCap('manage_vendors')
  await latency()
  let created: Vendor | undefined
  commit((db) => {
    const id = nextId(db.vendors, 'VEN', 3)
    const inherent = computeInherentRisk(input)
    const v: Vendor = {
      id,
      name: input.name,
      category: input.category,
      description: input.description,
      website: input.website,
      tier: input.tier,
      lifecycle: 'intake',
      relationshipOwnerId: input.relationshipOwnerId,
      businessServiceIds: input.businessServiceIds,
      dataAccess: input.dataAccess,
      integrationAccess: input.integrationAccess,
      inherentRisk: inherent,
      residualRisk: inherent,
      securityRating: 0,
      ratingTrend: [],
      onboardedAt: now(),
      nextReviewDate: addDays(now(), 365),
      contract: { id: `CTR-${id.slice(4)}`, value: input.contractValue, start: now(), end: addDays(now(), 365 * 2), securityClauses: ['Breach notification within 72 hours', 'Annual SOC 2 Type II report', 'Right to audit (annual)'], milestones: [{ id: `${id}-M1`, title: 'Initial due diligence complete', dueDate: addDays(now(), 30), type: 'Security review', status: 'upcoming' }] },
      evidenceDocs: [],
      fourthParties: [],
      inherentRiskFactors: [
        { factor: 'Business criticality', value: input.tier.toUpperCase(), weight: 0.35 },
        { factor: 'Data sensitivity', value: input.dataAccess.join(', ') || 'None', weight: 0.3 },
        { factor: 'System / network access', value: input.integrationAccess.join('; ') || 'None', weight: 0.2 },
        { factor: 'AI processing of Northstar data', value: input.isAIProvider ? 'Yes' : 'No', weight: 0.15 },
      ],
      isAIProvider: input.isAIProvider,
      history: [historyEntry('status_change', `Vendor registered (intake). Inherent risk ${inherent}/100 calculated.`)],
    }
    created = v
    const asm: Assessment = { id: nextId(db.assessments, 'ASM'), vendorId: id, name: `${v.name} — Initial due diligence`, type: input.isAIProvider ? 'AI provider assessment' : 'Initial due diligence', status: 'draft', createdById: actor(), createdAt: now(), dueDate: addDays(now(), 21), answers: [] }
    let next: Database = { ...db, vendors: [v, ...db.vendors], assessments: [asm, ...db.assessments] }
    next = audit(next, { action: 'vendor onboarded', entityType: 'vendor', entityId: id, details: `${v.name} · inherent risk ${inherent}`, module: 'TPRM' })
    return next
  })
  return created!
}

export async function updateVendor(id: string, patch: Partial<Vendor>, summary: string) {
  requireCap('manage_vendors')
  await latency(0.6)
  commit((db) => {
    const v0 = mustFind(db.vendors, id, 'Vendor')
    return audit({ ...db, vendors: replace(db.vendors, { ...v0, ...patch, history: [...v0.history, historyEntry('status_change', summary)] }) }, { action: 'vendor updated', entityType: 'vendor', entityId: id, details: summary, module: 'TPRM' })
  })
}

export async function setVendorLifecycle(id: string, lifecycle: VendorLifecycle) {
  return updateVendor(id, { lifecycle }, `Lifecycle → ${lifecycle.replace('_', ' ')}`)
}

export async function createAssessment(vendorId: string, type: Assessment['type'], dueInDays = 21) {
  requireCap('manage_vendors')
  await latency()
  let created: Assessment | undefined
  commit((db) => {
    const v = mustFind(db.vendors, vendorId, 'Vendor')
    const a: Assessment = { id: nextId(db.assessments, 'ASM'), vendorId, name: `${v.name} — ${type}`, type, status: 'in_progress', createdById: actor(), createdAt: now(), dueDate: addDays(now(), dueInDays), answers: [] }
    created = a
    let next: Database = { ...db, assessments: [a, ...db.assessments], vendors: db.vendors.map((x) => (x.id === vendorId ? { ...x, lifecycle: x.lifecycle === 'intake' ? 'due_diligence' : x.lifecycle, history: [...x.history, historyEntry('status_change', `Assessment ${a.id} started (${type})`)] } : x)) }
    next = audit(next, { action: 'assessment started', entityType: 'assessment', entityId: a.id, details: `${v.name} · ${type}`, module: 'TPRM' })
    return next
  })
  return created!
}

export async function saveAssessmentAnswers(id: string, answers: AssessmentAnswer[]) {
  requireCap('manage_vendors')
  await latency(0.5)
  commit((db) => {
    const a = mustFind(db.assessments, id, 'Assessment')
    let next: Database = { ...db, assessments: replace(db.assessments, { ...a, answers, status: a.status === 'draft' || a.status === 'sent' ? 'in_progress' : a.status }) }
    if (a.status === 'draft') next = { ...next, vendors: next.vendors.map((v) => (v.id === a.vendorId && v.lifecycle === 'intake' ? { ...v, lifecycle: 'due_diligence' } : v)) }
    return audit(next, { action: 'questionnaire progress saved', entityType: 'assessment', entityId: id, details: `${answers.length} answers`, module: 'TPRM' })
  })
}

export async function submitAssessment(id: string, answers: AssessmentAnswer[]) {
  requireCap('manage_vendors')
  await latency()
  commit((db) => {
    const a = mustFind(db.assessments, id, 'Assessment')
    return audit({ ...db, assessments: replace(db.assessments, { ...a, answers, status: 'submitted', submittedAt: now() }) }, { action: 'assessment submitted', entityType: 'assessment', entityId: id, details: `${answers.length} answers`, module: 'TPRM' })
  })
}

/** Simulated assessment analysis — deterministic scoring of questionnaire answers plus evidence coverage. */
export async function generateAssessmentResult(id: string) {
  requireCap('manage_vendors')
  await latency(3)
  commit((db) => {
    const a = mustFind(db.assessments, id, 'Assessment')
    const v = mustFind(db.vendors, a.vendorId, 'Vendor')
    const r = scoreAssessment(a.answers, !!v.isAIProvider)
    const residual = Math.max(10, Math.round(v.inherentRisk * (1 - r.score / 140)))
    let next: Database = {
      ...db,
      assessments: replace(db.assessments, { ...a, status: 'completed', completedAt: now(), result: { ...r, generatedAt: now(), provenance: 'simulated' } }),
      vendors: replace(db.vendors, { ...v, residualRisk: residual, lifecycle: v.lifecycle === 'due_diligence' || v.lifecycle === 'intake' ? (r.gaps.some((g) => g.severity === 'critical' || g.severity === 'high') ? 'remediation' : 'active') : v.lifecycle, history: [...v.history, historyEntry('classified', `Assessment ${a.id} completed — score ${r.score}/100; residual risk ${v.residualRisk} → ${residual}`)] }),
    }
    next = audit(next, { action: 'assessment result generated (simulated)', entityType: 'assessment', entityId: id, details: `score ${r.score} · ${r.gaps.length} gaps`, module: 'TPRM' })
    return next
  })
}

export async function createVendorRemediation(assessmentId: string, questionIds: string[]) {
  requireCap('manage_vendors')
  await latency()
  commit((db) => {
    const a = mustFind(db.assessments, assessmentId, 'Assessment')
    const v = mustFind(db.vendors, a.vendorId, 'Vendor')
    let next = db
    for (const qid of questionIds) {
      const gap = a.result?.gaps.find((g) => g.questionId === qid)
      if (!gap) continue
      const t = buildTicket(next, { title: `${v.name}: ${gap.summary.split(' — ')[0]}`, description: gap.summary, type: 'vendor', priority: gap.severity === 'critical' ? 'P1' : gap.severity === 'high' ? 'P2' : gap.severity === 'medium' ? 'P3' : 'P4', assigneeId: v.relationshipOwnerId, dueDate: addDays(now(), gap.severity === 'critical' ? 30 : 60), vendorId: v.id, assessmentId })
      next = linkTicket(next, t)
    }
    return next
  })
}

export async function uploadEvidence(vendorId: string, doc: { name: string; type: EvidenceDoc['type']; expiresAt?: string }) {
  requireCap('manage_vendors')
  await latency()
  commit((db) => {
    const v = mustFind(db.vendors, vendorId, 'Vendor')
    const d: EvidenceDoc = { id: uid('DOC'), ...doc, uploadedAt: now(), status: 'pending_review' }
    return audit({ ...db, vendors: replace(db.vendors, { ...v, evidenceDocs: [d, ...v.evidenceDocs], history: [...v.history, historyEntry('comment', `Evidence uploaded: ${doc.name}`)] }) }, { action: 'evidence uploaded (simulated)', entityType: 'vendor', entityId: vendorId, details: doc.name, module: 'TPRM' })
  })
}

export async function analyzeEvidence(vendorId: string, docId: string) {
  requireCap('manage_vendors')
  await latency(4)
  commit((db) => {
    const v = mustFind(db.vendors, vendorId, 'Vendor')
    const evidenceDocs = v.evidenceDocs.map((d) => (d.id === docId ? { ...d, status: 'analyzed' as const, analysis: { summary: d.type === 'SOC 2 Type II' ? 'Simulated analysis: opinion unqualified; Security & Availability criteria in scope; 1 exception in CC6.2 (provisioning approval evidence). Complementary user entity controls (CUECs) require Northstar to manage SSO.' : d.type === 'Penetration Test Summary' ? 'Simulated analysis: external test, 0 critical, 1 high (remediated per vendor), 4 medium. Retest letter not included.' : `Simulated analysis of ${d.type}: content extracted and mapped to questionnaire sections; no contradictions detected.`, exceptions: d.type === 'SOC 2 Type II' ? ['CC6.2 — provisioning approval evidence missing for 2 of 25 samples'] : d.type === 'Penetration Test Summary' ? ['Retest evidence not provided'] : [], coverage: 78, analyzedBy: 'Vendor Evidence Analyzer (simulated)', provenance: 'simulated' as const } } : d))
    return audit({ ...db, vendors: replace(db.vendors, { ...v, evidenceDocs }) }, { action: 'evidence analyzed (simulated)', entityType: 'vendor', entityId: vendorId, details: docId, module: 'TPRM' })
  })
}

export async function setEvidenceStatus(vendorId: string, docId: string, status: EvidenceDoc['status']) {
  requireCap('manage_vendors')
  await latency(0.5)
  commit((db) => {
    const v = mustFind(db.vendors, vendorId, 'Vendor')
    const evidenceDocs = v.evidenceDocs.map((d) => (d.id === docId ? { ...d, status, analysis: d.analysis ? { ...d.analysis, provenance: 'human-reviewed' as const } : d.analysis } : d))
    return audit({ ...db, vendors: replace(db.vendors, { ...v, evidenceDocs, history: [...v.history, historyEntry('comment', `Evidence ${status}: ${v.evidenceDocs.find((d) => d.id === docId)?.name}`)] }) }, { action: `evidence ${status}`, entityType: 'vendor', entityId: vendorId, details: docId, module: 'TPRM' })
  })
}

export async function updateAlertStatus(id: string, status: 'open' | 'acknowledged' | 'resolved') {
  requireCap('manage_vendors')
  await latency(0.5)
  commit((db) => {
    const a = mustFind(db.monitoringAlerts, id, 'Alert')
    return audit({ ...db, monitoringAlerts: replace(db.monitoringAlerts, { ...a, status }) }, { action: `alert ${status}`, entityType: 'vendor', entityId: a.vendorId, details: a.title, module: 'TPRM' })
  })
}

export async function setMilestoneStatus(vendorId: string, milestoneId: string, status: 'met' | 'missed' | 'at_risk' | 'upcoming') {
  requireCap('manage_vendors')
  await latency(0.5)
  commit((db) => {
    const v = mustFind(db.vendors, vendorId, 'Vendor')
    const m = v.contract.milestones.find((x) => x.id === milestoneId)
    return audit({ ...db, vendors: replace(db.vendors, { ...v, contract: { ...v.contract, milestones: v.contract.milestones.map((x) => (x.id === milestoneId ? { ...x, status } : x)) }, history: [...v.history, historyEntry('comment', `Contract milestone "${m?.title}" marked ${status}`)] }) }, { action: 'contract milestone updated', entityType: 'vendor', entityId: vendorId, details: `${m?.title}: ${status}`, module: 'TPRM' })
  })
}

const OFFBOARDING_ITEMS = ['Revoke SSO / guest accounts', 'Remove network and API access (keys, IP allow-lists)', 'Confirm data return or certified destruction', 'Retrieve physical assets / badges', 'Close open remediation items or record residual risk', 'Final invoice and contract closure', 'Archive due-diligence record for audit']

export async function startOffboarding(vendorId: string) {
  requireCap('manage_vendors')
  await latency()
  commit((db) => {
    const v = mustFind(db.vendors, vendorId, 'Vendor')
    return audit({ ...db, vendors: replace(db.vendors, { ...v, lifecycle: 'offboarding', offboarding: { startedAt: now(), checklist: OFFBOARDING_ITEMS.map((item, i) => ({ id: `${vendorId}-OB${i + 1}`, item, done: false })) }, history: [...v.history, historyEntry('status_change', 'Offboarding started')] }) }, { action: 'offboarding started', entityType: 'vendor', entityId: vendorId, details: v.name, module: 'TPRM' })
  })
}

export async function toggleOffboardingItem(vendorId: string, itemId: string, done: boolean) {
  requireCap('manage_vendors')
  await latency(0.3)
  commit((db) => {
    const v = mustFind(db.vendors, vendorId, 'Vendor')
    if (!v.offboarding) throw new DemoApiError('Offboarding not started')
    const item = v.offboarding.checklist.find((c) => c.id === itemId)
    return audit({ ...db, vendors: replace(db.vendors, { ...v, offboarding: { ...v.offboarding, checklist: v.offboarding.checklist.map((c) => (c.id === itemId ? { ...c, done, doneAt: done ? now() : undefined } : c)) } }) }, { action: done ? 'offboarding step completed' : 'offboarding step reopened', entityType: 'vendor', entityId: vendorId, details: item?.item ?? itemId, module: 'TPRM' })
  })
}

export async function completeOffboarding(vendorId: string, residualRiskNote: string) {
  requireCap('manage_vendors')
  await latency()
  commit((db) => {
    const v = mustFind(db.vendors, vendorId, 'Vendor')
    if (!v.offboarding || v.offboarding.checklist.some((c) => !c.done)) throw new DemoApiError('All checklist items must be complete before closing offboarding.')
    let next: Database = { ...db, vendors: replace(db.vendors, { ...v, lifecycle: 'offboarded', integrationAccess: ['None (revoked)'], offboarding: { ...v.offboarding, residualRiskNote }, history: [...v.history, historyEntry('status_change', 'Offboarding completed — audit-ready record archived', residualRiskNote)] }) }
    next = { ...next, monitoringAlerts: next.monitoringAlerts.map((a) => (a.vendorId === vendorId && a.status !== 'resolved' ? { ...a, status: 'resolved' } : a)) }
    return audit(next, { action: 'offboarding completed', entityType: 'vendor', entityId: vendorId, details: residualRiskNote.slice(0, 80), module: 'TPRM' })
  })
}

// ===================================================================== AI security

export async function updateAISystem(id: string, patch: Partial<AISystem>, summary: string) {
  requireCap('manage_ai_governance')
  await latency(0.6)
  commit((db) => {
    const a = mustFind(db.aiSystems, id, 'AI system')
    return audit({ ...db, aiSystems: replace(db.aiSystems, { ...a, ...patch, history: [...a.history, historyEntry('status_change', summary)] }) }, { action: 'AI system updated', entityType: 'aiSystem', entityId: id, details: summary, module: 'AI-SPM' })
  })
}

export async function setAIApproval(id: string, approval: AIApproval, rationale: string) {
  return updateAISystem(id, { approval, governanceStatus: approval === 'approved' ? 'compliant' : approval === 'prohibited' ? 'compliant' : 'review_required' }, `Approval status → ${approval.replace('_', ' ')}: ${rationale}`)
}

export async function createGovernanceReview(input: { aiSystemId: string; findingId?: string; title: string; type: GovernanceReview['type']; reviewerId?: string; policyRefs: string[]; note?: string }) {
  requireCap('manage_ai_governance')
  await latency()
  let created: GovernanceReview | undefined
  commit((db) => {
    const id = nextId(db.governanceReviews, 'GOV', 3)
    const g: GovernanceReview = { id, aiSystemId: input.aiSystemId, findingId: input.findingId, title: input.title, type: input.type, status: input.reviewerId ? 'in_review' : 'open', requestedById: actor(), reviewerId: input.reviewerId, createdAt: now(), conditions: [], policyRefs: input.policyRefs, notes: input.note ? [{ id: uid('GN'), authorId: actor(), at: now(), text: input.note }] : [] }
    created = g
    let next: Database = { ...db, governanceReviews: [g, ...db.governanceReviews] }
    next = { ...next, aiSystems: next.aiSystems.map((a) => (a.id === input.aiSystemId ? { ...a, governanceStatus: 'review_required', approval: a.approval === 'unsanctioned' ? 'under_review' : a.approval, history: [...a.history, historyEntry('status_change', `Governance review ${id} opened`)] } : a)) }
    if (input.findingId) next = patchFinding(next, input.findingId, (f) => ({ ...f, status: f.status === 'new' ? 'triaged' : f.status, history: [...f.history, historyEntry('comment', `Governance review ${id} opened`)] }))
    next = audit(next, { action: 'governance review opened', entityType: 'governance', entityId: id, details: input.title, module: 'AI-SPM' })
    return input.reviewerId ? notify(next, { title: 'Governance review assigned', body: `${id}: ${input.title}`, link: `/ai-security/governance/${id}`, severity: 'info' }) : next
  })
  return created!
}

export async function decideGovernanceReview(id: string, status: GovernanceReview['status'], decision: string, conditions: string[], approval?: AIApproval) {
  requireCap('approve_high_impact')
  await latency()
  commit((db) => {
    const g = mustFind(db.governanceReviews, id, 'Governance review')
    let next: Database = { ...db, governanceReviews: replace(db.governanceReviews, { ...g, status, decision, conditions, reviewerId: g.reviewerId ?? actor(), decidedAt: now() }) }
    if (approval) next = { ...next, aiSystems: next.aiSystems.map((a) => (a.id === g.aiSystemId ? { ...a, approval, governanceStatus: status === 'approved' ? 'compliant' : status === 'rejected' ? (approval === 'prohibited' ? 'compliant' : 'non_compliant') : 'review_required', history: [...a.history, historyEntry('status_change', `Governance decision (${id}): ${status.replace(/_/g, ' ')} → ${approval}`, decision)] } : a)) }
    return audit(next, { action: `governance ${status}`, entityType: 'governance', entityId: id, details: decision.slice(0, 80), module: 'AI-SPM' })
  })
}

export async function addGovernanceNote(id: string, text: string) {
  requireCap('manage_ai_governance')
  await latency(0.4)
  commit((db) => {
    const g = mustFind(db.governanceReviews, id, 'Governance review')
    return audit({ ...db, governanceReviews: replace(db.governanceReviews, { ...g, status: g.status === 'open' ? 'in_review' : g.status, notes: [...g.notes, { id: uid('GN'), authorId: actor(), at: now(), text }] }) }, { action: 'governance note added', entityType: 'governance', entityId: id, details: text.slice(0, 80), module: 'AI-SPM' })
  })
}

// ===================================================================== CRQ

export async function saveScenarioSimulation(id: string, name: string, params: ScenarioParams, ale: number, baselineAle: number) {
  requireCap('edit_risk_models')
  await latency()
  commit((db) => {
    const s = mustFind(db.scenarios, id, 'Scenario')
    return audit({ ...db, scenarios: replace(db.scenarios, { ...s, savedSimulations: [{ id: uid('SIM'), name, savedAt: now(), savedById: actor(), params, ale, baselineAle }, ...s.savedSimulations] }) }, { action: 'simulation saved', entityType: 'scenario', entityId: id, details: `${name}: ALE ${Math.round(ale).toLocaleString()} (baseline ${Math.round(baselineAle).toLocaleString()})`, module: 'CRQ' })
  })
}

export async function applyScenarioParams(id: string, params: ScenarioParams) {
  requireCap('edit_risk_models')
  await latency()
  commit((db) => audit({ ...db, scenarios: replace(db.scenarios, { ...mustFind(db.scenarios, id, 'Scenario'), params }) }, { action: 'scenario assumptions updated', entityType: 'scenario', entityId: id, details: 'Baseline parameters changed', module: 'CRQ' }))
}

export async function updateControl(id: string, patch: Partial<Control>, summary: string) {
  requireCap('edit_risk_models')
  await latency(0.6)
  commit((db) => {
    const c = mustFind(db.controls, id, 'Control')
    const next = { ...db, controls: replace(db.controls, { ...c, ...patch }) }
    // Propagate effectiveness to scenarios that have not been individually overridden.
    if (patch.effectiveness !== undefined) next.scenarios = next.scenarios.map((s) => (s.controls.some((x) => x.controlId === id) ? { ...s, params: { ...s.params, controlEffectiveness: { ...s.params.controlEffectiveness, [id]: patch.effectiveness! } } } : s))
    return audit(next, { action: 'control updated', entityType: 'control', entityId: id, details: summary, module: 'CRQ' })
  })
}

// ===================================================================== Agents (simulated)

export async function setAgentEnabled(id: string, enabled: boolean) {
  requireCap('manage_settings')
  await latency(0.4)
  commit((db) => {
    const a = mustFind(db.agents, id, 'Agent')
    return audit({ ...db, agents: replace(db.agents, { ...a, enabled, status: enabled ? 'idle' : 'disabled' }) }, { action: enabled ? 'agent enabled' : 'agent disabled', entityType: 'agent', entityId: id, details: a.name, module: 'Intelligence' })
  })
}

/** Starts a simulated agent run. Steps advance on timers; nothing is scanned or changed outside demo state. */
export async function runAgentDemo(agentId: string) {
  requireCap('run_scans')
  await latency(0.3)
  const db0 = getDb()
  const agent = mustFind(db0.agents, agentId, 'Agent')
  if (!agent.enabled) throw new DemoApiError('Agent is disabled')
  if (db0.executions.some((e) => e.agentId === agentId && e.status === 'running')) throw new DemoApiError('A simulated run is already in progress')
  const pb = AGENT_PLAYBOOKS[agentId]
  const exeId = nextId(db0.executions, 'EXE')
  let payload: { findingIds?: string[] } | undefined
  if (agentId === 'AGT-07') payload = { findingIds: db0.findings.filter((f) => f.status === 'validated' && f.ticketIds.length === 0).slice(0, 3).map((f) => f.id) }
  if (agentId === 'AGT-02') payload = { findingIds: [] }
  const exe: AgentExecution = {
    id: exeId,
    agentId,
    trigger: 'Manual (Run Demo)',
    startedAt: now(),
    status: 'running',
    steps: pb.steps.map((name) => ({ name, status: 'pending', detail: 'Queued' })),
    outputs: [],
    warnings: [],
    inputSummary: `Inputs: ${agent.inputSources.slice(0, 3).join(', ')} (demo dataset)`,
    simulated: true,
  }
  commit((db) => audit({ ...db, executions: [exe, ...db.executions], agents: db.agents.map((a) => (a.id === agentId ? { ...a, status: 'running', lastRunAt: now() } : a)) }, { action: 'agent run started (simulated)', entityType: 'agent', entityId: agentId, details: exeId, module: 'Intelligence' }))

  const n = getDb().findings.length
  pb.steps.forEach((_, i) => {
    setTimeout(() => {
      commit((db) => ({ ...db, executions: db.executions.map((e) => (e.id === exeId ? { ...e, steps: e.steps.map((s, k) => (k === i ? { ...s, status: 'running', detail: 'Running (simulated)' } : k < i ? s : s)) } : e)) }))
    }, 900 * i + 200)
    setTimeout(() => {
      const isLast = i === pb.steps.length - 1
      const needsApproval = !!pb.approval && isLast
      commit((db) => {
        let next: Database = {
          ...db,
          executions: db.executions.map((e) => {
            if (e.id !== exeId) return e
            const steps = e.steps.map((s, k) => (k === i ? { ...s, status: needsApproval ? ('pending' as const) : ('done' as const), detail: needsApproval ? 'Blocked on human approval' : 'Completed (simulated)', durationMs: 900 } : s))
            if (!isLast) return { ...e, steps }
            const outputs = agentId === 'AGT-07' && payload?.findingIds
              ? [{ label: `${payload.findingIds.length} remediation tickets drafted (pending approval)` }, ...payload.findingIds.map((fid) => ({ label: `Draft ticket for ${fid}`, recordId: fid, recordType: 'finding' as const }))]
              : pb.outputs(n).map((label) => ({ label }))
            return { ...e, steps, outputs, finishedAt: needsApproval ? undefined : now(), status: needsApproval ? 'awaiting_approval' : 'completed', approval: needsApproval ? { action: pb.approval!, status: 'pending', payload } : undefined }
          }),
        }
        if (isLast) {
          next = { ...next, agents: next.agents.map((a) => (a.id === agentId ? { ...a, status: needsApproval ? 'awaiting_approval' : 'idle' } : a)) }
          if (needsApproval) next = notify(next, { title: 'Approval required', body: `${agent.name}: ${pb.approval}`, link: '/operations/approvals', severity: 'info' })
          next = audit(next, { action: needsApproval ? 'agent awaiting approval' : 'agent run completed (simulated)', entityType: 'agent', entityId: agentId, details: exeId, module: 'Intelligence', actorId: 'SYSTEM' })
        }
        return next
      })
    }, 900 * (i + 1) + 200)
  })
  return exeId
}

export async function decideExecution(executionId: string, approve: boolean) {
  requireCap('approve_high_impact')
  await latency()
  commit((db) => {
    const e = mustFind(db.executions, executionId, 'Execution')
    if (!e.approval || e.approval.status !== 'pending') throw new DemoApiError('No pending approval for this execution')
    let next: Database = {
      ...db,
      executions: replace(db.executions, { ...e, status: approve ? 'approved' : 'rejected', finishedAt: now(), approval: { ...e.approval, status: approve ? 'approved' : 'rejected', decidedById: actor(), decidedAt: now() }, steps: e.steps.map((s) => (s.status === 'pending' ? { ...s, status: approve ? 'done' : 'skipped', detail: approve ? 'Completed after approval (simulated)' : 'Skipped — approval rejected' } : s)) }),
      agents: db.agents.map((a) => (a.id === e.agentId ? { ...a, status: 'idle' } : a)),
    }
    if (approve && e.agentId === 'AGT-07') {
      for (const fid of e.approval.payload?.findingIds ?? []) {
        const f = next.findings.find((x) => x.id === fid)
        if (!f || f.ticketIds.length) continue
        const t = buildTicket(next, { title: `Remediate: ${f.title}`, description: `${f.remediation.recommended}\n\nDrafted by Remediation Orchestrator (simulated) and approved by ${userName(actor())}.`, type: f.domain === 'vulnerability' ? 'vulnerability' : 'configuration', priority: f.severity === 'critical' ? 'P1' : f.severity === 'high' ? 'P2' : 'P3', assigneeId: f.ownerId, dueDate: f.targetDate ?? addDays(now(), SLA()[f.severity]), findingId: f.id })
        next = linkTicket(next, t)
      }
    }
    if (approve && e.agentId === 'AGT-02') {
      const cand = next.assets.find((a) => a.possibleDuplicateOfId)
      if (cand) {
        next = { ...next, assets: next.assets.map((a) => (a.id === cand.id ? { ...a, duplicateOfId: cand.possibleDuplicateOfId, possibleDuplicateOfId: undefined } : a)) }
      }
    }
    return audit(next, { action: approve ? 'agent action approved' : 'agent action rejected', entityType: 'agent', entityId: e.agentId, details: `${executionId}: ${e.approval.action}`, module: 'Operations' })
  })
}

// ===================================================================== Integrations (simulated)

export async function configureIntegration(id: string, config: NonNullable<Integration['config']>) {
  requireCap('manage_integrations')
  await latency()
  commit((db) => {
    const i = mustFind(db.integrations, id, 'Integration')
    return audit({ ...db, integrations: replace(db.integrations, { ...i, config: { ...config, testResult: undefined, testedAt: undefined }, status: i.status === 'connected' ? 'connected' : 'configuring' }) }, { action: 'integration configured', entityType: 'integration', entityId: id, details: `${i.name} · ${config.scope}`, module: 'Integrations' })
  })
}

export async function testIntegration(id: string) {
  requireCap('manage_integrations')
  await latency(4)
  let ok = false
  commit((db) => {
    const i = mustFind(db.integrations, id, 'Integration')
    if (!i.config) throw new DemoApiError('Configure the connector before testing')
    ok = !/fail|invalid/i.test(i.config.endpoint)
    return audit({ ...db, integrations: replace(db.integrations, { ...i, config: { ...i.config, testedAt: now(), testResult: ok ? 'success' : 'failure' } }) }, { action: `connection test ${ok ? 'succeeded' : 'failed'} (simulated)`, entityType: 'integration', entityId: id, details: i.name, module: 'Integrations' })
  })
  return ok
}

const IMPORT_TEMPLATES: Partial<Record<Integration['category'], string[]>> = {
  'Cloud security': ['imdsv1', 's3-public', 'logging-off'],
  'Vulnerability scanner': ['openssl-loop', 'terrapin', 'regresshion'],
  'Endpoint (EDR)': ['libwebp'],
  'Code security': ['secret-repo', 'text4shell'],
  'Attack surface': ['tls-expired', 'db-public'],
}

/** Creates a finding for an asset from a detection template. Used by connector imports and full runs. */
export function buildFindingFromTemplate(db: Database, t: (typeof FINDING_TEMPLATES)[number], asset: Asset, source: { id: string; name: string }, origin: string, tags: string[]): Finding {
  const id = nextId(db.findings, 'FND')
  const cve = t.cveId ? db.knowledge.find((k) => k.externalId === t.cveId) : undefined
  const ts = now()
  const rid = `demo-${source.id.slice(4).toLowerCase()}-${Math.floor(Math.random() * 1e6).toString(16)}`
  const ev = t.evidence({ asset, host: asset.fqdn ?? asset.name, ip: asset.ipAddress ?? '—', date: ts, rid })
  return {
    id, title: t.title, domain: t.domain, category: t.category, severity: t.severity, status: 'new', assetId: asset.id, businessServiceId: asset.businessServiceId, templateKey: t.key,
    description: t.description, executiveSummary: `${t.title} on ${asset.name} — ${origin}. ${t.businessImpact}`, businessImpact: t.businessImpact,
    cveId: t.cveId, cweIds: t.cweIds, attackIds: t.attackIds, owaspIds: t.owaspIds, cvss: cve?.cvss ? { version: cve.cvss.version, score: cve.cvss.score, vector: cve.cvss.vector } : undefined, epss: cve?.epss ? { score: cve.epss.score, percentile: cve.epss.percentile } : undefined, kev: !!cve?.kev,
    exploitAvailable: t.exploitMaturity !== 'none', exploitMaturity: t.exploitMaturity, classificationConfidence: t.confidence, mappingRationale: t.rationale, firstDetected: ts, lastObserved: ts, ownerId: asset.ownerId, targetDate: addDays(ts, SLA()[t.severity]),
    sourceIntegrationId: source.id, sourceRecordId: rid, additionalSourceIds: [], detectionMethod: t.detectionMethod,
    evidence: ev.map((e, k) => ({ ...e, id: uid('EV') + k, collectedAt: ts, sourceIntegrationId: source.id, provenance: 'simulated' as const })), missingEvidence: t.missingEvidence,
    rootCause: { hypotheses: t.rootCauses.map((r) => ({ id: uid('RC'), statement: r.statement, likelihood: r.likelihood, supportingEvidenceIds: [], status: 'open' as const, provenance: 'inferred' as const })), relatedConfigIssues: t.configIssues, relatedWeaknesses: t.weaknesses, notes: [] },
    remediation: { recommended: t.recommended, steps: t.steps, vendorFix: t.vendorFix, compensatingControls: t.compensating, status: 'not_started', verificationRequirements: t.verification, similarResolutions: t.similar },
    validation: { status: 'not_started', provenance: 'observed' },
    history: [historyEntry('discovered', `Detected by ${source.name} (${origin})`, undefined, 'SYSTEM'), historyEntry('enriched', 'Enriched with knowledge library references', [t.cveId, ...t.cweIds, ...t.attackIds].filter(Boolean).join(', ') || 'No mapping applicable', 'SYSTEM')],
    fpReviews: [], ticketIds: [], incidentIds: [], eventIds: [], relatedFindingIds: db.findings.filter((x) => x.templateKey === t.key).slice(0, 3).map((x) => x.id), compensatingControlsInPlace: 0, attackPathIds: [], tags: [...tags, ...(asset.internetExposed ? ['internet-facing'] : [])],
  }
}

function importFindings(db: Database, integration: Integration): { db: Database; ids: string[] } {
  const keys = IMPORT_TEMPLATES[integration.category] ?? []
  let next = db
  const ids: string[] = []
  for (const key of keys) {
    const t = FINDING_TEMPLATES.find((x) => x.key === key)
    if (!t) continue
    const used = new Set(next.findings.filter((f) => f.templateKey === key).map((f) => f.assetId))
    const asset = next.assets.find((a) => !a.possibleDuplicateOfId && !a.duplicateOfId && (!t.assetTypes || t.assetTypes.includes(a.type)) && !used.has(a.id) && (integration.id !== 'INT-MSD' || a.cloud === 'Azure'))
      ?? next.assets.find((a) => !a.possibleDuplicateOfId && (!t.assetTypes || t.assetTypes.includes(a.type)) && !used.has(a.id))
    if (!asset) continue
    const f = buildFindingFromTemplate(next, t, asset, integration, 'imported by a simulated connector run', ['imported-demo'])
    next = { ...next, findings: [f, ...next.findings] }
    ids.push(f.id)
  }
  return { db: next, ids }
}

export async function enableIntegration(id: string) {
  requireCap('manage_integrations')
  await latency(2)
  let created: string[] = []
  commit((db) => {
    const i = mustFind(db.integrations, id, 'Integration')
    if (!i.config || i.config.testResult !== 'success') throw new DemoApiError('A successful connection test is required before enabling.')
    const imported = importFindings(db, i)
    created = imported.ids
    const received = 120 + imported.ids.length * 37
    const run = { id: nextId(db.ingestionRuns, 'ING'), integrationId: id, startedAt: now(), durationSec: 42, status: 'success' as const, received, normalized: received - 2, duplicatesMerged: Math.round(received * 0.12), rejected: 2, createdFindingIds: imported.ids, message: `Initial sync completed (simulated). ${imported.ids.length} new findings imported.` }
    let next: Database = { ...imported.db, ingestionRuns: [run, ...imported.db.ingestionRuns], integrations: replace(imported.db.integrations, { ...i, status: 'connected', lastSyncAt: now(), health: 100, recordsIngested: i.recordsIngested + received, syncHistory: [...i.syncHistory.slice(-13), received] }) }
    next = audit(next, { action: 'integration enabled (simulated)', entityType: 'integration', entityId: id, details: `${i.name} · ${imported.ids.length} findings imported`, module: 'Integrations' })
    return notify(next, { title: 'Integration connected', body: `${i.name} initial sync completed (simulated).`, link: `/integrations/${id}`, severity: 'info' })
  })
  return created
}

export async function syncIntegration(id: string) {
  requireCap('manage_integrations')
  await latency(2)
  commit((db) => {
    const i = mustFind(db.integrations, id, 'Integration')
    if (i.status !== 'connected') throw new DemoApiError('Integration is not connected')
    const received = Math.round(80 + Math.random() * 300)
    const run = { id: nextId(db.ingestionRuns, 'ING'), integrationId: id, startedAt: now(), durationSec: Math.round(10 + Math.random() * 90), status: 'success' as const, received, normalized: received, duplicatesMerged: Math.round(received * 0.15), rejected: 0, createdFindingIds: [], message: 'Incremental sync completed (simulated). No new findings; existing findings re-observed.' }
    return audit({ ...db, ingestionRuns: [run, ...db.ingestionRuns], integrations: replace(db.integrations, { ...i, lastSyncAt: now(), recordsIngested: i.recordsIngested + received, syncHistory: [...i.syncHistory.slice(-13), received] }) }, { action: 'sync run (simulated)', entityType: 'integration', entityId: id, details: `${received} records`, module: 'Integrations' })
  })
}

export async function setIntegrationStatus(id: string, status: Integration['status']) {
  requireCap('manage_integrations')
  await latency()
  commit((db) => {
    const i = mustFind(db.integrations, id, 'Integration')
    return audit({ ...db, integrations: replace(db.integrations, { ...i, status, health: status === 'connected' ? Math.max(i.health, 90) : status === 'disabled' ? 0 : i.health }) }, { action: `integration ${status}`, entityType: 'integration', entityId: id, details: i.name, module: 'Integrations' })
  })
}

export async function resolveDataQuality(id: string, status: 'resolved' | 'ignored' | 'open') {
  requireCap('manage_integrations')
  await latency(0.4)
  commit((db) => {
    const q = mustFind(db.dataQuality, id, 'Data quality issue')
    return audit({ ...db, dataQuality: replace(db.dataQuality, { ...q, status }) }, { action: `data quality issue ${status}`, entityType: 'integration', entityId: q.integrationId ?? id, details: q.description.slice(0, 80), module: 'Integrations' })
  })
}

// ===================================================================== Platform

export async function markNotificationRead(id: string | 'all') {
  commit((db) => ({ ...db, notifications: db.notifications.map((n) => (id === 'all' || n.id === id ? { ...n, read: true } : n)) }))
}

export async function updateSettings(patch: Partial<DemoSettings>, summary = 'Settings updated') {
  if (patch.weights) requireCap('edit_risk_models')
  if (patch.slaDays || patch.identity) requireCap('manage_settings')
  // Demo controls must always work, even while simulated API errors are enabled.
  await latency(0.3, false)
  commit((db) => audit({ ...db, settings: { ...db.settings, ...patch } }, { action: 'settings updated', entityType: 'settings', entityId: 'settings', details: summary, module: 'Platform' }))
}

export function recordRecent(type: SearchEntityType, id: string, label: string) {
  const db = getDb()
  const recent = [{ type, id, label, at: now() }, ...(db.settings.recentRecords ?? []).filter((r) => r.id !== id)].slice(0, 8)
  useDbStore.getState().setDb({ ...db, settings: { ...db.settings, recentRecords: recent } })
}

export function resetDemo() {
  useDbStore.getState().reset()
}

export type { Agent }

export * from './platform'
