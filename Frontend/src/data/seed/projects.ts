import type { AccessRequest, Asset, AssetLink, BusinessService, Invitation, Project, ScanRun, SupportTicket } from '@/types'
import type { Clock } from './rng'
import type { ServiceSeed } from './reference'

export const PROJECT_SEEDS: Omit<Project, 'createdAt'>[] = [
  {
    id: 'PRJ-01',
    name: 'Core Banking & Payments',
    description: 'Customer-facing banking, payments, identity and fraud platforms in production.',
    ownerId: 'USR-009',
    createdById: 'USR-006',
    members: [
      { userId: 'USR-010', role: 'owner', addedAt: '' },
      { userId: 'USR-014', role: 'contributor', addedAt: '' },
      { userId: 'USR-017', role: 'contributor', addedAt: '' },
      { userId: 'USR-011', role: 'viewer', addedAt: '' },
    ],
  },
  {
    id: 'PRJ-02',
    name: 'Customer Data & Analytics',
    description: 'Customer data platform, data lake and analytics pipelines.',
    ownerId: 'USR-012',
    createdById: 'USR-006',
    members: [{ userId: 'USR-017', role: 'contributor', addedAt: '' }],
  },
  {
    id: 'PRJ-03',
    name: 'Workplace & AI Services',
    description: 'Collaboration suite, internal tools and the AI customer-support platform.',
    ownerId: 'USR-015',
    createdById: 'USR-006',
    members: [{ userId: 'USR-013', role: 'owner', addedAt: '' }],
  },
  {
    id: 'PRJ-04',
    name: 'Treasury Portal Launch',
    description: 'Securing the new commercial treasury portal before go-live.',
    ownerId: 'USR-009',
    createdById: 'USR-009',
    members: [{ userId: 'USR-011', role: 'viewer', addedAt: '' }],
  },
]

const APP_META: Record<string, { projectId: string; appType: BusinessService['appType']; environment: BusinessService['environment'] }> = {
  'SVC-PAY': { projectId: 'PRJ-01', appType: 'API service', environment: 'production' },
  'SVC-IDN': { projectId: 'PRJ-01', appType: 'Internal platform', environment: 'production' },
  'SVC-DBK': { projectId: 'PRJ-01', appType: 'Web application', environment: 'production' },
  'SVC-FRD': { projectId: 'PRJ-01', appType: 'Data platform', environment: 'production' },
  'SVC-CDP': { projectId: 'PRJ-02', appType: 'Data platform', environment: 'production' },
  'SVC-COL': { projectId: 'PRJ-03', appType: 'SaaS workspace', environment: 'corporate' },
  'SVC-AIS': { projectId: 'PRJ-03', appType: 'AI application', environment: 'production' },
  'SVC-TRS': { projectId: 'PRJ-04', appType: 'Web application', environment: 'staging' },
}

/** Assets for the application still being onboarded — generated after the main seed so existing IDs stay stable. */
export function treasuryAssets(clock: Clock, startIndex: number): Asset[] {
  const items: [string, Asset['type'], boolean, string][] = [
    ['trs-portal-web', 'web-application', true, 'tier-2'],
    ['trs-payments-api', 'api-gateway', false, 'tier-2'],
    ['trs-ledger-db', 'database', false, 'tier-2'],
    ['trs-k8s-stg', 'kubernetes-cluster', false, 'tier-3'],
    ['treasury-portal', 'code-repository', false, 'tier-3'],
  ]
  return items.map(([name, type, internet, crit], i) => ({
    id: `AST-${String(startIndex + i).padStart(4, '0')}`,
    name,
    type,
    environment: type === 'code-repository' ? 'development' : 'staging',
    businessServiceId: 'SVC-TRS',
    ownerId: 'USR-009',
    ipAddress: type === 'code-repository' ? undefined : internet ? '203.0.113.240' : `10.29.4.${30 + i}`,
    fqdn: type === 'code-repository' ? 'github.example/northstar-fin/treasury-portal' : internet ? `${name}.northstar.example` : `${name}.int.northstar.example`,
    cloud: type === 'code-repository' ? undefined : 'AWS',
    region: type === 'code-repository' ? undefined : 'us-east-1',
    internetExposed: internet,
    criticality: crit as Asset['criticality'],
    sourceIntegrationIds: [],
    tags: ['staging', 'onboarding'],
    firstSeen: clock.ago(3),
    lastSeen: clock.ago(3),
    software: [],
  }))
}

const RELATION_RULES: [Asset['type'][], Asset['type'][], AssetLink['relation']][] = [
  [['api-gateway', 'web-application'], ['container', 'server', 'serverless-function'], 'routes to'],
  [['container', 'server', 'serverless-function'], ['database', 'cloud-storage'], 'stores data in'],
  [['web-application', 'api-gateway', 'container'], ['identity-provider'], 'authenticates via'],
  [['kubernetes-cluster'], ['container'], 'hosts'],
  [['code-repository'], ['container', 'serverless-function', 'web-application'], 'deploys to'],
  [['network-device'], ['api-gateway', 'web-application', 'server'], 'routes to'],
]

/** Derives a plausible asset map for an application from asset types. */
export function deriveLinks(assets: Asset[], prefix: string): AssetLink[] {
  const links: AssetLink[] = []
  let n = 1
  for (const [from, to, relation] of RELATION_RULES) {
    const sources = assets.filter((a) => from.includes(a.type))
    const targets = assets.filter((a) => to.includes(a.type))
    for (const s of sources) {
      for (const t of targets.slice(0, 3)) {
        if (s.id === t.id || links.some((l) => l.sourceAssetId === s.id && l.targetAssetId === t.id)) continue
        links.push({ id: `${prefix}-L${n++}`, sourceAssetId: s.id, targetAssetId: t.id, relation })
      }
    }
  }
  return links.slice(0, Math.max(assets.length + 4, 6))
}

function seededRun(id: string, kind: ScanRun['kind'], assets: Asset[], at: string, by: string, findingIds: string[]): ScanRun {
  const end = new Date(new Date(at).getTime() + (kind === 'test' ? 4 : 38) * 60_000).toISOString()
  return {
    id,
    kind,
    status: kind === 'test' ? 'passed' : 'completed',
    startedAt: at,
    finishedAt: end,
    startedById: by,
    steps: (kind === 'test' ? TEST_STEPS : FULL_STEPS).map((name) => ({ name, status: 'done' as const, detail: 'Completed' })),
    assetResults: assets.map((a) => ({ assetId: a.id, reachable: true, credentialsOk: true, sourceIds: a.sourceIntegrationIds, note: 'OK' })),
    findingIds,
    summary: kind === 'test' ? `All ${assets.length} parts reachable and every tool’s access works. A test run reports no problems.` : `Checked ${assets.length} parts — found ${findingIds.length} problems.`,
  }
}

export const TEST_STEPS = ['Finding your parts', 'Reaching each part', 'Confirming tool access', 'Running a safe sample check', 'Making sure results arrive']
export const FULL_STEPS = ['Looking at every part', 'Checking for weak or outdated software', 'Checking settings and sign-in safety', 'Explaining each problem', 'Ranking what to fix first', 'Turning on daily checks']

export function buildApplications(services: ServiceSeed[], assets: Asset[], findings: { id: string; businessServiceId?: string; firstDetected: string }[], clock: Clock): BusinessService[] {
  return services.map((s) => {
    const meta = APP_META[s.id]
    const appAssets = assets.filter((a) => a.businessServiceId === s.id && !a.duplicateOfId && !a.possibleDuplicateOfId)
    const coverage = Object.fromEntries(appAssets.map((a) => [a.id, a.sourceIntegrationIds]))
    const onboarding = s.id === 'SVC-TRS'
    const appFindings = findings.filter((f) => f.businessServiceId === s.id)
    const runs: ScanRun[] = onboarding
      ? []
      : [
          // Newest first, matching how the API prepends runs.
          seededRun(`${s.id}-RUN-3`, 'full', appAssets, clock.ago(1, 3), 'SYSTEM', appFindings.filter((f) => new Date(f.firstDetected) > new Date(clock.ago(2))).map((f) => f.id)),
          seededRun(`${s.id}-RUN-2`, 'full', appAssets, clock.ago(199), 'USR-006', appFindings.filter((f) => new Date(f.firstDetected) < new Date(clock.ago(150))).map((f) => f.id)),
          seededRun(`${s.id}-RUN-1`, 'test', appAssets, clock.ago(200), 'USR-006', []),
        ]
    return {
      ...s,
      projectId: meta.projectId,
      appType: meta.appType,
      environment: meta.environment,
      status: onboarding ? 'mapped' : 'active',
      coverage: onboarding ? {} : coverage,
      assetLinks: deriveLinks(appAssets, s.id),
      runs,
      onboardingStartedAt: onboarding ? clock.ago(3) : clock.ago(201),
      protectedSince: onboarding ? undefined : clock.ago(199),
      nextRunAt: onboarding ? undefined : clock.ahead(0, 5),
      runSchedule: onboarding ? 'Manual' : s.criticality === 'tier-1' ? 'Every 6 hours' : 'Daily',
    }
  })
}

export function buildProjects(clock: Clock): Project[] {
  return PROJECT_SEEDS.map((p, i) => ({ ...p, createdAt: clock.ago(i === 3 ? 3 : 210 - i), members: p.members.map((m) => ({ ...m, addedAt: clock.ago(i === 3 ? 3 : 200) })) }))
}

export function buildAccessRequests(clock: Clock): AccessRequest[] {
  return [
    { id: 'AR-204', requesterId: 'USR-011', kind: 'Project access', projectId: 'PRJ-01', requestedRole: 'Contributor', justification: 'I own the web-banking release train and need to create and update remediation tickets for Digital Banking findings.', durationDays: 90, risk: 'medium', status: 'pending', createdAt: clock.ago(0, 5) },
    { id: 'AR-203', requesterId: 'USR-016', kind: 'Project access', projectId: 'PRJ-04', requestedRole: 'Contributor', justification: 'Assigned as SOC analyst for the Treasury Portal go-live readiness review.', durationDays: 30, risk: 'low', status: 'pending', createdAt: clock.ago(1, 2) },
    { id: 'AR-202', requesterId: 'USR-018', kind: 'Role change', requestedRole: 'Administrator', justification: 'Need to configure the vendor-rating connector myself.', risk: 'high', status: 'pending', createdAt: clock.ago(1, 6) },
    { id: 'AR-201', requesterId: 'USR-013', kind: 'Project access', projectId: 'PRJ-02', requestedRole: 'Viewer', justification: 'Read-only visibility into data platform findings that affect collaboration exports.', durationDays: 60, risk: 'low', status: 'approved', createdAt: clock.ago(6), reviewerId: 'USR-012', decidedAt: clock.ago(5), decisionNote: 'Approved — read-only, 60 days.' },
  ]
}

export function buildInvitations(clock: Clock): Invitation[] {
  return [
    { id: 'INV-031', email: 'li.wei@northstar.example', name: 'Li Wei', orgRole: 'analyst', projectIds: ['PRJ-01'], invitedById: 'USR-006', sentAt: clock.ago(2), status: 'pending' },
    { id: 'INV-030', email: 'auditor@extaudit.example', name: 'External Auditor (Q4)', orgRole: 'viewer', projectIds: ['PRJ-01', 'PRJ-02'], invitedById: 'USR-001', sentAt: clock.ago(4), status: 'pending' },
    { id: 'INV-029', email: 'sarah.novak@northstar.example', name: 'Sarah Novak', orgRole: 'analyst', projectIds: [], invitedById: 'USR-006', sentAt: clock.ago(120), status: 'accepted' },
  ]
}

export function buildSupportTickets(clock: Clock): SupportTicket[] {
  return [
    { id: 'SUP-1042', title: 'Splunk connector failing authentication', category: 'Connectors & scans', priority: 'High', status: 'investigating', createdById: 'USR-006', createdAt: clock.ago(1, 2), updatedAt: clock.ago(0, 3), description: 'Since yesterday the Splunk Enterprise Security connector returns HTTP 401 on every sync. The token was not rotated on our side.', impact: 'SIEM events are not reaching DO SAFE for any project.', messages: [{ id: 'm1', author: 'USR-006', at: clock.ago(1, 2), text: 'Connector shows "Authentication failed (HTTP 401)". Token unchanged.' }, { id: 'm2', author: 'Support', at: clock.ago(0, 3), text: 'Thanks Hannah — we see the HEC token was revoked by an expiry policy on the Splunk side. Can you confirm whether token expiry is set to 90 days?' }] },
    { id: 'SUP-1038', title: 'Request access to Treasury Portal project', category: 'Access & permissions', priority: 'Normal', status: 'resolved', projectId: 'PRJ-04', createdById: 'USR-011', createdAt: clock.ago(3), updatedAt: clock.ago(2), description: 'I cannot see the Treasury Portal project.', impact: 'Single user', messages: [{ id: 'm1', author: 'Support', at: clock.ago(2), text: 'Project access is granted by the project owner — you have been added as Viewer. For changes, use Requests → Request access.' }] },
    { id: 'SUP-1035', title: 'How should we model a shared API gateway used by two applications?', category: 'Onboarding & assets', priority: 'Low', status: 'waiting_on_you', projectId: 'PRJ-01', createdById: 'USR-009', createdAt: clock.ago(5), updatedAt: clock.ago(4), description: 'prod-api-gw-01 fronts both Payments and Digital Banking.', impact: 'Asset mapping accuracy', messages: [{ id: 'm1', author: 'Support', at: clock.ago(4), text: 'Keep the gateway in the application that owns it and link it from the other application in Asset mapping. Could you share which team operates it?' }] },
  ]
}
