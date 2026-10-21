// Job-specific home sections. Every home shares the same shell, header and status band (see index.tsx);
// these sections change what comes first for each kind of work.
import * as React from 'react'
import { Link } from 'react-router'
import { AlarmClock, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, Bot, Building2, Calculator, CheckCircle2, ClipboardList, FileWarning, Gavel, HelpCircle, Inbox, KeyRound, LifeBuoy, Mail, Plug, Rocket, ShieldAlert, ShieldCheck, Siren, Unplug, UserX, Zap } from 'lucide-react'
import type { AccessRequest, Asset, BusinessService, Finding, Integration, Ticket as TicketT } from '@/types'
import { useCollections } from '@/hooks/queries'
import { Section } from '@/components/common/layout'
import { Badge, SeverityBadge, StatusBadge } from '@/components/common/badges'
import { RelTime } from '@/components/common/entities'
import { Term } from '@/components/common/Term'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/misc'
import { APP_STATUS } from '@/modules/applications'
import { JOURNEY, stepFromStatus } from '@/modules/onboarding/journey'
import { cn, fmtDate, fmtDateTime, fmtMoney, plural } from '@/utils/format'
import { isOpen, TICKET_STATUS } from '@/utils/labels'
import { computeScenario, isOverdue, vendorRiskBand } from '@/utils/risk'
import type { scoreFindings } from '@/utils/derive'
import { assetLabel, findingPlain, SEVERITY_PLAIN } from '@/utils/plain'

type Scored = ReturnType<typeof scoreFindings>[number]

export interface HomeCtx {
  meId: string
  services: BusinessService[]
  findings: Finding[]
  assets: Asset[]
  tickets: TicketT[]
  integrations: Integration[]
  accessRequests: AccessRequest[]
  openAll: Scored[]
  pendingForMe: AccessRequest[]
}

const DAY = 86_400_000
const ago = (iso?: string) => (iso ? Date.now() - new Date(iso).getTime() : Infinity)

/** A count that links to the list behind it. */
export function CountTile({ icon, label, value, to, tone, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; to: string; tone?: 'red' | 'amber' | 'green' | 'violet'; sub?: string }) {
  return (
    <Link to={to} className="card flex items-start gap-3 p-4 transition-colors hover:border-border-strong">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-[18px]', tone === 'red' ? 'bg-red-50 text-red-600' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : tone === 'green' ? 'bg-emerald-50 text-emerald-700' : 'bg-primary-soft text-primary')}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-[13px] text-muted">{label}</span>
        <span className="num block text-2xl font-semibold">{value}</span>
        {sub && <span className="block truncate text-[12px] text-muted">{sub}</span>}
      </span>
    </Link>
  )
}

function ProblemRow({ x }: { x: Scored }) {
  return (
    <Link to={`/operations/findings/${x.f.id}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-2/60">
      <SeverityBadge severity={x.f.severity} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium">{findingPlain(x.f)}</span>
        <span className="block truncate text-[12px] text-muted">{x.service?.name ?? '—'}{x.asset ? ` · ${assetLabel(x.asset.type).toLowerCase()}` : ''} · {x.f.title}{isOverdue(x.f) ? ' · overdue' : ''}</span>
      </span>
      <span className="hidden text-[12px] text-muted sm:block">{SEVERITY_PLAIN[x.f.severity].when}</span>
    </Link>
  )
}

// ---------------------------------------------------------------- Executive

export function ExecutiveSections({ ctx }: { ctx: HomeCtx }) {
  const { data } = useCollections(['scenarios', 'vendors', 'aiSystems', 'governanceReviews', 'executions'] as const)
  const critical = ctx.findings.filter((f) => f.severity === 'critical')
  const opened30 = critical.filter((f) => ago(f.firstDetected) < 30 * DAY).length
  const closed30 = critical.filter((f) => f.resolvedAt && ago(f.resolvedAt) < 30 * DAY).length
  const openNow = critical.filter((f) => isOpen(f.status)).length
  const improving = closed30 >= opened30
  const decisions = data ? data.executions.filter((e) => e.approval?.status === 'pending').length + ctx.findings.filter((f) => f.riskAcceptance?.status === 'pending').length + data.governanceReviews.filter((g) => ['open', 'in_review'].includes(g.status)).length : 0
  const exposure = ctx.services
    .map((s) => {
      const open = ctx.findings.filter((f) => f.businessServiceId === s.id && isOpen(f.status))
      const ale = data ? data.scenarios.filter((x) => x.businessServiceId === s.id).reduce((a, x) => a + computeScenario(x, ctx.findings).ale, 0) : 0
      return { s, crit: open.filter((f) => f.severity === 'critical').length, high: open.filter((f) => f.severity === 'high').length, ale }
    })
    .sort((a, b) => b.ale - a.ale || b.crit - a.crit)
    .slice(0, 6)
  const highVendors = data ? data.vendors.filter((v) => v.lifecycle !== 'offboarded' && ['critical', 'high'].includes(vendorRiskBand(v.residualRisk))).length : 0
  const unapprovedAI = data ? data.aiSystems.filter((a) => a.approval === 'unsanctioned' || a.approval === 'prohibited').length : 0
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CountTile icon={<Gavel />} label="Decisions waiting for you" value={decisions} to="/requests?tab=approvals" tone={decisions ? 'violet' : 'green'} sub="Risk acceptances, AI reviews, agent actions" />
        <CountTile icon={improving ? <ArrowDownRight /> : <ArrowUpRight />} label="Is risk improving?" value={improving ? 'Yes' : 'Not yet'} to="/analytics" tone={improving ? 'green' : 'amber'} sub={`Last 30 days: ${opened30} urgent new, ${closed30} fixed`} />
        <CountTile icon={<Building2 />} label="High-risk suppliers" value={highVendors} to="/tprm/vendors" tone={highVendors ? 'amber' : 'green'} />
        <CountTile icon={<Bot />} label="Unapproved AI tools" value={unapprovedAI} to="/ai-security/shadow-ai" tone={unapprovedAI ? 'amber' : 'green'} />
      </div>
      <Section title="Where is the business most exposed?" description={<>Applications ranked by <Term k="ale">expected yearly loss</Term>, then urgent problems. {openNow} urgent problems are open across the organization.</>} actions={<Button size="xs" variant="ghost" asChild><Link to="/crq/report">Board report <ArrowRight /></Link></Button>}>
        <div className="divide-y divide-border">
          {exposure.map(({ s, crit, high, ale }) => (
            <Link key={s.id} to={`/applications/${s.id}`} className="flex flex-wrap items-center gap-3 py-2.5 hover:bg-surface-2/60">
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">{s.name}</span>
                <span className="block text-[12px] text-muted">{crit ? `${plural(crit, 'urgent problem')}` : 'No urgent problems'}{high ? ` · ${high} high` : ''}</span>
              </span>
              <span className="num text-[13.5px] font-semibold">{ale ? fmtMoney(ale) : '—'}<span className="block text-right text-[11px] font-normal text-muted">per year (est.)</span></span>
              <StatusBadge map={APP_STATUS} value={s.status} />
            </Link>
          ))}
        </div>
      </Section>
    </>
  )
}

// ---------------------------------------------------------------- Platform administrator

export function AdminSections({ ctx, pendingInvites, noMfa }: { ctx: HomeCtx; pendingInvites: number; noMfa: number }) {
  const connected = ctx.integrations.filter((i) => i.status === 'connected' || i.status === 'error')
  const attention = ctx.integrations.filter((i) => i.status === 'error' || (i.status === 'connected' && i.health < 80))
  const healthy = connected.length ? Math.round(((connected.length - attention.length) / connected.length) * 100) : 100
  const lastImport = connected.map((i) => i.lastSyncAt).filter(Boolean).sort().pop()
  const setup = ctx.services.filter((s) => !['active', 'paused'].includes(s.status))
  const blocked = setup.filter((s) => s.status === 'test_failed')
  const firstIssue = attention[0] ? `/integrations/${attention[0].id}` : blocked[0] ? `/onboarding?app=${blocked[0].id}` : ctx.pendingForMe.length ? '/requests' : '/integrations/monitoring'
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CountTile icon={<Plug />} label="Data-source health" value={`${healthy}%`} to="/integrations/monitoring" tone={healthy >= 90 ? 'green' : healthy >= 70 ? 'amber' : 'red'} sub={lastImport ? `Last import ${fmtDateTime(lastImport)}` : 'No imports yet'} />
        <CountTile icon={<Unplug />} label="Tools needing attention" value={attention.length} to="/integrations/connected" tone={attention.length ? 'red' : 'green'} />
        <CountTile icon={<Rocket />} label="Setups blocked" value={blocked.length} to={blocked[0] ? `/onboarding?app=${blocked[0].id}` : '/applications'} tone={blocked.length ? 'amber' : 'green'} sub={`${plural(setup.length, 'app')} being set up`} />
        <CountTile icon={<KeyRound />} label="People & access" value={ctx.pendingForMe.length + pendingInvites} to="/requests" tone={ctx.pendingForMe.length ? 'violet' : undefined} sub={`${ctx.pendingForMe.length} requests · ${pendingInvites} invites · ${noMfa} without two-step login`} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Tools that need attention" description="Problems here reduce what DO SAFE can see" actions={<Button size="sm" asChild><Link to={firstIssue}>Fix platform health <ArrowRight /></Link></Button>}>
          <ul className="divide-y divide-border">
            {attention.map((i) => (
              <li key={i.id}>
                <Link to={`/integrations/${i.id}`} className="flex items-center justify-between gap-3 py-2.5 text-[13.5px] hover:text-primary">
                  <span className="flex items-center gap-2"><AlertTriangle className={cn('size-4', i.status === 'error' ? 'text-red-600' : 'text-amber-600')} /> {i.name}</span>
                  <span className="text-[12px] text-muted">{i.status === 'error' ? 'Not working' : `Health ${i.health}%`}{i.lastSyncAt ? ` · synced ` : ''}{i.lastSyncAt && <RelTime iso={i.lastSyncAt} />}</span>
                </Link>
              </li>
            ))}
            {!attention.length && <li className="flex items-center gap-2 py-2.5 text-[13.5px]"><CheckCircle2 className="size-4 text-emerald-600" /> All connected tools are healthy.</li>}
          </ul>
        </Section>
        <Section title="Applications being set up" actions={<Button size="xs" variant="ghost" asChild><Link to="/applications">All <ArrowRight /></Link></Button>}>
          <ul className="divide-y divide-border">
            {setup.map((s) => (
              <li key={s.id}>
                <Link to={`/onboarding?app=${s.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-surface-2/60">
                  <span className="min-w-0"><span className="block text-[13.5px] font-medium">{s.name}</span><span className="block text-[12px] text-muted">Next: {JOURNEY[stepFromStatus(s)].label}</span></span>
                  <StatusBadge map={APP_STATUS} value={s.status} />
                </Link>
              </li>
            ))}
            {!setup.length && <li className="py-2.5 text-[13.5px] text-muted">Nothing being set up right now.</li>}
          </ul>
        </Section>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- Security analyst / incident responder

export function AnalystSections({ ctx, top, incidentsFirst }: { ctx: HomeCtx; top: Scored[]; incidentsFirst?: boolean }) {
  const triage = ctx.openAll.filter((x) => x.f.status === 'new')
  const exploited = ctx.openAll.filter((x) => x.f.severity === 'critical' && x.f.kev)
  const overdue = ctx.openAll.filter((x) => isOverdue(x.f))
  const verify = ctx.openAll.filter((x) => x.f.status === 'pending_verification')
  const broken = ctx.integrations.filter((i) => i.status === 'error')
  return (
    <>
      {incidentsFirst && <IncidentSection />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <CountTile icon={<Inbox />} label="New — need triage" value={triage.length} to="/operations/findings?status=new" tone={triage.length ? 'violet' : 'green'} />
        <CountTile icon={<ShieldAlert />} label={'Urgent & being exploited'} value={exploited.length} to="/exposures/prioritization" tone={exploited.length ? 'red' : 'green'} />
        <CountTile icon={<AlarmClock />} label="Fixes overdue" value={overdue.length} to="/operations/remediation?sla=Overdue" tone={overdue.length ? 'amber' : 'green'} />
        <CountTile icon={<Unplug />} label="Tool failures" value={broken.length} to="/integrations/connected" tone={broken.length ? 'amber' : 'green'} sub="Reduce what we can see" />
        <CountTile icon={<BadgeCheck />} label="Waiting for verification" value={verify.length} to="/operations/verification" />
      </div>
      <Section title="Your queue" description="Highest priority first" actions={top[0] && <Button size="sm" asChild><Link to={`/operations/findings/${top[0].f.id}`}>Start with the highest-priority issue <ArrowRight /></Link></Button>}>
        <div className="divide-y divide-border">
          {top.map((x) => <ProblemRow key={x.f.id} x={x} />)}
          {!top.length && <p className="py-3 text-[13.5px] text-muted">Your queue is empty.</p>}
        </div>
      </Section>
    </>
  )
}

function IncidentSection() {
  const { data } = useCollections(['incidents', 'events'] as const)
  if (!data) return null
  const active = data.incidents.filter((i) => !['recovered', 'closed'].includes(i.status))
  const recent = data.events.filter((e) => ago(e.occurredAt) < DAY)
  return (
    <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
      <Section title={`Active incidents (${active.length})`} actions={<Button size="xs" variant="ghost" asChild><Link to="/operations/incidents">All <ArrowRight /></Link></Button>}>
        <ul className="divide-y divide-border">
          {active.slice(0, 5).map((i) => (
            <li key={i.id}>
              <Link to={`/operations/incidents/${i.id}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-2/60">
                <Siren className="size-4 text-red-600" />
                <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-medium">{i.title}</span><span className="block text-[12px] text-muted">{i.status} · opened <RelTime iso={i.createdAt} /></span></span>
                <SeverityBadge severity={i.severity} />
              </Link>
            </li>
          ))}
          {!active.length && <li className="py-2.5 text-[13.5px] text-muted">No active incidents.</li>}
        </ul>
      </Section>
      <CountTile icon={<Zap />} label="Security events, last 24 hours" value={recent.length} to="/operations/events" tone={recent.some((e) => e.severity === 'critical') ? 'red' : undefined} sub={`${recent.filter((e) => e.status === 'new').length} not yet reviewed`} />
    </div>
  )
}

// ---------------------------------------------------------------- Application owner

export function OwnerSections({ ctx, myTickets }: { ctx: HomeCtx; myTickets: TicketT[] }) {
  const connected = new Set(ctx.integrations.filter((i) => i.status === 'connected').map((i) => i.id))
  const mine = ctx.services.filter((s) => s.ownerId === ctx.meId)
  const apps = (mine.length ? mine : ctx.services).filter((s) => s.status === 'active' || s.status === 'paused')
  const weekEnd = Date.now() + 7 * DAY
  const dueSoon = myTickets.filter((t) => new Date(t.dueDate).getTime() < weekEnd)
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {apps.slice(0, 4).map((s) => {
          const parts = ctx.assets.filter((a) => a.businessServiceId === s.id)
          const checked = parts.filter((a) => (s.coverage[a.id] ?? a.sourceIntegrationIds).some((id) => connected.has(id))).length
          const pct = parts.length ? Math.round((checked / parts.length) * 100) : 0
          const action = ctx.openAll.filter((x) => x.f.businessServiceId === s.id && ['critical', 'high'].includes(x.f.severity))
          return (
            <Card key={s.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[15px] font-semibold">Your {s.name} is {pct}% protected</div>
                  <div className="text-[12.5px] text-muted">{checked} of {plural(parts.length, 'part')} checked · next check {s.nextRunAt ? fmtDateTime(s.nextRunAt) : '—'}</div>
                </div>
                <StatusBadge map={APP_STATUS} value={s.status} />
              </div>
              <Progress value={pct} tone={pct === 100 ? 'emerald' : 'amber'} className="mt-3" />
              <ul className="mt-3 space-y-1 text-[13px]">
                <li className="flex items-center gap-2">{action.length ? <ShieldAlert className="size-4 text-red-600" /> : <CheckCircle2 className="size-4 text-emerald-600" />}{action.length ? `${plural(action.length, 'problem')} need action` : 'No urgent or high problems'}</li>
                {parts.length - checked > 0 && <li className="flex items-center gap-2"><Unplug className="size-4 text-amber-600" /> {plural(parts.length - checked, 'part')} not covered by a tool</li>}
              </ul>
              <div className="mt-3 flex gap-2">
                <Button size="sm" asChild><Link to={`/applications/${s.id}`}>Review my required actions</Link></Button>
              </div>
            </Card>
          )
        })}
      </div>
      <Section title={`Your fix tasks (${myTickets.length})`} description={dueSoon.length ? `${plural(dueSoon.length, 'task')} due this week` : 'Nothing due this week'} actions={<Button size="xs" variant="ghost" asChild><Link to="/operations/tickets">All <ArrowRight /></Link></Button>}>
        <TaskList tickets={myTickets} />
      </Section>
    </>
  )
}

function TaskList({ tickets }: { tickets: TicketT[] }) {
  return (
    <ul className="divide-y divide-border">
      {tickets.slice(0, 8).map((t) => (
        <li key={t.id}>
          <Link to={`/operations/tickets/${t.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-surface-2/60">
            <span className="min-w-0"><span className="block truncate text-[13.5px] font-medium">{t.title}</span><span className="block text-[12px] text-muted">{TICKET_STATUS[t.status].label}</span></span>
            <span className={cn('flex shrink-0 items-center gap-1 text-[12.5px]', new Date(t.dueDate) < new Date() ? 'text-red-700' : 'text-muted')}>{new Date(t.dueDate) < new Date() && <AlarmClock className="size-3.5" />}Due {fmtDate(t.dueDate)}</span>
          </Link>
        </li>
      ))}
      {!tickets.length && <li className="flex items-center gap-2 py-2.5 text-[13.5px]"><CheckCircle2 className="size-4 text-emerald-600" /> Nothing assigned to you.</li>}
    </ul>
  )
}

// ---------------------------------------------------------------- Specialists

export function VendorSections() {
  const { data } = useCollections(['vendors', 'assessments', 'monitoringAlerts'] as const)
  if (!data) return null
  const live = data.vendors.filter((v) => v.lifecycle !== 'offboarded')
  const high = live.filter((v) => ['critical', 'high'].includes(vendorRiskBand(v.residualRisk))).sort((a, b) => b.residualRisk - a.residualRisk)
  const due = data.assessments.filter((a) => a.status !== 'completed' && new Date(a.dueDate).getTime() < Date.now() + 14 * DAY)
  const alerts = data.monitoringAlerts.filter((a) => a.status === 'open')
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CountTile icon={<Building2 />} label="High-risk suppliers" value={high.length} to="/tprm/vendors" tone={high.length ? 'red' : 'green'} sub={`of ${live.length} active`} />
        <CountTile icon={<ClipboardList />} label="Assessments due in 14 days" value={due.length} to="/tprm/assessments" tone={due.length ? 'amber' : 'green'} />
        <CountTile icon={<AlertTriangle />} label="Open monitoring alerts" value={alerts.length} to="/tprm/monitoring" tone={alerts.length ? 'amber' : 'green'} />
        <CountTile icon={<FileWarning />} label="Suppliers in remediation" value={live.filter((v) => v.lifecycle === 'remediation').length} to="/tprm/remediation" />
      </div>
      <Section title="Riskiest suppliers" actions={<Button size="xs" variant="ghost" asChild><Link to="/tprm/vendors">All <ArrowRight /></Link></Button>}>
        <ul className="divide-y divide-border">
          {high.slice(0, 6).map((v) => (
            <li key={v.id}><Link to={`/tprm/vendors/${v.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-surface-2/60"><span className="text-[13.5px] font-medium">{v.name}</span><SeverityBadge severity={vendorRiskBand(v.residualRisk)} /></Link></li>
          ))}
        </ul>
      </Section>
    </>
  )
}

export function AISections({ ctx }: { ctx: HomeCtx }) {
  const { data } = useCollections(['aiSystems', 'governanceReviews'] as const)
  if (!data) return null
  const unapproved = data.aiSystems.filter((a) => a.approval === 'unsanctioned' || a.approval === 'prohibited')
  const reviews = data.governanceReviews.filter((g) => ['open', 'in_review'].includes(g.status))
  const aiProblems = ctx.openAll.filter((x) => x.f.domain === 'ai')
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <CountTile icon={<Bot />} label="Unapproved AI tools" value={unapproved.length} to="/ai-security/shadow-ai" tone={unapproved.length ? 'red' : 'green'} />
        <CountTile icon={<Gavel />} label="Governance reviews open" value={reviews.length} to="/ai-security/governance" tone={reviews.length ? 'violet' : 'green'} />
        <CountTile icon={<FileWarning />} label="AI problems open" value={aiProblems.length} to="/ai-security/config-risks" tone={aiProblems.some((x) => x.f.severity === 'critical') ? 'red' : undefined} />
      </div>
      <Section title="Unapproved AI in use" actions={<Button size="xs" variant="ghost" asChild><Link to="/ai-security/inventory">Inventory <ArrowRight /></Link></Button>}>
        <ul className="divide-y divide-border">
          {unapproved.slice(0, 6).map((a) => (
            <li key={a.id}><Link to={`/ai-security/systems/${a.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-surface-2/60"><span className="text-[13.5px] font-medium">{a.name}</span><Badge tone={a.approval === 'prohibited' ? 'red' : 'amber'}>{a.approval}</Badge></Link></li>
          ))}
          {!unapproved.length && <li className="py-2.5 text-[13.5px] text-muted">No unapproved AI detected.</li>}
        </ul>
      </Section>
    </>
  )
}

export function RiskSections({ ctx }: { ctx: HomeCtx }) {
  const { data } = useCollections(['scenarios', 'controls'] as const)
  if (!data) return null
  const rows = data.scenarios.map((s) => ({ s, r: computeScenario(s, ctx.findings) })).sort((a, b) => b.r.ale - a.r.ale)
  const total = rows.reduce((a, x) => a + x.r.ale, 0)
  const weak = [...data.controls].sort((a, b) => a.effectiveness - b.effectiveness).slice(0, 4)
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <CountTile icon={<Calculator />} label="Expected yearly loss (est.)" value={fmtMoney(total)} to="/crq" tone="violet" sub={`${plural(rows.length, 'scenario')}`} />
        <CountTile icon={<ShieldCheck />} label="Weakest control" value={weak[0] ? `${Math.round(weak[0].effectiveness * 100)}%` : '—'} to="/crq/controls" tone="amber" sub={weak[0]?.name} />
        <CountTile icon={<ClipboardList />} label="Board report" value="Ready" to="/crq/report" tone="green" />
      </div>
      <Section title="Biggest loss scenarios" actions={<Button size="xs" variant="ghost" asChild><Link to="/crq/scenarios">All <ArrowRight /></Link></Button>}>
        <ul className="divide-y divide-border">
          {rows.slice(0, 5).map(({ s, r }) => (
            <li key={s.id}><Link to={`/crq/scenarios/${s.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-surface-2/60"><span className="text-[13.5px] font-medium">{s.name}</span><span className="num text-[13.5px] font-semibold">{fmtMoney(r.ale)}</span></Link></li>
          ))}
        </ul>
      </Section>
    </>
  )
}

// ---------------------------------------------------------------- Employee

export function EmployeeHome({ name, myTickets, myRequests }: { name: string; myTickets: TicketT[]; myRequests: AccessRequest[] }) {
  const n = myTickets.length
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight">Hi {name}</h1>
        <p className="mt-1 text-[15px] text-muted">{n ? `Here ${n === 1 ? 'is the 1 security task' : `are the ${n} security tasks`} assigned to you.` : 'You have no security tasks right now — nothing to do.'}</p>
      </div>
      <Card className="p-5">
        <h2 className="text-[15px] font-semibold">Your tasks</h2>
        <div className="mt-2"><TaskList tickets={myTickets} /></div>
      </Card>
      {myRequests.length > 0 && (
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">Your requests</h2>
          <ul className="mt-2 space-y-2 text-[13.5px]">
            {myRequests.map((r) => <li key={r.id} className="flex items-center justify-between gap-2"><span>{r.requestedRole}{r.justification ? ` — ${r.justification.slice(0, 60)}` : ''}</span><Badge tone={r.status === 'pending' ? 'amber' : r.status === 'approved' ? 'emerald' : 'slate'}>{r.status}</Badge></li>)}
          </ul>
        </Card>
      )}
      <Card className="grid gap-3 p-5 sm:grid-cols-3">
        {[
          [HelpCircle, 'How do I fix a task?', '/knowledge?guide=triage'],
          [Mail, 'Ask for more access', '/requests?new=1'],
          [LifeBuoy, 'Get help from a person', '/support?new=1'],
        ].map(([Icon, t, to]) => {
          const I = Icon as typeof HelpCircle
          return <Link key={t as string} to={to as string} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-[13.5px] hover:border-primary/40"><I className="size-4 text-primary" /> {t as string}</Link>
        })}
      </Card>
      <p className="flex items-center gap-2 text-[12.5px] text-muted"><UserX className="size-3.5" /> You see only what’s assigned to you. Security problems, incidents and reports are handled by your security team.</p>
    </div>
  )
}
