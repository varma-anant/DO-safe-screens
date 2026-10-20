import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { createColumnHelper } from '@tanstack/react-table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowRight, CheckCircle2, Database, Filter, GitMerge, Layers, MonitorDot, Plug, PlugZap, Power, RefreshCw, Search, Store, Tags, TestTube2, XCircle, BookOpen, Link2 } from 'lucide-react'
import type { DataQualityIssue, IngestionRun, Integration } from '@/types'
import { useAction, useCollections, useSettings } from '@/hooks/queries'
import { usePage } from '@/hooks/usePage'
import { Callout, EmptyState, ErrorState, KpiCard, LoadingState, NotFound, PageHeader, Section, Stat } from '@/components/common/layout'
import { Badge, DemoTag, ProvenanceBadge } from '@/components/common/badges'
import { EntityLink, RelTime } from '@/components/common/entities'
import { DataTable } from '@/components/common/DataTable'
import { AXIS, ChartTooltip, GRID, CATEGORICAL } from '@/components/common/charts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, NativeSelect } from '@/components/ui/input'
import { Progress } from '@/components/ui/misc'
import { FindingsTable } from '@/modules/findings/FindingsTable'
import * as api from '@/services/api'
import { cn, fmtDateTime, fmtNum } from '@/utils/format'
import { scoreFindings } from '@/utils/derive'

const STATUS: Record<Integration['status'], { label: string; tone: 'emerald' | 'red' | 'slate' | 'amber' | 'sky' }> = { available: { label: 'Available', tone: 'sky' }, configuring: { label: 'Configuring', tone: 'amber' }, connected: { label: 'Connected', tone: 'emerald' }, error: { label: 'Error', tone: 'red' }, disabled: { label: 'Disabled', tone: 'slate' } }

function Logo({ i }: { i: Integration }) {
  const hue = (i.vendor.charCodeAt(0) * 37 + i.vendor.length * 11) % 360
  return <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 42%), hsl(${(hue + 40) % 360} 55% 30%))` }}>{i.vendor.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}</span>
}

// ============================================================ Marketplace

export function MarketplacePage() {
  usePage('Integration Marketplace', [{ label: 'Integrations' }, { label: 'Integration Marketplace' }])
  const navigate = useNavigate()
  const [q, setQ] = React.useState('')
  const [cat, setCat] = React.useState('All')
  const { data, isLoading, error, retry } = useCollections(['integrations'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={8} />
  const cats = ['All', ...new Set(data.integrations.map((i) => i.category))]
  const list = data.integrations.filter((i) => (cat === 'All' || i.category === cat) && (!q || `${i.name} ${i.vendor} ${i.category} ${i.capabilities.join(' ')}`.toLowerCase().includes(q.toLowerCase())))
  return (
    <div className="space-y-5">
      <PageHeader title="Integration Marketplace" icon={<Store />} description="Connect DO SAFE to the security tools and information sources Northstar already uses. All connectors in this prototype are simulated." />
      <Callout tone="demo" icon={<PlugZap />}>Connector names refer to real product categories only as targets of simulated connectors. No API calls are made and no credentials are stored; configuration values are demo placeholders. Trademarks belong to their respective owners.</Callout>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search integrations…" className="pl-8" aria-label="Search integrations" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={cn('rounded-full border px-2.5 py-1 text-xs cursor-pointer', cat === c ? 'border-violet-500/50 bg-violet-500/15 text-violet-200' : 'border-border text-muted hover:text-fg')}>{c}</button>
          ))}
        </div>
      </div>
      {list.length === 0 ? <Card><EmptyState search title="No integrations match" /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((i) => (
            <button key={i.id} onClick={() => navigate(`/integrations/${i.id}`)} className="card flex flex-col p-4 text-left transition-colors hover:border-border-strong cursor-pointer">
              <div className="flex items-start gap-3">
                <Logo i={i} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold">{i.name}</div>
                  <div className="text-[11px] text-muted">{i.category} · {i.vendor}</div>
                </div>
                <Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-muted">{i.description}</p>
              <div className="mt-auto flex flex-wrap gap-1 pt-3">
                {i.dataTypes.map((d) => <Badge key={d}>{d}</Badge>)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================ Integration detail / configuration

const cfgSchema = z.object({
  endpoint: z.string().min(6, 'Endpoint is required'),
  authMethod: z.string().min(3, 'Select an authentication method'),
  scope: z.string().min(3, 'Define the ingestion scope'),
  syncInterval: z.string().min(3),
})

export function IntegrationDetail() {
  const { id } = useParams()
  const settings = useSettings()
  const { data, isLoading, error, retry } = useCollections(['integrations', 'ingestionRuns', 'findings', 'assets', 'services'] as const)
  const i = data?.integrations.find((x) => x.id === id)
  usePage(i?.name ?? 'Integration', [{ label: 'Integrations' }, { label: 'Integration Marketplace', to: '/integrations' }, { label: i?.name ?? id ?? '' }])
  const { run, pending } = useAction()
  const [testing, setTesting] = React.useState(false)
  const { register, handleSubmit, formState, reset } = useForm<z.infer<typeof cfgSchema>>({ resolver: zodResolver(cfgSchema), values: i?.config ? { endpoint: i.config.endpoint, authMethod: i.config.authMethod, scope: i.config.scope, syncInterval: i.config.syncInterval } : { endpoint: 'https://api.vendor.example/v1', authMethod: 'API token (demo placeholder)', scope: '', syncInterval: 'Hourly' } })
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={8} />
  if (!i) return <NotFound what="Integration" back={{ to: '/integrations', label: 'Back to Marketplace' }} />
  const runs = data.ingestionRuns.filter((r) => r.integrationId === i.id)
  const imported = scoreFindings(data.findings.filter((f) => f.sourceIntegrationId === i.id), data.assets, data.services, settings.weights)
  const corroborated = data.findings.filter((f) => f.additionalSourceIds.includes(i.id)).length
  const canEnable = i.config?.testResult === 'success' && i.status !== 'connected'
  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/integrations', label: 'Integration Marketplace' }}
        title={i.name}
        icon={<Plug />}
        description={i.description}
        badges={<><Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Badge><DemoTag>Simulated connector</DemoTag></>}
        actions={
          <>
            {i.status === 'connected' && <Button variant="secondary" loading={pending} onClick={() => run(() => api.syncIntegration(i.id), 'Sync completed (simulated)')}><RefreshCw /> Sync now</Button>}
            {i.status === 'connected' && <Button variant="secondary" loading={pending} onClick={() => run(() => api.setIntegrationStatus(i.id, 'disabled'), 'Integration disabled')}><Power /> Disable</Button>}
            {(i.status === 'disabled' || i.status === 'error') && i.config?.testResult === 'success' && <Button loading={pending} onClick={() => run(() => api.setIntegrationStatus(i.id, 'connected'), 'Integration re-enabled')}><Power /> Re-enable</Button>}
            {canEnable && i.status !== 'disabled' && i.status !== 'error' && <Button variant="accent" loading={pending} onClick={() => run(() => api.enableIntegration(i.id), (ids) => `Integration enabled — initial sync imported ${ids.length} finding(s)`)}><PlugZap /> Enable integration</Button>}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Health" value={i.status === 'available' ? '—' : `${i.health}%`} tone={i.health > 90 ? 'green' : i.health > 60 ? 'amber' : i.status === 'available' ? 'default' : 'red'} />
        <KpiCard label="Records ingested" value={fmtNum(i.recordsIngested)} />
        <KpiCard label="Findings sourced" value={imported.length} sub={`${corroborated} corroborated as secondary source`} />
        <KpiCard label="Last sync" value={i.lastSyncAt ? <RelTime iso={i.lastSyncAt} className="text-lg text-fg" /> : '—'} />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Section title="Capabilities">
          <ul className="space-y-1.5 text-[13px]">{i.capabilities.map((c) => <li key={c} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />{c}</li>)}</ul>
          <div className="label-xs mb-1 mt-4">Data types</div>
          <div className="flex flex-wrap gap-1">{i.dataTypes.map((d) => <Badge key={d}>{d}</Badge>)}</div>
        </Section>
        <Section className="xl:col-span-2" title="Connector configuration" description="Step 1: configure · Step 2: test connection · Step 3: enable">
          <form onSubmit={handleSubmit(async (v) => { await run(() => api.configureIntegration(i.id, v), 'Configuration saved — test the connection next'); reset(v) })} className="grid gap-4 sm:grid-cols-2">
            <Field label="API endpoint" required error={formState.errors.endpoint?.message} hint="Tip: include “fail” in the endpoint to simulate a failed connection test">
              <Input {...register('endpoint')} />
            </Field>
            <Field label="Authentication" required error={formState.errors.authMethod?.message}>
              <NativeSelect {...register('authMethod')}>
                {['API token (demo placeholder)', 'OAuth client credentials (demo placeholder)', 'Service account (demo placeholder)', 'Cross-account IAM role (demo placeholder)', 'Public feed', 'Built-in'].map((a) => <option key={a}>{a}</option>)}
                {i.config && !['API token (demo placeholder)', 'OAuth client credentials (demo placeholder)', 'Service account (demo placeholder)', 'Cross-account IAM role (demo placeholder)', 'Public feed', 'Built-in'].includes(i.config.authMethod) && <option>{i.config.authMethod}</option>}
              </NativeSelect>
            </Field>
            <Field label="Ingestion scope" required error={formState.errors.scope?.message}>
              <Input {...register('scope')} placeholder="e.g. Azure tenant northstar-prod" />
            </Field>
            <Field label="Sync interval">
              <NativeSelect {...register('syncInterval')}>
                {['Every 15 minutes', 'Hourly', 'Every 6 hours', 'Daily', i.config?.syncInterval].filter((x, k, arr) => x && arr.indexOf(x) === k).map((s) => <option key={s}>{s}</option>)}
              </NativeSelect>
            </Field>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Button type="submit" variant="secondary" loading={formState.isSubmitting} disabled={!formState.isDirty && !!i.config}>Save configuration</Button>
              <Button type="button" variant="secondary" disabled={!i.config || formState.isDirty} loading={testing} onClick={async () => { setTesting(true); await run(() => api.testIntegration(i.id), (ok) => (ok ? 'Connection test succeeded (simulated)' : 'Connection test failed (simulated)')); setTesting(false) }}><TestTube2 /> Test connection</Button>
              {i.config?.testResult && (
                <span className={cn('inline-flex items-center gap-1 text-xs', i.config.testResult === 'success' ? 'text-emerald-300' : 'text-red-300')}>
                  {i.config.testResult === 'success' ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />} Last test {i.config.testResult} · {fmtDateTime(i.config.testedAt)}
                </span>
              )}
              {formState.isDirty && i.config && <span className="text-xs text-amber-300">Unsaved changes</span>}
            </div>
          </form>
          {i.status === 'error' && <div className="mt-3"><Callout tone="danger" icon={<AlertTriangle />} title="Connector error">{runs.find((r) => r.status === 'failed')?.message ?? 'Last sync failed.'} Update credentials and re-test to restore.</Callout></div>}
        </Section>
      </div>
      <Section title="Ingestion activity" description="Recent sync runs for this connector (simulated)">
        <RunsTable runs={runs} integrations={data.integrations} />
      </Section>
      {imported.length > 0 && (
        <Section title={`Findings sourced from ${i.vendor} (${imported.length})`} description="Source provenance is preserved on every finding">
          <FindingsTable tableId={`int-${i.id}`} rows={imported} views={[{ id: 'new', label: 'Newly imported', filters: [{ id: 'status', value: ['new'] }] }, { id: 'all', label: 'All', filters: [] }]} initialViewId={imported.some((x) => x.f.tags.includes('imported-demo')) ? 'new' : 'all'} hideColumns={['source']} pageSize={8} />
        </Section>
      )}
    </div>
  )
}

const rCol = createColumnHelper<IngestionRun & { connector: string }>()

function RunsTable({ runs, integrations }: { runs: IngestionRun[]; integrations: Integration[] }) {
  const navigate = useNavigate()
  const rows = runs.map((r) => ({ ...r, connector: integrations.find((i) => i.id === r.integrationId)?.name ?? r.integrationId }))
  const columns = [
    rCol.accessor('startedAt', { header: 'Started', cell: (c) => <RelTime iso={c.getValue()} /> }),
    rCol.accessor('connector', { header: 'Connector', filterFn: 'multi' }),
    rCol.accessor('status', { header: 'Status', filterFn: 'multi', cell: (c) => <Badge tone={c.getValue() === 'success' ? 'emerald' : c.getValue() === 'partial' ? 'amber' : 'red'}>{c.getValue()}</Badge> }),
    rCol.accessor('received', { header: 'Received', cell: (c) => <span className="num">{fmtNum(c.getValue())}</span> }),
    rCol.accessor('normalized', { header: 'Normalized', cell: (c) => <span className="num">{fmtNum(c.getValue())}</span> }),
    rCol.accessor('duplicatesMerged', { header: 'Duplicates merged', cell: (c) => <span className="num text-muted">{fmtNum(c.getValue())}</span> }),
    rCol.accessor('rejected', { header: 'Rejected', cell: (c) => <span className={cn('num', c.getValue() ? 'text-amber-300' : 'text-subtle')}>{c.getValue()}</span> }),
    rCol.accessor((r) => r.createdFindingIds.length, { id: 'created', header: 'New findings', cell: (c) => (c.getValue() ? <Badge tone="violet">{c.getValue()}</Badge> : <span className="text-subtle">0</span>) }),
    rCol.accessor('durationSec', { header: 'Duration', cell: (c) => <span className="text-muted">{c.getValue()}s</span> }),
    rCol.accessor('message', { header: 'Message', cell: (c) => <span className="block max-w-[320px] truncate text-xs text-muted">{c.getValue()}</span> }),
  ]
  return <DataTable tableId={`runs-${runs[0]?.integrationId ?? 'all'}`} data={rows} columns={columns} getRowId={(r) => r.id} onRowClick={(r) => navigate(`/integrations/${r.integrationId}`)} facets={[{ columnId: 'status', label: 'Status' }, { columnId: 'connector', label: 'Connector' }]} initialSorting={[{ id: 'startedAt', desc: true }]} pageSize={10} selectable={false} exportName="do-safe-ingestion-runs" emptyTitle="No ingestion runs yet" emptyDescription="Runs appear after the connector is enabled." />
}

// ============================================================ Connected sources

export function ConnectedPage() {
  usePage('Connected Sources', [{ label: 'Integrations' }, { label: 'Connected Sources' }])
  const navigate = useNavigate()
  const { data, isLoading, error, retry } = useCollections(['integrations', 'ingestionRuns'] as const)
  const { run } = useAction()
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={8} />
  const connected = data.integrations.filter((i) => i.status !== 'available')
  return (
    <div className="space-y-5">
      <PageHeader title="Connected Sources" icon={<Plug />} description="Configured connectors, their health and synchronization status." actions={<Button asChild variant="secondary"><Link to="/integrations"><Store /> Add integration</Link></Button>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Connected" value={connected.filter((i) => i.status === 'connected').length} tone="green" />
        <KpiCard label="In error" value={connected.filter((i) => i.status === 'error').length} tone="red" />
        <KpiCard label="Disabled" value={connected.filter((i) => i.status === 'disabled').length} />
        <KpiCard label="Records ingested" value={fmtNum(connected.reduce((s, i) => s + i.recordsIngested, 0))} />
      </div>
      <Card className="divide-y divide-border/60">
        {connected.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
            <Logo i={i} />
            <button onClick={() => navigate(`/integrations/${i.id}`)} className="min-w-0 flex-1 text-left cursor-pointer">
              <div className="text-[13px] font-medium hover:text-violet-200">{i.name}</div>
              <div className="text-[11px] text-muted">{i.category} · {i.config?.syncInterval} · last sync {i.lastSyncAt ? <RelTime iso={i.lastSyncAt} /> : 'never'}</div>
            </button>
            <div className="h-8 w-32">
              <ResponsiveContainer>
                <LineChart data={i.syncHistory.map((v, k) => ({ k, v }))}>
                  <Line dataKey="v" stroke={i.status === 'error' ? '#ef4444' : CATEGORICAL[1]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="w-28">
              <div className="flex justify-between text-[11px] text-muted"><span>Health</span><span>{i.health}%</span></div>
              <Progress value={i.health} tone={i.health > 90 ? 'emerald' : i.health > 60 ? 'amber' : 'red'} />
            </div>
            <Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Badge>
            {i.status === 'connected' ? <Button size="xs" variant="ghost" onClick={() => run(() => api.syncIntegration(i.id), 'Sync completed (simulated)')}><RefreshCw /> Sync</Button> : <Button size="xs" variant="ghost" onClick={() => navigate(`/integrations/${i.id}`)}>Fix</Button>}
          </div>
        ))}
      </Card>
    </div>
  )
}

// ============================================================ Data pipelines

export function PipelinesPage() {
  usePage('Data Pipelines', [{ label: 'Integrations' }, { label: 'Data Pipelines' }])
  const { data, isLoading, error, retry } = useCollections(['ingestionRuns', 'findings', 'assets', 'integrations'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={8} />
  const runs = data.ingestionRuns
  const recv = runs.reduce((s, r) => s + r.received, 0)
  const norm = runs.reduce((s, r) => s + r.normalized, 0)
  const dup = runs.reduce((s, r) => s + r.duplicatesMerged, 0)
  const rej = runs.reduce((s, r) => s + r.rejected, 0)
  const multi = data.findings.filter((f) => f.additionalSourceIds.length)
  const mergedAssets = data.assets.filter((a) => a.duplicateOfId)
  const stages = [
    { icon: <Database />, name: 'Ingestion', n: recv, sub: `${runs.length} runs from ${new Set(runs.map((r) => r.integrationId)).size} connectors` },
    { icon: <Filter />, name: 'Normalization', n: norm, sub: `${rej} rejected (schema validation)` },
    { icon: <GitMerge />, name: 'Deduplication', n: norm - dup, sub: `${fmtNum(dup)} duplicates merged` },
    { icon: <BookOpen />, name: 'Enrichment', n: data.findings.filter((f) => f.cveId || f.cweIds.length).length, sub: 'CVE · CWE · ATT&CK · KEV · EPSS' },
    { icon: <Link2 />, name: 'Correlation', n: data.findings.length, sub: 'Findings linked to assets, services, vendors, AI' },
  ]
  return (
    <div className="space-y-5">
      <PageHeader title="Data Pipelines" icon={<Layers />} description="How raw source records become normalized, deduplicated, enriched findings — with source provenance preserved at every step." />
      <div className="grid gap-3 md:grid-cols-5">
        {stages.map((s, i) => (
          <div key={s.name} className="card relative p-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-violet-300 [&_svg]:size-4">{s.icon}</span>
            <div className="mt-2 text-[14px] font-semibold">{s.name}</div>
            <div className="num text-xl font-semibold">{fmtNum(s.n)}</div>
            <div className="text-[11px] text-muted">{s.sub}</div>
            {i < 4 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden size-4 -translate-y-1/2 text-subtle md:block" />}
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Normalization: field mapping" description="Example mapping of source fields to the DO SAFE common finding schema">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-subtle"><th className="py-1.5">Source field (example)</th><th>Source</th><th>DO SAFE field</th></tr></thead>
            <tbody className="font-mono">
              {[
                ['plugin_output.severity', 'Tenable', 'severity'],
                ['QID / CVE_LIST', 'Qualys', 'cveId'],
                ['issue.entitySnapshot.name', 'Wiz', 'assetId (via correlation)'],
                ['device.hostname', 'CrowdStrike', 'asset.name'],
                ['secret_type, validity', 'GitHub', 'category, evidence'],
                ['app.name, user_count', 'Netskope', 'aiSystem, users'],
                ['first_found / last_found', '*', 'firstDetected / lastObserved'],
              ].map(([a, b, c]) => <tr key={a} className="border-t border-border/50"><td className="py-1.5 text-muted">{a}</td><td className="font-sans">{b}</td><td className="text-violet-200">{c}</td></tr>)}
            </tbody>
          </table>
        </Section>
        <Section title="Deduplication" description="Repeated findings and asset records identified across sources">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Multi-source findings" value={multi.length} />
            <Stat label="Assets merged" value={mergedAssets.length} />
            <Stat label="Pending asset matches" value={data.assets.filter((a) => a.possibleDuplicateOfId).length} />
          </div>
          <div className="label-xs mb-1.5 mt-4">Examples of merged findings (source provenance preserved)</div>
          <div className="space-y-1.5">
            {multi.slice(0, 5).map((f) => (
              <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-1.5 text-xs">
                <EntityLink type="finding" id={f.id} />
                <span className="text-muted">{[f.sourceIntegrationId, ...f.additionalSourceIds].map((s) => data.integrations.find((x) => x.id === s)?.vendor).join(' + ')}</span>
              </div>
            ))}
          </div>
          <Button asChild variant="secondary" size="sm" className="mt-3"><Link to="/exposures/assets">Asset reconciliation queue</Link></Button>
        </Section>
      </div>
      <Section title="Source provenance" description="Every finding retains its primary source, corroborating sources and raw source record ID" actions={<ProvenanceBadge value="observed" />}>
        <div className="grid gap-3 md:grid-cols-3">
          {data.integrations.filter((i) => data.findings.some((f) => f.sourceIntegrationId === i.id)).map((i) => (
            <Link key={i.id} to={`/integrations/${i.id}`} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-xs hover:bg-surface-3">
              <span className="flex items-center gap-2"><Tags className="size-3.5 text-violet-300" /> {i.name}</span>
              <span className="num font-semibold">{data.findings.filter((f) => f.sourceIntegrationId === i.id).length}</span>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  )
}

// ============================================================ Ingestion monitoring & data quality

const dqCol = createColumnHelper<DataQualityIssue>()

export function IngestionMonitoringPage() {
  usePage('Ingestion Monitoring', [{ label: 'Integrations' }, { label: 'Ingestion Monitoring' }])
  const navigate = useNavigate()
  const { data, isLoading, error, retry } = useCollections(['ingestionRuns', 'integrations', 'dataQuality'] as const)
  const { run } = useAction()
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={10} />
  const { ingestionRuns: runs, integrations, dataQuality } = data
  const health = integrations.filter((i) => i.status !== 'available').map((i) => ({ name: i.vendor.split(' ')[0], health: i.health, id: i.id }))
  const columns = [
    dqCol.accessor('type', { header: 'Issue', filterFn: 'multi', cell: (c) => <span className="font-medium">{c.getValue()}</span> }),
    dqCol.accessor('description', { header: 'Description', cell: (c) => <span className="block max-w-[420px] truncate text-xs text-muted">{c.getValue()}</span> }),
    dqCol.accessor('entityId', { header: 'Record', cell: (c) => <EntityLink type={c.row.original.entityType === 'aiSystem' ? 'aiSystem' : c.row.original.entityType} id={c.getValue()} showId /> }),
    dqCol.accessor((d) => integrations.find((i) => i.id === d.integrationId)?.vendor ?? '—', { id: 'source', header: 'Source', filterFn: 'multi' }),
    dqCol.accessor('status', { header: 'Status', filterFn: 'multi', cell: (c) => <Badge tone={c.getValue() === 'open' ? 'amber' : c.getValue() === 'resolved' ? 'emerald' : 'slate'}>{c.getValue()}</Badge> }),
    dqCol.accessor('detectedAt', { header: 'Detected', cell: (c) => <RelTime iso={c.getValue()} /> }),
    dqCol.display({ id: 'act', header: '', cell: (c) => c.row.original.status === 'open' ? <div className="flex gap-1" onClick={(e) => e.stopPropagation()}><Button size="xs" variant="ghost" onClick={() => run(() => api.resolveDataQuality(c.row.original.id, 'resolved'), 'Marked resolved')}>Resolve</Button><Button size="xs" variant="ghost" onClick={() => run(() => api.resolveDataQuality(c.row.original.id, 'ignored'), 'Ignored')}>Ignore</Button></div> : <Button size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); run(() => api.resolveDataQuality(c.row.original.id, 'open'), 'Reopened') }}>Reopen</Button> }),
  ]
  return (
    <div className="space-y-5">
      <PageHeader title="Ingestion & Data Quality Monitoring" icon={<MonitorDot />} description="Connector health, synchronization status, and missing, inconsistent or stale information detected in ingested data." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Runs (last 7 days)" value={runs.filter((r) => Date.now() - new Date(r.startedAt).getTime() < 7 * 86_400_000).length} />
        <KpiCard label="Failed runs" value={runs.filter((r) => r.status === 'failed').length} tone="red" />
        <KpiCard label="Partial runs" value={runs.filter((r) => r.status === 'partial').length} tone="amber" />
        <KpiCard label="Open data quality issues" value={dataQuality.filter((d) => d.status === 'open').length} tone="violet" />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2" title="Connector health" description="Click a bar to open the connector">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={health} margin={{ left: -18, right: 8, top: 8 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" {...AXIS} interval={0} />
                <YAxis {...AXIS} domain={[0, 100]} />
                <RTooltip content={<ChartTooltip format={(v) => `${v}%`} />} />
                <Bar dataKey="health" name="Health" radius={[4, 4, 0, 0]} fill={CATEGORICAL[1]} onClick={(d) => navigate(`/integrations/${(d as unknown as { id: string }).id}`)} className="cursor-pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Attention needed">
          <div className="space-y-2">
            {integrations.filter((i) => i.status === 'error').map((i) => (
              <Link key={i.id} to={`/integrations/${i.id}`} className="block rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-red-200"><XCircle className="size-3.5" /> {i.name}</div>
                <div className="text-muted">{runs.find((r) => r.integrationId === i.id && r.status === 'failed')?.message}</div>
              </Link>
            ))}
            {runs.filter((r) => r.status === 'partial').slice(0, 3).map((r) => (
              <div key={r.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-amber-200"><AlertTriangle className="size-3.5" /> {integrations.find((i) => i.id === r.integrationId)?.name}</div>
                <div className="text-muted">{r.message}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>
      <Section title="Data quality issues" description="Missing owners, stale records, inconsistent hostnames, conflicting severities and unmapped fields">
        <DataTable tableId="dq" data={dataQuality} columns={columns} getRowId={(d) => d.id} facets={[{ columnId: 'type', label: 'Issue type' }, { columnId: 'status', label: 'Status' }, { columnId: 'source', label: 'Source' }]} views={[{ id: 'open', label: 'Open', filters: [{ id: 'status', value: ['open'] }] }, { id: 'all', label: 'All', filters: [] }]} initialViewId="open" selectable={false} pageSize={8} exportName="do-safe-data-quality" />
      </Section>
      <Section title="Recent ingestion runs">
        <RunsTable runs={runs} integrations={integrations} />
      </Section>
    </div>
  )
}
