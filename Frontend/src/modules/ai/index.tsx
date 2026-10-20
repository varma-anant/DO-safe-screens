import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { createColumnHelper } from '@tanstack/react-table'
import { ReactFlow, Background, Controls, Handle, Position, type Edge, type Node } from '@xyflow/react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, Bot, Boxes, Building2, CheckCircle2, ClipboardCheck, Database, EyeOff, FileSignature, Gavel, MessageSquare, Plus, Scale, Settings2, ShieldAlert, Ticket as TicketIcon, XCircle, HelpCircle, Network } from 'lucide-react'
import type { AIApproval, AISystem, GovernanceReview } from '@/types'
import { useAction, useCollections, useSettings, useUsers } from '@/hooks/queries'
import { usePage, useUrlFilters } from '@/hooks/usePage'
import { Callout, EmptyState, ErrorState, KeyValue, KpiCard, LoadingState, NotFound, PageHeader, Section, Stat } from '@/components/common/layout'
import { Badge, DemoTag, FindingStatusBadge, ProvenanceBadge, RiskScore, SeverityBadge, StatusBadge } from '@/components/common/badges'
import { EntityLink, IntegrationName, RelTime, Timeline, UserName } from '@/components/common/entities'
import { DataTable } from '@/components/common/DataTable'
import { AXIS, ChartTooltip, GRID } from '@/components/common/charts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FindingsTable } from '@/modules/findings/FindingsTable'
import { CreateTicketDialog } from '@/modules/findings/dialogs'
import * as api from '@/services/api'
import { cn, fmtDate, fmtDateTime, fmtNum } from '@/utils/format'
import { AI_APPROVAL, ASSESSMENT_STATUS, isOpen, SEVERITY_COLOR } from '@/utils/labels'
import { aiRiskScore, riskBand } from '@/utils/risk'
import { scoreFindings } from '@/utils/derive'

const DIMENSIONS = ['Live activity', 'Configuration', 'External exposure', 'Compliance evidence', 'Contract'] as const
const SIG_COLOR = { ok: 'bg-emerald-500/20 text-emerald-300', warning: 'bg-amber-500/20 text-amber-300', risk: 'bg-red-500/25 text-red-300', unknown: 'bg-slate-500/15 text-slate-400' }
const GOV_STATUS: Record<GovernanceReview['status'], { label: string; tone: 'violet' | 'amber' | 'emerald' | 'red' | 'slate' | 'sky' }> = { open: { label: 'Open', tone: 'violet' }, in_review: { label: 'In review', tone: 'amber' }, approved: { label: 'Approved', tone: 'emerald' }, approved_with_conditions: { label: 'Approved with conditions', tone: 'sky' }, rejected: { label: 'Rejected / prohibited', tone: 'red' }, closed: { label: 'Closed', tone: 'slate' } }
const POLICIES = ['AI Acceptable Use Policy §3.2', 'AI Acceptable Use Policy §5', 'AI Risk Management Standard §4', 'AI Risk Management Standard §6', 'Data Classification Standard §4', 'Third-Party Risk Standard §2.4', 'Data Residency Standard', 'Model Risk Management (SR 11-7)']

// ---------------------------------------------------------------- governance review dialog (shared)

export function NewGovernanceReviewDialog({ ai, findingId, open, onOpenChange }: { ai?: AISystem; findingId?: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const users = useUsers()
  const navigate = useNavigate()
  const { data } = useCollections(['aiSystems'] as const)
  const { run, pending } = useAction()
  const [form, setForm] = React.useState({ aiSystemId: ai?.id ?? '', type: (ai?.approval === 'unsanctioned' ? 'Shadow AI review' : 'Periodic review') as GovernanceReview['type'], reviewerId: '', policies: [] as string[], note: '' })
  const sys = data?.aiSystems.find((a) => a.id === form.aiSystemId)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide title="Create governance review" description="Opens an AI governance case. Unsanctioned systems move to “Under review”; a human reviewer decides the outcome.">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="AI system" required>
              <NativeSelect value={form.aiSystemId} onChange={(e) => setForm({ ...form, aiSystemId: e.target.value })} disabled={!!ai}>
                <option value="">Select…</option>
                {data?.aiSystems.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Review type" required>
              <NativeSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as GovernanceReview['type'] })}>
                {['Shadow AI review', 'New AI use-case approval', 'Configuration exception', 'Policy violation', 'Periodic review'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Reviewer" hint="Leave empty to queue for the governance board">
              <NativeSelect value={form.reviewerId} onChange={(e) => setForm({ ...form, reviewerId: e.target.value })}>
                <option value="">Governance board (unassigned)</option>
                {users.filter((u) => ['AI Security Analyst', 'CISO', 'Risk Manager'].includes(u.role)).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.role}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Linked finding">
              <Input value={findingId ?? 'None'} readOnly className="text-muted" />
            </Field>
          </div>
          <Field label="Policy references" required>
            <div className="flex flex-wrap gap-1.5">
              {POLICIES.map((p) => (
                <button type="button" key={p} onClick={() => setForm({ ...form, policies: form.policies.includes(p) ? form.policies.filter((x) => x !== p) : [...form.policies, p] })} className={cn('rounded-lg border px-2 py-1 text-xs cursor-pointer', form.policies.includes(p) ? 'border-violet-500/60 bg-violet-500/15 text-violet-200' : 'border-border text-muted')}>
                  {p}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Initial note">
            <Textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Context for the reviewer: usage observed, business need, data involved…" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!form.aiSystemId || !form.policies.length}
            loading={pending}
            onClick={async () => {
              const g = await run(() => api.createGovernanceReview({ aiSystemId: form.aiSystemId, findingId, title: `${form.type} — ${sys?.name}`, type: form.type, reviewerId: form.reviewerId || undefined, policyRefs: form.policies, note: form.note || undefined }), (x) => `Governance review ${x.id} opened`)
              onOpenChange(false)
              if (g) navigate(`/ai-security/governance/${g.id}`)
            }}
          >
            <Scale /> Open review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================ Overview

export function AIOverview() {
  usePage('AI Security Overview', [{ label: 'AI Security' }, { label: 'Overview' }])
  const navigate = useNavigate()
  const { data, isLoading, error, retry } = useCollections(['aiSystems', 'findings', 'governanceReviews'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={5} rows={8} />
  const { aiSystems, findings, governanceReviews } = data
  const aiF = findings.filter((f) => f.domain === 'ai')
  const openAI = aiF.filter((f) => isOpen(f.status))
  const scored = aiSystems.map((a) => ({ a, score: aiRiskScore(a, findings) })).sort((x, y) => y.score - x.score)
  const shadow = aiSystems.filter((a) => a.approval === 'unsanctioned' || (a.approval === 'prohibited' && a.users > 0))
  const cats = Object.entries(openAI.reduce<Record<string, number>>((acc, f) => ((acc[f.category] = (acc[f.category] ?? 0) + 1), acc), {})).map(([name, value]) => ({ name, value }))
  return (
    <div className="space-y-5">
      <PageHeader title="AI Security Posture" icon={<Bot />} description="Visibility across Northstar's AI ecosystem — sanctioned assistants, RAG apps, agents, ML models and shadow AI — correlating live activity, configuration, external exposure, compliance evidence and contracts." actions={<Button asChild variant="secondary"><Link to="/ai-security/shadow-ai"><EyeOff /> Investigate shadow AI</Link></Button>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="AI systems" value={aiSystems.length} sub={`${aiSystems.filter((a) => a.approval === 'approved').length} approved`} onClick={() => navigate('/ai-security/inventory')} />
        <KpiCard label="Shadow AI" value={shadow.length} tone="red" sub={`${fmtNum(shadow.reduce((s, a) => s + a.users, 0))} users`} onClick={() => navigate('/ai-security/shadow-ai')} />
        <KpiCard label="Non-compliant" value={aiSystems.filter((a) => a.governanceStatus === 'non_compliant').length} tone="amber" onClick={() => navigate('/ai-security/inventory?governance=non_compliant')} />
        <KpiCard label="Open AI findings" value={openAI.length} sub={`${openAI.filter((f) => f.severity === 'critical').length} critical`} onClick={() => navigate('/ai-security/config-risks')} />
        <KpiCard label="Governance reviews open" value={governanceReviews.filter((g) => ['open', 'in_review'].includes(g.status)).length} onClick={() => navigate('/ai-security/governance')} />
      </div>
      <Section title="AI risk correlation" description="Five exposure dimensions per AI system. Correlated weak signals across dimensions indicate broader exposure. Click a system to inspect its risk graph.">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-subtle">
                <th className="py-2 pr-3 font-medium">AI system</th>
                <th className="py-2 pr-3 font-medium">Approval</th>
                {DIMENSIONS.map((d) => (
                  <th key={d} className="px-1 py-2 text-center font-medium">{d}</th>
                ))}
                <th className="py-2 pl-3 text-right font-medium">Risk</th>
              </tr>
            </thead>
            <tbody>
              {scored.map(({ a, score }) => (
                <tr key={a.id} onClick={() => navigate(`/ai-security/systems/${a.id}`)} className="cursor-pointer border-t border-border/50 hover:bg-surface-2/50">
                  <td className="py-1.5 pr-3">
                    <div className="font-medium text-fg">{a.name}</div>
                    <div className="text-[11px] text-subtle">{a.type} · {a.provider}</div>
                  </td>
                  <td className="py-1.5 pr-3"><StatusBadge map={AI_APPROVAL} value={a.approval} /></td>
                  {DIMENSIONS.map((d) => {
                    const s = a.signals.find((x) => x.dimension === d)
                    return (
                      <td key={d} className="px-1 py-1.5" title={s?.detail}>
                        <div className={cn('mx-auto flex h-7 max-w-24 items-center justify-center rounded-md text-[10px] font-semibold uppercase', SIG_COLOR[s?.status ?? 'unknown'])}>{s?.status ?? 'unknown'}</div>
                      </td>
                    )
                  })}
                  <td className="py-1.5 pl-3 text-right"><RiskScore score={score} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <div className="grid gap-5 xl:grid-cols-3">
        <Section title="Shadow AI detected" description="Unsanctioned AI usage with detection source" actions={<Button size="xs" variant="ghost" asChild><Link to="/ai-security/shadow-ai">All</Link></Button>}>
          <ul className="space-y-2">
            {shadow.map((a) => (
              <li key={a.id}>
                <Link to={`/ai-security/systems/${a.id}`} className="block rounded-lg bg-surface-2 px-3 py-2 hover:bg-surface-3">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-xs text-muted">{a.users} users</span>
                  </div>
                  <div className="text-[11px] text-subtle">Detected via {a.discoveredVia.join(', ')}</div>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Open AI findings by category">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={cats} layout="vertical" margin={{ left: 0, right: 12 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={130} {...AXIS} />
                <RTooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Findings" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={14} onClick={() => navigate('/ai-security/config-risks')} className="cursor-pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="AI posture by system" description="Illustrative AI risk score">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={scored.slice(0, 8).map(({ a, score }) => ({ name: a.name.split(' ')[0], score, id: a.id }))} margin={{ left: -18, right: 8, top: 8 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" {...AXIS} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis {...AXIS} domain={[0, 100]} />
                <RTooltip content={<ChartTooltip />} />
                <Bar dataKey="score" name="Risk score" radius={[4, 4, 0, 0]} onClick={(d) => navigate(`/ai-security/systems/${(d as unknown as { id: string }).id}`)} className="cursor-pointer">
                  {scored.slice(0, 8).map(({ a, score }) => <Cell key={a.id} fill={SEVERITY_COLOR[riskBand(score)]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>
      <Callout tone="info" icon={<HelpCircle />}>No single data source detects every AI risk. DO SAFE correlates SSE traffic, IdP OAuth grants, EDR browser-extension inventory, code platform app installs, cloud configuration and contract records. Each finding shows its detection source and evidence.</Callout>
    </div>
  )
}

// ============================================================ Inventory

const aiCol = createColumnHelper<AISystem & { score: number; openFindings: number }>()

export function AIInventory() {
  usePage('AI Inventory', [{ label: 'AI Security' }, { label: 'AI Inventory' }])
  const navigate = useNavigate()
  const initialFilters = useUrlFilters(['approval', 'type', 'governance'])
  const { data, isLoading, error, retry } = useCollections(['aiSystems', 'findings'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={12} />
  const rows = data.aiSystems.map((a) => ({ ...a, score: aiRiskScore(a, data.findings), openFindings: data.findings.filter((f) => f.aiSystemId === a.id && isOpen(f.status)).length }))
  const columns = [
    aiCol.accessor('name', { header: 'AI system', cell: (c) => <div><div className="font-medium">{c.getValue()}</div><div className="text-[11px] text-subtle">{c.row.original.provider}</div></div> }),
    aiCol.accessor('type', { header: 'Type', filterFn: 'multi' }),
    aiCol.accessor('approval', { header: 'Approval', filterFn: 'multi', cell: (c) => <StatusBadge map={AI_APPROVAL} value={c.getValue()} /> }),
    aiCol.accessor('governanceStatus', { id: 'governance', header: 'Governance', filterFn: 'multi', cell: (c) => <Badge tone={c.getValue() === 'compliant' ? 'emerald' : c.getValue() === 'non_compliant' ? 'red' : c.getValue() === 'review_required' ? 'amber' : 'slate'}>{c.getValue().replace('_', ' ')}</Badge> }),
    aiCol.accessor('deployment', { header: 'Deployment', cell: (c) => <span className="text-muted">{c.getValue()}</span> }),
    aiCol.accessor('dataClassification', { header: 'Data', filterFn: 'multi', cell: (c) => <span className="text-muted">{c.getValue()}</span> }),
    aiCol.accessor('users', { header: 'Users', cell: (c) => <span className="num">{fmtNum(c.getValue())}</span> }),
    aiCol.accessor('openFindings', { header: 'Open findings' }),
    aiCol.accessor('score', { header: 'Risk', cell: (c) => <RiskScore score={c.getValue()} /> }),
    aiCol.accessor('lastActivity', { header: 'Last activity', cell: (c) => <RelTime iso={c.getValue()} /> }),
  ]
  return (
    <div className="space-y-5">
      <PageHeader title="AI Inventory" icon={<Boxes />} description="All AI systems discovered or registered: approved enterprise tools, internal AI applications, embedded SaaS AI features and shadow AI." />
      <DataTable key={JSON.stringify(initialFilters)} tableId="ai-inventory" data={rows} columns={columns} getRowId={(a) => a.id} onRowClick={(a) => navigate(`/ai-security/systems/${a.id}`)} initialFilters={initialFilters} facets={[{ columnId: 'approval', label: 'Approval', options: Object.entries(AI_APPROVAL).map(([value, x]) => ({ value, label: x.label })) }, { columnId: 'type', label: 'Type' }, { columnId: 'governance', label: 'Governance' }, { columnId: 'dataClassification', label: 'Data' }]} views={[{ id: 'all', label: 'All AI systems', filters: [] }, { id: 'approved', label: 'Approved AI tools', filters: [{ id: 'approval', value: ['approved'] }] }, { id: 'shadow', label: 'Shadow AI', filters: [{ id: 'approval', value: ['unsanctioned', 'prohibited'] }] }, { id: 'review', label: 'Under review', filters: [{ id: 'approval', value: ['under_review'] }] }]} initialViewId="all" exportName="do-safe-ai-inventory" exportRow={(a) => ({ id: a.id, name: a.name, type: a.type, provider: a.provider, approval: a.approval, governance: a.governanceStatus, users: a.users, data: a.dataClassification, risk: a.score })} selectable={false} />
    </div>
  )
}

// ============================================================ AI system detail

function GraphNode({ data }: { data: { label: string; sub: string; kind: 'ai' | 'vendor' | 'finding' | 'data' | 'signal'; tone?: string } }) {
  const icon = { ai: <Bot className="size-3.5 text-violet-300" />, vendor: <Building2 className="size-3.5 text-sky-300" />, finding: <ShieldAlert className="size-3.5 text-red-300" />, data: <Database className="size-3.5 text-amber-300" />, signal: <Network className="size-3.5 text-emerald-300" /> }[data.kind]
  return (
    <div className={cn('w-44 rounded-lg border bg-surface px-2.5 py-2 shadow', data.kind === 'ai' ? 'border-violet-400' : data.tone === 'risk' ? 'border-red-500/50' : data.tone === 'warning' ? 'border-amber-500/50' : 'border-border-strong')}>
      <Handle type="target" position={Position.Top} className="!bg-violet-400" />
      <div className="flex items-center gap-1.5 text-[12px] font-medium">{icon}<span className="truncate">{data.label}</span></div>
      <div className="truncate text-[10px] text-muted">{data.sub}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-violet-400" />
    </div>
  )
}
const graphTypes = { g: GraphNode }

export function AISystemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const settings = useSettings()
  const { data, isLoading, error, retry } = useCollections(['aiSystems', 'findings', 'assets', 'services', 'vendors', 'governanceReviews', 'incidents', 'tickets', 'assessments'] as const)
  const ai = data?.aiSystems.find((a) => a.id === id)
  usePage(ai?.name ?? 'AI system', [{ label: 'AI Security' }, { label: 'AI Inventory', to: '/ai-security/inventory' }, { label: ai?.name ?? id ?? '' }])
  const [govOpen, setGovOpen] = React.useState(false)
  const [apprOpen, setApprOpen] = React.useState(false)
  const [appr, setAppr] = React.useState<{ approval: AIApproval; rationale: string }>({ approval: 'approved', rationale: '' })
  const { run, pending } = useAction()
  React.useEffect(() => {
    if (ai) api.recordRecent('aiSystem', ai.id, ai.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai?.id])
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} />
  if (!ai) return <NotFound what="AI system" back={{ to: '/ai-security/inventory', label: 'Back to AI Inventory' }} />
  const fs = scoreFindings(data.findings.filter((f) => f.aiSystemId === ai.id), data.assets, data.services, settings.weights)
  const open = fs.filter((x) => isOpen(x.f.status))
  const vendor = data.vendors.find((v) => v.id === ai.vendorId)
  const reviews = data.governanceReviews.filter((g) => g.aiSystemId === ai.id)
  const incidents = data.incidents.filter((i) => i.aiSystemIds.includes(ai.id))
  const tickets = data.tickets.filter((t) => t.aiSystemId === ai.id)
  const vendorAsm = data.assessments.filter((a) => a.vendorId === ai.vendorId)
  const score = aiRiskScore(ai, data.findings)

  // Risk graph: AI system at center, provider, data sources, findings, risky signals
  const nodes: Node[] = [{ id: 'ai', type: 'g', position: { x: 360, y: 0 }, data: { label: ai.name, sub: `${ai.type} · risk ${score}`, kind: 'ai' } }]
  const edges: Edge[] = []
  const ring = [
    ...(vendor ? [{ id: 'v', label: vendor.name, sub: `Provider · residual risk ${vendor.residualRisk}`, kind: 'vendor' as const, tone: vendor.residualRisk > 55 ? 'warning' : 'ok', link: `/tprm/vendors/${vendor.id}` }] : []),
    ...ai.dataSources.slice(0, 3).map((d, i) => ({ id: `d${i}`, label: d, sub: `${ai.dataClassification} data`, kind: 'data' as const, tone: ai.dataClassification === 'Restricted' ? 'warning' : 'ok', link: undefined })),
    ...open.slice(0, 4).map((x) => ({ id: x.f.id, label: x.f.title, sub: `${x.f.id} · ${x.f.severity}`, kind: 'finding' as const, tone: 'risk', link: `/ai-security/findings/${x.f.id}` })),
    ...ai.signals.filter((s) => s.status === 'risk').map((s, i) => ({ id: `s${i}`, label: s.dimension, sub: s.detail, kind: 'signal' as const, tone: 'risk', link: undefined })),
  ]
  ring.forEach((r, i) => {
    nodes.push({ id: r.id, type: 'g', position: { x: (i % 5) * 200, y: 140 + Math.floor(i / 5) * 100 }, data: { label: r.label, sub: r.sub, kind: r.kind, tone: r.tone, link: r.link } })
    edges.push({ id: `e-${r.id}`, source: 'ai', target: r.id, animated: r.tone === 'risk', style: { stroke: r.tone === 'risk' ? '#ef4444' : r.tone === 'warning' ? '#f59e0b' : '#3a4360', strokeWidth: 1.5 } })
  })
  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/ai-security/inventory', label: 'AI Inventory' }}
        title={ai.name}
        icon={<Bot />}
        description={`${ai.type} · ${ai.provider} · ${ai.deployment}`}
        badges={<><StatusBadge map={AI_APPROVAL} value={ai.approval} /><Badge tone={ai.governanceStatus === 'compliant' ? 'emerald' : ai.governanceStatus === 'non_compliant' ? 'red' : 'amber'}>{ai.governanceStatus.replace('_', ' ')}</Badge></>}
        actions={
          <>
            <Button variant="secondary" onClick={() => { setAppr({ approval: ai.approval, rationale: '' }); setApprOpen(true) }}>
              <Gavel /> Change approval status
            </Button>
            <Button onClick={() => setGovOpen(true)}>
              <Scale /> Create governance review
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="AI risk score" value={score} tone={score >= 60 ? 'red' : score >= 40 ? 'amber' : 'green'} help="Illustrative: open finding severity + approval status + risk signals + data classification." />
        <KpiCard label="Users" value={fmtNum(ai.users)} />
        <KpiCard label="Open findings" value={open.length} tone={open.length ? 'amber' : 'green'} />
        <KpiCard label="Governance reviews" value={reviews.length} sub={`${reviews.filter((r) => ['open', 'in_review'].includes(r.status)).length} open`} />
        <KpiCard label="Related incidents" value={incidents.length} tone={incidents.some((i) => i.status !== 'closed') ? 'red' : 'default'} />
      </div>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><Bot /> Profile</TabsTrigger>
          <TabsTrigger value="signals"><Network /> Risk signals & graph</TabsTrigger>
          <TabsTrigger value="config"><Settings2 /> Configuration ({ai.configChecks.filter((c) => c.result === 'fail').length} failing)</TabsTrigger>
          <TabsTrigger value="findings"><ShieldAlert /> Findings ({fs.length})</TabsTrigger>
          <TabsTrigger value="governance"><Scale /> Governance ({reviews.length})</TabsTrigger>
          <TabsTrigger value="contract"><FileSignature /> Contract & evidence</TabsTrigger>
          <TabsTrigger value="remediation"><TicketIcon /> Remediation ({tickets.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <div className="grid gap-5 xl:grid-cols-3">
            <Section className="xl:col-span-2" title="AI application profile">
              <KeyValue cols={3} items={[{ label: 'System ID', value: <span className="font-mono">{ai.id}</span> }, { label: 'Owner', value: <UserName id={ai.ownerId} /> }, { label: 'Business service', value: ai.businessServiceId ? <EntityLink type="service" id={ai.businessServiceId} showId={false} /> : 'Not mapped' }, { label: 'Models', value: ai.models.join(', ') }, { label: 'Deployment', value: ai.deployment }, { label: 'Data classification', value: ai.dataClassification }, { label: 'Data sources', value: ai.dataSources.join('; ') }, { label: 'Integrations / tools', value: ai.integrations.join('; ') || 'None' }, { label: 'Provider', value: vendor ? <EntityLink type="vendor" id={vendor.id} showId={false} /> : ai.provider }, { label: 'First seen', value: fmtDate(ai.firstSeen) }, { label: 'Last activity', value: fmtDateTime(ai.lastActivity) }, { label: 'Discovered via', value: ai.discoveredVia.join(', ') }]} />
            </Section>
            <Section title="Related incidents">
              {incidents.map((i) => <div key={i.id} className="mb-1.5 text-xs"><EntityLink type="incident" id={i.id} /></div>)}
              {!incidents.length && <p className="text-xs text-muted">None.</p>}
            </Section>
          </div>
        </TabsContent>
        <TabsContent value="signals">
          <div className="grid gap-5 xl:grid-cols-3">
            <Section title="Exposure dimensions">
              <div className="space-y-2">
                {ai.signals.map((s) => (
                  <div key={s.dimension} className="rounded-lg bg-surface-2 px-3 py-2">
                    <div className="flex items-center justify-between text-[13px]">
                      <span>{s.dimension}</span>
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', SIG_COLOR[s.status])}>{s.status}</span>
                    </div>
                    <div className="text-xs text-muted">{s.detail}</div>
                  </div>
                ))}
              </div>
            </Section>
            <Card className="h-[420px] overflow-hidden xl:col-span-2">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="text-[13px] font-semibold">AI risk graph</span>
                <span className="text-[11px] text-muted">Click a provider or finding node to open it</span>
              </div>
              <div className="h-[370px]">
                <ReactFlow nodes={nodes} edges={edges} nodeTypes={graphTypes} fitView fitViewOptions={{ padding: 0.15 }} nodesDraggable={false} onNodeClick={(_, n) => (n.data as { link?: string }).link && navigate((n.data as { link: string }).link)}>
                  <Background color="#1f2638" gap={20} />
                  <Controls showInteractive={false} />
                </ReactFlow>
              </div>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="config">
          <Section title="Configuration assessment" description="Security configuration checks for this AI system (simulated evaluation)" actions={<ProvenanceBadge value="observed" />}>
            <div className="divide-y divide-border/60">
              {ai.configChecks.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="flex gap-2.5">
                    {c.result === 'pass' ? <CheckCircle2 className="mt-0.5 size-4 text-emerald-400" /> : c.result === 'fail' ? <XCircle className="mt-0.5 size-4 text-red-400" /> : c.result === 'warn' ? <AlertTriangle className="mt-0.5 size-4 text-amber-400" /> : <HelpCircle className="mt-0.5 size-4 text-subtle" />}
                    <div>
                      <div className="text-[13px] font-medium">{c.check}</div>
                      <div className="text-xs text-muted">{c.detail}</div>
                    </div>
                  </div>
                  <Badge tone={c.result === 'pass' ? 'emerald' : c.result === 'fail' ? 'red' : c.result === 'warn' ? 'amber' : 'slate'}>{c.result}</Badge>
                </div>
              ))}
            </div>
          </Section>
        </TabsContent>
        <TabsContent value="findings">
          <FindingsTable tableId={`ai-${ai.id}`} rows={fs} hideColumns={['target', 'exposure']} initialViewId="all" showAI />
        </TabsContent>
        <TabsContent value="governance">
          <div className="space-y-3">
            {reviews.map((g) => (
              <Link key={g.id} to={`/ai-security/governance/${g.id}`} className="card block p-4 hover:border-border-strong">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-medium"><span className="font-mono text-[11px] text-muted">{g.id}</span> {g.title}</span>
                  <Badge tone={GOV_STATUS[g.status].tone}>{GOV_STATUS[g.status].label}</Badge>
                </div>
                {g.decision && <p className="mt-1 text-xs text-muted">Decision: {g.decision}</p>}
              </Link>
            ))}
            {!reviews.length && <Card><EmptyState icon={<Scale />} title="No governance reviews" action={<Button size="sm" onClick={() => setGovOpen(true)}>Create governance review</Button>} /></Card>}
          </div>
        </TabsContent>
        <TabsContent value="contract">
          <div className="grid gap-5 xl:grid-cols-2">
            <Section title="Contract terms">
              {ai.contract ? (
                <KeyValue cols={2} items={[{ label: 'Contract reference', value: ai.contract.reference }, { label: 'DPA signed', value: ai.contract.dpaSigned ? 'Yes' : 'No' }, { label: 'Training on customer data', value: <Badge tone={ai.contract.trainingOnCustomerData === 'opt-out confirmed' ? 'emerald' : 'red'}>{ai.contract.trainingOnCustomerData}</Badge> }, { label: 'Renewal', value: fmtDate(ai.contract.renewal) }]} />
              ) : (
                <Callout tone="warn" icon={<FileSignature />} title="No contract on record">{ai.approval === 'unsanctioned' ? 'Shadow AI — used under consumer terms without an enterprise agreement.' : 'Contract evidence not linked to this AI system.'}</Callout>
              )}
            </Section>
            <Section title="Provider assessment & compliance evidence">
              {vendor ? (
                <>
                  <div className="mb-2 text-xs"><EntityLink type="vendor" id={vendor.id} /> · residual risk {vendor.residualRisk}</div>
                  {vendorAsm.map((a) => (
                    <Link key={a.id} to={`/tprm/assessments/${a.id}`} className="mb-1.5 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-xs hover:bg-surface-3">
                      <span>{a.name}</span>
                      <StatusBadge map={ASSESSMENT_STATUS} value={a.status} />
                    </Link>
                  ))}
                  <div className="label-xs mb-1 mt-3">Evidence documents</div>
                  {vendor.evidenceDocs.map((d) => <div key={d.id} className="text-xs text-muted">• {d.type} — {d.status.replace('_', ' ')}</div>)}
                </>
              ) : (
                <p className="text-xs text-muted">No provider vendor record — {ai.approval === 'unsanctioned' ? 'register the provider through TPRM onboarding if the use case is approved.' : 'internal system.'}</p>
              )}
            </Section>
          </div>
        </TabsContent>
        <TabsContent value="remediation">
          <Card className="divide-y divide-border/60">
            {tickets.map((t) => (
              <Link key={t.id} to={`/operations/tickets/${t.id}`} className="flex items-center justify-between gap-2 px-4 py-3 text-[13px] hover:bg-surface-2/50">
                <span><span className="font-mono text-[11px] text-muted">{t.id}</span> {t.title}</span>
                <Badge>{t.status.replace('_', ' ')}</Badge>
              </Link>
            ))}
            {!tickets.length && <EmptyState title="No remediation tickets" description="Create tickets from individual AI findings or governance decisions." />}
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Section title="Activity history">
            <Timeline entries={ai.history} />
          </Section>
        </TabsContent>
      </Tabs>
      <NewGovernanceReviewDialog ai={ai} findingId={open[0]?.f.id} open={govOpen} onOpenChange={setGovOpen} />
      <Dialog open={apprOpen} onOpenChange={setApprOpen}>
        <DialogContent title="Change approval status" description="Approval changes are governance decisions and are recorded in the system history and audit log.">
          <div className="space-y-4">
            <Field label="Approval status">
              <NativeSelect value={appr.approval} onChange={(e) => setAppr({ ...appr, approval: e.target.value as AIApproval })}>
                {Object.entries(AI_APPROVAL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Rationale" required>
              <Textarea rows={3} value={appr.rationale} onChange={(e) => setAppr({ ...appr, rationale: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setApprOpen(false)}>Cancel</Button>
            <Button disabled={appr.rationale.trim().length < 10} loading={pending} onClick={async () => { await run(() => api.setAIApproval(ai.id, appr.approval, appr.rationale.trim()), 'Approval status updated'); setApprOpen(false) }}>Save decision</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================ Shadow AI

export function ShadowAIPage() {
  usePage('Shadow AI', [{ label: 'AI Security' }, { label: 'Shadow AI' }])
  const settings = useSettings()
  const { data, isLoading, error, retry } = useCollections(['aiSystems', 'findings', 'assets', 'services', 'integrations'] as const)
  const [gov, setGov] = React.useState<{ ai: AISystem; findingId?: string } | null>(null)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={8} />
  const shadow = data.aiSystems.filter((a) => a.approval === 'unsanctioned' || a.approval === 'prohibited')
  const findings = data.findings.filter((f) => f.category === 'Shadow AI')
  const scored = scoreFindings(findings, data.assets, data.services, settings.weights)
  return (
    <div className="space-y-5">
      <PageHeader title="Shadow AI Discovery" icon={<EyeOff />} description="Potentially unauthorized AI usage detected across network, identity, endpoint and code platforms. Each detection shows its source and evidence; decisions go through governance review." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Unsanctioned AI apps" value={shadow.filter((a) => a.approval === 'unsanctioned').length} tone="red" />
        <KpiCard label="Prohibited apps still in use" value={shadow.filter((a) => a.approval === 'prohibited' && a.users > 0).length} tone="amber" />
        <KpiCard label="Users of shadow AI" value={fmtNum(shadow.reduce((s, a) => s + a.users, 0))} />
        <KpiCard label="Open shadow AI findings" value={findings.filter((f) => isOpen(f.status)).length} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {shadow.map((a) => {
          const f = data.findings.find((x) => x.aiSystemId === a.id && isOpen(x.status))
          const ev = f?.evidence[0]
          return (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link to={`/ai-security/systems/${a.id}`} className="text-[14px] font-semibold hover:text-violet-200">{a.name}</Link>
                  <div className="text-xs text-muted">{a.provider} · {a.users} users · {a.dataClassification} data at risk</div>
                </div>
                <StatusBadge map={AI_APPROVAL} value={a.approval} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {a.discoveredVia.map((d) => <Badge key={d} tone="sky">{d}</Badge>)}
              </div>
              {ev && (
                <pre className="mt-3 max-h-28 overflow-hidden whitespace-pre-wrap rounded-lg bg-surface-2 p-2.5 font-mono text-[11px] text-slate-300">{ev.content}</pre>
              )}
              {ev && <div className="mt-1 text-[11px] text-subtle">Evidence {ev.id} · source <IntegrationName id={ev.sourceIntegrationId} /> · <ProvenanceBadge value={ev.provenance} /></div>}
              <div className="mt-3 flex flex-wrap gap-2">
                {f && <Button size="sm" variant="secondary" asChild><Link to={`/ai-security/findings/${f.id}`}>Investigate finding</Link></Button>}
                <Button size="sm" onClick={() => setGov({ ai: a, findingId: f?.id })}><Scale /> Create governance review</Button>
              </div>
            </Card>
          )
        })}
      </div>
      <Section title="Shadow AI findings" description="Including resolved and false-positive decisions">
        <FindingsTable tableId="shadow-findings" rows={scored} views={[{ id: 'all', label: 'All', filters: [] }]} initialViewId="all" showAI hideColumns={['exposure', 'service']} pageSize={10} />
      </Section>
      {gov && <NewGovernanceReviewDialog ai={gov.ai} findingId={gov.findingId} open onOpenChange={(o) => !o && setGov(null)} />}
    </div>
  )
}

// ============================================================ Configuration & access risks

export function ConfigRisksPage() {
  usePage('AI Configuration Risks', [{ label: 'AI Security' }, { label: 'Configuration Risks' }])
  const settings = useSettings()
  const navigate = useNavigate()
  const { data, isLoading, error, retry } = useCollections(['aiSystems', 'findings', 'assets', 'services'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={10} />
  const ai = data.findings.filter((f) => f.domain === 'ai')
  const scored = scoreFindings(ai, data.assets, data.services, settings.weights)
  const cats = ['AI configuration', 'AI access', 'AI data exposure', 'AI external exposure', 'AI provider risk'] as const
  const failing = data.aiSystems.flatMap((a) => a.configChecks.filter((c) => c.result === 'fail').map((c) => ({ a, c })))
  return (
    <div className="space-y-5">
      <PageHeader title="AI Configuration, Access & Data Exposure Risks" icon={<Settings2 />} description="Risky AI configurations, excessive access scopes, data exposure concerns, externally exposed AI endpoints and AI provider risk — mapped to OWASP Top 10 for LLM Applications where applicable." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {cats.map((c) => (
          <KpiCard key={c} label={c} value={ai.filter((f) => f.category === c && isOpen(f.status)).length} onClick={() => navigate(`/operations/findings?category=${encodeURIComponent(c)}`)} sub="open" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <FindingsTable tableId="ai-config" rows={scored} views={[{ id: 'open', label: 'Open AI findings', filters: [{ id: 'status', value: ['new', 'triaged', 'in_validation', 'validated', 'in_remediation', 'pending_verification'] }] }, { id: 'all', label: 'All AI findings', filters: [] }]} initialViewId="open" showAI hideColumns={['exposure', 'source']} />
        </div>
        <Section title={`Failing configuration checks (${failing.length})`}>
          <ul className="space-y-2">
            {failing.map(({ a, c }) => (
              <li key={a.id + c.id}>
                <Link to={`/ai-security/systems/${a.id}`} className="block rounded-lg bg-surface-2 px-3 py-2 hover:bg-surface-3">
                  <div className="flex items-center gap-1.5 text-[13px]"><XCircle className="size-3.5 text-red-400" /> {c.check}</div>
                  <div className="text-[11px] text-muted">{a.name} · {c.detail}</div>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  )
}

// ============================================================ AI risk assessments

export function AIAssessmentsPage() {
  usePage('AI Risk Assessments', [{ label: 'AI Security' }, { label: 'AI Risk Assessments' }])
  const navigate = useNavigate()
  const { data, isLoading, error, retry } = useCollections(['aiSystems', 'findings', 'vendors', 'assessments'] as const)
  const { run, pending } = useAction()
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={10} />
  const providers = data.vendors.filter((v) => v.isAIProvider)
  return (
    <div className="space-y-5">
      <PageHeader title="AI Risk Assessments" icon={<ClipboardCheck />} description="Per-system AI risk assessment (illustrative factor breakdown) and AI provider security assessments run through the TPRM questionnaire with the AI Usage section." />
      <Section title="AI system risk assessment" description="Factor breakdown of the illustrative AI risk score">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-subtle">
                {['AI system', 'Approval', 'Open findings', 'Failing checks', 'Risk signals', 'Data', 'Score'].map((h) => <th key={h} className="py-2 pr-3 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.aiSystems.map((a) => {
                const of = data.findings.filter((f) => f.aiSystemId === a.id && isOpen(f.status))
                return (
                  <tr key={a.id} onClick={() => navigate(`/ai-security/systems/${a.id}`)} className="cursor-pointer border-t border-border/50 hover:bg-surface-2/50">
                    <td className="py-2 pr-3 font-medium text-fg">{a.name}</td>
                    <td className="py-2 pr-3"><StatusBadge map={AI_APPROVAL} value={a.approval} /></td>
                    <td className="py-2 pr-3">{of.length} {of.some((f) => f.severity === 'critical') && <span className="text-red-300">(critical)</span>}</td>
                    <td className="py-2 pr-3">{a.configChecks.filter((c) => c.result === 'fail').length}</td>
                    <td className="py-2 pr-3">{a.signals.filter((s) => s.status === 'risk').length} risk · {a.signals.filter((s) => s.status === 'warning').length} warn</td>
                    <td className="py-2 pr-3">{a.dataClassification}</td>
                    <td className="py-2"><RiskScore score={aiRiskScore(a, data.findings)} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="AI vendor assessments" description="Security posture of AI providers (TPRM)">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((v) => {
            const asm = data.assessments.filter((a) => a.vendorId === v.id)
            const latest = asm.find((a) => a.status === 'completed')
            const inprog = asm.find((a) => a.status !== 'completed')
            return (
              <Card key={v.id} className="p-4">
                <div className="flex items-start justify-between">
                  <EntityLink type="vendor" id={v.id} showId={false} />
                  <RiskScore score={v.residualRisk} label={`Residual risk ${v.residualRisk}`} />
                </div>
                <div className="mt-1 text-xs text-muted">{v.category}</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Stat label="Latest score" value={latest?.result ? `${latest.result.score}/100` : '—'} />
                  <Stat label="AI systems" value={data.aiSystems.filter((a) => a.vendorId === v.id).length} />
                </div>
                <div className="mt-3">
                  {inprog ? (
                    <Button size="sm" variant="secondary" className="w-full" asChild><Link to={`/tprm/assessments/${inprog.id}`}>Continue {inprog.type}</Link></Button>
                  ) : (
                    <Button size="sm" variant="secondary" className="w-full" loading={pending} onClick={async () => { const a = await run(() => api.createAssessment(v.id, 'AI provider assessment'), (x) => `Assessment ${x.id} started`); if (a) navigate(`/tprm/assessments/${a.id}`) }}>Start AI provider assessment</Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      </Section>
    </div>
  )
}

// ============================================================ Governance

const gCol = createColumnHelper<GovernanceReview & { system: string }>()

export function GovernancePage() {
  usePage('AI Governance', [{ label: 'AI Security' }, { label: 'Governance' }])
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)
  const { data, isLoading, error, retry } = useCollections(['governanceReviews', 'aiSystems'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={8} />
  const rows = data.governanceReviews.map((g) => ({ ...g, system: data.aiSystems.find((a) => a.id === g.aiSystemId)?.name ?? g.aiSystemId }))
  const columns = [
    gCol.accessor('id', { header: 'ID', cell: (c) => <span className="font-mono text-[11px] text-muted">{c.getValue()}</span> }),
    gCol.accessor('title', { header: 'Review', cell: (c) => <span className="font-medium">{c.getValue()}</span> }),
    gCol.accessor('type', { header: 'Type', filterFn: 'multi', cell: (c) => <span className="text-muted">{c.getValue()}</span> }),
    gCol.accessor('system', { header: 'AI system', filterFn: 'multi' }),
    gCol.accessor('status', { header: 'Status', filterFn: 'multi', cell: (c) => <Badge tone={GOV_STATUS[c.getValue()].tone}>{GOV_STATUS[c.getValue()].label}</Badge> }),
    gCol.accessor('reviewerId', { header: 'Reviewer', cell: (c) => <UserName id={c.getValue()} /> }),
    gCol.accessor('createdAt', { header: 'Opened', cell: (c) => <RelTime iso={c.getValue()} /> }),
  ]
  return (
    <div className="space-y-5">
      <PageHeader title="AI Governance Workflows" icon={<Scale />} description="Investigate and address AI policy violations, approve new AI use cases and configuration exceptions. Decisions require a human reviewer." actions={<Button onClick={() => setOpen(true)}><Plus /> New governance review</Button>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Open" value={rows.filter((r) => r.status === 'open').length} tone="violet" />
        <KpiCard label="In review" value={rows.filter((r) => r.status === 'in_review').length} tone="amber" />
        <KpiCard label="Approved (incl. conditions)" value={rows.filter((r) => r.status.startsWith('approved')).length} tone="green" />
        <KpiCard label="Rejected / prohibited" value={rows.filter((r) => r.status === 'rejected').length} />
      </div>
      <DataTable tableId="governance" data={rows} columns={columns} getRowId={(g) => g.id} onRowClick={(g) => navigate(`/ai-security/governance/${g.id}`)} facets={[{ columnId: 'status', label: 'Status', options: Object.entries(GOV_STATUS).map(([value, x]) => ({ value, label: x.label })) }, { columnId: 'type', label: 'Type' }]} views={[{ id: 'active', label: 'Active', filters: [{ id: 'status', value: ['open', 'in_review'] }] }, { id: 'all', label: 'All reviews', filters: [] }]} initialViewId="active" selectable={false} exportName="do-safe-ai-governance" />
      <NewGovernanceReviewDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}

export function GovernanceDetail() {
  const { id } = useParams()
  const { data, isLoading, error, retry } = useCollections(['governanceReviews', 'aiSystems', 'findings', 'tickets'] as const)
  const g = data?.governanceReviews.find((x) => x.id === id)
  usePage(g?.id ?? 'Governance review', [{ label: 'AI Security' }, { label: 'Governance', to: '/ai-security/governance' }, { label: id ?? '' }])
  const { run, pending } = useAction()
  const [note, setNote] = React.useState('')
  const [dec, setDec] = React.useState({ status: 'approved_with_conditions' as GovernanceReview['status'], decision: '', conditions: '', approval: '' as AIApproval | '' })
  const [ticketOpen, setTicketOpen] = React.useState(false)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={8} />
  if (!g) return <NotFound what="Governance review" back={{ to: '/ai-security/governance', label: 'Back to Governance' }} />
  const ai = data.aiSystems.find((a) => a.id === g.aiSystemId)!
  const f = data.findings.find((x) => x.id === g.findingId)
  const decided = !['open', 'in_review'].includes(g.status)
  return (
    <div className="space-y-5">
      <PageHeader back={{ to: '/ai-security/governance', label: 'Governance' }} title={g.title} icon={<Scale />} badges={<Badge tone={GOV_STATUS[g.status].tone}>{GOV_STATUS[g.status].label}</Badge>} description={`${g.id} · ${g.type} · opened ${fmtDateTime(g.createdAt)}`} actions={f && isOpen(f.status) && <Button variant="secondary" onClick={() => setTicketOpen(true)}><TicketIcon /> Assign remediation</Button>} />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {decided ? (
            <Callout tone={g.status === 'rejected' ? 'danger' : 'success'} icon={<Gavel />} title={`Decision: ${GOV_STATUS[g.status].label} · ${fmtDateTime(g.decidedAt)}`}>
              {g.decision}
              {g.conditions.length > 0 && <ul className="mt-1.5 list-disc pl-4">{g.conditions.map((c) => <li key={c}>{c}</li>)}</ul>}
              <div className="mt-1 opacity-80">Reviewer: <UserName id={g.reviewerId} avatar={false} /></div>
            </Callout>
          ) : (
            <Section title="Record governance decision" description="Human approval gate — the decision and rationale become part of the permanent record">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Outcome">
                  <NativeSelect value={dec.status} onChange={(e) => setDec({ ...dec, status: e.target.value as GovernanceReview['status'] })}>
                    <option value="approved">Approve</option>
                    <option value="approved_with_conditions">Approve with conditions</option>
                    <option value="rejected">Reject / prohibit</option>
                  </NativeSelect>
                </Field>
                <Field label="Set AI system approval to">
                  <NativeSelect value={dec.approval} onChange={(e) => setDec({ ...dec, approval: e.target.value as AIApproval })}>
                    <option value="">No change ({AI_APPROVAL[ai.approval].label})</option>
                    {Object.entries(AI_APPROVAL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </NativeSelect>
                </Field>
              </div>
              <div className="mt-4 space-y-4">
                <Field label="Decision rationale" required>
                  <Textarea rows={3} value={dec.decision} onChange={(e) => setDec({ ...dec, decision: e.target.value })} />
                </Field>
                {dec.status === 'approved_with_conditions' && (
                  <Field label="Conditions (one per line)">
                    <Textarea rows={3} value={dec.conditions} onChange={(e) => setDec({ ...dec, conditions: e.target.value })} placeholder={'e.g. Enable audit logging\nBlock file uploads of Confidential data'} />
                  </Field>
                )}
                <div className="flex justify-end">
                  <Button disabled={dec.decision.trim().length < 15} loading={pending} onClick={() => run(() => api.decideGovernanceReview(g.id, dec.status, dec.decision.trim(), dec.conditions.split('\n').map((s) => s.trim()).filter(Boolean), dec.approval || undefined), 'Governance decision recorded')}>
                    <Gavel /> Record decision
                  </Button>
                </div>
              </div>
            </Section>
          )}
          <Section title="Review notes">
            <div className="space-y-2">
              {g.notes.map((n) => (
                <div key={n.id} className="rounded-lg bg-surface-2 px-3 py-2">
                  <div className="flex justify-between text-[11px] text-subtle"><UserName id={n.authorId} /> <span>{fmtDateTime(n.at)}</span></div>
                  <p className="mt-1 text-[13px]">{n.text}</p>
                </div>
              ))}
              {!g.notes.length && <p className="text-xs text-muted">No notes yet.</p>}
            </div>
            <div className="mt-3 flex gap-2">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a review note…" aria-label="Review note" />
              <Button variant="secondary" disabled={note.trim().length < 3} loading={pending} onClick={async () => { await run(() => api.addGovernanceNote(g.id, note.trim()), 'Note added'); setNote('') }}><MessageSquare /> Add</Button>
            </div>
          </Section>
        </div>
        <div className="space-y-5">
          <Section title="AI system">
            <EntityLink type="aiSystem" id={ai.id} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge map={AI_APPROVAL} value={ai.approval} />
              <Badge>{ai.users} users</Badge>
              <Badge>{ai.dataClassification}</Badge>
            </div>
            <div className="mt-3 space-y-1.5">
              {ai.signals.filter((s) => s.status !== 'ok').map((s) => (
                <div key={s.dimension} className="text-xs"><span className={cn('mr-1.5 rounded px-1 text-[10px] font-semibold uppercase', SIG_COLOR[s.status])}>{s.status}</span>{s.dimension}: <span className="text-muted">{s.detail}</span></div>
              ))}
            </div>
          </Section>
          {f && (
            <Section title="Linked finding">
              <EntityLink type="finding" id={f.id} />
              <div className="mt-1 flex gap-1.5"><SeverityBadge severity={f.severity} /><FindingStatusBadge status={f.status} /></div>
              <div className="mt-2 text-[11px] text-muted">{f.ticketIds.length} remediation ticket(s)</div>
            </Section>
          )}
          <Section title="Policy references">
            <ul className="space-y-1 text-xs">{g.policyRefs.map((p) => <li key={p}>• {p}</li>)}</ul>
          </Section>
          <Section title="People">
            <KeyValue cols={1} items={[{ label: 'Requested by', value: <UserName id={g.requestedById} /> }, { label: 'Reviewer', value: <UserName id={g.reviewerId} /> }]} />
          </Section>
          <DemoTag>Governance workflow — demo data</DemoTag>
        </div>
      </div>
      {f && <CreateTicketDialog finding={f} open={ticketOpen} onOpenChange={setTicketOpen} />}
    </div>
  )
}
