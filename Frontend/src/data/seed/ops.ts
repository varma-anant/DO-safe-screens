import type { AISystem, Asset, AttackPath, AuditEvent, DataQualityIssue, Finding, Incident, IngestionRun, Integration, Notification, SecurityEvent, Ticket, Vendor, Assessment, MonitoringAlert } from '@/types'
import type { Clock, Rng } from './rng'
import { pad } from './rng'

const addDays = (iso: string, d: number) => new Date(new Date(iso).getTime() + d * 86_400_000).toISOString()
const PRIORITY = { critical: 'P1', high: 'P2', medium: 'P3', low: 'P4', informational: 'P4' } as const

export function generateTickets(rng: Rng, clock: Clock, findings: Finding[], vendors: Vendor[], assessments: Assessment[]) {
  const tickets: Ticket[] = []
  let seq = 1
  const jira = (proj: string) => `${proj}-${rng.int(1200, 4800)}`

  for (const f of findings) {
    if (!['in_remediation', 'pending_verification', 'resolved'].includes(f.status)) continue
    const id = `TKT-${pad(seq++)}`
    const created = addDays(f.firstDetected, 4)
    const status: Ticket['status'] = f.status === 'resolved' ? 'done' : f.status === 'pending_verification' ? 'pending_verification' : rng.weighted([['open', 2], ['in_progress', 5], ['blocked', 1]])
    const progress = status === 'done' ? 100 : status === 'pending_verification' ? 90 : status === 'in_progress' ? rng.int(20, 75) : status === 'blocked' ? rng.int(10, 40) : 0
    const t: Ticket = {
      id,
      title: `Remediate: ${f.title}`,
      description: `${f.remediation.recommended}\n\nLinked finding ${f.id}.`,
      type: f.domain === 'ai' ? 'ai-governance' : f.domain === 'vulnerability' ? 'vulnerability' : 'configuration',
      priority: PRIORITY[f.severity],
      status,
      assigneeId: f.ownerId,
      reporterId: rng.pick(['USR-002', 'USR-007']),
      createdAt: created,
      updatedAt: f.resolvedAt ?? clock.ago(rng.int(0, 5)),
      dueDate: f.targetDate!,
      progress,
      findingId: f.id,
      aiSystemId: f.aiSystemId,
      externalRef: f.domain === 'ai' ? jira('AIG') : jira(f.businessServiceId?.replace('SVC-', '') ?? 'SEC'),
      comments: status === 'blocked' ? [{ id: `${id}-C1`, authorId: f.ownerId ?? 'USR-009', at: addDays(created, 2), text: 'Blocked: waiting on change-freeze exception approval from CAB.' }] : progress > 0 ? [{ id: `${id}-C1`, authorId: f.ownerId ?? 'USR-009', at: addDays(created, 1.5), text: 'Fix implemented in staging; scheduling production rollout.' }] : [],
      verification: status === 'done' ? { evidence: `Rescan by ${f.sourceIntegrationId.replace('INT-', '')} shows remediated state; screenshot and scan ID attached.`, method: 'Rescan', result: 'passed', verifiedById: rng.pick(['USR-002', 'USR-007']), verifiedAt: f.resolvedAt! } : undefined,
      history: [
        { id: `${id}-H1`, at: created, actorId: 'USR-007', type: 'ticket_created', summary: `Ticket created from ${f.id}` },
        ...(progress > 0 ? [{ id: `${id}-H2`, at: addDays(created, 1), actorId: f.ownerId ?? 'USR-009', type: 'remediation_update' as const, summary: `Progress updated to ${progress}%` }] : []),
        ...(status === 'done' ? [{ id: `${id}-H3`, at: f.resolvedAt!, actorId: 'USR-007', type: 'verification' as const, summary: 'Verification passed; ticket closed' }] : []),
      ],
    }
    f.ticketIds.push(id)
    tickets.push(t)
  }

  // Vendor remediation items from completed assessments
  for (const a of assessments.filter((x) => x.status === 'completed' && x.result)) {
    const v = vendors.find((x) => x.id === a.vendorId)!
    for (const gap of a.result!.gaps.slice(0, v.lifecycle === 'remediation' ? 3 : 1)) {
      const id = `TKT-${pad(seq++)}`
      const vr = rng.weighted([['awaiting', 3], ['acknowledged', 3], ['remediated', 2], ['disputed', 1]] as const)
      tickets.push({
        id,
        title: `${v.name}: ${gap.summary.split(' — ')[0]}`,
        description: gap.summary,
        type: 'vendor',
        priority: PRIORITY[gap.severity],
        status: vr === 'remediated' ? 'pending_verification' : vr === 'awaiting' ? 'open' : 'in_progress',
        assigneeId: v.relationshipOwnerId,
        reporterId: v.relationshipOwnerId,
        createdAt: a.completedAt!,
        updatedAt: clock.ago(rng.int(0, 6)),
        dueDate: addDays(a.completedAt!, gap.severity === 'critical' ? 30 : 60),
        progress: vr === 'remediated' ? 90 : vr === 'acknowledged' ? 40 : 0,
        vendorId: v.id,
        assessmentId: a.id,
        comments: [],
        vendorResponse: { status: vr, message: vr === 'acknowledged' ? 'We have scheduled this control improvement for next quarter.' : vr === 'disputed' ? 'We believe our existing compensating control satisfies this requirement — see attached policy.' : vr === 'remediated' ? 'Completed; evidence uploaded to the portal.' : undefined, respondedAt: vr === 'awaiting' ? undefined : clock.ago(rng.int(1, 10)) },
        history: [{ id: `${id}-H1`, at: a.completedAt!, actorId: v.relationshipOwnerId, type: 'ticket_created', summary: `Created from assessment ${a.id}` }],
      })
    }
  }
  return tickets
}

export function generateEvents(rng: Rng, clock: Clock, findings: Finding[], assets: Asset[], aiSystems: AISystem[]) {
  const events: SecurityEvent[] = []
  let seq = 1
  const add = (e: Omit<SecurityEvent, 'id'>) => {
    const ev = { ...e, id: `EVT-${pad(seq++)}` }
    events.push(ev)
    return ev
  }
  // Vulnerability signals for KEV / critical findings
  for (const f of findings.filter((x) => x.kev && !['resolved', 'false_positive'].includes(x.status)).slice(0, 14)) {
    const ev = add({ title: `Threat intel: active exploitation of ${f.cveId} — affects ${assets.find((a) => a.id === f.assetId)?.name}`, type: 'Threat intel match', severity: f.severity, sourceIntegrationId: 'INT-RF', occurredAt: addDays(f.firstDetected, 0.5), assetId: f.assetId, findingId: f.id, status: rng.weighted([['triaged', 3], ['new', 2], ['escalated', 1]]), rawSummary: `Exploitation activity for ${f.cveId} reported by threat intelligence; asset has unremediated exposure.` })
    f.eventIds.push(ev.id)
  }
  const servers = assets.filter((a) => ['server', 'endpoint', 'container'].includes(a.type) && !a.possibleDuplicateOfId)
  const edr: [string, SecurityEvent['severity'], string][] = [
    ['Suspicious PowerShell download cradle', 'high', 'powershell.exe -nop -w hidden -c IEX(New-Object Net.WebClient)… (blocked by EDR policy)'],
    ['Credential dumping attempt (LSASS access)', 'critical', 'Process attempted to read LSASS memory; prevented.'],
    ['Unsigned binary executed from temp directory', 'medium', 'C:\\Users\\…\\AppData\\Local\\Temp\\upd.exe executed'],
    ['Outbound connection to newly registered domain', 'medium', 'Connection to domain registered 2 days ago (category: uncategorized)'],
    ['Web shell-like file written to web root', 'high', 'New .jsp file written to /opt/app/webapps by java process'],
    ['Reverse shell pattern detected', 'critical', 'bash -i >& /dev/tcp/… pattern blocked'],
  ]
  for (let i = 0; i < 18; i++) {
    const [title, severity, raw] = rng.pick(edr)
    const asset = rng.pick(servers)
    add({ title: `${title} on ${asset.name}`, type: 'Detection', severity, sourceIntegrationId: 'INT-CRW', occurredAt: clock.ago(rng.int(0, 40), rng.int(0, 23)), assetId: asset.id, status: rng.weighted([['new', 3], ['triaged', 3], ['dismissed', 2], ['escalated', 1]]), rawSummary: raw, assessment: rng.chance(0.4) ? 'Benign — authorized admin script (change ticket referenced).' : undefined })
  }
  const auth: [string, SecurityEvent['severity'], string][] = [
    ['MFA push fatigue pattern for admin account', 'high', '6 denied pushes followed by approval within 4 minutes'],
    ['Impossible travel sign-in', 'medium', 'Sign-ins from two countries 40 minutes apart'],
    ['Password spraying against customer login', 'high', '1,900 failed logins across 1,700 accounts from 220 IPs in 10 minutes'],
    ['Admin role granted outside change window', 'medium', 'Super Admin role assigned to service account'],
  ]
  const idp = assets.filter((a) => a.type === 'identity-provider' && !a.possibleDuplicateOfId)
  for (let i = 0; i < 10; i++) {
    const [title, severity, raw] = rng.pick(auth)
    const a = rng.pick(idp)
    add({ title: `${title} (${a.name})`, type: 'Authentication anomaly', severity, sourceIntegrationId: 'INT-OKT', occurredAt: clock.ago(rng.int(0, 30), rng.int(0, 23)), assetId: a.id, status: rng.weighted([['new', 2], ['triaged', 3], ['escalated', 1], ['dismissed', 1]]), rawSummary: raw })
  }
  for (const ai of aiSystems.filter((x) => ['unsanctioned', 'prohibited'].includes(x.approval) || x.id === 'AIS-006')) {
    const f = findings.find((x) => x.aiSystemId === ai.id)
    const ev = add({ title: `DLP: Confidential content sent to ${ai.name}`, type: 'Data movement', severity: ai.approval === 'prohibited' ? 'high' : 'medium', sourceIntegrationId: 'INT-NSK', occurredAt: clock.ago(rng.int(0, 14), rng.int(0, 23)), aiSystemId: ai.id, findingId: f?.id, status: rng.weighted([['new', 2], ['triaged', 2]]), rawSummary: 'DLP policy "Confidential label → external AI" matched (content redacted in DO SAFE).' })
    if (f) f.eventIds.push(ev.id)
  }
  const cfgChanges = ['Security group opened to 0.0.0.0/0', 'Bucket policy changed to allow public principal', 'CloudTrail logging disabled in region', 'IAM access key created for root-equivalent role']
  for (let i = 0; i < 8; i++) {
    const a = rng.pick(assets.filter((x) => x.cloud === 'AWS' && !x.possibleDuplicateOfId))
    add({ title: `${rng.pick(cfgChanges)} — ${a.name}`, type: 'Configuration change', severity: rng.pick(['medium', 'high'] as const), sourceIntegrationId: 'INT-WIZ', occurredAt: clock.ago(rng.int(0, 35), rng.int(0, 23)), assetId: a.id, status: rng.weighted([['new', 2], ['triaged', 3], ['dismissed', 1]]), rawSummary: 'Cloud configuration change detected by posture monitoring.' })
  }
  return events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}

export function generateIncidents(clock: Clock, findings: Finding[], events: SecurityEvent[], assets: Asset[]) {
  const incidents: Incident[] = []
  const find = (pred: (f: Finding) => boolean) => findings.find(pred)
  const assetName = (id?: string) => assets.find((a) => a.id === id)?.name ?? id

  const defs: { title: string; severity: Incident['severity']; status: Incident['status']; category: string; f?: Finding; inv: string; age: number; summary: string; resolution?: string }[] = [
    { title: 'Suspected exploitation attempt against MFT server', severity: 'critical', status: 'investigating', category: 'Exploitation attempt', f: find((f) => f.templateKey === 'moveit'), inv: 'USR-008', age: 3, summary: 'Threat intel and WAF logs indicate scanning for MOVEit endpoints against mft-partner-01; server has unpatched CVE-2023-34362.' },
    { title: 'Public exposure of customer export bucket', severity: 'high', status: 'contained', category: 'Data exposure', f: find((f) => f.templateKey === 's3-public' && f.status !== 'resolved'), inv: 'USR-016', age: 9, summary: 'Bucket with customer exports was publicly readable; access restricted, CloudTrail review in progress to determine whether objects were accessed.' },
    { title: 'Leaked AWS key in payments repository', severity: 'high', status: 'eradicated', category: 'Credential exposure', f: find((f) => f.templateKey === 'secret-repo'), inv: 'USR-008', age: 14, summary: 'Active access key committed to repository; key revoked, CloudTrail shows no unauthorized use.' },
    { title: 'MFA fatigue attack on identity administrators', severity: 'high', status: 'closed', category: 'Account compromise attempt', f: find((f) => f.templateKey === 'mfa-gap'), inv: 'USR-016', age: 32, summary: 'Repeated push MFA requests to admin; one approval. Session revoked within 6 minutes.', resolution: 'Session terminated, password reset, FIDO2 enforced for affected admin. No evidence of configuration changes during the 6-minute session (audit log review). Root cause: push MFA without number matching.' },
    { title: 'Unsanctioned AI tool receiving customer correspondence', severity: 'medium', status: 'open', category: 'AI policy violation', f: find((f) => f.aiSystemId === 'AIS-016'), inv: 'USR-004', age: 4, summary: 'DLP shows confidential customer correspondence sent to prohibited TranslateNow AI despite policy.' },
    { title: 'Unauthenticated model endpoint observed from internet', severity: 'high', status: 'investigating', category: 'Exposure', f: find((f) => f.aiSystemId === 'AIS-008'), inv: 'USR-008', age: 6, summary: 'Fine-tuned fraud model served without auth on a public IP; unknown external callers observed.' },
    { title: 'Ransomware precursor activity on legacy batch server', severity: 'critical', status: 'recovered', category: 'Malware', f: find((f) => f.templateKey === 'bluekeep'), inv: 'USR-008', age: 48, summary: 'EDR blocked credential dumping on pay-batch-legacy; host isolated and rebuilt.', resolution: 'Host isolated within 4 minutes, rebuilt from known-good image. No lateral movement identified.' },
    { title: 'Password spraying campaign against customer login', severity: 'medium', status: 'closed', category: 'Credential attack', f: undefined, inv: 'USR-016', age: 22, summary: 'Distributed password spraying blocked by rate limiting and bot protection.', resolution: 'Bot mitigation rules tuned; 37 accounts with successful logins forced to reset. No fraudulent transactions identified.' },
  ]
  defs.forEach((d, i) => {
    const id = `INC-${pad(i + 1, 3)}`
    const created = clock.ago(d.age, 3)
    const relEvents = events.filter((e) => (d.f && e.findingId === d.f.id) || (d.f?.assetId && e.assetId === d.f.assetId)).slice(0, 3)
    relEvents.forEach((e) => {
      e.incidentId = id
      e.status = 'escalated'
    })
    if (d.f) d.f.incidentIds.push(id)
    const closed = d.status === 'closed'
    incidents.push({
      id,
      title: d.title,
      severity: d.severity,
      status: d.status,
      category: d.category,
      summary: d.summary,
      investigatorId: d.inv,
      createdById: 'USR-002',
      createdAt: created,
      updatedAt: clock.ago(Math.max(0, d.age - 2)),
      closedAt: closed ? clock.ago(Math.max(0, d.age - 5)) : undefined,
      findingIds: d.f ? [d.f.id] : [],
      eventIds: relEvents.map((e) => e.id),
      assetIds: d.f?.assetId ? [d.f.assetId] : [],
      aiSystemIds: d.f?.aiSystemId ? [d.f.aiSystemId] : [],
      businessServiceIds: d.f?.businessServiceId ? [d.f.businessServiceId] : ['SVC-IDN'],
      tasks: [
        { id: `${id}-T1`, title: 'Collect and preserve logs', assigneeId: d.inv, status: 'done', dueDate: addDays(created, 1) },
        { id: `${id}-T2`, title: `Scope impact on ${assetName(d.f?.assetId) ?? 'affected systems'}`, assigneeId: d.inv, status: ['open', 'investigating'].includes(d.status) ? 'in_progress' : 'done', dueDate: addDays(created, 2) },
        { id: `${id}-T3`, title: 'Apply containment / remediation', assigneeId: d.f?.ownerId ?? 'USR-017', status: ['contained', 'eradicated', 'recovered', 'closed'].includes(d.status) ? 'done' : 'todo', dueDate: addDays(created, 3) },
        { id: `${id}-T4`, title: 'Post-incident review', assigneeId: 'USR-001', status: closed ? 'done' : 'todo', dueDate: addDays(created, 14) },
      ],
      notes: [{ id: `${id}-N1`, authorId: d.inv, at: addDays(created, 0.2), text: 'Initial triage complete. Evidence preserved; see linked finding and events.' }],
      timeline: [
        { id: `${id}-TL1`, at: created, actorId: 'USR-002', type: 'incident_created', summary: `Incident declared${d.f ? ` from ${d.f.id}` : ''}` },
        { id: `${id}-TL2`, at: addDays(created, 0.05), actorId: 'USR-002', type: 'assigned', summary: 'Investigator assigned' },
        ...(d.status !== 'open' ? [{ id: `${id}-TL3`, at: addDays(created, 0.5), actorId: d.inv, type: 'status_change' as const, summary: 'Status → Investigating' }] : []),
        ...(['contained', 'eradicated', 'recovered', 'closed'].includes(d.status) ? [{ id: `${id}-TL4`, at: addDays(created, 1), actorId: d.inv, type: 'status_change' as const, summary: 'Status → Contained' }] : []),
        ...(closed ? [{ id: `${id}-TL5`, at: clock.ago(Math.max(0, d.age - 5)), actorId: d.inv, type: 'status_change' as const, summary: 'Incident closed with resolution summary' }] : []),
      ],
      resolutionSummary: d.resolution,
    })
  })
  return incidents
}

export function generateAttackPaths(clock: Clock, findings: Finding[], assets: Asset[]): AttackPath[] {
  const A = (name: string) => assets.find((a) => a.name === name)!
  const F = (assetName: string, pred?: (f: Finding) => boolean) => findings.find((f) => f.assetId === A(assetName).id && !['resolved', 'false_positive'].includes(f.status) && (!pred || pred(f)))
  const paths: AttackPath[] = []
  const mk = (id: string, name: string, svc: string, steps: [string, string | undefined, string][], likelihood: AttackPath['likelihood'], impact: AttackPath['impact']) => {
    const s = steps.map(([an, tech, desc]) => {
      const f = F(an)
      return { assetId: A(an).id, findingId: f?.id, techniqueId: tech, description: desc }
    })
    s.forEach((st) => st.findingId && findings.find((f) => f.id === st.findingId)!.attackPathIds.push(id))
    paths.push({ id, name, entryAssetId: s[0].assetId, targetAssetId: s[s.length - 1].assetId, steps: s, likelihood, impact, status: 'active', businessServiceId: svc, discoveredAt: clock.ago(5) })
  }
  mk('AP-001', 'Internet → API gateway → settlement ledger', 'SVC-PAY', [['prod-api-gw-01', 'T1190', 'Exploit vulnerable component on internet-facing gateway'], ['pay-settlement-svc', 'T1210', 'Pivot to settlement service over service mesh'], ['pay-ledger-db', 'T1078', 'Use service credentials to access ledger database']], 'high', 'critical')
  mk('AP-002', 'MFT server → message broker → clearing', 'SVC-PAY', [['mft-partner-01', 'T1190', 'Exploit MFT web application (SQL injection)'], ['pay-mq-broker-01', 'T1210', 'Exploit broker deserialization from MFT network'], ['pay-clearing-01', 'T1059', 'Execute commands on clearing server']], 'high', 'critical')
  mk('AP-003', 'Leaked key → staging bucket → payments build', 'SVC-PAY', [['payments-platform', 'T1552.001', 'Harvest committed cloud credentials'], ['pay-settlement-exports', undefined, 'Write to deployment bucket'], ['pay-auth-svc', 'T1195.002', 'Tampered artifact promoted to production']], 'medium', 'critical')
  mk('AP-004', 'Remote access gateway → identity admin', 'SVC-IDN', [['citrix-gw-01', 'T1550.004', 'Hijack session via token disclosure'], ['okta-prod', 'T1621', 'MFA fatigue against admin'], ['idn-user-db', 'T1078', 'Access customer identity store']], 'medium', 'critical')
  mk('AP-005', 'Public database → customer profiles', 'SVC-CDP', [['cdp-profile-db', 'T1110.003', 'Brute force exposed database'], ['cdp-warehouse', 'T1530', 'Access analytics warehouse with reused credentials']], 'medium', 'high')
  mk('AP-006', 'Public model endpoint → fraud training data', 'SVC-FRD', [['fraud-sandbox-ds', 'T1190', 'Query unauthenticated inference endpoint'], ['fraud-features-db', undefined, 'Sandbox host holds read credentials to feature store']], 'low', 'high')
  return paths
}

export function generateIngestion(rng: Rng, clock: Clock, integrations: Integration[], findings: Finding[], assets: Asset[]) {
  const runs: IngestionRun[] = []
  let seq = 1
  for (const i of integrations.filter((x) => ['connected', 'error'].includes(x.status))) {
    const count = rng.int(4, 7)
    for (let k = 0; k < count; k++) {
      const failed = i.status === 'error' && k < 2
      const received = failed ? 0 : rng.int(40, 900)
      const dup = Math.round(received * rng.float(0.05, 0.25))
      const rejected = failed ? 0 : rng.int(0, Math.max(1, Math.round(received * 0.02)))
      runs.push({ id: `ING-${pad(seq++)}`, integrationId: i.id, startedAt: clock.ago(k * (i.id === 'INT-CRW' ? 0.1 : 0.5), rng.int(0, 5)), durationSec: rng.int(8, 240), status: failed ? 'failed' : rejected > 3 ? 'partial' : 'success', received, normalized: received - rejected, duplicatesMerged: dup, rejected, createdFindingIds: [], message: failed ? 'Authentication failed (HTTP 401) — token expired (simulated)' : rejected > 3 ? `${rejected} records rejected: missing required field "asset identifier"` : 'Completed' })
    }
    const total = findings.filter((f) => f.sourceIntegrationId === i.id || f.additionalSourceIds.includes(i.id)).length + assets.filter((a) => a.sourceIntegrationIds.includes(i.id)).length
    i.recordsIngested = total * rng.int(18, 40)
    i.lastSyncAt = runs.filter((r) => r.integrationId === i.id && r.status !== 'failed')[0]?.startedAt ?? clock.ago(2)
  }
  return runs
}

export function generateDataQuality(rng: Rng, clock: Clock, assets: Asset[], findings: Finding[]) {
  const issues: DataQualityIssue[] = []
  let seq = 1
  const add = (i: Omit<DataQualityIssue, 'id' | 'status' | 'detectedAt'>) => issues.push({ ...i, id: `DQ-${pad(seq++, 3)}`, detectedAt: clock.ago(rng.int(0, 20)), status: rng.chance(0.15) ? 'resolved' : 'open' })
  for (const a of assets.filter((x) => x.possibleDuplicateOfId)) add({ type: 'Inconsistent hostname', entityType: 'asset', entityId: a.id, integrationId: a.sourceIntegrationIds[0], description: `Hostname "${a.name}" likely refers to the same asset as ${a.possibleDuplicateOfId}; pending reconciliation.` })
  for (const a of rng.pickN(assets.filter((x) => x.type === 'endpoint' || x.type === 'serverless-function'), 4)) add({ type: 'Missing owner', entityType: 'asset', entityId: a.id, integrationId: a.sourceIntegrationIds[0], description: 'Source record has no owner attribute; owner inferred from business service (low confidence).' })
  for (const a of rng.pickN(assets.filter((x) => x.environment === 'development'), 3)) add({ type: 'Stale record', entityType: 'asset', entityId: a.id, integrationId: a.sourceIntegrationIds[0], description: 'Asset not observed by any source in > 14 days.' })
  for (const f of rng.pickN(findings.filter((x) => x.additionalSourceIds.length > 0), 4)) add({ type: 'Conflicting severity', entityType: 'finding', entityId: f.id, integrationId: f.additionalSourceIds[0], description: `Sources disagree on severity (${f.sourceIntegrationId.replace('INT-', '')}: ${f.severity}; ${f.additionalSourceIds[0].replace('INT-', '')}: ${f.severity === 'critical' ? 'high' : 'medium'}). DO SAFE uses the CVE base score with context.` })
  add({ type: 'Unmapped field', entityType: 'finding', entityId: findings[3].id, integrationId: 'INT-QLY', description: 'Field "QID category" has 3 values with no normalization mapping.' })
  add({ type: 'Missing business service', entityType: 'aiSystem', entityId: 'AIS-004', description: 'AI system not mapped to a business service.' })
  return issues
}

export function generateAudit(rng: Rng, clock: Clock, findings: Finding[], tickets: Ticket[], incidents: Incident[], alerts: MonitoringAlert[]): AuditEvent[] {
  const out: AuditEvent[] = []
  let seq = 1
  const add = (e: Omit<AuditEvent, 'id'>) => out.push({ ...e, id: `AUD-${pad(seq++, 5)}` })
  for (const f of findings) {
    for (const h of f.history) {
      if (['status_change', 'assigned', 'false_positive_review', 'risk_acceptance', 'verification', 'ticket_created'].includes(h.type)) add({ at: h.at, actorId: h.actorId, action: h.type.replace(/_/g, ' '), entityType: 'finding', entityId: f.id, details: h.summary, module: f.domain === 'ai' ? 'AI-SPM' : 'CTEM' })
    }
  }
  for (const t of tickets.filter((x) => x.verification)) add({ at: t.verification!.verifiedAt, actorId: t.verification!.verifiedById, action: 'verification recorded', entityType: 'ticket', entityId: t.id, details: `Verification ${t.verification!.result} (${t.verification!.method})`, module: 'Operations' })
  for (const i of incidents) add({ at: i.createdAt, actorId: i.createdById, action: 'incident created', entityType: 'incident', entityId: i.id, details: i.title, module: 'Operations' })
  for (const a of alerts.filter((x) => x.status === 'acknowledged')) add({ at: a.detectedAt, actorId: 'USR-003', action: 'alert acknowledged', entityType: 'vendor', entityId: a.vendorId, details: a.title, module: 'TPRM' })
  add({ at: clock.ago(30), actorId: 'USR-006', action: 'integration configured', entityType: 'integration', entityId: 'INT-RF', details: 'Recorded Future connector enabled', module: 'Integrations' })
  add({ at: clock.ago(1, 4), actorId: 'USR-006', action: 'connector error', entityType: 'integration', entityId: 'INT-SPL', details: 'Splunk connector authentication failed', module: 'Integrations' })
  void rng
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

export function generateNotifications(clock: Clock, findings: Finding[], incidents: Incident[]): Notification[] {
  const crit = findings.filter((f) => f.kev && f.status === 'new').slice(0, 3)
  return [
    ...crit.map((f, i) => ({ id: `NTF-${i + 1}`, at: clock.ago(0, i + 1), title: 'New KEV-listed exposure', body: `${f.title} detected (${f.id}).`, link: `/exposures/vulnerabilities/${f.id}`, severity: 'critical' as const, read: false })),
    { id: 'NTF-10', at: clock.ago(0, 2), title: 'Approval required', body: 'Remediation Orchestrator drafted remediation tickets and is awaiting approval.', link: '/operations/approvals', severity: 'info', read: false },
    { id: 'NTF-11', at: clock.ago(0, 5), title: 'Vendor alert: Orbit Messaging', body: 'Public report of SMS routing compromise at a carrier aggregator.', link: '/tprm/monitoring', severity: 'critical', read: false },
    { id: 'NTF-12', at: clock.ago(1, 1), title: 'Connector error', body: 'Splunk Enterprise Security connector authentication failed.', link: '/integrations/monitoring', severity: 'high', read: false },
    { id: 'NTF-13', at: clock.ago(1, 6), title: 'Incident update', body: `${incidents[0].id} moved to Investigating.`, link: `/operations/incidents/${incidents[0].id}`, severity: 'high', read: true },
    { id: 'NTF-14', at: clock.ago(2), title: 'Shadow AI detected', body: 'ChatterBox (free tier) observed for 112 users.', link: '/ai-security/shadow-ai', severity: 'medium', read: true },
    { id: 'NTF-15', at: clock.ago(3), title: 'Governance review assigned', body: 'You were assigned GOV-001 (QuickSumm AI).', link: '/ai-security/governance/GOV-001', severity: 'info', read: true },
  ]
}
