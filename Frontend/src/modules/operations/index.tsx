import { TicketDashboard } from '@/modules/enterprise/TicketDashboard'
import * as React from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { createColumnHelper } from '@tanstack/react-table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlarmClock, BadgeCheck, Bot, Check, CheckCheck, ClipboardCheck, FileWarning, Hammer, MessageSquare, Plus, Scale, Siren, Ticket as TicketIcon, Users, X, Zap, ArrowRight, Building2, ShieldCheck } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import type { Incident, IncidentStatus, SecurityEvent, Ticket, TicketStatus } from '@/types'
import { useCan, useAction, useCollections, useSettings, useUsers } from '@/hooks/queries'
import { usePage, useUrlFilters } from '@/hooks/usePage'
import { Callout, EmptyState, ErrorState, KeyValue, KpiCard, LoadingState, NotFound, PageHeader, Section } from '@/components/common/layout'
import { Badge, DemoTag, FindingStatusBadge, ProvenanceBadge, SeverityBadge, StatusBadge } from '@/components/common/badges'
import { EntityLink, RelTime, Timeline, UserName, IntegrationName } from '@/components/common/entities'
import { DataTable } from '@/components/common/DataTable'
import { AXIS, ChartTooltip, GRID, CATEGORICAL } from '@/components/common/charts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, Sheet } from '@/components/ui/dialog'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Progress, Slider } from '@/components/ui/misc'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FindingsTable, FINDING_VIEWS } from '@/modules/findings/FindingsTable'
import { EscalateDialog } from '@/modules/findings/dialogs'
import * as api from '@/services/api'
import { cn, daysUntil, fmtDate, fmtDateTime } from '@/utils/format'
import { EVENT_STATUS, INCIDENT_STATUS, SEVERITY_ORDER, SEVERITY_RANK, TICKET_STATUS } from '@/utils/labels'
import { scoreFindings } from '@/utils/derive'

export { WorkflowCenter } from './workflows'

const ticketOverdue = (t: Ticket) => !['done', 'cancelled'].includes(t.status) && new Date(t.dueDate).getTime() < Date.now()

// ============================================================ Findings lifecycle

export function FindingsPage() {
  usePage('Security Findings', [{ label: 'Security Operations' }, { label: 'Security Findings' }])
  const settings = useSettings()
  const navigate = useNavigate()
  const initialFilters = useUrlFilters(['severity', 'status', 'service', 'domain', 'category', 'sla', 'source'])
  const { data, isLoading, error, retry } = useCollections(['findings', 'assets', 'services'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={5} rows={12} />
  const { findings } = data
  const scored = scoreFindings(findings, data.assets, data.services, settings.weights)
  const stages = [
    ['new', 'New'],
    ['triaged', 'Triaged'],
    ['in_validation', 'Validating'],
    ['validated', 'Validated'],
    ['in_remediation', 'Remediating'],
    ['pending_verification', 'Verifying'],
    ['resolved', 'Resolved'],
  ] as const
  return (
    <div className="space-y-5">
      <PageHeader title="Security Findings" icon={<FileWarning />} description="Lifecycle of every finding — vulnerabilities, misconfigurations, identity, code and AI — from discovery to verified closure. False positives and risk acceptances keep their full decision history." />
      <Card className="p-4">
        <div className="label-xs mb-3">Finding lifecycle</div>
        <div className="flex items-stretch gap-1 overflow-x-auto">
          {stages.map(([s, label], i) => {
            const n = findings.filter((f) => f.status === s).length
            return (
              <React.Fragment key={s}>
                {i > 0 && <ArrowRight className="mt-4 size-4 shrink-0 text-subtle" />}
                <button onClick={() => navigate(`/operations/findings?status=${s}`)} className="min-w-[96px] flex-1 rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-left hover:border-violet-500/40 cursor-pointer">
                  <div className="num text-lg font-semibold">{n}</div>
                  <div className="text-[11px] text-muted">{label}</div>
                </button>
              </React.Fragment>
            )
          })}
          <div className="mx-2 w-px bg-border" />
          {(['false_positive', 'risk_accepted'] as const).map((s) => (
            <button key={s} onClick={() => navigate(`/operations/findings?status=${s}`)} className="min-w-[96px] rounded-lg border border-dashed border-border px-3 py-2 text-left hover:border-violet-500/40 cursor-pointer">
              <div className="num text-lg font-semibold text-muted">{findings.filter((f) => f.status === s).length}</div>
              <div className="text-[11px] text-subtle">{s === 'false_positive' ? 'False positive' : 'Risk accepted'}</div>
            </button>
          ))}
        </div>
      </Card>
      <FindingsTable key={JSON.stringify(initialFilters)} tableId="ops-findings" rows={scored} views={[...FINDING_VIEWS, { id: 'ai', label: 'AI findings', filters: [{ id: 'domain', value: ['ai'] }] }]} initialFilters={initialFilters} initialViewId="all" showAI />
    </div>
  )
}

// ============================================================ Events

const evCol = createColumnHelper<SecurityEvent>()

export function EventsPage() {
  usePage('Security Events', [{ label: 'Security Operations' }, { label: 'Events' }])
  const [params] = useSearchParams()
  const { data, isLoading, error, retry } = useCollections(['events', 'assets', 'integrations'] as const)
  const [sel, setSel] = React.useState<string | null>(params.get('q'))
  const [escalate, setEscalate] = React.useState<SecurityEvent | null>(null)
  const [assessment, setAssessment] = React.useState('')
  const { run, pending } = useAction()
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={12} />
  const { events, assets } = data
  const ev = events.find((e) => e.id === sel)
  const columns = [
    evCol.accessor('occurredAt', { header: 'Time', cell: (c) => <RelTime iso={c.getValue()} /> }),
    evCol.accessor('id', { header: 'ID', cell: (c) => <span className="font-mono text-[11px] text-muted">{c.getValue()}</span> }),
    evCol.accessor('title', { header: 'Event', cell: (c) => <span className="block max-w-[420px] truncate font-medium">{c.getValue()}</span> }),
    evCol.accessor('type', { header: 'Type', filterFn: 'multi', cell: (c) => <span className="whitespace-nowrap text-muted">{c.getValue()}</span> }),
    evCol.accessor('severity', { header: 'Severity', filterFn: 'multi', cell: (c) => <SeverityBadge severity={c.getValue()} />, sortingFn: (a, b) => SEVERITY_RANK[a.original.severity] - SEVERITY_RANK[b.original.severity] }),
    evCol.accessor('status', { header: 'Status', filterFn: 'multi', cell: (c) => <StatusBadge map={EVENT_STATUS} value={c.getValue()} /> }),
    evCol.accessor((e) => assets.find((a) => a.id === e.assetId)?.name ?? '—', { id: 'asset', header: 'Asset' }),
    evCol.accessor((e) => data.integrations.find((i) => i.id === e.sourceIntegrationId)?.vendor ?? e.sourceIntegrationId, { id: 'source', header: 'Source', filterFn: 'multi' }),
    evCol.display({
      id: 'actions',
      header: '',
      cell: (c) => {
        const e = c.row.original
        return e.status === 'new' || e.status === 'triaged' ? (
          <div className="flex gap-1" onClick={(x) => x.stopPropagation()}>
            {e.status === 'new' && <Button size="xs" variant="ghost" onClick={() => run(() => api.updateEventStatus(e.id, 'triaged'), 'Event triaged')}>Triage</Button>}
            <Button size="xs" variant="ghost" onClick={() => setEscalate(e)}>Escalate</Button>
          </div>
        ) : null
      },
    }),
  ]
  return (
    <div className="space-y-5">
      <PageHeader title="Security Events" icon={<Zap />} description="Detections, vulnerability signals, authentication anomalies, data movement and configuration changes from connected sources. Assess each event — not every event is an incident." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="New (untriaged)" value={events.filter((e) => e.status === 'new').length} tone="violet" />
        <KpiCard label="Critical / high" value={events.filter((e) => ['critical', 'high'].includes(e.severity) && e.status !== 'dismissed').length} tone="red" />
        <KpiCard label="Escalated to incidents" value={events.filter((e) => e.status === 'escalated').length} />
        <KpiCard label="Dismissed as benign" value={events.filter((e) => e.status === 'dismissed').length} tone="green" />
      </div>
      <DataTable tableId="events" data={events} columns={columns} getRowId={(e) => e.id} onRowClick={(e) => { setSel(e.id); setAssessment(e.assessment ?? '') }} searchPlaceholder="Search events…" facets={[{ columnId: 'type', label: 'Type' }, { columnId: 'severity', label: 'Severity', options: SEVERITY_ORDER.slice(0, 4).map((s) => ({ value: s, label: s })) }, { columnId: 'status', label: 'Status', options: Object.entries(EVENT_STATUS).map(([value, v]) => ({ value, label: v.label })) }, { columnId: 'source', label: 'Source' }]} views={[{ id: 'all', label: 'All events', filters: [] }, { id: 'new', label: 'Needs triage', filters: [{ id: 'status', value: ['new'] }] }, { id: 'crit', label: 'Critical & high', filters: [{ id: 'severity', value: ['critical', 'high'] }] }, { id: 'esc', label: 'Escalated', filters: [{ id: 'status', value: ['escalated'] }] }]} initialViewId="all" exportName="do-safe-events" selectable={false} />
      <Sheet open={!!ev} onOpenChange={(v) => !v && setSel(null)} title={ev?.title ?? ''} description={ev ? `${ev.id} · ${ev.type}` : undefined}>
        {ev && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <SeverityBadge severity={ev.severity} />
              <StatusBadge map={EVENT_STATUS} value={ev.status} />
              <ProvenanceBadge value="observed" />
            </div>
            <KeyValue cols={2} items={[{ label: 'Occurred', value: fmtDateTime(ev.occurredAt) }, { label: 'Source', value: <IntegrationName id={ev.sourceIntegrationId} /> }, { label: 'Asset', value: <EntityLink type="asset" id={ev.assetId} /> }, { label: 'AI system', value: <EntityLink type="aiSystem" id={ev.aiSystemId} /> }, { label: 'Linked finding', value: <EntityLink type="finding" id={ev.findingId} /> }, { label: 'Linked incident', value: <EntityLink type="incident" id={ev.incidentId} /> }]} />
            <div>
              <div className="label-xs mb-1">Raw event summary</div>
              <pre className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3 font-mono text-xs text-slate-600">{ev.rawSummary}</pre>
            </div>
            <Field label="Analyst assessment">
              <Textarea rows={3} value={assessment} onChange={(e) => setAssessment(e.target.value)} placeholder="e.g. Benign — authorized admin script, change ticket CHG-1234" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => api.updateEventStatus(ev.id, 'triaged', assessment || undefined), 'Event triaged')}>
                <Check /> Mark triaged
              </Button>
              <Button variant="secondary" size="sm" disabled={pending || assessment.trim().length < 5} onClick={() => run(() => api.updateEventStatus(ev.id, 'dismissed', assessment), 'Event dismissed with assessment')}>
                <X /> Dismiss as benign
              </Button>
              {ev.status !== 'escalated' && (
                <Button variant="destructive" size="sm" onClick={() => setEscalate(ev)}>
                  <Siren /> Escalate to incident
                </Button>
              )}
            </div>
            {assessment.trim().length < 5 && <p className="text-[11px] text-subtle">Dismissal requires an assessment note.</p>}
          </div>
        )}
      </Sheet>
      {escalate && <EscalateDialog event={escalate} open onOpenChange={(v) => !v && setEscalate(null)} />}
    </div>
  )
}

// ============================================================ Incidents

const incCol = createColumnHelper<Incident>()
const declareSchema = z.object({ title: z.string().min(8, 'Min 8 characters'), severity: z.enum(['critical', 'high', 'medium', 'low']), category: z.string().min(3), summary: z.string().min(20, 'Min 20 characters'), investigatorId: z.string().min(1, 'Assign an investigator') })

export function IncidentsPage() {
  usePage('Incidents', [{ label: 'Security Operations' }, { label: 'Incidents' }])
  const navigate = useNavigate()
  const users = useUsers()
  const [open, setOpen] = React.useState(false)
  const { run } = useAction()
  const { register, handleSubmit, formState, reset } = useForm<z.infer<typeof declareSchema>>({ resolver: zodResolver(declareSchema), defaultValues: { severity: 'high', category: 'Security event' } })
  const { data, isLoading, error, retry } = useCollections(['incidents'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={8} />
  const { incidents } = data
  const columns = [
    incCol.accessor('id', { header: 'ID', cell: (c) => <span className="font-mono text-[11px] text-muted">{c.getValue()}</span> }),
    incCol.accessor('title', { header: 'Incident', cell: (c) => <div className="max-w-[380px]"><div className="truncate font-medium">{c.getValue()}</div><div className="text-[11px] text-subtle">{c.row.original.category}</div></div> }),
    incCol.accessor('severity', { header: 'Severity', filterFn: 'multi', cell: (c) => <SeverityBadge severity={c.getValue()} />, sortingFn: (a, b) => SEVERITY_RANK[a.original.severity] - SEVERITY_RANK[b.original.severity] }),
    incCol.accessor('status', { header: 'Status', filterFn: 'multi', cell: (c) => <StatusBadge map={INCIDENT_STATUS} value={c.getValue()} /> }),
    incCol.accessor((i) => users.find((u) => u.id === i.investigatorId)?.name ?? 'Unassigned', { id: 'investigator', header: 'Investigator', cell: (c) => <UserName id={c.row.original.investigatorId} /> }),
    incCol.accessor((i) => `${i.tasks.filter((t) => t.status === 'done').length}/${i.tasks.length}`, { id: 'tasks', header: 'Tasks' }),
    incCol.accessor('createdAt', { header: 'Declared', cell: (c) => <RelTime iso={c.getValue()} /> }),
    incCol.accessor('updatedAt', { header: 'Updated', cell: (c) => <RelTime iso={c.getValue()} /> }),
  ]
  return (
    <div className="space-y-5">
      <PageHeader title="Incident Management" icon={<Siren />} description="Confirmed security incidents and their response activities — linked to the findings, events and assets that triggered them." actions={<Button variant="destructive" onClick={() => setOpen(true)}><Plus /> Declare incident</Button>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Active incidents" value={incidents.filter((i) => i.status !== 'closed').length} tone="red" />
        <KpiCard label="Critical active" value={incidents.filter((i) => i.status !== 'closed' && i.severity === 'critical').length} tone="red" />
        <KpiCard label="Contained / eradicated" value={incidents.filter((i) => ['contained', 'eradicated', 'recovered'].includes(i.status)).length} tone="amber" />
        <KpiCard label="Closed (with resolution)" value={incidents.filter((i) => i.status === 'closed').length} tone="green" />
      </div>
      <DataTable tableId="incidents" data={incidents} columns={columns} getRowId={(i) => i.id} onRowClick={(i) => navigate(`/operations/incidents/${i.id}`)} facets={[{ columnId: 'severity', label: 'Severity' }, { columnId: 'status', label: 'Status', options: Object.entries(INCIDENT_STATUS).map(([value, v]) => ({ value, label: v.label })) }]} views={[{ id: 'active', label: 'Active', filters: [{ id: 'status', value: ['open', 'investigating', 'contained', 'eradicated', 'recovered'] }] }, { id: 'all', label: 'All incidents', filters: [] }, { id: 'closed', label: 'Closed', filters: [{ id: 'status', value: ['closed'] }] }]} initialViewId="active" exportName="do-safe-incidents" selectable={false} />
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
        <DialogContent wide title="Declare incident" description="For incidents not originating from a specific finding. To escalate a finding or event, use the action on that record.">
          <form
            onSubmit={handleSubmit(async (v) => {
              const inc = await run(() => api.createIncident({ ...v, findingIds: [], eventIds: [] }), (i) => `Incident ${i.id} declared`)
              setOpen(false)
              reset()
              if (inc) navigate(`/operations/incidents/${inc.id}`)
            })}
            className="space-y-4"
          >
            <Field label="Title" required error={formState.errors.title?.message}>
              <Input {...register('title')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Severity" required>
                <NativeSelect {...register('severity')}>
                  {['critical', 'high', 'medium', 'low'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Category" required error={formState.errors.category?.message}>
                <Input {...register('category')} />
              </Field>
              <Field label="Investigator" required error={formState.errors.investigatorId?.message}>
                <NativeSelect {...register('investigatorId')}>
                  <option value="">Select…</option>
                  {users.filter((u) => ['Incident Responder', 'Security Analyst', 'AI Security Analyst'].includes(u.role)).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Summary" required error={formState.errors.summary?.message}>
              <Textarea rows={4} {...register('summary')} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" loading={formState.isSubmitting}>
                Declare incident
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const NEXT_STATUS: Partial<Record<IncidentStatus, IncidentStatus>> = { open: 'investigating', investigating: 'contained', contained: 'eradicated', eradicated: 'recovered' }

export function IncidentDetail() {
  const { id } = useParams()
  const users = useUsers()
  const { data, isLoading, error, retry } = useCollections(['incidents', 'findings', 'events', 'assets'] as const, { ignoreProjectFilter: true })
  const inc = data?.incidents.find((i) => i.id === id)
  usePage(inc?.id ?? 'Incident', [{ label: 'Security Operations' }, { label: 'Incidents', to: '/operations/incidents' }, { label: id ?? '' }])
  const { run, pending } = useAction()
  const [note, setNote] = React.useState('')
  const [task, setTask] = React.useState({ title: '', assigneeId: '', due: '' })
  const [closeOpen, setCloseOpen] = React.useState(false)
  const [resolution, setResolution] = React.useState('')
  const [taskOpen, setTaskOpen] = React.useState(false)
  React.useEffect(() => {
    if (inc) api.recordRecent('incident', inc.id, inc.title)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inc?.id])
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={3} />
  if (!inc) return <NotFound what="Incident" back={{ to: '/operations/incidents', label: 'Back to Incidents' }} />
  const next = NEXT_STATUS[inc.status]
  const closed = inc.status === 'closed'
  const evidenceFindings = data.findings.filter((f) => inc.findingIds.includes(f.id))
  const evidenceEvents = data.events.filter((e) => inc.eventIds.includes(e.id))
  const allTasksDone = inc.tasks.every((t) => t.status === 'done')
  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/operations/incidents', label: 'Incidents' }}
        title={inc.title}
        icon={<Siren />}
        badges={<><SeverityBadge severity={inc.severity} /><StatusBadge map={INCIDENT_STATUS} value={inc.status} /></>}
        description={`${inc.id} · ${inc.category} · declared ${fmtDateTime(inc.createdAt)}`}
        actions={
          !closed && (
            <>
              {next && (
                <Button variant="secondary" loading={pending} onClick={() => run(() => api.updateIncident(inc.id, { status: next }, `Status → ${INCIDENT_STATUS[next].label}`), `Incident moved to ${INCIDENT_STATUS[next].label}`)}>
                  Move to {INCIDENT_STATUS[next].label}
                </Button>
              )}
              <Button onClick={() => setCloseOpen(true)}>
                <CheckCheck /> Close incident
              </Button>
            </>
          )
        }
      />
      {closed && inc.resolutionSummary && (
        <Callout tone="success" icon={<CheckCheck />} title={`Closed ${fmtDateTime(inc.closedAt)} — resolution summary`}>
          {inc.resolutionSummary}
        </Callout>
      )}
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Section title="Summary">
            <p className="text-[13px] text-muted">{inc.summary}</p>
            <KeyValue
              cols={3}
              className="mt-4"
              items={[
                {
                  label: 'Investigator',
                  value: closed ? (
                    <UserName id={inc.investigatorId} />
                  ) : (
                    <NativeSelect value={inc.investigatorId ?? ''} onChange={(e) => run(() => api.updateIncident(inc.id, { investigatorId: e.target.value, status: inc.status === 'open' ? 'investigating' : inc.status }, `Investigator assigned: ${users.find((u) => u.id === e.target.value)?.name}`), 'Investigator assigned')} className="h-8 text-xs" aria-label="Investigator">
                      <option value="">Unassigned</option>
                      {users.filter((u) => ['Incident Responder', 'Security Analyst', 'AI Security Analyst'].includes(u.role)).map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </NativeSelect>
                  ),
                },
                { label: 'Declared by', value: <UserName id={inc.createdById} /> },
                { label: 'Applications', value: inc.businessServiceIds.map((s) => <div key={s}><EntityLink type="service" id={s} showId={false} /></div>) },
              ]}
            />
          </Section>
          <Section title={`Response tasks (${inc.tasks.filter((t) => t.status === 'done').length}/${inc.tasks.length})`} actions={!closed && <Button size="xs" variant="secondary" onClick={() => setTaskOpen(true)}><Plus /> Add task</Button>}>
            <div className="space-y-2">
              {inc.tasks.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <button disabled={closed} onClick={() => run(() => api.updateIncidentTask(inc.id, t.id, t.status === 'done' ? 'in_progress' : 'done'))} className={cn('flex size-5 items-center justify-center rounded-md border cursor-pointer', t.status === 'done' ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-border-strong')} aria-label={`Toggle task ${t.title}`}>
                      {t.status === 'done' && <Check className="size-3" />}
                    </button>
                    <span className={cn('text-[13px]', t.status === 'done' && 'text-muted line-through')}>{t.title}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <UserName id={t.assigneeId} />
                    <span className="text-muted">due {fmtDate(t.dueDate)}</span>
                    {!closed && t.status !== 'done' && (
                      <NativeSelect value={t.status} onChange={(e) => run(() => api.updateIncidentTask(inc.id, t.id, e.target.value as 'todo' | 'in_progress' | 'done'))} className="h-7 w-28 text-xs" aria-label="Task status">
                        <option value="todo">To do</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                      </NativeSelect>
                    )}
                  </div>
                </div>
              ))}
              {!inc.tasks.length && <p className="text-xs text-muted">No response tasks yet — add containment, scoping and communication tasks.</p>}
            </div>
          </Section>
          <Section title="Investigation notes">
            <div className="space-y-2">
              {inc.notes.map((n) => (
                <div key={n.id} className="rounded-lg bg-surface-2 px-3 py-2">
                  <div className="flex justify-between text-[11px] text-subtle">
                    <UserName id={n.authorId} /> <span>{fmtDateTime(n.at)}</span>
                  </div>
                  <p className="mt-1 text-[13px]">{n.text}</p>
                </div>
              ))}
            </div>
            {!closed && (
              <div className="mt-3 space-y-2">
                <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an investigation note…" aria-label="Investigation note" />
                <div className="flex justify-end">
                  <Button size="sm" disabled={note.trim().length < 5} loading={pending} onClick={async () => { await run(() => api.addIncidentNote(inc.id, note.trim()), 'Note added'); setNote('') }}>
                    <MessageSquare /> Add note
                  </Button>
                </div>
              </div>
            )}
          </Section>
          <Section title="Timeline">
            <Timeline entries={inc.timeline} />
          </Section>
        </div>
        <div className="space-y-5">
          <Section title={`Related findings (${evidenceFindings.length})`}>
            {evidenceFindings.map((f) => (
              <div key={f.id} className="mb-2 rounded-lg bg-surface-2 px-3 py-2 text-xs">
                <EntityLink type="finding" id={f.id} />
                <div className="mt-1 flex gap-1.5">
                  <SeverityBadge severity={f.severity} />
                  <FindingStatusBadge status={f.status} />
                </div>
              </div>
            ))}
            {!evidenceFindings.length && <p className="text-xs text-muted">None linked.</p>}
          </Section>
          <Section title={`Related events (${evidenceEvents.length})`}>
            {evidenceEvents.map((e) => (
              <div key={e.id} className="mb-2 text-xs">
                <span className="font-mono text-muted">{e.id}</span> {e.title}
                <div className="text-[11px] text-subtle">{fmtDateTime(e.occurredAt)} · {e.rawSummary}</div>
              </div>
            ))}
            {!evidenceEvents.length && <p className="text-xs text-muted">None linked.</p>}
          </Section>
          <Section title="Affected assets & AI systems">
            <ul className="space-y-1.5 text-xs">
              {inc.assetIds.map((a) => (
                <li key={a}>
                  <EntityLink type="asset" id={a} />
                </li>
              ))}
              {inc.aiSystemIds.map((a) => (
                <li key={a}>
                  <EntityLink type="aiSystem" id={a} />
                </li>
              ))}
              {!inc.assetIds.length && !inc.aiSystemIds.length && <li className="text-muted">None recorded.</li>}
            </ul>
          </Section>
        </div>
      </div>
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent title="Add response task">
          <div className="space-y-4">
            <Field label="Task" required>
              <Input value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} placeholder="e.g. Rotate service account credentials" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Assignee" required>
                <NativeSelect value={task.assigneeId} onChange={(e) => setTask({ ...task, assigneeId: e.target.value })}>
                  <option value="">Select…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Due date" required>
                <Input type="date" value={task.due} onChange={(e) => setTask({ ...task, due: e.target.value })} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setTaskOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={task.title.trim().length < 4 || !task.assigneeId || !task.due}
              loading={pending}
              onClick={async () => {
                await run(() => api.addIncidentTask(inc.id, { title: task.title.trim(), assigneeId: task.assigneeId, dueDate: new Date(`${task.due}T17:00:00`).toISOString() }), 'Task added')
                setTask({ title: '', assigneeId: '', due: '' })
                setTaskOpen(false)
              }}
            >
              Add task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent title="Close incident" description="A resolution summary is required and becomes part of the permanent record.">
          {!allTasksDone && <Callout tone="warn" title="Open response tasks">All response tasks must be completed before closing ({inc.tasks.filter((t) => t.status !== 'done').length} remaining).</Callout>}
          <Field label="Resolution summary" required hint="What happened, impact, containment, root cause and follow-up actions (min 40 characters)">
            <Textarea rows={5} value={resolution} onChange={(e) => setResolution(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCloseOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!allTasksDone || resolution.trim().length < 40}
              loading={pending}
              onClick={async () => {
                await run(() => api.closeIncident(inc.id, resolution.trim()), 'Incident closed')
                setCloseOpen(false)
              }}
            >
              Close incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================ Tickets

const tCol = createColumnHelper<Ticket>()

export function TicketsTable({ tickets, tableId, initialFilters, views }: { tickets: Ticket[]; tableId: string; initialFilters?: ReturnType<typeof useUrlFilters>; views?: { id: string; label: string; filters: { id: string; value: unknown }[] }[] }) {
  const navigate = useNavigate()
  const { id: projectId } = useParams()
  const users = useUsers()
  const columns = [
    tCol.accessor('id', { header: 'ID', cell: (c) => <span className="font-mono text-[11px] text-muted">{c.getValue()}</span> }),
    tCol.accessor('title', { header: 'Ticket', cell: (c) => <div className="max-w-[360px]"><div className="truncate font-medium">{c.getValue()}</div><div className="text-[11px] text-subtle">{c.row.original.externalRef ?? c.row.original.type}</div></div> }),
    tCol.accessor('type', { header: 'Type', filterFn: 'multi', cell: (c) => <span className="capitalize text-muted">{c.getValue().replace('-', ' ')}</span> }),
    tCol.accessor('priority', { header: 'Priority', filterFn: 'multi', cell: (c) => <Badge tone={c.getValue() === 'P1' ? 'red' : c.getValue() === 'P2' ? 'orange' : c.getValue() === 'P3' ? 'amber' : 'slate'}>{c.getValue()}</Badge> }),
    tCol.accessor('status', { header: 'Status', filterFn: 'multi', cell: (c) => <StatusBadge map={TICKET_STATUS} value={c.getValue()} /> }),
    tCol.accessor((t) => users.find((u) => u.id === t.assigneeId)?.name ?? 'Unassigned', { id: 'assignee', header: 'Assignee', filterFn: 'multi', cell: (c) => <UserName id={c.row.original.assigneeId} /> }),
    tCol.accessor('progress', { header: 'Progress', cell: (c) => <div className="flex w-24 items-center gap-2"><Progress value={c.getValue()} tone={c.getValue() === 100 ? 'emerald' : 'violet'} /><span className="text-[11px] text-muted">{c.getValue()}%</span></div> }),
    tCol.accessor((t) => (ticketOverdue(t) ? 'Overdue' : 'On track'), { id: 'sla', header: 'Due', filterFn: 'multi', cell: (c) => <span className={cn('inline-flex items-center gap-1 whitespace-nowrap', c.getValue() === 'Overdue' ? 'text-red-700' : 'text-muted')}>{c.getValue() === 'Overdue' && <AlarmClock className="size-3" />}{fmtDate(c.row.original.dueDate)}</span>, sortingFn: (a, b) => a.original.dueDate.localeCompare(b.original.dueDate) }),
    tCol.accessor((t) => t.findingId ?? t.vendorId ?? t.aiSystemId ?? t.incidentId ?? '', { id: 'linked', header: 'Linked record', cell: (c) => { const t = c.row.original; return t.findingId ? <span className="font-mono text-[11px] text-violet-700">{t.findingId}</span> : t.vendorId ? <span className="font-mono text-[11px] text-violet-700">{t.vendorId}</span> : '—' } }),
    tCol.accessor('updatedAt', { header: 'Updated', cell: (c) => <RelTime iso={c.getValue()} /> }),
  ]
  return (
    <DataTable
      tableId={tableId}
      data={tickets}
      columns={columns}
      getRowId={(t) => t.id}
      onRowClick={(t) => navigate(projectId ? `/projects/${projectId}/tickets/${t.id}` : `/operations/tickets/${t.id}`)}
      initialFilters={initialFilters}
      initialSorting={[{ id: tableId.startsWith('enterprise') ? 'updatedAt' : 'sla', desc: tableId.startsWith('enterprise') }]}
      facets={[{ columnId: 'status', label: 'Status', options: Object.entries(TICKET_STATUS).map(([value, v]) => ({ value, label: v.label })) }, { columnId: 'priority', label: 'Priority' }, { columnId: 'type', label: 'Type' }, { columnId: 'assignee', label: 'Assignee' }]}
      views={(views as never) ?? [{ id: 'open', label: 'Active', filters: [{ id: 'status', value: ['open', 'in_progress', 'blocked', 'pending_verification'] }] }, { id: 'overdue', label: 'Overdue remediation', filters: [{ id: 'sla', value: ['Overdue'] }] }, { id: 'blocked', label: 'Blocked', filters: [{ id: 'status', value: ['blocked'] }] }, { id: 'verify', label: 'Pending verification', filters: [{ id: 'status', value: ['pending_verification'] }] }, { id: 'all', label: 'All tickets', filters: [] }]}
      initialViewId="open"
      exportName="do-safe-tickets"
      exportRow={(t) => ({ id: t.id, title: t.title, type: t.type, priority: t.priority, status: t.status, assignee: users.find((u) => u.id === t.assigneeId)?.name ?? '', due: t.dueDate.slice(0, 10), progress: t.progress, finding: t.findingId ?? '', vendor: t.vendorId ?? '', external_ref: t.externalRef ?? '' })}
      selectable={false}
    />
  )
}

export function TicketsPage() {
  const { id } = useParams()
  usePage('Ticket Management', [{ label: id ? 'Project workspace' : 'Workspace' }, { label: 'Ticket Management' }])
  React.useEffect(() => {
    if (!id) document.title = 'Ticket Management'
  }, [id])
  const { data, isLoading, error, retry } = useCollections(['tickets'] as const, { ignoreProjectFilter: !id })
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={12} />
  return <div className="space-y-5"><PageHeader title="Ticket Management" icon={<TicketIcon />} description={id ? 'Tickets in this project.' : 'Tickets across all projects you are authorized to access.'} /><TicketDashboard tickets={data.tickets} /></div>
}

// ---------------------------------------------------------------- verification dialog

const verifySchema = z.object({ method: z.enum(['Rescan', 'Configuration review', 'Manual test', 'Vendor attestation', 'Control test']), evidence: z.string().min(20, 'Describe the verification evidence (min 20 characters)'), result: z.enum(['passed', 'failed']) })

export function VerifyDialog({ ticket, open, onOpenChange }: { ticket: Ticket; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { run } = useAction()
  const { register, handleSubmit, formState, watch } = useForm<z.infer<typeof verifySchema>>({ resolver: zodResolver(verifySchema), defaultValues: { method: ticket.vendorId ? 'Vendor attestation' : 'Rescan', evidence: '', result: 'passed' } })
  const result = watch('result')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Submit verification evidence" description={`${ticket.id} · ${ticket.title}. Passing verification closes the ticket and resolves the linked finding.`}>
        <form
          onSubmit={handleSubmit(async (v) => {
            await run(() => api.submitVerification(ticket.id, v), v.result === 'passed' ? 'Verification passed — remediation confirmed' : 'Verification failed — returned to remediation')
            onOpenChange(false)
          })}
          className="space-y-4"
        >
          <Field label="Verification method" required>
            <NativeSelect {...register('method')}>
              {['Rescan', 'Configuration review', 'Manual test', 'Vendor attestation', 'Control test'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Evidence" required error={formState.errors.evidence?.message} hint="e.g. scan ID and result, configuration diff, test output, vendor attestation reference">
            <Textarea rows={4} {...register('evidence')} />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-muted">Result</legend>
            <div className="flex gap-2">
              {(['passed', 'failed'] as const).map((r) => (
                <label key={r} className={cn('flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm', result === r ? (r === 'passed' ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-red-500/60 bg-red-500/10') : 'border-border')}>
                  <input type="radio" value={r} {...register('result')} className="accent-violet-500" /> {r === 'passed' ? 'Passed — exposure closed' : 'Failed — still exposed'}
                </label>
              ))}
            </div>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={result === 'passed' ? 'accent' : 'destructive'} loading={formState.isSubmitting}>
              <BadgeCheck /> Record verification
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TicketDetail() {
  const params = useParams()
  const id = params.ticketId || params.id
  const canEdit = useCan('manage_tickets')
  const users = useUsers()
  const { data, isLoading, error, retry } = useCollections(['tickets', 'findings', 'vendors'] as const, { ignoreProjectFilter: !params.ticketId })
  const t = data?.tickets.find((x) => x.id === id)
  usePage(t?.id ?? 'Ticket', [{ label: 'Security Operations' }, { label: 'Tickets', to: params.ticketId ? `/projects/${params.id}/tickets` : '/operations/tickets' }, { label: id ?? '' }])
  const { run, pending } = useAction()
  const [progress, setProgress] = React.useState<number | null>(null)
  const [comment, setComment] = React.useState('')
  const [verify, setVerify] = React.useState(false)
  const [vr, setVr] = React.useState({ status: 'acknowledged', message: '' })
  React.useEffect(() => {
    if (t) api.recordRecent('ticket', t.id, t.title)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.id])
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={3} />
  if (!t) return <NotFound what="Ticket" back={{ to: params.ticketId ? `/projects/${params.id}/tickets` : '/operations/tickets', label: 'Back to Tickets' }} />
  const f = data.findings.find((x) => x.id === t.findingId)
  const closed = ['done', 'cancelled'].includes(t.status)
  const p = progress ?? t.progress
  const setStatus = (status: TicketStatus) => run(() => api.updateTicket(t.id, { status, progress: status === 'pending_verification' ? Math.max(t.progress, 90) : status === 'in_progress' ? Math.max(t.progress, 10) : t.progress }, `Status → ${TICKET_STATUS[status].label}`), `Ticket ${TICKET_STATUS[status].label.toLowerCase()}`)
  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: params.ticketId ? `/projects/${params.id}/tickets` : '/operations/tickets', label: 'Tickets' }}
        title={t.title}
        icon={<TicketIcon />}
        badges={<><Badge tone={t.priority === 'P1' ? 'red' : t.priority === 'P2' ? 'orange' : 'amber'}>{t.priority}</Badge><StatusBadge map={TICKET_STATUS} value={t.status} />{ticketOverdue(t) && <Badge tone="red" icon={<AlarmClock />}>Overdue</Badge>}</>}
        description={`${t.id}${t.externalRef ? ` · ${t.externalRef} (simulated Jira sync)` : ''} · created ${fmtDateTime(t.createdAt)}`}
        actions={
          !closed && canEdit && (
            <>
              {t.status === 'open' && <Button variant="secondary" loading={pending} onClick={() => setStatus('in_progress')}>Start work</Button>}
              {t.status === 'in_progress' && <Button variant="secondary" loading={pending} onClick={() => setStatus('blocked')}>Mark blocked</Button>}
              {t.status === 'blocked' && <Button variant="secondary" loading={pending} onClick={() => setStatus('in_progress')}>Unblock</Button>}
              {['open', 'in_progress', 'blocked'].includes(t.status) && <Button variant="secondary" loading={pending} onClick={() => setStatus('pending_verification')}>Request verification</Button>}
              <Button variant="accent" onClick={() => setVerify(true)}>
                <BadgeCheck /> Submit verification
              </Button>
            </>
          )
        }
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Section title="Description">
            <p className="whitespace-pre-line text-[13px] text-muted">{t.description}</p>
          </Section>
          {!closed && canEdit && (
            <Section title="Remediation progress" description="Update progress as work proceeds — it is reflected on the linked finding and in the Remediation Center">
              <div className="flex items-center gap-4">
                <Slider value={[p]} min={0} max={100} step={5} onValueChange={([v]) => setProgress(v)} aria-label="Progress" />
                <span className="num w-12 text-right font-semibold">{p}%</span>
                <Button size="sm" disabled={progress === null || progress === t.progress} loading={pending} onClick={async () => { await run(() => api.updateTicket(t.id, { progress: p, status: t.status === 'open' && p > 0 ? 'in_progress' : t.status }, `Progress updated to ${p}%`), 'Progress updated'); setProgress(null) }}>
                  Save
                </Button>
              </div>
            </Section>
          )}
          {t.verification && (
            <Callout tone={t.verification.result === 'passed' ? 'success' : 'danger'} icon={<BadgeCheck />} title={`Verification ${t.verification.result} · ${t.verification.method}`}>
              {t.verification.evidence}
              <div className="mt-1 opacity-80">
                <UserName id={t.verification.verifiedById} avatar={false} /> · {fmtDateTime(t.verification.verifiedAt)}
              </div>
            </Callout>
          )}
          {t.vendorId && (
            <Section title="Vendor response" description="Track the third party's response to this remediation item" actions={t.vendorResponse && <Badge tone={t.vendorResponse.status === 'remediated' ? 'emerald' : t.vendorResponse.status === 'disputed' ? 'red' : t.vendorResponse.status === 'acknowledged' ? 'amber' : 'slate'}>{t.vendorResponse.status}</Badge>}>
              {t.vendorResponse?.message && (
                <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
                  “{t.vendorResponse.message}” <span className="text-[11px] text-subtle">— {fmtDateTime(t.vendorResponse.respondedAt)}</span>
                </p>
              )}
              {!closed && canEdit && (
                <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
                  <NativeSelect value={vr.status} onChange={(e) => setVr({ ...vr, status: e.target.value })} aria-label="Vendor response status">
                    <option value="acknowledged">Acknowledged</option>
                    <option value="disputed">Disputed</option>
                    <option value="remediated">Remediated (claims)</option>
                    <option value="awaiting">Awaiting</option>
                  </NativeSelect>
                  <Input value={vr.message} onChange={(e) => setVr({ ...vr, message: e.target.value })} placeholder="Vendor message (simulated portal response)" aria-label="Vendor message" />
                  <Button variant="secondary" disabled={vr.message.trim().length < 3} loading={pending} onClick={async () => { await run(() => api.recordVendorResponse(t.id, vr.status as 'acknowledged', vr.message), 'Vendor response recorded'); setVr({ status: 'acknowledged', message: '' }) }}>
                    Record
                  </Button>
                </div>
              )}
            </Section>
          )}
          <Section title={`Comments (${t.comments.length})`}>
            <div className="space-y-2">
              {t.comments.map((c) => (
                <div key={c.id} className="rounded-lg bg-surface-2 px-3 py-2">
                  <div className="flex justify-between text-[11px] text-subtle">
                    <UserName id={c.authorId} /> <span>{fmtDateTime(c.at)}</span>
                  </div>
                  <p className="mt-1 text-[13px]">{c.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Input disabled={!canEdit} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" aria-label="Comment" />
              <Button variant="secondary" disabled={!canEdit || comment.trim().length < 2} loading={pending} onClick={async () => { await run(() => api.addTicketComment(t.id, comment.trim()), 'Comment added'); setComment('') }}>
                Comment
              </Button>
            </div>
          </Section>
          <Section title="History">
            <Timeline entries={t.history} />
          </Section>
        </div>
        <div className="space-y-5">
          <Section title="Details">
            <KeyValue
              cols={1}
              items={[
                {
                  label: 'Assignee',
                  value: closed || !canEdit ? <UserName id={t.assigneeId} /> : (
                    <NativeSelect value={t.assigneeId ?? ''} onChange={(e) => run(() => api.updateTicket(t.id, { assigneeId: e.target.value }, `Reassigned to ${users.find((u) => u.id === e.target.value)?.name}`), 'Ticket reassigned')} className="h-8 text-xs" aria-label="Assignee">
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </NativeSelect>
                  ),
                },
                {
                  label: 'Due date',
                  value: closed || !canEdit ? fmtDate(t.dueDate) : (
                    <Input type="date" defaultValue={t.dueDate.slice(0, 10)} className="h-8 text-xs" aria-label="Due date" onBlur={(e) => e.target.value && e.target.value !== t.dueDate.slice(0, 10) && run(() => api.updateTicket(t.id, { dueDate: new Date(`${e.target.value}T17:00:00`).toISOString() }, `Due date → ${e.target.value}`), 'Due date updated')} />
                  ),
                  hint: `${daysUntil(t.dueDate) >= 0 ? `${daysUntil(t.dueDate)} days remaining` : `${-daysUntil(t.dueDate)} days overdue`}`,
                },
                { label: 'Reporter', value: <UserName id={t.reporterId} /> },
                { label: 'Type', value: <span className="capitalize">{t.type.replace('-', ' ')}</span> },
                { label: 'Progress', value: `${t.progress}%` },
              ]}
            />
          </Section>
          <Section title="Linked records">
            <ul className="space-y-2 text-xs">
              {f && (
                <li>
                  <div className="label-xs mb-0.5">Finding</div>
                  <EntityLink type="finding" id={f.id} />
                  <div className="mt-1 flex gap-1.5">
                    <SeverityBadge severity={f.severity} />
                    <FindingStatusBadge status={f.status} />
                  </div>
                </li>
              )}
              {t.vendorId && (
                <li>
                  <div className="label-xs mb-0.5">Vendor</div>
                  <EntityLink type="vendor" id={t.vendorId} />
                </li>
              )}
              {t.assessmentId && (
                <li>
                  <div className="label-xs mb-0.5">Assessment</div>
                  <Link to={`/tprm/assessments/${t.assessmentId}`} className="font-mono text-violet-700">{t.assessmentId}</Link>
                </li>
              )}
              {t.aiSystemId && (
                <li>
                  <div className="label-xs mb-0.5">AI system</div>
                  <EntityLink type="aiSystem" id={t.aiSystemId} />
                </li>
              )}
              {t.incidentId && (
                <li>
                  <div className="label-xs mb-0.5">Incident</div>
                  <EntityLink type="incident" id={t.incidentId} />
                </li>
              )}
            </ul>
          </Section>
          {f && (
            <Section title="Verification requirements">
              <ul className="space-y-1 text-xs text-muted">
                {f.remediation.verificationRequirements.map((v) => (
                  <li key={v}>• {v}</li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
      {verify && <VerifyDialog ticket={t} open onOpenChange={setVerify} />}
    </div>
  )
}

// ============================================================ Remediation center

export function RemediationCenter() {
  usePage('Remediation Center', [{ label: 'Security Operations' }, { label: 'Remediation Center' }])
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data, isLoading, error, retry } = useCollections(['tickets', 'findings', 'users', 'services'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={5} rows={10} />
  const { tickets, findings, users, services } = data
  const active = tickets.filter((t) => !['done', 'cancelled'].includes(t.status))
  const dueWeek = active.filter((t) => daysUntil(t.dueDate) >= 0 && daysUntil(t.dueDate) <= 7)
  const verified30 = tickets.filter((t) => t.verification?.result === 'passed' && Date.now() - new Date(t.verification.verifiedAt).getTime() < 30 * 86_400_000)
  const workload = users.map((u) => ({ name: u.name.split(' ')[0], id: u.id, onTrack: active.filter((t) => t.assigneeId === u.id && !ticketOverdue(t)).length, overdue: active.filter((t) => t.assigneeId === u.id && ticketOverdue(t)).length })).filter((w) => w.onTrack + w.overdue > 0).sort((a, b) => b.onTrack + b.overdue - (a.onTrack + a.overdue))
  const bySvc = services.map((s) => ({ name: s.name, value: active.filter((t) => findings.find((f) => f.id === t.findingId)?.businessServiceId === s.id).length })).sort((a, b) => b.value - a.value)
  const unticketed = findings.filter((f) => f.status === 'validated' && f.ticketIds.length === 0)
  const initial = params.get('sla') ? [{ id: 'sla', value: params.get('sla')!.split(',') }] : undefined
  return (
    <div className="space-y-5">
      <PageHeader title="Remediation Center" icon={<Hammer />} description="Orchestrate remediation across teams: ownership, deadlines, workload, blockers and verified risk reduction." actions={<Button variant="secondary" asChild><Link to="/intelligence/agents/AGT-07"><Bot /> Remediation Orchestrator</Link></Button>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="Open work items" value={active.length} />
        <KpiCard label="Overdue" value={active.filter(ticketOverdue).length} tone="red" onClick={() => navigate('/operations/remediation?sla=Overdue')} />
        <KpiCard label="Due in 7 days" value={dueWeek.length} tone="amber" />
        <KpiCard label="Validated, no ticket" value={unticketed.length} tone={unticketed.length ? 'violet' : 'green'} onClick={() => navigate('/operations/findings?status=validated')} sub="Ready for mobilization" />
        <KpiCard label="Verified (30 days)" value={verified30.length} tone="green" sub="Confirmed risk reduction" />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2" title="Workload by owner" description="Active tickets — on track vs overdue">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={workload} margin={{ left: -18, right: 8, top: 8 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" {...AXIS} />
                <YAxis {...AXIS} allowDecimals={false} />
                <RTooltip content={<ChartTooltip />} />
                <Bar dataKey="onTrack" name="On track" stackId="a" fill={CATEGORICAL[0]} />
                <Bar dataKey="overdue" name="Overdue" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Active remediation by service">
          <ul className="space-y-2">
            {bySvc.map((s) => (
              <li key={s.name} className="flex items-center justify-between text-xs">
                <span>{s.name}</span>
                <span className="num font-semibold">{s.value}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
      <TicketsTable key={params.toString()} tickets={tickets} tableId="remediation" initialFilters={initial} />
    </div>
  )
}

// ============================================================ Verification

export function VerificationPage() {
  usePage('Remediation Verification', [{ label: 'Security Operations' }, { label: 'Verification' }])
  const { data, isLoading, error, retry } = useCollections(['tickets', 'findings'] as const)
  const [verify, setVerify] = React.useState<Ticket | null>(null)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={3} rows={8} />
  const { tickets, findings } = data
  const queue = tickets.filter((t) => t.status === 'pending_verification')
  const recent = tickets.filter((t) => t.verification).sort((a, b) => b.verification!.verifiedAt.localeCompare(a.verification!.verifiedAt))
  return (
    <div className="space-y-5">
      <PageHeader title="Remediation Verification" icon={<BadgeCheck />} description="Record evidence that corrective actions succeeded. A finding is resolved only after verification passes — this is how DO SAFE confirms actual risk reduction." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Awaiting verification" value={queue.length} tone="violet" />
        <KpiCard label="Passed" value={recent.filter((t) => t.verification!.result === 'passed').length} tone="green" />
        <KpiCard label="Failed (returned)" value={recent.filter((t) => t.verification!.result === 'failed').length} tone="red" />
        <KpiCard label="Findings resolved via verification" value={findings.filter((f) => f.status === 'resolved').length} />
      </div>
      <Section title={`Verification queue (${queue.length})`}>
        {queue.length ? (
          <div className="divide-y divide-border/60">
            {queue.map((t) => {
              const f = findings.find((x) => x.id === t.findingId)
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/operations/tickets/${t.id}`} className="block truncate text-[13px] font-medium hover:text-violet-700">
                      <span className="font-mono text-[11px] text-muted">{t.id}</span> {t.title}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                      <UserName id={t.assigneeId} /> {f && <span>· {f.id}</span>} {t.vendorId && <span className="inline-flex items-center gap-1"><Building2 className="size-3" /> vendor item</span>}
                      {f && <span>· requires: {f.remediation.verificationRequirements[0]}</span>}
                    </div>
                  </div>
                  <Button size="sm" variant="accent" onClick={() => setVerify(t)}>
                    <ShieldCheck /> Verify
                  </Button>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState icon={<ClipboardCheck />} title="Nothing awaiting verification" description="Tickets move here when owners request verification." />
        )}
      </Section>
      <Section title="Recent verification records">
        <div className="divide-y divide-border/60">
          {recent.slice(0, 15).map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-xs">
              <Link to={`/operations/tickets/${t.id}`} className="min-w-0 flex-1 truncate hover:text-violet-700">
                <span className="font-mono text-muted">{t.id}</span> {t.title}
              </Link>
              <span className="text-muted">{t.verification!.method}</span>
              <Badge tone={t.verification!.result === 'passed' ? 'emerald' : 'red'}>{t.verification!.result}</Badge>
              <UserName id={t.verification!.verifiedById} />
              <RelTime iso={t.verification!.verifiedAt} />
            </div>
          ))}
        </div>
      </Section>
      {verify && <VerifyDialog ticket={verify} open onOpenChange={(v) => !v && setVerify(null)} />}
    </div>
  )
}

// ============================================================ Approvals (human approval gates)

export function ApprovalsPage() {
  usePage('Approvals', [{ label: 'Security Operations' }, { label: 'Approvals' }])
  return <ApprovalsContent />
}

/** Human approval gates (agent actions, risk acceptance, AI governance). Also embedded in Requests. */
export function ApprovalsContent({ embedded }: { embedded?: boolean }) {
  const { data, isLoading, error, retry } = useCollections(['executions', 'agents', 'findings', 'governanceReviews'] as const)
  const { run, pending } = useAction()
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={8} />
  const { executions, agents, findings, governanceReviews } = data
  const agentPending = executions.filter((e) => e.approval?.status === 'pending')
  const raPending = findings.filter((f) => f.riskAcceptance?.status === 'pending')
  const govOpen = governanceReviews.filter((g) => ['open', 'in_review'].includes(g.status))
  const decided = [
    ...executions.filter((e) => e.approval && e.approval.status !== 'pending' && e.approval.decidedAt).map((e) => ({ at: e.approval!.decidedAt!, label: `${agents.find((a) => a.id === e.agentId)?.name}: ${e.approval!.action}`, status: e.approval!.status, by: e.approval!.decidedById, link: `/intelligence/agents/${e.agentId}` })),
    ...findings.filter((f) => f.riskAcceptance && f.riskAcceptance.status !== 'pending' && f.riskAcceptance.decidedAt).map((f) => ({ at: f.riskAcceptance!.decidedAt!, label: `Risk acceptance: ${f.id} ${f.title}`, status: f.riskAcceptance!.status, by: f.riskAcceptance!.decidedById, link: `/operations/findings/${f.id}` })),
  ].sort((a, b) => b.at.localeCompare(a.at))
  return (
    <div className="space-y-5">
      {!embedded && <PageHeader title="Human Approval Gates" icon={<Scale />} description="High-impact actions proposed by agents, risk acceptance requests and AI governance decisions require explicit human approval. Every decision is recorded in the audit log." />}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard label="Agent actions awaiting approval" value={agentPending.length} tone="violet" />
        <KpiCard label="Risk acceptance requests" value={raPending.length} tone="amber" />
        <KpiCard label="Open AI governance reviews" value={govOpen.length} />
      </div>
      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents"><Bot /> Agent actions ({agentPending.length})</TabsTrigger>
          <TabsTrigger value="risk"><Scale /> Risk acceptance ({raPending.length})</TabsTrigger>
          <TabsTrigger value="gov"><Users /> AI governance ({govOpen.length})</TabsTrigger>
          <TabsTrigger value="history"><CheckCheck /> Decision history</TabsTrigger>
        </TabsList>
        <TabsContent value="agents" className="space-y-3">
          {agentPending.map((e) => {
            const a = agents.find((x) => x.id === e.agentId)!
            return (
              <Card key={e.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link to={`/intelligence/agents/${a.id}`} className="font-semibold hover:text-violet-700">{a.name}</Link>
                      <DemoTag>Simulated run</DemoTag>
                    </div>
                    <div className="mt-0.5 text-[13px]">Proposed action: <span className="font-medium">{e.approval!.action}</span></div>
                    <div className="text-xs text-muted">
                      {e.id} · started <RelTime iso={e.startedAt} /> · policy: {a.approvalRequirement}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => api.decideExecution(e.id, false), 'Action rejected')}>
                      <X /> Reject
                    </Button>
                    <Button size="sm" disabled={pending} onClick={() => run(() => api.decideExecution(e.id, true), e.agentId === 'AGT-07' ? 'Approved — remediation tickets created' : 'Action approved')}>
                      <Check /> Approve
                    </Button>
                  </div>
                </div>
                <ul className="mt-3 space-y-1 rounded-lg bg-surface-2 p-3 text-xs">
                  {e.outputs.map((o, i) => (
                    <li key={i}>{o.recordId ? <EntityLink type="finding" id={o.recordId} label={o.label} showId={false} /> : o.label}</li>
                  ))}
                </ul>
              </Card>
            )
          })}
          {!agentPending.length && <Card><EmptyState icon={<CheckCheck />} title="No agent actions awaiting approval" description="Run the Remediation Orchestrator demo to generate a proposal." action={<Button size="sm" variant="secondary" asChild><Link to="/intelligence/agents/AGT-07">Open Remediation Orchestrator</Link></Button>} /></Card>}
        </TabsContent>
        <TabsContent value="risk" className="space-y-3">
          {raPending.map((f) => (
            <Card key={f.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <EntityLink type="finding" id={f.id} />
                  <div className="mt-1 flex gap-1.5">
                    <SeverityBadge severity={f.severity} />
                    <FindingStatusBadge status={f.status} />
                  </div>
                  <p className="mt-2 text-[13px] text-muted">“{f.riskAcceptance!.justification}”</p>
                  <div className="mt-1 text-xs text-subtle">
                    Requested by <UserName id={f.riskAcceptance!.requestedById} avatar={false} /> · expires {fmtDate(f.riskAcceptance!.expiresAt)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => api.decideRiskAcceptance(f.id, false), 'Risk acceptance rejected')}>
                    <X /> Reject
                  </Button>
                  <Button size="sm" disabled={pending} onClick={() => run(() => api.decideRiskAcceptance(f.id, true), 'Risk acceptance approved')}>
                    <Check /> Approve
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {!raPending.length && <Card><EmptyState title="No pending risk acceptance requests" description="Request risk acceptance from a finding's Remediation tab." /></Card>}
        </TabsContent>
        <TabsContent value="gov">
          <Card className="divide-y divide-border/60">
            {govOpen.map((g) => (
              <Link key={g.id} to={`/ai-security/governance/${g.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-surface-2/50">
                <span className="text-[13px]">
                  <span className="font-mono text-[11px] text-muted">{g.id}</span> {g.title}
                </span>
                <Badge tone={g.status === 'open' ? 'violet' : 'amber'}>{g.status.replace('_', ' ')}</Badge>
              </Link>
            ))}
            {!govOpen.length && <EmptyState title="No open governance reviews" />}
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card className="divide-y divide-border/60">
            {decided.slice(0, 25).map((d, i) => (
              <Link key={i} to={d.link} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs hover:bg-surface-2/50">
                <span className="min-w-0 flex-1 truncate">{d.label}</span>
                <Badge tone={d.status === 'approved' ? 'emerald' : 'red'}>{d.status}</Badge>
                <UserName id={d.by} />
                <RelTime iso={d.at} />
              </Link>
            ))}
            {!decided.length && <EmptyState title="No decisions yet" />}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
