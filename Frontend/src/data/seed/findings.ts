import type { AIAnalysis, AISystem, Asset, Finding, FindingStatus, HistoryEntry, KnowledgeRecord, Severity } from '@/types'
import type { Clock, Rng } from './rng'
import { pad } from './rng'
import { INTEGRATIONS } from './reference'
import { AI_FINDING_TEMPLATES, FINDING_TEMPLATES, type AIFindingTemplate, type FindingTemplate, type TemplateCtx } from './templates'

export const SLA_DAYS: Record<Severity, number> = { critical: 15, high: 30, medium: 60, low: 90, informational: 180 }
export const MODEL_ID = 'do-safe-intel (simulated)'
export const MODEL_VERSION = '0.9.3-demo'
const PREV_MODEL_VERSION = '0.8.1-demo'

const STATUS_WEIGHTS: [FindingStatus, number][] = [
  ['new', 5],
  ['triaged', 10],
  ['in_validation', 6],
  ['validated', 7],
  ['in_remediation', 15],
  ['pending_verification', 5],
  ['resolved', 62],
  ['false_positive', 8],
  ['risk_accepted', 3],
]

const ANALYSTS = ['USR-002', 'USR-007']

interface Ctx {
  rng: Rng
  clock: Clock
  services: { id: string; name: string }[]
  knowledge: KnowledgeRecord[]
  userName: (id: string) => string
}

let hseq = 0
const hid = () => `H-${pad(++hseq, 5)}`

function rid(rng: Rng, prefix: string) {
  return `demo-${prefix}-${rng.int(100000, 999999).toString(16)}`
}

function history(entries: [string, string, HistoryEntry['type'], string, string?][]): HistoryEntry[] {
  return entries.map(([at, actorId, type, summary, detail]) => ({ id: hid(), at, actorId, type, summary, detail }))
}

function addDays(iso: string, days: number) {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString()
}

function buildAIAnalysis(f: Finding, t: { title: string; recommended: string; confidence: number }, ctx: Ctx, assetName: string): AIAnalysis {
  const { rng } = ctx
  const conf = Math.min(0.97, Math.max(0.55, t.confidence - rng.float(0, 0.12)))
  const kRefs = [f.cveId, ...f.cweIds, ...f.attackIds, ...f.owaspIds].filter(Boolean) as string[]
  const prev = rng.chance(0.4)
    ? [{ modelVersion: PREV_MODEL_VERSION, assessedAt: addDays(f.firstDetected, 1), confidence: Number((conf - 0.11).toFixed(2)), summary: `Earlier assessment flagged "${t.title}" on ${assetName}; exploitability context was not yet available (KEV/EPSS enrichment pending).` }]
    : []
  return {
    summary: `${t.title} on ${assetName}. ${f.kev ? 'The CVE is listed in the CISA KEV catalog, indicating active exploitation in the wild. ' : ''}${f.assetId && f.tags.includes('internet-facing') ? 'The asset is internet-facing, which increases reachability. ' : ''}Evidence from ${f.evidence.length} source record(s) supports the detection. Recommended next step: ${t.recommended}`,
    keyObservations: [
      `Detection method: ${f.detectionMethod} (${f.evidence.filter((e) => e.reliability === 'high').length} high-reliability evidence item(s)).`,
      f.cveId ? `CVE ${f.cveId} matched; CVSS ${f.cvss?.score ?? 'n/a'}${f.epss ? `, EPSS ${(f.epss.score * 100).toFixed(1)}% (illustrative)` : ''}.` : 'No CVE applies — finding is a configuration or design weakness.',
      f.validation.status === 'not_exploitable' ? 'Validation indicates the issue is not exploitable in the current configuration.' : f.validation.status === 'exploitable' ? 'Validation confirmed exploitability conditions.' : 'Exploitability has not yet been validated.',
    ],
    evidenceRefs: f.evidence.map((e) => e.id),
    knowledgeRefs: kRefs,
    modelId: MODEL_ID,
    modelVersion: MODEL_VERSION,
    assessedAt: addDays(f.firstDetected, rng.int(1, 3)),
    confidence: Number(conf.toFixed(2)),
    confidenceFactors: [
      { factor: 'Authoritative version evidence', effect: f.evidence.some((e) => e.kind === 'package-manifest' || e.kind === 'config-snapshot') ? 'raises' : 'lowers' },
      { factor: 'Multiple corroborating sources', effect: f.additionalSourceIds.length > 0 ? 'raises' : 'lowers' },
      { factor: 'Missing runtime context', effect: f.missingEvidence.length > 0 ? 'lowers' : 'raises' },
    ],
    missingInformation: f.missingEvidence,
    reviewStatus: ['resolved', 'false_positive', 'risk_accepted'].includes(f.status) ? 'accepted' : rng.chance(0.3) ? 'accepted' : 'pending_review',
    reviewedById: undefined,
    previousVersions: prev,
  }
}

function lifecycle(f: Finding, ctx: Ctx, ownerName: string, srcName: string) {
  const { rng, clock } = ctx
  const t0 = f.firstDetected
  const analyst = rng.pick(ANALYSTS)
  const steps: [string, string, HistoryEntry['type'], string, string?][] = [
    [t0, 'SYSTEM', 'discovered', `Detected by ${srcName}`, `Source record ${f.sourceRecordId}`],
    [addDays(t0, 0.02), 'SYSTEM', 'enriched', 'Enriched with knowledge library references', [f.cveId, ...f.cweIds, ...f.attackIds].filter(Boolean).join(', ') || 'No external library mapping applicable'],
    [addDays(t0, 0.03), 'SYSTEM', 'classified', `Classified as ${f.category} (confidence ${(f.classificationConfidence * 100).toFixed(0)}%)`],
  ]
  if (f.additionalSourceIds.length) steps.push([addDays(t0, 0.5), 'SYSTEM', 'observed', 'Duplicate detection from additional source merged', f.additionalSourceIds.join(', ')])
  const order: FindingStatus[] = ['new', 'triaged', 'in_validation', 'validated', 'in_remediation', 'pending_verification', 'resolved']
  const idx = order.indexOf(f.status)
  if (idx >= 1 || ['false_positive', 'risk_accepted'].includes(f.status)) {
    steps.push([addDays(t0, 1), analyst, 'status_change', 'Status: New → Triaged'])
    steps.push([addDays(t0, 1.01), analyst, 'assigned', `Owner assigned: ${ownerName}`])
  }
  if (idx >= 2) steps.push([addDays(t0, 2), analyst, 'status_change', 'Status: Triaged → In validation'])
  if (idx >= 3) steps.push([addDays(t0, 3), 'SYSTEM', 'validated', `Validation: ${f.validation.status.replace('_', ' ')}`, f.validation.summary])
  if (idx >= 4) steps.push([addDays(t0, 4), analyst, 'ticket_created', 'Remediation ticket created'])
  if (idx >= 5) steps.push([addDays(t0, 8), f.ownerId ?? analyst, 'remediation_update', 'Fix deployed; verification requested'])
  if (idx >= 6 && f.resolvedAt) steps.push([f.resolvedAt, analyst, 'verification', 'Verification passed — finding resolved', 'Rescan confirmed fixed state'])
  if (f.status === 'risk_accepted') steps.push([addDays(t0, 6), 'USR-001', 'risk_acceptance', 'Risk acceptance approved by CISO', f.riskAcceptance?.justification])
  if (f.status === 'false_positive') {
    const r = f.fpReviews[0]
    steps.push([r.decidedAt, r.reviewerId, 'false_positive_review', `Confirmed false positive: ${r.reason}`, r.analystNotes])
  }
  if (f.aiAnalysis) steps.push([f.aiAnalysis.assessedAt, 'SYSTEM', 'ai_analysis', `AI investigation summary generated (${f.aiAnalysis.modelVersion}, simulated)`])
  steps.push([f.lastObserved, 'SYSTEM', 'observed', `Last observed by ${srcName}`])
  f.history = history(steps.sort((a, b) => a[0].localeCompare(b[0])))
  void clock
}

const FP_NOTES: Record<string, string> = {
  'Version not affected': 'Package metadata reports a backported fix (distribution patch level includes upstream commit). Scanner matched on upstream version string only.',
  'Compensating control prevents exploitation': 'Service is only reachable from the payments service mesh with mTLS; exploit precondition (unauthenticated network access) is not met. Exception documented.',
  'Scanner signature error': 'Vendor confirmed plugin false-positive in advisory note; plugin updated in next feed.',
  'Component not present': 'Library listed in SBOM is a test-scope dependency not packaged into the runtime image (verified via image layer inspection).',
  'Asset decommissioned / misattributed': 'IP address was re-assigned; finding belonged to a decommissioned host.',
}

function baseFinding(id: string, t: FindingTemplate | AIFindingTemplate, ctx: Ctx, extra: Partial<Finding>): Finding {
  return {
    id,
    title: t.title,
    domain: 'vulnerability',
    category: t.category,
    severity: t.severity,
    status: 'new',
    templateKey: t.key,
    description: t.description,
    executiveSummary: '',
    businessImpact: t.businessImpact,
    cweIds: t.cweIds,
    attackIds: t.attackIds,
    owaspIds: t.owaspIds,
    kev: false,
    exploitAvailable: false,
    exploitMaturity: 'none',
    classificationConfidence: t.confidence,
    mappingRationale: t.rationale,
    firstDetected: '',
    lastObserved: '',
    sourceIntegrationId: t.sources[0],
    sourceRecordId: rid(ctx.rng, t.sources[0].slice(4).toLowerCase()),
    additionalSourceIds: [],
    detectionMethod: t.detectionMethod,
    evidence: [],
    missingEvidence: t.missingEvidence,
    rootCause: { hypotheses: [], relatedConfigIssues: [], relatedWeaknesses: [], notes: [] },
    remediation: { recommended: t.recommended, steps: t.steps, compensatingControls: t.compensating, status: 'not_started', verificationRequirements: t.verification, similarResolutions: [] },
    validation: { status: 'not_started', provenance: 'observed' },
    history: [],
    fpReviews: [],
    ticketIds: [],
    incidentIds: [],
    eventIds: [],
    relatedFindingIds: [],
    compensatingControlsInPlace: 0,
    attackPathIds: [],
    tags: [],
    ...extra,
  }
}

function applyStatus(f: Finding, ctx: Ctx, forced?: FindingStatus) {
  const { rng, clock } = ctx
  const status = forced ?? rng.weighted(STATUS_WEIGHTS)
  const sla = SLA_DAYS[f.severity]
  // Age depends on lifecycle stage so trends and SLA performance look realistic.
  const backlog = rng.chance(0.55)
  const ageByStatus: Record<FindingStatus, [number, number]> = {
    new: [0, 9],
    triaged: backlog ? [sla, 220] : [2, 24],
    in_validation: [3, 40],
    validated: backlog ? [30, 200] : [5, 40],
    in_remediation: backlog ? [Math.round(sla * 0.8), 220] : [6, Math.round(sla * 1.1)],
    pending_verification: [10, Math.round(sla * 1.15)],
    resolved: [30, 200],
    false_positive: [8, 220],
    risk_accepted: [30, 200],
  }
  const [lo, hi] = ageByStatus[status]
  const ageDays = rng.int(lo, Math.max(lo + 1, hi))
  f.firstDetected = clock.ago(ageDays, rng.int(0, 23))
  f.status = status
  f.targetDate = addDays(f.firstDetected, SLA_DAYS[f.severity])
  if (status === 'resolved') {
    f.resolvedAt = addDays(f.firstDetected, Math.min(ageDays - 1, rng.int(15, rng.chance(0.6) ? Math.max(30, Math.round(sla * 2.5)) : 100)))
    f.lastObserved = addDays(f.resolvedAt, -0.5)
    f.remediation.status = 'verified'
  } else {
    f.lastObserved = clock.ago(0, rng.int(1, 30))
  }
  if (status === 'in_remediation') f.remediation.status = rng.chance(0.5) ? 'in_progress' : 'planned'
  if (status === 'pending_verification') f.remediation.status = 'awaiting_verification'
  if (status === 'risk_accepted') {
    f.remediation.status = 'not_applicable'
    f.riskAcceptance = { requestedById: f.ownerId ?? 'USR-007', requestedAt: addDays(f.firstDetected, 5), justification: 'Asset scheduled for decommission within 90 days; compensating network isolation in place.', expiresAt: addDays(f.firstDetected, 95), status: 'approved', decidedById: 'USR-001', decidedAt: addDays(f.firstDetected, 6) }
  }
  // Validation
  if (['validated', 'in_remediation', 'pending_verification', 'resolved'].includes(status)) {
    const exploitable = rng.chance(0.78)
    f.validation = {
      status: exploitable ? 'exploitable' : 'inconclusive',
      method: f.domain === 'misconfiguration' || f.domain === 'identity' ? 'Configuration verification' : rng.pick(['Reachability analysis', 'Safe exploit simulation', 'Control effectiveness check'] as const),
      reachable: exploitable,
      controlsObserved: exploitable ? [] : ['WAF virtual patch', 'Network segmentation'],
      summary: exploitable ? 'Vulnerable component reachable from its exposure zone; no effective compensating control observed (simulated validation).' : 'Reachability could not be fully established; treated as exploitable pending evidence (simulated validation).',
      validatedAt: addDays(f.firstDetected, 3),
      validatedById: 'SYSTEM',
      provenance: 'simulated',
    }
  } else if (status === 'in_validation') {
    f.validation = { status: 'in_progress', method: 'Reachability analysis', provenance: 'simulated' }
  } else if (status === 'false_positive' || status === 'risk_accepted') {
    f.validation = { status: 'not_exploitable', method: 'Manual review', reachable: false, summary: 'Analyst review determined exploit preconditions are not met.', validatedAt: addDays(f.firstDetected, 2), validatedById: rng.pick(ANALYSTS), provenance: 'human-reviewed' }
  }
  if (status === 'false_positive') {
    const reason = rng.pick(Object.keys(FP_NOTES)) as keyof typeof FP_NOTES
    f.fpReviews = [
      {
        id: `FPR-${f.id.slice(4)}-1`,
        reason: reason as Finding['fpReviews'][number]['reason'],
        supportingEvidence: f.evidence[0] ? `${f.evidence[0].label} (${f.evidence[0].id}); analyst re-verification on host` : 'Analyst verification',
        analystNotes: FP_NOTES[reason],
        reviewerId: rng.pick(ANALYSTS),
        decidedAt: addDays(f.firstDetected, 2.5),
        decision: 'confirmed_false_positive',
        version: 1,
        previousStatus: 'triaged',
      },
    ]
  }
}

export function generateFindings(ctx: Ctx, assets: Asset[], aiSystems: AISystem[]) {
  const { rng, services, knowledge } = ctx
  const findings: Finding[] = []
  const active = assets.filter((a) => !a.possibleDuplicateOfId)
  const byService = new Map(services.map((s) => [s.id, s]))
  const kb = new Map(knowledge.map((k) => [k.externalId, k]))
  let n = 1001
  let eseq = 1

  const integrationName = (id: string) => INTEGRATIONS.find((i) => i.id === id)?.name ?? id

  for (const t of FINDING_TEMPLATES) {
    const matching = active.filter((a) => !t.assetTypes || t.assetTypes.includes(a.type))
    // Prefer internet-facing / higher criticality assets for externally exploitable templates
    const ranked = [...matching].sort((a, b) => Number(b.internetExposed) - Number(a.internetExposed) + (rng.next() - 0.5) * 1.6)
    const count = Math.min(matching.length, t.frequency * 3)
    const chosen = ranked.slice(0, count)
    for (const asset of chosen) {
      const id = `FND-${pad(n++)}`
      const svc = byService.get(asset.businessServiceId)!
      const cveRec = t.cveId ? kb.get(t.cveId) : undefined
      const c: TemplateCtx = { asset, host: asset.fqdn ?? asset.name, ip: asset.ipAddress ?? '—', date: ctx.clock.ago(1), rid: '' }
      const f = baseFinding(id, t, ctx, {
        domain: t.domain,
        assetId: asset.id,
        businessServiceId: asset.businessServiceId,
        cveId: t.cveId,
        cvss: cveRec?.cvss ? { version: cveRec.cvss.version, score: cveRec.cvss.score, vector: cveRec.cvss.vector } : undefined,
        epss: cveRec?.epss ? { score: cveRec.epss.score, percentile: cveRec.epss.percentile } : undefined,
        kev: !!cveRec?.kev,
        exploitAvailable: t.exploitMaturity !== 'none',
        exploitMaturity: t.exploitMaturity,
        ownerId: asset.ownerId,
        compensatingControlsInPlace: rng.chance(0.3) ? 1 : 0,
        tags: asset.internetExposed ? ['internet-facing'] : [],
      })
      c.rid = f.sourceRecordId
      if (t.sources[1] && rng.chance(0.55)) f.additionalSourceIds = [t.sources[1]]
      f.evidence = t.evidence(c).map((e) => ({
        ...e,
        id: `EV-${pad(eseq++, 5)}`,
        collectedAt: '',
        sourceIntegrationId: e.fromSource === 'secondary' && t.sources[1] ? t.sources[1] : t.sources[0],
      }))
      if (asset.software && t.software && !asset.software.some((s) => s.name === t.software!.name)) asset.software.push(t.software)
      applyStatus(f, ctx)
      f.evidence.forEach((e, i) => (e.collectedAt = addDays(f.firstDetected, i * 0.01)))
      f.executiveSummary = `${t.severity === 'critical' ? 'Critical' : t.severity[0].toUpperCase() + t.severity.slice(1)} ${t.category.toLowerCase()} affecting ${asset.name} (${svc.name}${asset.internetExposed ? ', internet-facing' : ''}). ${f.kev ? 'Actively exploited in the wild per CISA KEV. ' : ''}${t.businessImpact}`
      f.rootCause = {
        hypotheses: t.rootCauses.map((r, i) => ({ id: `RC-${f.id.slice(4)}-${i + 1}`, statement: r.statement, likelihood: r.likelihood, supportingEvidenceIds: f.evidence.slice(0, 1 + (i % 2)).map((e) => e.id), status: f.status === 'resolved' && i === 0 ? 'confirmed' : 'open', provenance: 'inferred' })),
        confirmed: f.status === 'resolved' ? t.rootCauses[0]?.statement : undefined,
        relatedConfigIssues: t.configIssues,
        relatedWeaknesses: t.weaknesses,
        notes: f.status !== 'new' && rng.chance(0.4) ? [{ id: `N-${f.id}`, authorId: rng.pick(ANALYSTS), at: addDays(f.firstDetected, 1.2), text: 'Confirmed with service owner that the component is in the runtime path. Awaiting change window.' }] : [],
      }
      f.remediation.vendorFix = t.vendorFix
      f.remediation.similarResolutions = t.similar
      if (['critical', 'high'].includes(f.severity) || rng.chance(0.4)) f.aiAnalysis = buildAIAnalysis(f, t, ctx, asset.name)
      lifecycle(f, ctx, ctx.userName(asset.ownerId), integrationName(f.sourceIntegrationId))
      findings.push(f)
    }
  }

  // --- AI security findings bound to AI systems
  const aiAssign: [keyof typeof AI_FINDING_TEMPLATES, string, FindingStatus?][] = [
    ['shadowUsage', 'AIS-011', 'triaged'],
    ['shadowUsage', 'AIS-013', 'new'],
    ['shadowUsage', 'AIS-014', 'resolved'],
    ['shadowUsage', 'AIS-016', 'in_remediation'],
    ['browserExtension', 'AIS-012', 'triaged'],
    ['ragAcl', 'AIS-002', 'validated'],
    ['promptInjection', 'AIS-003', 'in_validation'],
    ['systemPrompt', 'AIS-003', 'in_remediation'],
    ['piiPrompts', 'AIS-006', 'triaged'],
    ['piiPrompts', 'AIS-003', 'new'],
    ['noLogging', 'AIS-006', 'in_remediation'],
    ['noLogging', 'AIS-009', 'resolved'],
    ['excessiveScope', 'AIS-015', 'new'],
    ['excessiveScope', 'AIS-004', 'pending_verification'],
    ['providerTraining', 'AIS-010', 'triaged'],
    ['providerTraining', 'AIS-007', 'in_remediation'],
    ['exposedEndpoint', 'AIS-008', 'validated'],
    ['noContract', 'AIS-007', 'triaged'],
    ['noContract', 'AIS-010', 'new'],
    ['shadowUsage', 'AIS-012', 'false_positive'],
  ]
  for (const [key, aiId, status] of aiAssign) {
    const t = AI_FINDING_TEMPLATES[key]
    const ai = aiSystems.find((a) => a.id === aiId)!
    const id = `FND-${pad(n++)}`
    const c: TemplateCtx = { aiName: ai.name, host: ai.name, ip: '198.51.100.' + (40 + n % 50), date: ctx.clock.ago(1), rid: '' }
    const f = baseFinding(id, t, ctx, {
      domain: 'ai',
      aiSystemId: ai.id,
      businessServiceId: ai.businessServiceId,
      vendorId: ai.vendorId,
      ownerId: ai.ownerId ?? 'USR-004',
      exploitAvailable: false,
      tags: ai.approval === 'unsanctioned' || ai.approval === 'prohibited' ? ['shadow-ai'] : [],
    })
    c.rid = f.sourceRecordId
    if (t.sources[1]) f.additionalSourceIds = [t.sources[1]]
    f.evidence = t.evidence(c).map((e) => ({ ...e, id: `EV-${pad(eseq++, 5)}`, collectedAt: '', sourceIntegrationId: e.fromSource === 'secondary' && t.sources[1] ? t.sources[1] : t.sources[0] }))
    applyStatus(f, ctx, status)
    f.firstDetected = ctx.clock.ago(rng.int(3, 50))
    f.targetDate = addDays(f.firstDetected, SLA_DAYS[f.severity])
    if (f.resolvedAt) f.resolvedAt = addDays(f.firstDetected, 9)
    f.evidence.forEach((e) => (e.collectedAt = f.firstDetected))
    if (status === 'false_positive') {
      f.fpReviews[0].reason = 'Intended configuration (approved exception)'
      f.fpReviews[0].analystNotes = 'Usage originated from the sanctioned enterprise tenant of the same provider; SSE categorized the traffic as consumer tier due to a shared domain. Verified tenant ID in traffic headers.'
      f.fpReviews[0].reviewerId = 'USR-004'
      f.fpReviews[0].decidedAt = addDays(f.firstDetected, 2)
    }
    f.executiveSummary = `${t.category}: ${t.title.toLowerCase()} — ${ai.name}. ${t.businessImpact}`
    f.rootCause.hypotheses = t.rootCauses.map((r, i) => ({ id: `RC-${f.id.slice(4)}-${i + 1}`, statement: r.statement, likelihood: r.likelihood, supportingEvidenceIds: f.evidence.slice(0, 1).map((e) => e.id), status: f.status === 'resolved' && i === 0 ? 'confirmed' : 'open', provenance: 'inferred' }))
    if (f.status === 'resolved') f.rootCause.confirmed = t.rootCauses[0].statement
    f.aiAnalysis = buildAIAnalysis(f, t, ctx, ai.name)
    lifecycle(f, ctx, ctx.userName(f.ownerId!), integrationName(f.sourceIntegrationId))
    findings.push(f)
  }

  // Related findings: same template on other assets, and other findings on same asset/AI system
  for (const f of findings) {
    const sameTpl = findings.filter((o) => o.id !== f.id && o.templateKey === f.templateKey).slice(0, 3)
    const sameAsset = findings.filter((o) => o.id !== f.id && ((f.assetId && o.assetId === f.assetId) || (f.aiSystemId && o.aiSystemId === f.aiSystemId))).slice(0, 3)
    f.relatedFindingIds = [...new Set([...sameTpl, ...sameAsset].map((o) => o.id))]
  }
  return findings
}
