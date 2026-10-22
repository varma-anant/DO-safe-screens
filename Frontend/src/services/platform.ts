// Sign-in, projects, application onboarding (declare → map → connect → test run → full run),
// access requests, user management and support. Demo implementation over the local store.
import type { AccessRequest, Asset, AssetLink, BusinessService, Database, Finding, Invitation, JobRole, OrgRole, Project, ProjectRole, RiskScenario, ScanRun, SupportTicket } from '@/types'
import { getDb, useDbStore } from '@/stores/db'
import { FINDING_TEMPLATES } from '@/data/seed/templates'
import { FULL_STEPS, TEST_STEPS } from '@/data/seed/projects'
import { can, JOB_INFO, projectRoleOf, ROLE_INFO } from '@/utils/permissions'
import { actor, audit, commit, DemoApiError, latency, mustFind, nextId, notify, now, replace, requireCap, uid, userName } from './core'
import { buildFindingFromTemplate } from './api'
import { plural } from '@/utils/format'

const addDays = (iso: string, d: number) => new Date(new Date(iso).getTime() + d * 86_400_000).toISOString()
const me = () => {
  const db = getDb()
  return db.users.find((u) => u.id === db.settings.currentUserId)
}

// ===================================================================== Session

export async function login(email: string, workspace: Database['settings']['workspace']) {
  await latency(1.5, false)
  if (getDb().settings.workspace !== workspace) useDbStore.getState().loadWorkspace(workspace)
  const db = getDb()
  const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
  if (!user) throw new DemoApiError(`We couldn’t find ${email.trim()} in ${db.settings.orgName}. Check the spelling, or ask your administrator for an invite.`)
  if (user.status === 'deactivated') throw new DemoApiError('This account has been switched off. Ask your administrator to turn it back on.')
  if (user.status === 'invited') throw new DemoApiError('You’ve been invited but haven’t accepted yet — open the invitation email first.')
  commit((d) => audit({ ...d, users: d.users.map((u) => (u.id === user.id ? { ...u, lastActiveAt: now() } : u)), settings: { ...d.settings, authenticated: true, currentUserId: user.id, currentProjectId: null } }, { action: 'signed in', entityType: 'settings', entityId: 'session', details: `${user.name} (${ROLE_INFO[user.orgRole].label})`, module: 'Platform', actorId: user.id }))
  return user
}

export function logout() {
  commit((d) => audit({ ...d, settings: { ...d.settings, authenticated: false, currentProjectId: null } }, { action: 'signed out', entityType: 'settings', entityId: 'session', details: userName(d.settings.currentUserId), module: 'Platform' }))
}

export function setCurrentProject(projectId: string | null) {
  commit((d) => ({ ...d, settings: { ...d.settings, currentProjectId: projectId } }))
}

// ===================================================================== Projects

export async function createProject(input: { name: string; description: string; ownerId: string }) {
  requireCap('create_project')
  await latency()
  let created: Project | undefined
  commit((db) => {
    const p: Project = { id: nextId(db.projects, 'PRJ', 2), name: input.name, description: input.description, ownerId: input.ownerId, members: input.ownerId === actor() ? [] : [{ userId: actor(), role: 'owner', addedAt: now() }], createdAt: now(), createdById: actor() }
    created = p
    return audit({ ...db, projects: [...db.projects, p], settings: { ...db.settings, currentProjectId: p.id } }, { action: 'project created', entityType: 'project', entityId: p.id, details: p.name, module: 'Platform' })
  })
  return created!
}

function ensureProjectWrite(db: Database, projectId: string) {
  const u = me()
  if (!u) throw new DemoApiError('Sign in again.')
  if (u.orgRole === 'admin') return
  const role = projectRoleOf(db, projectId, u.id)
  if (role !== 'owner' && role !== 'contributor') throw new DemoApiError('You need owner or contributor access to this project.')
}

// ===================================================================== Application onboarding

export interface AppInput {
  projectId: string
  name: string
  description: string
  appType: BusinessService['appType']
  environment: BusinessService['environment']
  criticality: BusinessService['criticality']
  dataClassification: BusinessService['dataClassification']
  ownerId: string
  regulatoryScope: string[]
}

export async function startApplication(input: AppInput) {
  requireCap('onboard_applications')
  await latency()
  let created: BusinessService | undefined
  commit((db) => {
    ensureProjectWrite(db, input.projectId)
    const app: BusinessService = { id: nextId(db.services.filter((s) => s.id.startsWith('APP')), 'APP'), ...input, revenueDependency: 'Not yet assessed', rtoHours: input.criticality === 'tier-1' ? 2 : 8, status: 'draft', coverage: {}, assetLinks: [], runs: [], onboardingStartedAt: now(), runSchedule: 'Manual' }
    created = app
    return audit({ ...db, services: [...db.services, app] }, { action: 'application onboarding started', entityType: 'service', entityId: app.id, details: `${app.name} in ${db.projects.find((p) => p.id === input.projectId)?.name}`, module: 'CTEM' })
  })
  return created!
}

export type AssetDraft = Pick<Asset, 'name' | 'type' | 'environment' | 'internetExposed' | 'criticality'> & { ipAddress?: string; fqdn?: string }

export async function declareAssets(appId: string, drafts: AssetDraft[]) {
  requireCap('onboard_applications')
  await latency()
  commit((db) => {
    const app = mustFind(db.services, appId, 'Application')
    ensureProjectWrite(db, app.projectId)
    let assets = db.assets
    const created: Asset[] = []
    for (const d of drafts) {
      if (assets.some((a) => a.businessServiceId === appId && a.name.toLowerCase() === d.name.toLowerCase())) continue
      const a: Asset = { id: nextId(assets, 'AST'), name: d.name, type: d.type, environment: d.environment, businessServiceId: appId, ownerId: app.ownerId, ipAddress: d.ipAddress || undefined, fqdn: d.fqdn || undefined, internetExposed: d.internetExposed, criticality: d.criticality, sourceIntegrationIds: [], tags: [d.environment, 'declared'], firstSeen: now(), lastSeen: now(), software: [] }
      assets = [...assets, a]
      created.push(a)
    }
    const status = app.status === 'draft' ? 'assets_declared' : app.status
    return audit({ ...db, assets, services: replace(db.services, { ...app, status }) }, { action: 'assets declared', entityType: 'service', entityId: appId, details: `${plural(created.length, 'asset')}: ${created.map((a) => a.name).join(', ')}`, module: 'CTEM' })
  })
}

export async function removeDeclaredAsset(appId: string, assetId: string) {
  requireCap('onboard_applications')
  await latency(0.4)
  commit((db) => {
    const app = mustFind(db.services, appId, 'Application')
    if (db.findings.some((f) => f.assetId === assetId)) throw new DemoApiError('This asset already has findings and cannot be removed.')
    const coverage = { ...app.coverage }
    delete coverage[assetId]
    return audit({ ...db, assets: db.assets.filter((a) => a.id !== assetId), services: replace(db.services, { ...app, coverage, assetLinks: app.assetLinks.filter((l) => l.sourceAssetId !== assetId && l.targetAssetId !== assetId) }) }, { action: 'asset removed', entityType: 'service', entityId: appId, details: assetId, module: 'CTEM' })
  })
}

export async function saveAssetLinks(appId: string, links: Omit<AssetLink, 'id'>[]) {
  requireCap('onboard_applications')
  await latency(0.6)
  commit((db) => {
    const app = mustFind(db.services, appId, 'Application')
    ensureProjectWrite(db, app.projectId)
    const assetLinks = links.map((l, i) => ({ ...l, id: `${appId}-L${i + 1}` }))
    const status = ['draft', 'assets_declared'].includes(app.status) ? 'mapped' : app.status
    return audit({ ...db, services: replace(db.services, { ...app, assetLinks, status }) }, { action: 'asset map saved', entityType: 'service', entityId: appId, details: `${plural(assetLinks.length, 'link')}`, module: 'CTEM' })
  })
}

export async function saveCoverage(appId: string, coverage: Record<string, string[]>) {
  requireCap('onboard_applications')
  await latency(0.6)
  commit((db) => {
    const app = mustFind(db.services, appId, 'Application')
    ensureProjectWrite(db, app.projectId)
    const status = ['draft', 'assets_declared', 'mapped', 'test_failed'].includes(app.status) ? 'connected' : app.status
    return audit({ ...db, assets: db.assets.map((a) => (coverage[a.id] ? { ...a, sourceIntegrationIds: coverage[a.id] } : a)), services: replace(db.services, { ...app, coverage, status }) }, { action: 'sources assigned', entityType: 'service', entityId: appId, details: `${plural(Object.values(coverage).filter((v) => v.length).length, 'asset')} covered`, module: 'Integrations' })
  })
}

/** Simulated connector authorization used during onboarding: read-only, scoped, no findings imported. */
export async function quickConnectIntegration(integrationId: string, scope?: string) {
  requireCap('manage_integrations')
  await latency(2)
  commit((db) => {
    const i = mustFind(db.integrations, integrationId, 'Integration')
    const sc = scope ?? i.config?.scope ?? `${db.settings.orgName} — all environments`
    return audit({ ...db, integrations: replace(db.integrations, { ...i, status: 'connected', health: 100, lastSyncAt: now(), config: { endpoint: i.config?.endpoint ?? `https://api.${i.vendor.toLowerCase().replace(/[^a-z]/g, '')}.example`, authMethod: 'Read-only authorization (simulated)', scope: sc, syncInterval: i.config?.syncInterval ?? 'Hourly', testedAt: now(), testResult: 'success' } }) }, { action: 'integration connected with read-only access (simulated)', entityType: 'integration', entityId: integrationId, details: `${i.name} · scope: ${sc}`, module: 'Integrations' })
  })
}

function patchApp(db: Database, appId: string, fn: (a: BusinessService) => BusinessService): Database {
  return { ...db, services: replace(db.services, fn(mustFind(db.services, appId, 'Application'))) }
}

function patchRun(db: Database, appId: string, runId: string, fn: (r: ScanRun) => ScanRun): Database {
  return patchApp(db, appId, (a) => ({ ...a, runs: a.runs.map((r) => (r.id === runId ? fn(r) : r)) }))
}

/** Per-asset readiness result for a test run — deterministic so the demo can show a fix-and-retry loop. */
function assessAsset(db: Database, app: BusinessService, a: Asset): ScanRun['assetResults'][number] {
  const sources = app.coverage[a.id] ?? []
  if (!sources.length) return { assetId: a.id, reachable: false, credentialsOk: false, sourceIds: [], note: 'No tool is checking this part yet — assign one.' }
  const disconnected = sources.map((s) => db.integrations.find((i) => i.id === s)).filter((i) => i && i.status !== 'connected')
  if (disconnected.length) return { assetId: a.id, reachable: true, credentialsOk: false, sourceIds: sources, note: `${disconnected.map((i) => (i!.id === 'INT-ASM' ? 'The outside-in monitor' : i!.vendor)).join(' and ')} ${disconnected.length > 1 ? 'aren’t' : 'isn’t'} connected yet — connect ${disconnected.length > 1 ? 'them' : 'it'} to check this part.` }
  const onlyExternal = sources.every((s) => s === 'INT-ASM')
  if (onlyExternal && !a.internetExposed) return { assetId: a.id, reachable: false, credentialsOk: true, sourceIds: sources, note: 'The outside-in monitor can’t see inside your network — add a cloud or server tool for this part.' }
  return { assetId: a.id, reachable: true, credentialsOk: true, sourceIds: sources, note: 'Reachable, access works, sample check returned data.' }
}

export async function startTestRun(appId: string) {
  requireCap('run_scans')
  await latency(0.3)
  const db0 = getDb()
  const app = mustFind(db0.services, appId, 'Application')
  if (app.runs.some((r) => r.status === 'running')) throw new DemoApiError('A run is already in progress.')
  const assets = db0.assets.filter((a) => a.businessServiceId === appId && !a.duplicateOfId)
  if (!assets.length) throw new DemoApiError('Declare assets before running a test.')
  const runId = uid('RUN')
  const run: ScanRun = { id: runId, kind: 'test', status: 'running', startedAt: now(), startedById: actor(), steps: TEST_STEPS.map((name) => ({ name, status: 'pending', detail: 'Queued' })), assetResults: [], findingIds: [], summary: 'Test run in progress — no findings will be created.' }
  commit((db) => audit(patchApp(db, appId, (a) => ({ ...a, runs: [run, ...a.runs] })), { action: 'test run started', entityType: 'service', entityId: appId, details: runId, module: 'CTEM' }))
  animateSteps(appId, runId, TEST_STEPS.length, 650, (db) => {
    const a = mustFind(db.services, appId, 'Application')
    const results = assets.map((x) => assessAsset(db, a, x))
    const failed = results.filter((r) => !r.reachable || !r.credentialsOk).length
    const status: ScanRun['status'] = failed ? 'failed' : 'passed'
    let next = patchRun(db, appId, runId, (r) => ({ ...r, status, finishedAt: now(), assetResults: results, steps: r.steps.map((s, i) => ({ ...s, status: failed && i >= 1 && i <= 2 ? 'warning' : 'done', detail: failed && i >= 1 && i <= 2 ? `${failed} ${failed === 1 ? 'part needs' : 'parts need'} attention` : 'Completed' })), summary: failed ? `${failed} of ${assets.length} parts aren’t ready yet. Each one below says what to do.` : `All ${assets.length} parts are reachable and every tool’s access works. Nothing was changed and no problems were reported yet — you can turn on protection.` }))
    next = patchApp(next, appId, (x) => ({ ...x, status: x.status === 'active' ? 'active' : failed ? 'test_failed' : 'test_passed' }))
    return audit(next, { action: `test run ${status}`, entityType: 'service', entityId: appId, details: `${assets.length - failed}/${assets.length} assets ready`, module: 'CTEM', actorId: 'SYSTEM' })
  })
  return runId
}

/** Chooses detection templates for an asset deterministically (same asset name → same findings). */
function templatesFor(asset: Asset) {
  const pool = FINDING_TEMPLATES.filter((t) => !t.assetTypes || t.assetTypes.includes(asset.type))
  if (!pool.length) return []
  const h = [...asset.name].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7)
  const picks = [pool[h % pool.length]]
  if (pool.length > 1 && h % 3 !== 0) picks.push(pool[(h >> 3) % pool.length])
  return [...new Set(picks)]
}

export async function startFullRun(appId: string) {
  requireCap('run_scans')
  await latency(0.3)
  const db0 = getDb()
  const app = mustFind(db0.services, appId, 'Application')
  if (app.runs.some((r) => r.status === 'running')) throw new DemoApiError('A run is already in progress.')
  if (app.status !== 'test_passed' && app.status !== 'active') throw new DemoApiError('Run a successful test first. A full run only starts after the test run passes.')
  const runId = uid('RUN')
  const run: ScanRun = { id: runId, kind: 'full', status: 'running', startedAt: now(), startedById: actor(), steps: FULL_STEPS.map((name) => ({ name, status: 'pending', detail: 'Queued' })), assetResults: [], findingIds: [], summary: 'Full assessment in progress (simulated).' }
  commit((db) => audit(patchApp(db, appId, (a) => ({ ...a, runs: [run, ...a.runs] })), { action: 'full run started', entityType: 'service', entityId: appId, details: runId, module: 'CTEM' }))
  animateSteps(appId, runId, FULL_STEPS.length, 850, (db) => {
    const a = mustFind(db.services, appId, 'Application')
    const assets = db.assets.filter((x) => x.businessServiceId === appId && !x.duplicateOfId)
    const firstRun = a.status !== 'active'
    let next = db
    const created: Finding[] = []
    for (const asset of assets) {
      const tpls = firstRun ? templatesFor(asset) : templatesFor(asset).slice(0, Math.random() < 0.3 ? 1 : 0)
      for (const t of tpls) {
        if (next.findings.some((f) => f.assetId === asset.id && f.templateKey === t.key)) continue
        const srcId = (a.coverage[asset.id] ?? [])[0] ?? 'INT-ASM'
        const src = next.integrations.find((i) => i.id === srcId)!
        const f = buildFindingFromTemplate(next, t, asset, src, `found by the ${firstRun ? 'first' : 'scheduled'} full run of ${a.name}`, ['onboarding-run'])
        next = { ...next, findings: [f, ...next.findings] }
        created.push(f)
      }
    }
    // Re-observe existing findings on this application.
    next = { ...next, findings: next.findings.map((f) => (f.businessServiceId === appId && !created.includes(f) && !['resolved', 'false_positive'].includes(f.status) ? { ...f, lastObserved: now() } : f)) }
    next = { ...next, assets: next.assets.map((x) => (x.businessServiceId === appId ? { ...x, lastSeen: now(), tags: x.tags.filter((t) => t !== 'declared' && t !== 'onboarding') } : x)) }
    next = patchRun(next, appId, runId, (r) => ({ ...r, status: 'completed', finishedAt: now(), findingIds: created.map((f) => f.id), assetResults: assets.map((x) => ({ assetId: x.id, reachable: true, credentialsOk: true, sourceIds: a.coverage[x.id] ?? [], note: `${created.filter((f) => f.assetId === x.id).length} new` })), steps: r.steps.map((s) => ({ ...s, status: 'done', detail: 'Completed (simulated)' })), summary: `Checked ${assets.length} parts — found ${created.length} ${created.length === 1 ? 'problem' : 'problems'}${created.filter((f) => f.severity === 'critical').length ? `, ${created.filter((f) => f.severity === 'critical').length} urgent` : ''}.` }))
    next = patchApp(next, appId, (x) => ({ ...x, status: x.status === 'paused' ? 'paused' : 'active', protectedSince: x.protectedSince ?? now(), nextRunAt: addDays(now(), 1), runSchedule: x.runSchedule === 'Manual' ? 'Daily' : x.runSchedule }))
    if (firstRun && !next.scenarios.some((s) => s.businessServiceId === appId)) next = { ...next, scenarios: [...next.scenarios, starterScenario(next, a, created)] }
    next = audit(next, { action: 'full run completed', entityType: 'service', entityId: appId, details: `${created.length} findings`, module: 'CTEM', actorId: 'SYSTEM' })
    return notify(next, { title: firstRun ? `Protection is on for ${a.name}` : `Check completed — ${a.name}`, body: `${created.length} ${created.length === 1 ? 'problem' : 'problems'} found. ${firstRun ? 'DO SAFE checks it every day from now on.' : ''}`, link: `/applications/${appId}`, severity: created.some((f) => f.severity === 'critical') ? 'critical' : 'info' })
  })
  return runId
}

function starterScenario(db: Database, app: BusinessService, findings: Finding[]): RiskScenario {
  const ctl = db.controls.find((c) => c.id === 'CTL-VM')
  return {
    id: nextId(db.scenarios, 'RSK', 3),
    name: `Data breach of ${app.name}`,
    description: `Compromise of ${app.name} through an exploitable exposure leading to unauthorized data access. Created automatically after the first full run — refine the assumptions with Finance.`,
    threatActor: 'Opportunistic external actor',
    threatType: 'Data breach',
    businessServiceId: app.id,
    findingIds: findings.map((f) => f.id),
    vendorIds: [],
    aiSystemIds: [],
    controls: ctl ? [{ controlId: ctl.id, relevance: 0.5 }] : [],
    params: { baseAEP: app.criticality === 'tier-1' ? 0.2 : 0.12, lossLow: 250_000, lossMostLikely: app.criticality === 'tier-1' ? 3_000_000 : 1_200_000, lossHigh: 9_000_000, controlEffectiveness: ctl ? { [ctl.id]: ctl.effectiveness } : {} },
    lossComponents: [{ component: 'Incident response & forensics', share: 0.2 }, { component: 'Regulatory & legal', share: 0.3 }, { component: 'Customer notification & remediation', share: 0.25 }, { component: 'Reputation', share: 0.25 }],
    assumptions: ['Starter assumptions generated at onboarding — not yet reviewed', 'Loss ranges are illustrative defaults by criticality tier'],
    savedSimulations: [],
  }
}

function animateSteps(appId: string, runId: string, count: number, ms: number, finish: (db: Database) => Database) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => commit((db) => patchRun(db, appId, runId, (r) => ({ ...r, steps: r.steps.map((s, k) => (k === i ? { ...s, status: 'running', detail: 'Running (simulated)' } : k < i ? { ...s, status: 'done', detail: 'Completed' } : s)) }))), ms * i + 150)
  }
  setTimeout(() => commit(finish), ms * count + 300)
}

export async function setMonitoring(appId: string, paused: boolean) {
  requireCap('run_scans')
  await latency(0.5)
  commit((db) => audit(patchApp(db, appId, (a) => ({ ...a, status: paused ? 'paused' : 'active' })), { action: paused ? 'monitoring paused' : 'monitoring resumed', entityType: 'service', entityId: appId, details: '', module: 'CTEM' }))
}

export async function deleteDraftApplication(appId: string) {
  requireCap('onboard_applications')
  await latency(0.5)
  commit((db) => {
    const app = mustFind(db.services, appId, 'Application')
    if (app.status === 'active' || app.runs.some((r) => r.kind === 'full')) throw new DemoApiError('Applications with a completed full run cannot be deleted.')
    return audit({ ...db, services: db.services.filter((s) => s.id !== appId), assets: db.assets.filter((a) => a.businessServiceId !== appId) }, { action: 'draft application deleted', entityType: 'service', entityId: appId, details: app.name, module: 'CTEM' })
  })
}

// ===================================================================== Access requests

export async function createAccessRequest(input: Pick<AccessRequest, 'kind' | 'projectId' | 'requestedRole' | 'justification' | 'durationDays'>) {
  await latency()
  const u = me()
  if (!u) throw new DemoApiError('Sign in again.')
  let created: AccessRequest | undefined
  commit((db) => {
    const id = nextId(db.accessRequests, 'AR', 3)
    const risk: AccessRequest['risk'] = input.requestedRole === 'Administrator' ? 'high' : input.requestedRole === 'Owner' || input.requestedRole === 'Contributor' ? 'medium' : 'low'
    const r: AccessRequest = { id, requesterId: u.id, ...input, risk, status: 'pending', createdAt: now() }
    created = r
    const next = audit({ ...db, accessRequests: [r, ...db.accessRequests] }, { action: 'access requested', entityType: 'settings', entityId: id, details: `${input.kind}: ${input.requestedRole}${input.projectId ? ` on ${db.projects.find((p) => p.id === input.projectId)?.name}` : ''}`, module: 'Platform' })
    return notify(next, { title: 'New access request', body: `${u.name} requested ${input.requestedRole}${input.projectId ? ` on ${db.projects.find((p) => p.id === input.projectId)?.name}` : ''}`, link: '/admin/requests', severity: 'info' })
  })
  return created!
}

export async function decideAccessRequest(id: string, approve: boolean, note: string) {
  await latency()
  const u = me()
  commit((db) => {
    const r = mustFind(db.accessRequests, id, 'Access request')
    if (r.status !== 'pending') throw new DemoApiError('This request has already been decided.')
    if (r.requesterId === u?.id) throw new DemoApiError('You cannot decide your own request.')
    if (r.kind === 'Role change' && !can(u, 'manage_users')) throw new DemoApiError('Only administrators can approve role changes.')
    if (r.kind !== 'Role change') {
      const isOwner = r.projectId && u && projectRoleOf(db, r.projectId, u.id) === 'owner'
      if (!(can(u, 'manage_users') || (isOwner && can(u, 'decide_access_requests')))) throw new DemoApiError('Only administrators or the project owner can decide this request.')
    }
    let next: Database = { ...db, accessRequests: replace(db.accessRequests, { ...r, status: approve ? 'approved' : 'declined', reviewerId: u!.id, decidedAt: now(), decisionNote: note }) }
    if (approve && r.kind === 'Project access' && r.projectId) {
      const role = (r.requestedRole.toLowerCase() as ProjectRole) ?? 'viewer'
      next = { ...next, projects: next.projects.map((p) => (p.id === r.projectId ? { ...p, members: [...p.members.filter((m) => m.userId !== r.requesterId), { userId: r.requesterId, role, addedAt: now() }] } : p)) }
    }
    if (approve && r.kind === 'Role change') {
      const map: Record<string, OrgRole> = { Administrator: 'admin', 'Security Analyst': 'analyst', 'Project Owner': 'project_owner', Viewer: 'viewer' }
      next = { ...next, users: next.users.map((x) => (x.id === r.requesterId && map[r.requestedRole] ? { ...x, orgRole: map[r.requestedRole] } : x)) }
    }
    next = audit(next, { action: `access request ${approve ? 'approved' : 'declined'}`, entityType: 'settings', entityId: id, details: `${userName(r.requesterId)} · ${r.requestedRole}${note ? ` · ${note}` : ''}`, module: 'Platform' })
    return notify(next, { title: `Access request ${approve ? 'approved' : 'declined'}`, body: `${id}: ${r.requestedRole} for ${userName(r.requesterId)}`, link: '/admin/requests', severity: 'info' })
  })
}

// ===================================================================== User management

export async function inviteUser(input: Pick<Invitation, 'name' | 'email' | 'orgRole' | 'job' | 'projectIds'>) {
  requireCap('manage_users')
  await latency()
  commit((db) => {
    if (db.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase()) || db.invitations.some((i) => i.email.toLowerCase() === input.email.toLowerCase() && i.status === 'pending')) throw new DemoApiError('That email already has an account or a pending invitation.')
    const inv: Invitation = { id: nextId(db.invitations, 'INV', 3), ...input, invitedById: actor(), sentAt: now(), status: 'pending' }
    return audit({ ...db, invitations: [inv, ...db.invitations] }, { action: 'user invited', entityType: 'settings', entityId: inv.id, details: `${input.email} as ${ROLE_INFO[input.orgRole].label}${input.job ? ` · ${JOB_INFO[input.job].label}` : ''}`, module: 'Platform' })
  })
}

export async function setInvitationStatus(id: string, status: 'accepted' | 'revoked') {
  requireCap('manage_users')
  await latency(0.6)
  commit((db) => {
    const inv = mustFind(db.invitations, id, 'Invitation')
    let next: Database = { ...db, invitations: replace(db.invitations, { ...inv, status }) }
    if (status === 'accepted') {
      const uidv = nextId(db.users.filter((u) => u.id.startsWith('USR') || u.id.startsWith('ACM')), db.settings.workspace === 'acme' ? 'ACM' : 'USR', 3)
      const initials = inv.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
      next = { ...next, users: [...next.users, { id: uidv, name: inv.name, role: inv.orgRole === 'analyst' ? 'Security Analyst' : 'Engineering Owner', team: 'Invited user', email: inv.email, initials, orgRole: inv.orgRole, job: inv.job ?? (inv.orgRole === 'viewer' ? 'employee' : inv.orgRole === 'project_owner' ? 'project_owner' : inv.orgRole === 'executive' ? 'executive' : inv.orgRole === 'admin' ? 'platform_admin' : 'security_analyst'), status: 'active', mfaEnabled: false }], projects: next.projects.map((p) => (inv.projectIds.includes(p.id) ? { ...p, members: [...p.members, { userId: uidv, role: inv.orgRole === 'viewer' ? 'viewer' : 'contributor', addedAt: now() }] } : p)) }
    }
    return audit(next, { action: `invitation ${status}`, entityType: 'settings', entityId: id, details: inv.email, module: 'Platform' })
  })
}

export async function changeUserRole(userId: string, orgRole: OrgRole) {
  requireCap('manage_users')
  await latency(0.6)
  commit((db) => {
    const u = mustFind(db.users, userId, 'User')
    if (u.orgRole === 'admin' && orgRole !== 'admin' && db.users.filter((x) => x.orgRole === 'admin' && x.status === 'active').length <= 1) throw new DemoApiError('At least one active administrator is required.')
    if (userId === actor()) throw new DemoApiError('You cannot change your own role.')
    return audit({ ...db, users: replace(db.users, { ...u, orgRole }) }, { action: 'role changed', entityType: 'settings', entityId: userId, details: `${u.name}: ${ROLE_INFO[u.orgRole].label} → ${ROLE_INFO[orgRole].label}`, module: 'Platform' })
  })
}

export async function changeUserJob(userId: string, job: JobRole) {
  requireCap('manage_users')
  await latency(0.6)
  commit((db) => {
    const u = mustFind(db.users, userId, 'User')
    return audit({ ...db, users: replace(db.users, { ...u, job }) }, { action: 'job changed', entityType: 'settings', entityId: userId, details: `${u.name}: ${JOB_INFO[u.job].label} → ${JOB_INFO[job].label}`, module: 'Platform' })
  })
}

export async function setUserStatus(userId: string, status: 'active' | 'deactivated') {
  requireCap('manage_users')
  await latency(0.6)
  commit((db) => {
    if (userId === actor()) throw new DemoApiError('You cannot deactivate your own account.')
    const u = mustFind(db.users, userId, 'User')
    return audit({ ...db, users: replace(db.users, { ...u, status }) }, { action: status === 'active' ? 'user reactivated' : 'user deactivated', entityType: 'settings', entityId: userId, details: `${u.name}${status === 'deactivated' ? ' — sessions revoked, project ownership preserved' : ''}`, module: 'Platform' })
  })
}

export async function setProjectMember(projectId: string, userId: string, role: ProjectRole | null) {
  await latency(0.5)
  commit((db) => {
    const p = mustFind(db.projects, projectId, 'Project')
    const u = me()
    if (!(can(u, 'manage_users') || (u && projectRoleOf(db, projectId, u.id) === 'owner' && can(u, 'decide_access_requests')))) throw new DemoApiError('Only administrators or the project owner can change project membership.')
    if (p.ownerId === userId && role !== 'owner') throw new DemoApiError('Transfer project ownership before changing the owner’s access.')
    const members = role ? [...p.members.filter((m) => m.userId !== userId), { userId, role, addedAt: now() }] : p.members.filter((m) => m.userId !== userId)
    return audit({ ...db, projects: replace(db.projects, { ...p, members }) }, { action: role ? 'project access granted' : 'project access removed', entityType: 'project', entityId: projectId, details: `${userName(userId)}${role ? ` as ${role}` : ''}`, module: 'Platform' })
  })
}

// ===================================================================== Support

export async function createSupportTicket(input: Pick<SupportTicket, 'title' | 'category' | 'priority' | 'projectId' | 'description' | 'impact'>) {
  await latency()
  let created: SupportTicket | undefined
  commit((db) => {
    const id = `SUP-${1000 + db.supportTickets.length + 43}`
    const t: SupportTicket = { id, ...input, status: 'submitted', createdById: actor(), createdAt: now(), updatedAt: now(), messages: [{ id: uid('M'), author: actor(), at: now(), text: input.description }] }
    created = t
    return audit({ ...db, supportTickets: [t, ...db.supportTickets] }, { action: 'support ticket created', entityType: 'settings', entityId: id, details: input.title, module: 'Platform' })
  })
  const id = created!.id
  // Simulated support acknowledgement.
  setTimeout(() => commit((db) => ({ ...db, supportTickets: db.supportTickets.map((t) => (t.id === id ? { ...t, status: 'triage', updatedAt: now(), messages: [...t.messages, { id: uid('M'), author: 'Support', at: now(), text: 'Thanks — we have your request and a support engineer is reviewing it. (Simulated reply: no help desk is connected in this demo.)' }] } : t)) })), 2500)
  return created!
}

export async function addSupportMessage(id: string, text: string) {
  await latency(0.4)
  commit((db) => ({ ...db, supportTickets: db.supportTickets.map((t) => (t.id === id ? { ...t, status: t.status === 'waiting_on_you' ? 'investigating' : t.status, updatedAt: now(), messages: [...t.messages, { id: uid('M'), author: actor(), at: now(), text }] } : t)) }))
}

export async function setSupportStatus(id: string, status: SupportTicket['status']) {
  await latency(0.4)
  commit((db) => audit({ ...db, supportTickets: db.supportTickets.map((t) => (t.id === id ? { ...t, status, updatedAt: now() } : t)) }, { action: `support ticket ${status}`, entityType: 'settings', entityId: id, details: '', module: 'Platform' }))
}

