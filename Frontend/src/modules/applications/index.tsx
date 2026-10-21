import * as React from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { createColumnHelper } from '@tanstack/react-table'
import { AppWindow, ArrowRight, Calculator, CheckCircle2, FolderKanban, Loader2, MoreHorizontal, Pause, Play, Plus, Rocket, Save, ShieldCheck, Siren, Trash2, UserPlus, Users, Waypoints } from 'lucide-react'
import type { AssetLink, BusinessService, ProjectRole } from '@/types'
import { useAction, useCan, useCollections, useCurrentUser, useSettings, useUsers } from '@/hooks/queries'
import { usePage } from '@/hooks/usePage'
import { Callout, EmptyState, ErrorState, KeyValue, KpiCard, LoadingState, NotFound, PageHeader, Section, Stat } from '@/components/common/layout'
import { Badge, CriticalityBadge, FindingStatusBadge, RiskScore, SeverityBadge, StatusBadge } from '@/components/common/badges'
import { EntityLink, RelTime, Timeline, UserName } from '@/components/common/entities'
import { DataTable } from '@/components/common/DataTable'
import { AssetMap } from '@/components/common/AssetMap'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Progress } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, NativeSelect } from '@/components/ui/input'
import { FindingsTable } from '@/modules/findings/FindingsTable'
import * as api from '@/services/api'
import { useDbStore } from '@/stores/db'
import { fmtDateTime, fmtMoney, plural } from '@/utils/format'
import { ASSET_TYPE_LABEL, INCIDENT_STATUS, isOpen, SEVERITY_COLOR } from '@/utils/labels'
import { computeScenario } from '@/utils/risk'
import { scoreFindings } from '@/utils/derive'
import { projectRoleOf } from '@/utils/permissions'

export const APP_STATUS: Record<BusinessService['status'], { label: string; tone: 'emerald' | 'violet' | 'amber' | 'red' | 'slate' | 'sky'; step: number }> = {
  draft: { label: 'Setting up — list its parts', tone: 'slate', step: 2 },
  assets_declared: { label: 'Setting up — connect the parts', tone: 'sky', step: 3 },
  mapped: { label: 'Setting up — connect tools', tone: 'sky', step: 4 },
  connected: { label: 'Ready for test run', tone: 'violet', step: 5 },
  test_failed: { label: 'Test run needs fixes', tone: 'red', step: 5 },
  test_passed: { label: 'Ready to turn on protection', tone: 'amber', step: 6 },
  active: { label: 'Protected', tone: 'emerald', step: 7 },
  paused: { label: 'Paused', tone: 'slate', step: 7 },
}

const SEVS = ['critical', 'high', 'medium', 'low'] as const

function SevBar({ counts }: { counts: number[] }) {
  const total = counts.reduce((a, b) => a + b, 0)
  if (!total) return <span className="text-xs text-subtle">No open findings</span>
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-2 w-24 overflow-hidden rounded-full bg-surface-3">
        {counts.map((n, i) => (n ? <div key={i} style={{ width: `${(n / total) * 100}%`, background: SEVERITY_COLOR[SEVS[i]] }} className="border-r border-white last:border-0" /> : null))}
      </div>
      <span className="num text-xs text-muted">{total}</span>
    </div>
  )
}

function OnboardingProgress({ app }: { app: BusinessService }) {
  const s = APP_STATUS[app.status]
  return (
    <div className="w-40">
      <div className="mb-1 flex justify-between text-[11px] text-muted">
        <span>Step {Math.min(s.step, 7)} of 7</span>
      </div>
      <Progress value={(Math.min(s.step - 1, 6) / 6) * 100} tone={app.status === 'test_failed' ? 'red' : 'violet'} />
    </div>
  )
}

// ============================================================ SAFE applications

const col = createColumnHelper<BusinessService & { projectName: string; open: number[]; assets: number; risk: number; lastRun?: string }>()

export function ApplicationsPage() {
  usePage('SAFE applications', [{ label: 'Workspace' }, { label: 'SAFE applications' }])
  const navigate = useNavigate()
  const settings = useSettings()
  const canOnboard = useCan('onboard_applications')
  const canRun = useCan('run_scans')
  const { run } = useAction()
  const { data, isLoading, error, retry } = useCollections(['services', 'projects', 'assets', 'findings'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={8} />
  const { services, projects, assets, findings } = data
  const scored = scoreFindings(findings, assets, services, settings.weights)
  const rows = services.map((s) => {
    const open = scored.filter((x) => x.f.businessServiceId === s.id && isOpen(x.f.status))
    return { ...s, projectName: projects.find((p) => p.id === s.projectId)?.name ?? '—', open: SEVS.map((v) => open.filter((x) => x.f.severity === v).length), assets: assets.filter((a) => a.businessServiceId === s.id && !a.duplicateOfId && !a.possibleDuplicateOfId).length, risk: open.length ? Math.max(...open.map((x) => x.score)) : 0, lastRun: s.runs.find((r) => r.kind === 'full')?.finishedAt }
  })
  const safe = rows.filter((r) => r.status === 'active' || r.status === 'paused')
  const onboarding = rows.filter((r) => !(r.status === 'active' || r.status === 'paused'))
  const columns = [
    col.accessor('name', { header: 'Application', cell: (c) => <div><div className="font-medium">{c.getValue()}</div><div className="text-[11.5px] text-subtle">{c.row.original.appType} · {c.row.original.environment}</div></div> }),
    col.accessor('projectName', { id: 'project', header: 'Project', filterFn: 'multi', cell: (c) => <span className="text-muted">{c.getValue()}</span> }),
    col.accessor('criticality', { header: 'Criticality', filterFn: 'multi', cell: (c) => <CriticalityBadge value={c.getValue()} /> }),
    col.accessor('status', { header: 'Status', filterFn: 'multi', cell: (c) => <StatusBadge map={APP_STATUS} value={c.getValue()} /> }),
    col.accessor('assets', { header: 'Assets' }),
    col.accessor((r) => r.open.reduce((a, b) => a + b, 0), { id: 'open', header: 'Open findings', cell: (c) => <SevBar counts={c.row.original.open} /> }),
    col.accessor('risk', { header: 'Top risk', cell: (c) => (c.getValue() ? <RiskScore score={c.getValue()} /> : <span className="text-subtle">—</span>) }),
    col.accessor((r) => Object.values(r.coverage).flat().filter((v, i, a) => a.indexOf(v) === i).length, { id: 'sources', header: 'Sources' }),
    col.accessor('lastRun', { header: 'Last full run', cell: (c) => <RelTime iso={c.getValue()} /> }),
    col.accessor('nextRunAt', { header: 'Next run', cell: (c) => (c.row.original.status === 'paused' ? <span className="text-subtle">Paused</span> : <RelTime iso={c.getValue()} />) }),
    col.display({
      id: 'actions',
      header: '',
      cell: (c) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.row.original.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem disabled={!canRun || c.row.original.status === 'paused'} onSelect={() => run(() => api.startFullRun(c.row.original.id), 'Full run started')}>
                <Play /> Run full assessment now
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canRun} onSelect={() => run(() => api.setMonitoring(c.row.original.id, c.row.original.status !== 'paused'), c.row.original.status === 'paused' ? 'Monitoring resumed' : 'Paused')}>
                <Pause /> {c.row.original.status === 'paused' ? 'Resume monitoring' : 'Pause monitoring'}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate(`/mapping?app=${c.row.original.id}`)}>
                <Waypoints /> Open asset map
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    }),
  ]
  return (
    <div className="space-y-5">
      <PageHeader title="SAFE applications" icon={<ShieldCheck />} description="Applications whose assets are mapped, connected and under continuous assessment. Applications still being onboarded are listed with their next step." actions={canOnboard && <Button onClick={() => navigate('/onboarding?new=1')}><Plus /> Onboard application</Button>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Protected applications" value={safe.filter((r) => r.status === 'active').length} tone="green" sub={`${safe.filter((r) => r.status === 'paused').length} paused`} />
        <KpiCard label="In onboarding" value={onboarding.length} tone="violet" sub={onboarding.length ? onboarding.map((o) => o.name).join(', ') : 'None'} />
        <KpiCard label="Assets under assessment" value={safe.reduce((s, r) => s + r.assets, 0)} />
        <KpiCard label="Open critical findings" value={safe.reduce((s, r) => s + r.open[0], 0)} tone="red" onClick={() => navigate('/operations/findings?severity=critical&status=new,triaged,in_validation,validated,in_remediation,pending_verification')} />
      </div>
      {onboarding.length > 0 && (
        <Section title="Onboarding in progress" description="Pick up where the team left off">
          <div className="divide-y divide-border">
            {onboarding.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium">{o.name}</div>
                  <div className="text-xs text-muted">{o.projectName} · {plural(o.assets, 'asset')} declared · started <RelTime iso={o.onboardingStartedAt} /></div>
                </div>
                <StatusBadge map={APP_STATUS} value={o.status} />
                <OnboardingProgress app={o} />
                {canOnboard ? (
                  <Button size="sm" onClick={() => navigate(`/onboarding?app=${o.id}`)}>
                    Continue <ArrowRight />
                  </Button>
                ) : (
                  <span className="text-xs text-subtle">Owner: <UserName id={o.ownerId} avatar={false} /></span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
      {safe.length ? (
        <DataTable tableId="safe-apps" data={safe} columns={columns} getRowId={(r) => r.id} onRowClick={(r) => navigate(`/applications/${r.id}`)} facets={[{ columnId: 'project', label: 'Project' }, { columnId: 'criticality', label: 'Criticality' }]} searchPlaceholder="Search applications…" selectable={false} exportName="do-safe-applications" />
      ) : (
        <Card>
          <EmptyState icon={<Rocket />} title="No SAFE applications yet" description="Onboard your first application: declare its assets, map them, connect your tools, run a test and then a full assessment." action={canOnboard && <Button onClick={() => navigate('/onboarding?new=1')}><Plus /> Onboard application</Button>} />
        </Card>
      )}
    </div>
  )
}

// ============================================================ Application detail

export function ApplicationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const settings = useSettings()
  const canRun = useCan('run_scans')
  const canOnboard = useCan('onboard_applications')
  const { run, pending } = useAction()
  const { data, isLoading, error, retry } = useCollections(['services', 'projects', 'assets', 'findings', 'scenarios', 'vendors', 'aiSystems', 'incidents', 'attackPaths', 'integrations'] as const, { ignoreProjectFilter: true })
  const app = data?.services.find((s) => s.id === id)
  usePage(app?.name ?? 'Application', [{ label: 'SAFE applications', to: '/applications' }, { label: app?.name ?? id ?? '' }])
  React.useEffect(() => {
    if (app) api.recordRecent('service', app.id, app.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.id])
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={5} rows={8} />
  if (!app) return <NotFound what="Application" back={{ to: '/applications', label: 'Back to SAFE applications' }} />
  const project = data.projects.find((p) => p.id === app.projectId)
  const assets = data.assets.filter((a) => a.businessServiceId === app.id && !a.duplicateOfId && !a.possibleDuplicateOfId)
  const fs = scoreFindings(data.findings.filter((f) => f.businessServiceId === app.id), data.assets, data.services, settings.weights)
  const open = fs.filter((x) => isOpen(x.f.status))
  const openByAsset = Object.fromEntries(assets.map((a) => [a.id, open.filter((x) => x.f.assetId === a.id).length]))
  const scenarios = data.scenarios.filter((s) => s.businessServiceId === app.id)
  const ale = scenarios.reduce((s, x) => s + computeScenario(x, data.findings).ale, 0)
  const vendors = data.vendors.filter((v) => v.businessServiceIds.includes(app.id))
  const ais = data.aiSystems.filter((a) => a.businessServiceId === app.id)
  const incidents = data.incidents.filter((i) => i.businessServiceIds.includes(app.id))
  const paths = data.attackPaths.filter((p) => p.businessServiceId === app.id)
  const running = app.runs.some((r) => r.status === 'running')
  const protectedApp = app.status === 'active' || app.status === 'paused'
  const sources = [...new Set(Object.values(app.coverage).flat())]
  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/applications', label: 'SAFE applications' }}
        title={app.name}
        icon={<AppWindow />}
        description={app.description}
        badges={<><StatusBadge map={APP_STATUS} value={app.status} /><CriticalityBadge value={app.criticality} /></>}
        actions={
          protectedApp ? (
            <>
              <Button variant="secondary" disabled={!canRun} onClick={() => run(() => api.setMonitoring(app.id, app.status !== 'paused'), app.status === 'paused' ? 'Monitoring resumed' : 'Paused')}>
                {app.status === 'paused' ? <Play /> : <Pause />} {app.status === 'paused' ? 'Resume monitoring' : 'Pause monitoring'}
              </Button>
              <Button disabled={!canRun || running || app.status === 'paused'} loading={pending} onClick={() => run(() => api.startFullRun(app.id), 'Full run started')}>
                {running ? <Loader2 className="animate-spin" /> : <Play />} {running ? 'Run in progress…' : 'Run full assessment'}
              </Button>
            </>
          ) : (
            canOnboard && (
              <>
                {app.runs.every((r) => r.kind !== 'full') && (
                  <Button variant="ghost" onClick={async () => { await run(() => api.deleteDraftApplication(app.id), 'Draft application deleted'); if (!useDbStore.getState().db.services.some((s) => s.id === app.id)) navigate('/applications') }}>
                    <Trash2 /> Delete draft
                  </Button>
                )}
                <Button onClick={() => navigate(`/onboarding?app=${app.id}`)}>
                  Continue onboarding <ArrowRight />
                </Button>
              </>
            )
          )
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <KpiCard label="Project" value={<span className="text-[15px]">{project?.name}</span>} onClick={() => navigate(`/projects/${app.projectId}`)} />
        <KpiCard label="Assets" value={assets.length} sub={`${assets.filter((a) => a.internetExposed).length} internet-facing`} />
        <KpiCard label="Open findings" value={open.length} tone={open.some((x) => x.f.severity === 'critical') ? 'red' : 'default'} sub={`${open.filter((x) => x.f.severity === 'critical').length} critical`} />
        <KpiCard label="Connected sources" value={sources.length} />
        <KpiCard label="Last full run" value={<RelTime iso={app.runs.find((r) => r.kind === 'full')?.finishedAt} className="text-[15px] text-fg" />} sub={app.runSchedule} />
        <KpiCard label="Illustrative ALE" value={fmtMoney(ale)} tone="violet" onClick={() => navigate(scenarios[0] ? `/crq/scenarios/${scenarios[0].id}` : '/crq')} />
      </div>
      {!protectedApp && <Callout tone="info" icon={<Rocket />} title={`Onboarding: ${APP_STATUS[app.status].label}`}>This application is not yet protected. Findings appear after the first full run.</Callout>}
      <Tabs defaultValue={protectedApp ? 'findings' : 'map'}>
        <TabsList>
          <TabsTrigger value="findings">Findings ({open.length})</TabsTrigger>
          <TabsTrigger value="map"><Waypoints /> Asset map</TabsTrigger>
          <TabsTrigger value="assets">Assets ({assets.length})</TabsTrigger>
          <TabsTrigger value="runs">Runs ({app.runs.length})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="risk"><Calculator /> Risk & dependencies</TabsTrigger>
          <TabsTrigger value="incidents"><Siren /> Incidents ({incidents.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="findings">
          {fs.length ? <FindingsTable tableId={`app-${app.id}`} rows={fs} hideColumns={['service']} initialViewId="critical" showAI /> : <Card><EmptyState title="No findings yet" description="Findings are published by full runs." /></Card>}
        </TabsContent>
        <TabsContent value="map">
          <Section title="Asset map" description="Open findings are shown on each asset" actions={canOnboard && <Button size="sm" variant="secondary" onClick={() => navigate(`/mapping?app=${app.id}`)}><Waypoints /> Edit in Asset mapping</Button>}>
            <AssetMap assets={assets} links={app.assetLinks} openFindings={openByAsset} height={440} />
          </Section>
        </TabsContent>
        <TabsContent value="assets">
          <Card className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b border-border bg-surface-2 text-left text-[11px] uppercase tracking-wide text-subtle">
                <tr>
                  <th className="px-4 py-2.5">Asset</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Address</th>
                  <th className="px-4 py-2.5">Sources</th>
                  <th className="px-4 py-2.5">Open findings</th>
                  <th className="px-4 py-2.5">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assets.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-2/60">
                    <td className="px-4 py-2.5"><EntityLink type="asset" id={a.id} showId={false} /></td>
                    <td className="px-4 py-2.5 text-muted">{ASSET_TYPE_LABEL[a.type]}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{a.fqdn ?? a.ipAddress ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{(app.coverage[a.id] ?? a.sourceIntegrationIds).map((s) => data.integrations.find((i) => i.id === s)?.vendor).join(', ') || <span className="text-amber-700">None</span>}</td>
                    <td className="px-4 py-2.5">{openByAsset[a.id] || <span className="text-subtle">0</span>}</td>
                    <td className="px-4 py-2.5"><RelTime iso={a.lastSeen} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>
        <TabsContent value="runs">
          <div className="space-y-3">
            {app.runs.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[13px] font-medium">
                    {r.status === 'running' ? <Loader2 className="size-4 animate-spin text-primary" /> : r.status === 'failed' ? <Badge tone="red">Failed</Badge> : <CheckCircle2 className="size-4 text-emerald-600" />}
                    {r.kind === 'test' ? 'Test run' : 'Full run'}
                    <Badge tone="slate">simulated</Badge>
                  </div>
                  <span className="text-xs text-muted">{fmtDateTime(r.startedAt)} · by <UserName id={r.startedById} avatar={false} /></span>
                </div>
                <p className="mt-1.5 text-[13px] text-muted">{r.status === 'running' ? `Running: ${r.steps.find((s) => s.status === 'running')?.name ?? 'starting'}…` : r.summary}</p>
                {r.findingIds.length > 0 && <p className="mt-1 text-xs text-subtle">{plural(r.findingIds.length, 'finding')} published</p>}
              </Card>
            ))}
            {!app.runs.length && <Card><EmptyState title="No runs yet" description="Runs start from the onboarding wizard." /></Card>}
          </div>
        </TabsContent>
        <TabsContent value="details">
          <Section title="Application details">
            <KeyValue cols={3} items={[{ label: 'Application ID', value: <span className="font-mono">{app.id}</span> }, { label: 'Type', value: app.appType }, { label: 'Environment', value: <span className="capitalize">{app.environment}</span> }, { label: 'Owner', value: <UserName id={app.ownerId} /> }, { label: 'Data classification', value: app.dataClassification }, { label: 'Regulatory scope', value: app.regulatoryScope.join(', ') || '—' }, { label: 'Run schedule', value: app.runSchedule }, { label: 'Protected since', value: app.protectedSince ? fmtDateTime(app.protectedSince) : 'Not yet' }, { label: 'Next run', value: app.status === 'paused' ? 'Paused' : app.nextRunAt ? fmtDateTime(app.nextRunAt) : '—' }]} />
          </Section>
        </TabsContent>
        <TabsContent value="risk">
          <div className="grid gap-5 lg:grid-cols-2">
            <Section title={`Risk scenarios (${scenarios.length})`}>
              {scenarios.map((s) => <Link key={s.id} to={`/crq/scenarios/${s.id}`} className="mb-2 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-[13px] hover:bg-surface-3"><span>{s.name}</span><span className="num font-semibold">{fmtMoney(computeScenario(s, data.findings).ale)}</span></Link>)}
              {!scenarios.length && <p className="text-xs text-muted">None yet.</p>}
            </Section>
            <Section title={`Attack paths (${paths.length})`}>
              {paths.map((p) => <Link key={p.id} to={`/exposures/attack-paths/${p.id}`} className="mb-2 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-[13px] hover:bg-surface-3"><span>{p.name}</span><Badge tone={p.status === 'active' ? 'red' : 'emerald'}>{p.status}</Badge></Link>)}
              {!paths.length && <p className="text-xs text-muted">None identified.</p>}
            </Section>
            <Section title={`Third parties (${vendors.length})`}>
              {vendors.map((v) => <div key={v.id} className="mb-1.5 text-[13px]"><EntityLink type="vendor" id={v.id} /></div>)}
              {!vendors.length && <p className="text-xs text-muted">None mapped.</p>}
            </Section>
            <Section title={`AI systems (${ais.length})`}>
              {ais.map((a) => <div key={a.id} className="mb-1.5 text-[13px]"><EntityLink type="aiSystem" id={a.id} /></div>)}
              {!ais.length && <p className="text-xs text-muted">None mapped.</p>}
            </Section>
          </div>
        </TabsContent>
        <TabsContent value="incidents">
          <Card className="divide-y divide-border">
            {incidents.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <EntityLink type="incident" id={i.id} />
                <div className="flex items-center gap-2"><SeverityBadge severity={i.severity} /><StatusBadge map={INCIDENT_STATUS} value={i.status} /></div>
              </div>
            ))}
            {!incidents.length && <EmptyState title="No incidents" />}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================ Asset mapping

export function MappingPage() {
  usePage('Asset mapping', [{ label: 'Workspace' }, { label: 'Asset mapping' }])
  const [params, setParams] = useSearchParams()
  const me = useCurrentUser()
  const canOnboard = useCan('onboard_applications')
  const { run, pending } = useAction()
  const { data, isLoading, error, retry } = useCollections(['services', 'assets', 'findings', 'projects'] as const)
  const db = useDbStore((s) => s.db)
  const appId = params.get('app') ?? data?.services[0]?.id
  const app = data?.services.find((s) => s.id === appId)
  const [links, setLinks] = React.useState<AssetLink[] | null>(null)
  React.useEffect(() => setLinks(null), [appId])
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={8} />
  if (!data.services.length)
    return (
      <div className="space-y-5">
        <PageHeader title="Asset mapping" icon={<Waypoints />} />
        <Card><EmptyState icon={<Waypoints />} title="No applications to map" description="Onboard an application to declare and map its assets." action={canOnboard && <Button asChild><Link to="/onboarding?new=1">Onboard application</Link></Button>} /></Card>
      </div>
    )
  if (!app) return <NotFound what="Application" back={{ to: '/mapping', label: 'Back to Asset mapping' }} />
  const assets = data.assets.filter((a) => a.businessServiceId === app.id && !a.duplicateOfId && !a.possibleDuplicateOfId)
  const openByAsset = Object.fromEntries(assets.map((a) => [a.id, data.findings.filter((f) => f.assetId === a.id && isOpen(f.status)).length]))
  const editable = canOnboard && (me.orgRole === 'admin' || ['owner', 'contributor'].includes(projectRoleOf(db, app.projectId, me.id) ?? ''))
  const current = links ?? app.assetLinks
  const dirty = links !== null
  return (
    <div className="space-y-5">
      <PageHeader
        title="Asset mapping"
        icon={<Waypoints />}
        description="How each application's assets connect. The map drives attack-path analysis and shows where open findings sit."
        actions={
          <>
            <NativeSelect value={app.id} onChange={(e) => setParams({ app: e.target.value })} className="w-72" aria-label="Application">
              {data.projects.map((p) => (
                <optgroup key={p.id} label={p.name}>
                  {data.services.filter((s) => s.projectId === p.id).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </NativeSelect>
            {editable && (
              <Button disabled={!dirty} loading={pending} onClick={async () => { await run(() => api.saveAssetLinks(app.id, current.map(({ sourceAssetId, targetAssetId, relation }) => ({ sourceAssetId, targetAssetId, relation }))), 'Asset map saved'); setLinks(null) }}>
                <Save /> Save map
              </Button>
            )}
          </>
        }
      />
      {!editable && <Callout tone="info">You can view this map. Editing requires owner or contributor access to {data.projects.find((p) => p.id === app.projectId)?.name}.</Callout>}
      {dirty && <Callout tone="warn">Unsaved changes to the asset map.</Callout>}
      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <Card className="p-4">
          <AssetMap assets={assets} links={current} editable={editable} onChange={setLinks} openFindings={openByAsset} height={520} />
        </Card>
        <Section title={`Links (${current.length})`} description={<Link to={`/applications/${app.id}`} className="text-primary hover:underline">Open {app.name} →</Link>}>
          <ul className="max-h-[520px] space-y-1.5 overflow-y-auto text-xs">
            {current.map((l) => (
              <li key={l.id} className="rounded-lg bg-surface-2 px-2.5 py-1.5">
                <span className="font-medium">{assets.find((a) => a.id === l.sourceAssetId)?.name}</span> <span className="text-primary">{l.relation}</span> <span className="font-medium">{assets.find((a) => a.id === l.targetAssetId)?.name}</span>
              </li>
            ))}
            {!current.length && <li className="text-muted">No links yet.</li>}
          </ul>
        </Section>
      </div>
    </div>
  )
}

// ============================================================ Projects

export function ProjectsPage() {
  usePage('Projects', [{ label: 'Projects' }])
  const navigate = useNavigate()
  const canCreate = useCan('create_project')
  const { data, isLoading, error, retry } = useCollections(['projects', 'services', 'findings'] as const, { ignoreProjectFilter: true })
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={6} />
  return (
    <div className="space-y-5">
      <PageHeader title="Projects" icon={<FolderKanban />} description="What your organization is securing. Each project groups applications and controls who can see and act on their findings." actions={canCreate && <Button onClick={() => navigate('/onboarding?new=1')}><Plus /> New project</Button>} />
      {data.projects.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.projects.map((p) => {
            const apps = data.services.filter((s) => s.projectId === p.id)
            const open = data.findings.filter((f) => apps.some((a) => a.id === f.businessServiceId) && isOpen(f.status))
            return (
              <button key={p.id} onClick={() => { api.setCurrentProject(p.id); navigate(`/projects/${p.id}`) }} className="card p-5 text-left hover:border-border-strong cursor-pointer">
                <div className="flex items-start justify-between gap-2">
                  <FolderKanban className="size-5 text-primary" />
                  <span className="text-[11.5px] text-subtle">{p.members.length + 1} members</span>
                </div>
                <div className="mt-2 text-[15px] font-semibold">{p.name}</div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted">{p.description}</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Stat label="Applications" value={apps.length} />
                  <Stat label="Protected" value={apps.filter((a) => a.status === 'active').length} />
                  <Stat label="Open findings" value={open.length} />
                </div>
                <div className="mt-3 text-[11.5px] text-subtle">Owner: <UserName id={p.ownerId} avatar={false} /></div>
              </button>
            )
          })}
        </div>
      ) : (
        <Card><EmptyState icon={<FolderKanban />} title="No projects yet" description="Create a project for the first thing you want to secure." action={canCreate && <Button onClick={() => navigate('/onboarding?new=1')}><Plus /> New project</Button>} /></Card>
      )}
    </div>
  )
}

export function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const me = useCurrentUser()
  const users = useUsers()
  const settings = useSettings()
  const canOnboard = useCan('onboard_applications')
  const { run, pending } = useAction()
  const db = useDbStore((s) => s.db)
  const { data, isLoading, error, retry } = useCollections(['projects', 'services', 'findings', 'assets', 'audit', 'tickets'] as const, { ignoreProjectFilter: true })
  const project = data?.projects.find((p) => p.id === id)
  usePage(project?.name ?? 'Project', [{ label: 'Projects', to: '/projects' }, { label: project?.name ?? id ?? '' }])
  const [addOpen, setAddOpen] = React.useState(false)
  const [member, setMember] = React.useState({ userId: '', role: 'contributor' as ProjectRole })
  React.useEffect(() => {
    if (project && settings.currentProjectId !== project.id) api.setCurrentProject(project.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id])
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={6} />
  if (!project) return <NotFound what="Project" back={{ to: '/projects', label: 'Back to Projects' }} />
  const apps = data.services.filter((s) => s.projectId === project.id)
  const fs = scoreFindings(data.findings.filter((f) => apps.some((a) => a.id === f.businessServiceId)), data.assets, data.services, settings.weights)
  const open = fs.filter((x) => isOpen(x.f.status))
  const myRole = me.orgRole === 'admin' ? 'admin' : projectRoleOf(db, project.id, me.id)
  const canManage = me.orgRole === 'admin' || myRole === 'owner'
  const members = [{ userId: project.ownerId, role: 'owner' as ProjectRole, addedAt: project.createdAt }, ...project.members.filter((m) => m.userId !== project.ownerId)]
  const appIds = new Set(apps.map((a) => a.id))
  const activity = data.audit.filter((a) => a.entityId === project.id || appIds.has(a.entityId)).slice(0, 12)
  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/projects', label: 'Projects' }}
        title={project.name}
        icon={<FolderKanban />}
        description={project.description}
        badges={myRole && <Badge tone="violet">Your access: {myRole}</Badge>}
        actions={
          <>
            {canManage && <Button variant="secondary" onClick={() => setAddOpen(true)}><UserPlus /> Add member</Button>}
            {canOnboard && (myRole === 'admin' || myRole === 'owner' || myRole === 'contributor') && <Button onClick={() => navigate(`/onboarding?project=${project.id}`)}><Plus /> Onboard application</Button>}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="Applications" value={apps.length} sub={`${apps.filter((a) => a.status === 'active').length} protected`} onClick={() => navigate('/applications')} />
        <KpiCard label="Open findings" value={open.length} onClick={() => navigate('/operations/findings')} />
        <KpiCard label="Critical" value={open.filter((x) => x.f.severity === 'critical').length} tone="red" onClick={() => navigate('/operations/findings?severity=critical&status=new,triaged,in_validation,validated,in_remediation,pending_verification')} />
        <KpiCard label="Open tickets" value={data.tickets.filter((t) => t.findingId && fs.some((x) => x.f.id === t.findingId) && !['done', 'cancelled'].includes(t.status)).length} onClick={() => navigate('/operations/tickets')} />
        <KpiCard label="Members" value={members.length} />
      </div>
      <Callout tone="info" icon={<FolderKanban />}>Every security screen is now scoped to <strong>{project.name}</strong>. Use the project switcher in the top bar to change scope.</Callout>
      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2" title="Applications" description="Onboarding status and exposure per application">
          <div className="divide-y divide-border">
            {apps.map((a) => {
              const o = open.filter((x) => x.f.businessServiceId === a.id)
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/applications/${a.id}`} className="text-[14px] font-medium hover:text-primary">{a.name}</Link>
                    <div className="text-xs text-muted">{a.appType} · {a.environment} · {data.assets.filter((x) => x.businessServiceId === a.id && !x.duplicateOfId && !x.possibleDuplicateOfId).length} assets</div>
                  </div>
                  <StatusBadge map={APP_STATUS} value={a.status} />
                  {a.status === 'active' || a.status === 'paused' ? <SevBar counts={SEVS.map((s) => o.filter((x) => x.f.severity === s).length)} /> : <OnboardingProgress app={a} />}
                  {!(a.status === 'active' || a.status === 'paused') && canOnboard && <Button size="sm" variant="secondary" onClick={() => navigate(`/onboarding?app=${a.id}`)}>Continue</Button>}
                </div>
              )
            })}
            {!apps.length && <EmptyState icon={<Rocket />} title="No applications in this project" description="Onboard the first application to start assessing it." action={canOnboard && <Button size="sm" onClick={() => navigate(`/onboarding?project=${project.id}`)}>Onboard application</Button>} />}
          </div>
        </Section>
        <Section title="Top risks" description="Highest dynamic risk score">
          <div className="space-y-2">
            {[...open].sort((a, b) => b.score - a.score).slice(0, 6).map((x) => (
              <Link key={x.f.id} to={`/operations/findings/${x.f.id}`} className="flex items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-surface-2">
                <RiskScore score={x.score} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{x.f.title}</span>
                  <span className="block truncate text-[11px] text-subtle">{x.asset?.name}</span>
                </span>
                <FindingStatusBadge status={x.f.status} />
              </Link>
            ))}
            {!open.length && <p className="text-xs text-muted">No open findings.</p>}
          </div>
        </Section>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title={`Members (${members.length})`} description="Effective access = organization role ∩ project role" actions={<Users className="size-4 text-subtle" />}>
          <div className="divide-y divide-border">
            {members.map((m) => (
              <div key={m.userId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <UserName id={m.userId} />
                <div className="flex items-center gap-2">
                  {canManage && m.userId !== project.ownerId ? (
                    <>
                      <NativeSelect value={m.role} onChange={(e) => run(() => api.setProjectMember(project.id, m.userId, e.target.value as ProjectRole), 'Project role updated')} className="h-8 w-32 text-xs" aria-label="Project role">
                        <option value="owner">Owner</option>
                        <option value="contributor">Contributor</option>
                        <option value="viewer">Viewer</option>
                      </NativeSelect>
                      <Button size="icon-sm" variant="ghost" aria-label="Remove member" onClick={() => run(() => api.setProjectMember(project.id, m.userId, null), 'Member removed')}><Trash2 /></Button>
                    </>
                  ) : (
                    <Badge tone={m.role === 'owner' ? 'violet' : 'slate'}>{m.userId === project.ownerId ? 'Project owner' : m.role}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Recent activity">
          <Timeline entries={activity.map((a) => ({ id: a.id, at: a.at, actorId: a.actorId, type: 'comment' as const, summary: a.action, detail: a.details }))} empty="No activity yet." />
        </Section>
      </div>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent title={`Add member to ${project.name}`} description="Project roles: Owner manages access and onboarding; Contributor works findings and tickets; Viewer is read-only.">
          <div className="space-y-4">
            <Field label="Person">
              <NativeSelect value={member.userId} onChange={(e) => setMember({ ...member, userId: e.target.value })}>
                <option value="">Select…</option>
                {users.filter((u) => u.status === 'active' && !members.some((m) => m.userId === u.id)).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.team}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Project role">
              <NativeSelect value={member.role} onChange={(e) => setMember({ ...member, role: e.target.value as ProjectRole })}>
                <option value="contributor">Contributor</option>
                <option value="viewer">Viewer</option>
                <option value="owner">Owner</option>
              </NativeSelect>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button disabled={!member.userId} loading={pending} onClick={async () => { await run(() => api.setProjectMember(project.id, member.userId, member.role), 'Member added'); setAddOpen(false); setMember({ userId: '', role: 'contributor' }) }}>Add member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

