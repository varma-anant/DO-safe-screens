import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { createColumnHelper } from '@tanstack/react-table'
import { ReactFlow, Background, Controls, type Edge, type Node, Handle, Position, MarkerType } from '@xyflow/react'
import { ArrowDown, ArrowRight, ArrowUp, Box, CheckCircle2, Crosshair, Gauge, GitMerge, Layers, ListOrdered, Play, Radar, RotateCcw, Route, Save, Search, Server, ShieldCheck, Target, X, Pencil, Bug, Globe } from 'lucide-react'
import type { Asset, PrioritizationWeights } from '@/types'
import { useAction, useCollections, useSettings, useUsers } from '@/hooks/queries'
import { usePage, useUrlFilters } from '@/hooks/usePage'
import { Callout, EmptyState, ErrorState, KeyValue, KpiCard, LoadingState, NotFound, PageHeader, Section } from '@/components/common/layout'
import { Badge, CriticalityBadge, FindingStatusBadge, InfoHint, KevBadge, ProvenanceBadge, RiskScore, SeverityBadge } from '@/components/common/badges'
import { EntityLink, IntegrationName, RelTime, UserName } from '@/components/common/entities'
import { DataTable } from '@/components/common/DataTable'
import { BarList, CATEGORICAL } from '@/components/common/charts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, NativeSelect, Textarea } from '@/components/ui/input'
import { FindingsTable, FINDING_VIEWS } from '@/modules/findings/FindingsTable'
import * as api from '@/services/api'
import { DEFAULT_WEIGHTS } from '@/data/seed'
import { cn, fmtDateTime, fmtPct } from '@/utils/format'
import { ASSET_TYPE_LABEL, isOpen, SEVERITY_COLOR } from '@/utils/labels'
import { scoreFindings } from '@/utils/derive'

const OPEN = ['new', 'triaged', 'in_validation', 'validated', 'in_remediation', 'pending_verification']

// ============================================================ Exposure inventory (CTEM loop)

export function ExposureInventory() {
  usePage('Exposure Inventory', [{ label: 'Exposure Management' }, { label: 'Exposure Inventory' }])
  const settings = useSettings()
  const navigate = useNavigate()
  const initialFilters = useUrlFilters(['severity', 'status', 'service', 'domain'])
  const { data, isLoading, error, retry } = useCollections(['findings', 'assets', 'services', 'integrations', 'attackPaths', 'tickets'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={5} rows={10} />
  const { findings, assets, services, integrations, attackPaths, tickets } = data
  const exposures = findings.filter((f) => f.domain !== 'ai')
  const scored = scoreFindings(exposures, assets, services, settings.weights)
  const open = exposures.filter((f) => isOpen(f.status))
  const activeAssets = assets.filter((a) => !a.duplicateOfId)
  const stages = [
    { icon: <Target />, name: 'Scoping', metric: `${services.length} services · ${activeAssets.filter((a) => a.criticality === 'tier-1').length} tier-1 assets`, detail: 'Assets mapped to business services and criticality', to: '/services' },
    { icon: <Radar />, name: 'Discovery', metric: `${integrations.filter((i) => i.status === 'connected').length} sources · ${assets.filter((a) => a.possibleDuplicateOfId).length} to reconcile`, detail: 'Ingestion, shadow assets, deduplication', to: '/exposures/assets' },
    { icon: <ListOrdered />, name: 'Prioritization', metric: `${open.filter((f) => f.kev).length} KEV · ${attackPaths.filter((p) => p.status === 'active').length} attack paths`, detail: 'Exploitability, threat intel, business impact', to: '/exposures/prioritization' },
    { icon: <ShieldCheck />, name: 'Validation', metric: `${exposures.filter((f) => f.status === 'in_validation').length} in progress · ${exposures.filter((f) => f.validation.status === 'not_exploitable').length} not exploitable`, detail: 'Reachability, exploitability, controls', to: '/exposures/validation' },
    { icon: <Play />, name: 'Mobilization', metric: `${tickets.filter((t) => t.findingId && !['done', 'cancelled'].includes(t.status)).length} tickets · ${exposures.filter((f) => f.status === 'pending_verification').length} verifying`, detail: 'Owned remediation to verified closure', to: '/operations/remediation' },
  ]
  return (
    <div className="space-y-5">
      <PageHeader title="Exposure Inventory" icon={<Radar />} description="Continuous Threat Exposure Management: every vulnerability, misconfiguration, identity weakness and external exposure collected from connected sources, deduplicated and prioritized." />
      <div className="grid gap-3 md:grid-cols-5">
        {stages.map((s, i) => (
          <button key={s.name} onClick={() => navigate(s.to)} className="card group relative p-4 text-left hover:border-border-strong cursor-pointer">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary-soft text-violet-300 [&_svg]:size-4">{s.icon}</span>
              <span className="text-[11px] text-subtle">Stage {i + 1}</span>
            </div>
            <div className="mt-2 text-[14px] font-semibold group-hover:text-violet-200">{s.name}</div>
            <div className="mt-0.5 text-xs text-fg">{s.metric}</div>
            <div className="mt-1 text-[11px] text-muted">{s.detail}</div>
            {i < 4 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden size-4 -translate-y-1/2 text-subtle md:block" />}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {(['critical', 'high', 'medium', 'low'] as const).map((s) => (
          <KpiCard key={s} label={`Open ${s}`} value={open.filter((f) => f.severity === s).length} onClick={() => navigate(`/exposures?severity=${s}&status=${OPEN.join(',')}`)} sub={<span style={{ color: SEVERITY_COLOR[s] }}>● {fmtPct(open.filter((f) => f.severity === s).length / Math.max(1, open.length))} of open</span>} />
        ))}
        <KpiCard label="Threat-intel enriched" value={exposures.filter((f) => f.cveId).length} sub={`${open.filter((f) => f.kev).length} open KEV · ${open.filter((f) => (f.epss?.score ?? 0) > 0.5).length} EPSS > 50%`} help="CVE-based findings enriched with NVD, CISA KEV and EPSS (illustrative snapshot) data." />
      </div>
      <FindingsTable tableId="exposures" rows={scored} views={FINDING_VIEWS} initialFilters={initialFilters} initialViewId="all" />
    </div>
  )
}

// ============================================================ Vulnerabilities

export function VulnerabilitiesPage() {
  usePage('Vulnerabilities', [{ label: 'Exposure Management' }, { label: 'Vulnerabilities' }])
  const settings = useSettings()
  const initialFilters = useUrlFilters(['severity', 'status', 'service', 'sla', 'kev'])
  const { data, isLoading, error, retry } = useCollections(['findings', 'assets', 'services'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={12} />
  const vulns = data.findings.filter((f) => f.domain === 'vulnerability')
  const scored = scoreFindings(vulns, data.assets, data.services, settings.weights)
  const open = vulns.filter((f) => isOpen(f.status))
  const uniqueCves = new Set(vulns.map((f) => f.cveId).filter(Boolean))
  return (
    <div className="space-y-5">
      <PageHeader title="Vulnerabilities" icon={<Bug />} description="CVE-identified software vulnerabilities affecting Northstar assets, with library mapping, exploitability context and remediation tracking." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Open vulnerabilities" value={open.length} sub={`${vulns.length} tracked · ${uniqueCves.size} unique CVEs`} />
        <KpiCard label="Known exploited (KEV)" value={open.filter((f) => f.kev).length} tone="red" sub="Open, CISA KEV-listed" />
        <KpiCard label="Internet-facing" value={scored.filter((s) => isOpen(s.f.status) && s.asset?.internetExposed).length} tone="amber" sub="Open on externally reachable assets" />
        <KpiCard label="Confirmed false positives" value={vulns.filter((f) => f.status === 'false_positive').length} sub="With recorded analyst rationale" />
      </div>
      <FindingsTable tableId="vulns" rows={scored} initialFilters={initialFilters} initialViewId="critical" hideColumns={['domain']} />
    </div>
  )
}

// ============================================================ Assets

const assetCol = createColumnHelper<Asset & { openFindings: number; serviceName: string; ownerName: string }>()

export function AssetsPage() {
  usePage('Assets', [{ label: 'Exposure Management' }, { label: 'Assets' }])
  const navigate = useNavigate()
  const initialFilters = useUrlFilters(['type', 'environment', 'service', 'internet'])
  const { data, isLoading, error, retry } = useCollections(['assets', 'services', 'findings', 'users', 'integrations', 'dataQuality'] as const)
  const { run, pending } = useAction()
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={12} />
  const { assets, services, findings, users, integrations } = data
  const active = assets.filter((a) => !a.duplicateOfId && !a.possibleDuplicateOfId)
  const candidates = assets.filter((a) => a.possibleDuplicateOfId)
  const merged = assets.filter((a) => a.duplicateOfId)
  const rows = active.map((a) => ({ ...a, openFindings: findings.filter((f) => f.assetId === a.id && isOpen(f.status)).length, serviceName: services.find((s) => s.id === a.businessServiceId)?.name ?? '—', ownerName: users.find((u) => u.id === a.ownerId)?.name ?? '—' }))
  const columns = [
    assetCol.accessor('name', { header: 'Asset', cell: (c) => <div><div className="font-medium">{c.getValue()}</div><div className="text-[11px] text-subtle">{c.row.original.fqdn ?? c.row.original.ipAddress}</div></div> }),
    assetCol.accessor('type', { header: 'Type', filterFn: 'multi', cell: (c) => ASSET_TYPE_LABEL[c.getValue()] }),
    assetCol.accessor('environment', { header: 'Environment', filterFn: 'multi', cell: (c) => <span className="capitalize text-muted">{c.getValue()}</span> }),
    assetCol.accessor('serviceName', { id: 'service', header: 'Business service', filterFn: 'multi' }),
    assetCol.accessor('criticality', { header: 'Criticality', filterFn: 'multi', cell: (c) => <CriticalityBadge value={c.getValue()} /> }),
    assetCol.accessor((a) => (a.internetExposed ? 'Internet-facing' : 'Internal'), { id: 'internet', header: 'Exposure', filterFn: 'multi', cell: (c) => <span className={c.getValue() === 'Internet-facing' ? 'text-orange-300' : 'text-muted'}>{c.getValue()}</span> }),
    assetCol.accessor('ownerName', { header: 'Owner', cell: (c) => <UserName id={c.row.original.ownerId} /> }),
    assetCol.accessor('openFindings', { header: 'Open findings', cell: (c) => <span className={c.getValue() ? 'font-semibold' : 'text-subtle'}>{c.getValue()}</span> }),
    assetCol.accessor((a) => a.sourceIntegrationIds.length, { id: 'sources', header: 'Sources', cell: (c) => <span className="text-muted">{c.getValue()}</span> }),
    assetCol.accessor('lastSeen', { header: 'Last seen', cell: (c) => <RelTime iso={c.getValue()} /> }),
  ]
  const coverage = integrations.filter((i) => i.status === 'connected' || i.status === 'error').map((i) => ({ i, n: active.filter((a) => a.sourceIntegrationIds.includes(i.id)).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)
  const noScanner = active.filter((a) => !a.sourceIntegrationIds.some((s) => ['INT-TEN', 'INT-QLY', 'INT-WIZ', 'INT-CRW', 'INT-GHB'].includes(s)))
  return (
    <div className="space-y-5">
      <PageHeader title="Asset Inventory" icon={<Server />} description="Normalized enterprise asset inventory built from all connected sources, mapped to business services and owners." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Assets" value={active.length} sub={`${active.filter((a) => a.environment === 'production').length} production`} />
        <KpiCard label="Internet-facing" value={active.filter((a) => a.internetExposed).length} tone="amber" onClick={() => navigate('/exposures/assets?internet=Internet-facing')} />
        <KpiCard label="Reconciliation queue" value={candidates.length} tone={candidates.length ? 'violet' : 'green'} sub={`${merged.length} duplicates merged`} />
        <KpiCard label="Without vulnerability coverage" value={noScanner.length} tone={noScanner.length ? 'amber' : 'green'} sub="No scanner/EDR/cloud source" />
      </div>
      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory"><Server /> Inventory ({active.length})</TabsTrigger>
          <TabsTrigger value="reconcile"><GitMerge /> Reconciliation ({candidates.length})</TabsTrigger>
          <TabsTrigger value="coverage"><Layers /> Source coverage</TabsTrigger>
        </TabsList>
        <TabsContent value="inventory">
          <DataTable tableId="assets" data={rows} columns={columns} getRowId={(a) => a.id} onRowClick={(a) => navigate(`/exposures/assets/${a.id}`)} searchPlaceholder="Search hostname, IP, FQDN…" initialFilters={initialFilters} facets={[{ columnId: 'type', label: 'Type' }, { columnId: 'environment', label: 'Environment' }, { columnId: 'service', label: 'Service' }, { columnId: 'criticality', label: 'Criticality' }, { columnId: 'internet', label: 'Exposure' }]} views={[{ id: 'all', label: 'All assets', filters: [] }, { id: 'internet', label: 'Internet-exposed assets', filters: [{ id: 'internet', value: ['Internet-facing'] }] }, { id: 'tier1', label: 'Tier 1', filters: [{ id: 'criticality', value: ['tier-1'] }] }, { id: 'prod', label: 'Production', filters: [{ id: 'environment', value: ['production'] }] }]} initialViewId="all" exportName="do-safe-assets" exportRow={(a) => ({ id: a.id, name: a.name, type: a.type, environment: a.environment, service: a.serviceName, owner: a.ownerName, criticality: a.criticality, internet_facing: a.internetExposed, ip: a.ipAddress ?? '', fqdn: a.fqdn ?? '', open_findings: a.openFindings, sources: a.sourceIntegrationIds.join(' ') })} selectable={false} />
        </TabsContent>
        <TabsContent value="reconcile" className="space-y-4">
          <Callout tone="info" icon={<GitMerge />} title="Asset reconciliation">
            The Asset Correlation Agent (simulated) proposes records that likely describe the same asset across sources. Merging moves findings and source provenance onto the canonical record. Every merge requires human confirmation.
          </Callout>
          {candidates.length === 0 && <Card><EmptyState icon={<CheckCircle2 />} title="Reconciliation queue is empty" description="All duplicate candidates have been reviewed." /></Card>}
          {candidates.map((c) => {
            const orig = assets.find((a) => a.id === c.possibleDuplicateOfId)!
            const signals = [
              orig.ipAddress && c.ipAddress === orig.ipAddress && 'Same IP address',
              c.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(orig.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)) && 'Hostname similarity',
              c.businessServiceId === orig.businessServiceId && 'Same business service',
              c.cloud === orig.cloud && c.cloud && 'Same cloud account/region',
              c.type === orig.type && 'Same asset type',
            ].filter(Boolean) as string[]
            const confidence = Math.min(0.98, 0.5 + signals.length * 0.1)
            return (
              <Card key={c.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[13px]">
                    <Badge tone="violet">Match confidence {fmtPct(confidence)}</Badge>
                    <ProvenanceBadge value="inferred" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => api.dismissDuplicate(c.id), 'Marked as distinct asset')}>
                      <X /> Not a duplicate
                    </Button>
                    <Button size="sm" disabled={pending} onClick={() => run(() => api.mergeAsset(c.id, orig.id), `Merged ${c.name} into ${orig.name}`)}>
                      <GitMerge /> Merge into canonical
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {[{ label: 'Canonical record', a: orig }, { label: 'Candidate duplicate', a: c }].map(({ label, a }) => (
                    <div key={a.id} className="rounded-lg border border-border bg-surface-2/50 p-3">
                      <div className="label-xs mb-1">{label}</div>
                      <div className="font-medium">{a.name}</div>
                      <KeyValue cols={2} className="mt-2" items={[{ label: 'ID', value: <span className="font-mono text-xs">{a.id}</span> }, { label: 'IP', value: a.ipAddress ?? '—' }, { label: 'FQDN', value: <span className="text-xs">{a.fqdn}</span> }, { label: 'Sources', value: a.sourceIntegrationIds.map((s) => <div key={s}><IntegrationName id={s} /></div>) }, { label: 'First seen', value: <RelTime iso={a.firstSeen} /> }, { label: 'Findings', value: findings.filter((f) => f.assetId === a.id).length }]} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  {signals.map((s) => (
                    <Badge key={s} tone="emerald">✓ {s}</Badge>
                  ))}
                </div>
              </Card>
            )
          })}
          {merged.length > 0 && (
            <Section title={`Previously merged (${merged.length})`}>
              <ul className="space-y-1 text-xs">
                {merged.map((m) => (
                  <li key={m.id}>
                    <span className="font-mono text-muted">{m.id}</span> {m.name} → <EntityLink type="asset" id={m.duplicateOfId} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </TabsContent>
        <TabsContent value="coverage" className="grid gap-5 lg:grid-cols-2">
          <Section title="Assets observed per source">
            <BarList items={coverage.map((c, i) => ({ label: c.i.name, value: c.n, color: CATEGORICAL[i % CATEGORICAL.length], onClick: () => navigate(`/integrations/${c.i.id}`) }))} />
          </Section>
          <Section title={`Coverage gaps (${noScanner.length})`} description="Assets not covered by any vulnerability, cloud, EDR or code scanner">
            <ul className="space-y-1.5">
              {noScanner.map((a) => (
                <li key={a.id} className="flex items-center justify-between text-xs">
                  <EntityLink type="asset" id={a.id} />
                  <span className="text-muted">{ASSET_TYPE_LABEL[a.type]}</span>
                </li>
              ))}
              {!noScanner.length && <li className="text-xs text-muted">Full coverage.</li>}
            </ul>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function AssetDetail() {
  const { id } = useParams()
  const settings = useSettings()
  const users = useUsers()
  const { data, isLoading, error, retry } = useCollections(['assets', 'services', 'findings', 'attackPaths', 'events', 'vendors'] as const)
  const a = data?.assets.find((x) => x.id === id)
  usePage(a?.name ?? 'Asset', [{ label: 'Exposure Management' }, { label: 'Assets', to: '/exposures/assets' }, { label: a?.name ?? id ?? '' }])
  const [edit, setEdit] = React.useState(false)
  const [owner, setOwner] = React.useState('')
  const [crit, setCrit] = React.useState<Asset['criticality']>('tier-3')
  const { run, pending } = useAction()
  React.useEffect(() => {
    if (a) api.recordRecent('asset', a.id, a.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id])
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} />
  if (!a) return <NotFound what="Asset" back={{ to: '/exposures/assets', label: 'Back to Assets' }} />
  const svc = data.services.find((s) => s.id === a.businessServiceId)
  const fs = scoreFindings(data.findings.filter((f) => f.assetId === a.id), data.assets, data.services, settings.weights)
  const open = fs.filter((x) => isOpen(x.f.status))
  const paths = data.attackPaths.filter((p) => p.steps.some((s) => s.assetId === a.id))
  const events = data.events.filter((e) => e.assetId === a.id)
  const dupes = data.assets.filter((x) => x.duplicateOfId === a.id || x.possibleDuplicateOfId === a.id)
  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/exposures/assets', label: 'Assets' }}
        title={a.name}
        icon={<Box />}
        description={`${ASSET_TYPE_LABEL[a.type]} · ${a.fqdn ?? ''}`}
        badges={<><CriticalityBadge value={a.criticality} />{a.internetExposed && <Badge tone="orange" icon={<Globe />}>Internet-facing</Badge>}{a.duplicateOfId && <Badge tone="slate">Merged duplicate</Badge>}</>}
        actions={<Button variant="secondary" onClick={() => { setOwner(a.ownerId); setCrit(a.criticality); setEdit(true) }}><Pencil /> Edit ownership & criticality</Button>}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Open findings" value={open.length} tone={open.some((x) => x.f.severity === 'critical') ? 'red' : 'default'} sub={`${open.filter((x) => x.f.severity === 'critical').length} critical · ${open.filter((x) => x.f.kev).length} KEV`} />
        <KpiCard label="Highest risk score" value={open.length ? Math.max(...open.map((x) => x.score)) : '—'} />
        <KpiCard label="Attack paths through asset" value={paths.length} tone={paths.some((p) => p.status === 'active') ? 'amber' : 'default'} />
        <KpiCard label="Security events (30d)" value={events.length} />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2" title="Asset details">
          <KeyValue cols={3} items={[{ label: 'Asset ID', value: <span className="font-mono">{a.id}</span> }, { label: 'Business service', value: svc ? <EntityLink type="service" id={svc.id} showId={false} /> : '—' }, { label: 'Owner', value: <UserName id={a.ownerId} /> }, { label: 'Environment', value: <span className="capitalize">{a.environment}</span> }, { label: 'IP address', value: a.ipAddress ?? '—' }, { label: 'Operating system', value: a.os ?? '—' }, { label: 'Cloud / location', value: [a.cloud, a.region].filter(Boolean).join(' · ') || '—' }, { label: 'First seen', value: fmtDateTime(a.firstSeen) }, { label: 'Last seen', value: fmtDateTime(a.lastSeen) }, { label: 'Tags', value: <div className="flex flex-wrap gap-1">{a.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div> }]} />
        </Section>
        <Section title="Source provenance" description="Connectors that observed this asset">
          <ul className="space-y-1.5 text-xs">
            {a.sourceIntegrationIds.map((s) => (
              <li key={s}>
                <IntegrationName id={s} />
              </li>
            ))}
          </ul>
          {dupes.length > 0 && (
            <div className="mt-3">
              <div className="label-xs mb-1">Reconciled records</div>
              {dupes.map((d) => (
                <div key={d.id} className="text-xs text-muted">
                  {d.name} ({d.id}) — {d.duplicateOfId ? 'merged' : 'pending review'}
                </div>
              ))}
            </div>
          )}
          <div className="label-xs mb-1 mt-3">Software inventory</div>
          <ul className="space-y-1 text-xs">
            {a.software.map((s) => (
              <li key={s.name} className="flex justify-between">
                <span>{s.name}</span>
                <span className="font-mono text-muted">{s.version}</span>
              </li>
            ))}
            {!a.software.length && <li className="text-muted">Not reported by sources.</li>}
          </ul>
        </Section>
      </div>
      <Tabs defaultValue="findings">
        <TabsList>
          <TabsTrigger value="findings">Findings ({fs.length})</TabsTrigger>
          <TabsTrigger value="paths">Attack paths ({paths.length})</TabsTrigger>
          <TabsTrigger value="events">Events ({events.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="findings">
          <FindingsTable tableId={`asset-${a.id}`} rows={fs} hideColumns={['target', 'service']} initialViewId="all" pageSize={10} />
        </TabsContent>
        <TabsContent value="paths">
          <Card className="divide-y divide-border/60">
            {paths.map((p) => (
              <Link key={p.id} to={`/exposures/attack-paths/${p.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2/50">
                <span className="text-[13px]">{p.name}</span>
                <Badge tone={p.status === 'active' ? 'red' : 'emerald'}>{p.status}</Badge>
              </Link>
            ))}
            {!paths.length && <EmptyState title="No attack paths" />}
          </Card>
        </TabsContent>
        <TabsContent value="events">
          <Card className="divide-y divide-border/60">
            {events.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
                <span>
                  <span className="font-mono text-[11px] text-muted">{e.id}</span> {e.title}
                </span>
                <span className="flex items-center gap-2">
                  <SeverityBadge severity={e.severity} />
                  <RelTime iso={e.occurredAt} className="text-xs" />
                </span>
              </div>
            ))}
            {!events.length && <EmptyState title="No events" />}
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent title="Edit ownership & criticality" description="Changes propagate to risk scoring for all findings on this asset.">
          <div className="space-y-4">
            <Field label="Owner">
              <NativeSelect value={owner} onChange={(e) => setOwner(e.target.value)}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.team}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Criticality">
              <NativeSelect value={crit} onChange={(e) => setCrit(e.target.value as Asset['criticality'])}>
                <option value="tier-1">Tier 1 — business critical</option>
                <option value="tier-2">Tier 2 — important</option>
                <option value="tier-3">Tier 3 — standard</option>
                <option value="tier-4">Tier 4 — low</option>
              </NativeSelect>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEdit(false)}>
              Cancel
            </Button>
            <Button
              loading={pending}
              onClick={async () => {
                await run(() => api.updateAsset(a.id, { ownerId: owner, criticality: crit }, `Owner → ${users.find((u) => u.id === owner)?.name}; criticality → ${crit}`), 'Asset updated')
                setEdit(false)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================ Attack paths

export function AttackPathsPage() {
  usePage('Attack Paths', [{ label: 'Exposure Management' }, { label: 'Attack Paths' }])
  const { data, isLoading, error, retry } = useCollections(['attackPaths', 'assets', 'findings', 'services'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={6} />
  const { attackPaths, assets, findings, services } = data
  return (
    <div className="space-y-5">
      <PageHeader title="Attack Path Analysis" icon={<Route />} description="Plausible chains of exposures, reachability and identity weaknesses that lead to crown-jewel assets. Paths are computed by the Attack Path Analysis Agent (simulated) from demo data." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Active paths" value={attackPaths.filter((p) => p.status === 'active').length} tone="red" />
        <KpiCard label="Paths to tier-1 assets" value={attackPaths.filter((p) => assets.find((a) => a.id === p.targetAssetId)?.criticality === 'tier-1').length} />
        <KpiCard label="Choke-point findings" value={new Set(attackPaths.flatMap((p) => p.steps.map((s) => s.findingId)).filter(Boolean)).size} sub="Findings that break ≥1 path when fixed" />
        <KpiCard label="Mitigated / accepted" value={attackPaths.filter((p) => p.status !== 'active').length} tone="green" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {attackPaths.map((p) => (
          <Link key={p.id} to={`/exposures/attack-paths/${p.id}`} className="card p-4 hover:border-border-strong">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-mono text-[11px] text-muted">{p.id}</div>
                <div className="text-[14px] font-semibold">{p.name}</div>
                <div className="text-xs text-muted">{services.find((s) => s.id === p.businessServiceId)?.name} · likelihood {p.likelihood}</div>
              </div>
              <div className="flex gap-1.5">
                <SeverityBadge severity={p.impact} />
                <Badge tone={p.status === 'active' ? 'red' : p.status === 'mitigated' ? 'emerald' : 'slate'}>{p.status}</Badge>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
              {p.steps.map((s, i) => {
                const f = findings.find((x) => x.id === s.findingId)
                return (
                  <React.Fragment key={i}>
                    {i > 0 && <ArrowRight className="size-3.5 text-subtle" />}
                    <span className={cn('rounded-md border px-2 py-1', f && isOpen(f.status) ? 'border-red-500/30 bg-red-500/8' : 'border-border bg-surface-2')}>
                      {assets.find((a) => a.id === s.assetId)?.name}
                      {s.techniqueId && <span className="ml-1 font-mono text-[10px] text-sky-300">{s.techniqueId}</span>}
                    </span>
                  </React.Fragment>
                )
              })}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function PathNode({ data }: { data: { label: string; sub: string; tone: 'entry' | 'mid' | 'target'; open: boolean; selected: boolean } }) {
  return (
    <div className={cn('w-52 rounded-xl border bg-surface px-3 py-2.5 shadow-lg', data.selected ? 'border-violet-400 ring-2 ring-violet-500/30' : data.open ? 'border-red-500/50' : 'border-border-strong')}>
      <Handle type="target" position={Position.Left} className="!bg-violet-400" />
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-subtle">
        {data.tone === 'entry' ? <Crosshair className="size-3 text-orange-300" /> : data.tone === 'target' ? <Target className="size-3 text-red-300" /> : <Server className="size-3" />}
        {data.tone === 'entry' ? 'Entry point' : data.tone === 'target' ? 'Target' : 'Pivot'}
      </div>
      <div className="mt-0.5 truncate text-[13px] font-medium text-fg">{data.label}</div>
      <div className="truncate text-[11px] text-muted">{data.sub}</div>
      <Handle type="source" position={Position.Right} className="!bg-violet-400" />
    </div>
  )
}
const nodeTypes = { path: PathNode }

export function AttackPathDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, error, retry } = useCollections(['attackPaths', 'assets', 'findings', 'knowledge', 'services'] as const)
  const p = data?.attackPaths.find((x) => x.id === id)
  usePage(p?.name ?? 'Attack path', [{ label: 'Exposure Management' }, { label: 'Attack Paths', to: '/exposures/attack-paths' }, { label: id ?? '' }])
  const [sel, setSel] = React.useState(0)
  const [acceptOpen, setAcceptOpen] = React.useState(false)
  const [note, setNote] = React.useState('')
  const { run, pending } = useAction()
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={8} />
  if (!p) return <NotFound what="Attack path" back={{ to: '/exposures/attack-paths', label: 'Back to Attack Paths' }} />
  const { assets, findings, knowledge } = data
  const nodes: Node[] = p.steps.map((s, i) => {
    const a = assets.find((x) => x.id === s.assetId)
    const f = findings.find((x) => x.id === s.findingId)
    return { id: String(i), type: 'path', position: { x: i * 280, y: i % 2 ? 60 : 0 }, data: { label: a?.name ?? s.assetId, sub: f ? f.title : s.description, tone: i === 0 ? 'entry' : i === p.steps.length - 1 ? 'target' : 'mid', open: !!f && isOpen(f.status), selected: sel === i } }
  })
  const edges: Edge[] = p.steps.slice(1).map((s, i) => ({ id: `e${i}`, source: String(i), target: String(i + 1), label: s.techniqueId ?? '', animated: p.status === 'active', style: { stroke: p.status === 'active' ? '#ef4444' : '#3a4360', strokeWidth: 2 }, labelStyle: { fill: '#7dd3fc', fontSize: 11, fontFamily: 'JetBrains Mono' }, labelBgStyle: { fill: '#111522' }, markerEnd: { type: MarkerType.ArrowClosed, color: p.status === 'active' ? '#ef4444' : '#3a4360' } }))
  const step = p.steps[sel]
  const stepAsset = assets.find((a) => a.id === step.assetId)
  const stepFinding = findings.find((f) => f.id === step.findingId)
  const tech = step.techniqueId ? knowledge.find((k) => k.externalId === step.techniqueId) : undefined
  const pathFindings = p.steps.map((s) => findings.find((f) => f.id === s.findingId)).filter(Boolean)
  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/exposures/attack-paths', label: 'Attack Paths' }}
        title={p.name}
        icon={<Route />}
        badges={<><SeverityBadge severity={p.impact} /><Badge tone={p.status === 'active' ? 'red' : p.status === 'mitigated' ? 'emerald' : 'slate'}>{p.status}</Badge></>}
        description={`Likelihood ${p.likelihood} · ${p.steps.length} steps · discovered ${fmtDateTime(p.discoveredAt)}`}
        actions={p.status === 'active' ? <Button variant="secondary" onClick={() => setAcceptOpen(true)}>Accept path risk</Button> : <Button variant="secondary" loading={pending} onClick={() => run(() => api.setAttackPathStatus(p.id, 'active', 'Reactivated'), 'Path reactivated')}><RotateCcw /> Reactivate</Button>}
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="h-[380px] overflow-hidden xl:col-span-2">
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.25 }} onNodeClick={(_, n) => setSel(Number(n.id))} nodesDraggable={false}>
            <Background color="#1f2638" gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </Card>
        <Section title={`Step ${sel + 1}: ${stepAsset?.name}`} description={step.description}>
          <KeyValue cols={1} items={[{ label: 'Asset', value: <EntityLink type="asset" id={step.assetId} /> }, { label: 'Exploited finding', value: stepFinding ? <div className="space-y-1"><EntityLink type="finding" id={stepFinding.id} /><div className="flex gap-1.5"><SeverityBadge severity={stepFinding.severity} /><FindingStatusBadge status={stepFinding.status} />{stepFinding.kev && <KevBadge />}</div></div> : <span className="text-muted">No discrete finding — relies on reachability / credentials</span> }, { label: 'ATT&CK technique', value: tech ? <Link to={`/intelligence/library/${tech.id}`} className="text-violet-300">{tech.externalId} — {tech.name}</Link> : 'Not mapped' }]} />
          {stepFinding && isOpen(stepFinding.status) && (
            <Button size="sm" className="mt-4 w-full" onClick={() => navigate(`/exposures/vulnerabilities/${stepFinding.id}`)}>
              Investigate & remediate this step
            </Button>
          )}
        </Section>
      </div>
      <Section title="Break the path" description="Remediating any open finding in the chain breaks this path. Prioritize choke points.">
        <div className="space-y-2">
          {pathFindings.map((f) => (
            <div key={f!.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
              <EntityLink type="finding" id={f!.id} />
              <div className="flex items-center gap-2">
                <FindingStatusBadge status={f!.status} />
                <span className="text-xs text-muted">{f!.ticketIds.length ? `${f!.ticketIds.length} ticket(s)` : 'no ticket'}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent title="Accept attack path risk" description="Records a decision that this path is accepted (e.g. compensating controls). Logged in the audit trail.">
          <Field label="Rationale" required>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAcceptOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={note.trim().length < 10}
              loading={pending}
              onClick={async () => {
                await run(() => api.setAttackPathStatus(p.id, 'accepted', note), 'Attack path accepted')
                setAcceptOpen(false)
              }}
            >
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================ Prioritization

const WEIGHT_LABELS: Record<keyof PrioritizationWeights, [string, string]> = {
  cvss: ['CVSS base severity', 'Technical severity of the vulnerability (or contextual severity when no CVE applies).'],
  epss: ['EPSS exploit probability', 'Probability of exploitation in the next 30 days (illustrative snapshot values).'],
  kev: ['Known exploitation (KEV)', 'Listed in the CISA Known Exploited Vulnerabilities catalog.'],
  exploit: ['Exploit maturity', 'Public PoC, functional or weaponized exploit available.'],
  internet: ['Internet exposure', 'Asset is reachable from the internet (or shadow AI egress).'],
  assetCriticality: ['Asset criticality', 'Tier of the affected asset.'],
  serviceCriticality: ['Business service criticality', 'Tier of the business service the asset supports.'],
  compensating: ['Compensating controls (reduces)', 'Strength of observed compensating controls / not-exploitable validation.'],
}

export function PrioritizationPage() {
  usePage('Dynamic Prioritization', [{ label: 'Exposure Management' }, { label: 'Prioritization' }])
  const settings = useSettings()
  const navigate = useNavigate()
  const [w, setW] = React.useState<PrioritizationWeights>(settings.weights)
  const { run, pending } = useAction()
  const { data, isLoading, error, retry } = useCollections(['findings', 'assets', 'services'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={12} />
  const open = data.findings.filter((f) => isOpen(f.status) && f.domain !== 'ai')
  const current = scoreFindings(open, data.assets, data.services, settings.weights).sort((a, b) => b.score - a.score)
  const preview = scoreFindings(open, data.assets, data.services, w).sort((a, b) => b.score - a.score)
  const currentRank = new Map(current.map((c, i) => [c.f.id, i + 1]))
  const dirty = JSON.stringify(w) !== JSON.stringify(settings.weights)
  return (
    <div className="space-y-5">
      <PageHeader
        title="Dynamic Risk Prioritization"
        icon={<Gauge />}
        description="Rank exposures using severity, exploitability, threat intelligence, exposure, business criticality and compensating controls. Tune weights and preview the re-ranked queue before applying."
        actions={
          <>
            <Button variant="secondary" onClick={() => setW({ ...DEFAULT_WEIGHTS })}>
              <RotateCcw /> Reset to defaults
            </Button>
            <Button disabled={!dirty} loading={pending} onClick={() => run(() => api.updateSettings({ weights: w }, 'Prioritization weights updated'), 'Weights applied — risk scores updated across DO SAFE')}>
              <Save /> Apply as organization default
            </Button>
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <Section title="Model weights" description="Illustrative scoring model — normalized weighted sum (0–100)">
          <div className="space-y-4">
            {(Object.keys(WEIGHT_LABELS) as (keyof PrioritizationWeights)[]).map((k) => (
              <div key={k}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1">
                    {WEIGHT_LABELS[k][0]} <InfoHint text={WEIGHT_LABELS[k][1]} />
                  </span>
                  <span className="num font-semibold">{w[k]}</span>
                </div>
                <Slider value={[w[k]]} min={0} max={40} step={1} onValueChange={([v]) => setW((x) => ({ ...x, [k]: v }))} aria-label={WEIGHT_LABELS[k][0]} />
              </div>
            ))}
          </div>
          {dirty && <Callout tone="warn">Preview only — apply to update risk scores on dashboards, tables and the intelligence assistant.</Callout>}
        </Section>
        <Section className="xl:col-span-2" title="Prioritized queue (preview)" description={`Top 20 of ${open.length} open exposures. Arrows show rank change vs. current organization weights.`}>
          <div className="divide-y divide-border/60">
            {preview.slice(0, 20).map((p, i) => {
              const prev = currentRank.get(p.f.id) ?? i + 1
              const delta = prev - (i + 1)
              return (
                <button key={p.f.id} onClick={() => navigate(`/exposures/vulnerabilities/${p.f.id}`)} className="flex w-full items-center gap-3 py-2 text-left hover:bg-surface-2/40 cursor-pointer">
                  <span className="num w-6 text-right text-xs text-subtle">{i + 1}</span>
                  <span className={cn('flex w-10 items-center gap-0.5 text-[11px]', delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-red-300' : 'text-subtle')}>
                    {delta > 0 ? <ArrowUp className="size-3" /> : delta < 0 ? <ArrowDown className="size-3" /> : null}
                    {delta !== 0 ? Math.abs(delta) : '–'}
                  </span>
                  <RiskScore score={p.score} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{p.f.title}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {p.f.id} · {p.asset?.name} · {p.service?.name}
                    </span>
                  </span>
                  <span className="hidden gap-1 md:flex">
                    {p.f.kev && <Badge tone="red">KEV</Badge>}
                    {p.asset?.internetExposed && <Badge tone="orange">Internet</Badge>}
                    <SeverityBadge severity={p.f.severity} />
                  </span>
                </button>
              )
            })}
          </div>
        </Section>
      </div>
    </div>
  )
}

// ============================================================ Validation

export function ValidationPage() {
  usePage('Exploitability Validation', [{ label: 'Exposure Management' }, { label: 'Validation' }])
  const settings = useSettings()
  const navigate = useNavigate()
  const { run, pending } = useAction()
  const [running, setRunning] = React.useState<string | null>(null)
  const [q, setQ] = React.useState('')
  const { data, isLoading, error, retry } = useCollections(['findings', 'assets', 'services'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={10} />
  const ex = data.findings.filter((f) => f.domain !== 'ai')
  const queue = scoreFindings(ex.filter((f) => ['new', 'triaged', 'in_validation'].includes(f.status)), data.assets, data.services, settings.weights).sort((a, b) => b.score - a.score).filter((s) => !q || `${s.f.id} ${s.f.title} ${s.asset?.name}`.toLowerCase().includes(q.toLowerCase()))
  const validated = ex.filter((f) => f.validation.validatedAt).sort((a, b) => (b.validation.validatedAt ?? '').localeCompare(a.validation.validatedAt ?? ''))
  const counts = { exploitable: ex.filter((f) => f.validation.status === 'exploitable').length, not: ex.filter((f) => f.validation.status === 'not_exploitable').length, inconclusive: ex.filter((f) => f.validation.status === 'inconclusive').length, progress: ex.filter((f) => f.validation.status === 'in_progress').length }
  const doRun = async (id: string) => {
    setRunning(id)
    await run(() => api.runValidation(id), 'Validation completed (simulated)')
    setRunning(null)
  }
  return (
    <div className="space-y-5">
      <PageHeader title="Exploitability Validation" icon={<ShieldCheck />} description="Assess whether reported exposures are genuinely exploitable: reachability, exploit preconditions and compensating control effectiveness." />
      <Callout tone="demo" icon={<ShieldCheck />} title="Simulated validation">
        Validation runs in this prototype are simulated from asset exposure, exploit maturity and control data. No scanning or exploitation is performed against any system.
      </Callout>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Exploitable" value={counts.exploitable} tone="red" />
        <KpiCard label="Not exploitable" value={counts.not} tone="green" sub="Candidates for FP review / risk acceptance" />
        <KpiCard label="Inconclusive" value={counts.inconclusive} tone="amber" />
        <KpiCard label="In progress" value={counts.progress} tone="violet" />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2" title={`Validation queue (${queue.length})`} description="Untriaged and in-validation exposures, highest risk first" actions={<div className="relative"><Search className="pointer-events-none absolute left-2 top-2 size-3.5 text-subtle" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" aria-label="Filter queue" className="h-8 w-44 rounded-lg border border-border bg-surface-2 pl-7 pr-2 text-xs focus:outline-none" /></div>}>
          {queue.length === 0 ? (
            <EmptyState search={!!q} title={q ? 'No matching findings' : 'Validation queue is empty'} />
          ) : (
            <div className="divide-y divide-border/60">
              {queue.slice(0, 25).map((s) => (
                <div key={s.f.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <RiskScore score={s.score} />
                  <button onClick={() => navigate(`/exposures/vulnerabilities/${s.f.id}`)} className="min-w-0 flex-1 text-left cursor-pointer">
                    <span className="block truncate text-[13px] hover:text-violet-200">{s.f.title}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {s.f.id} · {s.asset?.name} {s.asset?.internetExposed && '· internet-facing'}
                    </span>
                  </button>
                  <FindingStatusBadge status={s.f.status} />
                  <div className="flex gap-1.5">
                    {s.f.status !== 'in_validation' && (
                      <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => api.startValidation(s.f.id), 'Queued for validation')}>
                        Queue
                      </Button>
                    )}
                    <Button size="xs" variant="secondary" loading={running === s.f.id} disabled={!!running && running !== s.f.id} onClick={() => doRun(s.f.id)}>
                      <Play /> Run validation
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
        <Section title="Recent validation results">
          <div className="space-y-2.5">
            {validated.slice(0, 10).map((f) => (
              <Link key={f.id} to={`/exposures/vulnerabilities/${f.id}`} className="block rounded-lg bg-surface-2 px-3 py-2 hover:bg-surface-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium">{f.title}</span>
                  <Badge tone={f.validation.status === 'exploitable' ? 'red' : f.validation.status === 'not_exploitable' ? 'emerald' : 'amber'}>{f.validation.status.replace('_', ' ')}</Badge>
                </div>
                <div className="mt-0.5 text-[11px] text-subtle">
                  {f.validation.method} · <RelTime iso={f.validation.validatedAt} />
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-4">
            <div className="label-xs mb-2">Outcome mix</div>
            <div className="flex h-2 overflow-hidden rounded-full">
              {[
                ['#ef4444', counts.exploitable],
                ['#22c55e', counts.not],
                ['#f59e0b', counts.inconclusive],
              ].map(([c, n], i) => (
                <div key={i} style={{ width: `${((n as number) / Math.max(1, counts.exploitable + counts.not + counts.inconclusive)) * 100}%`, background: c as string }} className="border-r-2 border-surface last:border-0" />
              ))}
            </div>
            <div className="mt-1.5 flex gap-3 text-[11px] text-muted">
              <span>● Exploitable</span>
              <span className="text-green-300">● Not exploitable</span>
              <span className="text-amber-300">● Inconclusive</span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
