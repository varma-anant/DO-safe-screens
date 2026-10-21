import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { AlarmClock, AppWindow, ArrowRight, Check, Cloud, Database, FileWarning, FolderKanban, Globe, Inbox, KeyRound, Plug, Rocket, ShieldCheck, Sparkles, Ticket, Users, Waypoints, Bot, Play, Radar } from 'lucide-react'
import type { BusinessService } from '@/types'
import { useCan, useCollections, useCurrentUser, useSettings } from '@/hooks/queries'
import { usePage } from '@/hooks/usePage'
import { Callout, ErrorState, LoadingState, Section } from '@/components/common/layout'
import { Badge, FindingStatusBadge, RiskScore, SeverityBadge, StatusBadge } from '@/components/common/badges'
import { RelTime } from '@/components/common/entities'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { APP_STATUS } from '@/modules/applications'
import { cn, fmtDate } from '@/utils/format'
import { isOpen, TICKET_STATUS } from '@/utils/labels'
import { isOverdue } from '@/utils/risk'
import { scoreFindings } from '@/utils/derive'
import { ROLE_INFO } from '@/utils/permissions'

const TYPES: { type: BusinessService['appType']; icon: React.ReactNode; blurb: string }[] = [
  { type: 'Web application', icon: <Globe />, blurb: 'Websites and portals your customers or employees use' },
  { type: 'API service', icon: <Plug />, blurb: 'Public, partner and internal APIs' },
  { type: 'Cloud workload', icon: <Cloud />, blurb: 'Containers, Kubernetes and serverless' },
  { type: 'Data platform', icon: <Database />, blurb: 'Databases, data lakes and pipelines' },
  { type: 'SaaS workspace', icon: <AppWindow />, blurb: 'Collaboration and business SaaS tenants' },
  { type: 'AI application', icon: <Bot />, blurb: 'LLM apps, agents and RAG systems' },
]

const JOURNEY = [
  { icon: <FolderKanban />, label: 'Create a project' },
  { icon: <Radar />, label: 'Declare assets' },
  { icon: <Waypoints />, label: 'Map & link' },
  { icon: <Plug />, label: 'Connect sources' },
  { icon: <Play />, label: 'Test run' },
  { icon: <ShieldCheck />, label: 'Full run' },
]

export function HomePage() {
  const me = useCurrentUser()
  const settings = useSettings()
  usePage('Home', [{ label: 'Home' }])
  const navigate = useNavigate()
  const canOnboard = useCan('onboard_applications')
  const canUsers = useCan('manage_users')
  const canIntegrations = useCan('manage_integrations')
  const { data, isLoading, error, retry } = useCollections(['services', 'projects', 'findings', 'assets', 'tickets', 'accessRequests', 'integrations', 'audit'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={3} rows={6} />
  const { services, projects, findings, assets, tickets, accessRequests, integrations } = data
  const protectedApps = services.filter((s) => s.status === 'active' || s.status === 'paused')
  const onboarding = services.filter((s) => !(s.status === 'active' || s.status === 'paused'))
  const firstName = me.name.split(' ')[0]
  const greeting = `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${firstName}`

  // ---------------- First-time landing: nothing protected yet
  if (!protectedApps.length && canOnboard) {
    const steps = [
      { done: projects.length > 0, label: 'Create your first project', to: '/onboarding?new=1' },
      { done: services.length > 0, label: 'Describe the application you want to secure', to: onboarding[0] ? `/onboarding?app=${onboarding[0].id}` : '/onboarding?new=1' },
      { done: assets.length > 0, label: 'Declare and map its assets', to: onboarding[0] ? `/onboarding?app=${onboarding[0].id}` : '/onboarding?new=1' },
      { done: integrations.some((i) => i.status === 'connected' && !i.vendor.includes('public')), label: 'Connect at least one security tool', to: onboarding[0] ? `/onboarding?app=${onboarding[0].id}` : '/integrations' },
      { done: services.some((s) => s.runs.some((r) => r.kind === 'test' && r.status === 'passed')), label: 'Pass a test run', to: onboarding[0] ? `/onboarding?app=${onboarding[0].id}` : '/onboarding?new=1' },
      { done: false, label: 'Run the first full assessment', to: onboarding[0] ? `/onboarding?app=${onboarding[0].id}` : '/onboarding?new=1' },
    ]
    const doneCount = steps.filter((s) => s.done).length
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="pt-2">
          <div className="text-[13px] font-medium text-primary">{settings.orgName}</div>
          <h1 className="mt-1 text-[30px] font-semibold tracking-tight" style={{ textWrap: 'balance' }}>
            {greeting}. What do you want to secure?
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] text-muted">Start with one application. You'll declare its assets, map how they connect, connect the tools that assess them, prove the connection with a test run — and only then run a full assessment.</p>
        </div>
        {onboarding.length > 0 && (
          <Callout tone="info" icon={<Rocket />} title={`${onboarding[0].name}: ${APP_STATUS[onboarding[0].status].label}`}>
            You started onboarding <RelTime iso={onboarding[0].onboardingStartedAt} className="text-sky-900" />.{' '}
            <Link to={`/onboarding?app=${onboarding[0].id}`} className="font-semibold underline">Continue where you left off →</Link>
          </Callout>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TYPES.map((t) => (
            <button key={t.type} onClick={() => navigate(`/onboarding?new=1&type=${encodeURIComponent(t.type)}`)} className="card group flex items-start gap-3 p-4 text-left transition-colors hover:border-primary/40 cursor-pointer">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary [&_svg]:size-5">{t.icon}</span>
              <span>
                <span className="block text-[14px] font-semibold group-hover:text-primary">{t.type}</span>
                <span className="block text-xs text-muted">{t.blurb}</span>
              </span>
            </button>
          ))}
        </div>
        <Card className="p-5">
          <div className="text-[13px] font-semibold">How onboarding works</div>
          <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {JOURNEY.map((j, i) => (
              <li key={j.label} className="flex flex-col items-start gap-2">
                <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-primary [&_svg]:size-4">{j.icon}</span>
                <span className="text-[12.5px]">
                  <span className="text-subtle">{i + 1}.</span> {j.label}
                </span>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold">Workspace setup</div>
            <span className="text-xs text-muted">{doneCount} of {steps.length} done</span>
          </div>
          <ul className="mt-3 divide-y divide-border">
            {steps.map((s) => (
              <li key={s.label}>
                <Link to={s.to} className="flex items-center gap-3 py-2.5 text-[13.5px] hover:text-primary">
                  <span className={cn('flex size-5 items-center justify-center rounded-full border', s.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border-strong')}>{s.done && <Check className="size-3" />}</span>
                  <span className={cn('flex-1', s.done && 'text-muted line-through')}>{s.label}</span>
                  {!s.done && <ArrowRight className="size-4 text-subtle" />}
                </Link>
              </li>
            ))}
            {canUsers && (
              <li>
                <Link to="/admin/people" className="flex items-center gap-3 py-2.5 text-[13.5px] hover:text-primary">
                  <span className="flex size-5 items-center justify-center rounded-full border border-border-strong" />
                  <span className="flex-1">Invite your team (optional)</span>
                  <ArrowRight className="size-4 text-subtle" />
                </Link>
              </li>
            )}
          </ul>
        </Card>
      </div>
    )
  }

  // ---------------- Returning user
  const scored = scoreFindings(findings, assets, services, settings.weights)
  const mine = scored.filter((x) => x.f.ownerId === me.id && isOpen(x.f.status)).sort((a, b) => b.score - a.score)
  const myTickets = tickets.filter((t) => t.assigneeId === me.id && !['done', 'cancelled'].includes(t.status))
  const pendingForMe = accessRequests.filter((r) => r.status === 'pending' && r.requesterId !== me.id && (me.orgRole === 'admin' || projects.find((p) => p.id === r.projectId)?.ownerId === me.id))
  const myRequests = accessRequests.filter((r) => r.requesterId === me.id && r.status === 'pending')
  const openAll = scored.filter((x) => isOpen(x.f.status))
  const top = [...openAll].sort((a, b) => b.score - a.score).slice(0, 5)
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-medium text-primary">{settings.orgName} · {ROLE_INFO[me.orgRole].label}</div>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">{greeting}</h1>
          <p className="mt-1 text-[13.5px] text-muted">{protectedApps.length} SAFE application(s) across {projects.length} project(s) you can access.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canOnboard && <Button onClick={() => navigate('/onboarding?new=1')}><Rocket /> Onboard application</Button>}
          {canUsers && <Button variant="secondary" onClick={() => navigate('/admin/people')}><Users /> Invite people</Button>}
          {canIntegrations && <Button variant="secondary" onClick={() => navigate('/integrations')}><Plug /> Integrations</Button>}
          {me.orgRole === 'viewer' && <Button variant="secondary" onClick={() => navigate('/requests?new=1')}><KeyRound /> Request access</Button>}
        </div>
      </div>
      {me.orgRole === 'viewer' && <Callout tone="info" icon={<KeyRound />}>You have read-only access to {projects.length} project(s). To create tickets or change findings, request contributor access.</Callout>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AttentionCard icon={<Inbox />} label="Requests awaiting your decision" value={pendingForMe.length} to="/requests" tone={pendingForMe.length ? 'violet' : undefined} />
        <AttentionCard icon={<FileWarning />} label="Findings assigned to you" value={mine.length} to="/operations/findings" tone={mine.some((x) => x.f.severity === 'critical') ? 'red' : undefined} sub={`${mine.filter(({ f }) => isOverdue(f)).length} overdue`} />
        <AttentionCard icon={<Ticket />} label="Your open tickets" value={myTickets.length} to="/operations/tickets" sub={`${myTickets.filter((t) => new Date(t.dueDate) < new Date()).length} overdue`} />
        <AttentionCard icon={<Rocket />} label="Applications in onboarding" value={onboarding.length} to="/applications" sub={onboarding[0] ? `${onboarding[0].name}: ${APP_STATUS[onboarding[0].status].label}` : 'None'} />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2" title={mine.length ? 'Your highest-risk findings' : 'Top risks in your scope'} actions={<Button size="xs" variant="ghost" asChild><Link to="/exposures/prioritization">Prioritization <ArrowRight /></Link></Button>}>
          <div className="divide-y divide-border">
            {(mine.length ? mine.slice(0, 6) : top).map((x) => (
              <Link key={x.f.id} to={`/operations/findings/${x.f.id}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-2/60">
                <RiskScore score={x.score} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{x.f.title}</span>
                  <span className="block truncate text-[11.5px] text-muted">{x.f.id} · {x.asset?.name ?? '—'} · {x.service?.name ?? '—'}{isOverdue(x.f) ? ' · overdue' : ''}</span>
                </span>
                <SeverityBadge severity={x.f.severity} />
                <span className="hidden sm:block"><FindingStatusBadge status={x.f.status} /></span>
              </Link>
            ))}
            {!openAll.length && <p className="py-3 text-xs text-muted">No open findings in your scope.</p>}
          </div>
        </Section>
        <div className="space-y-5">
          <Section title="SAFE applications" actions={<Button size="xs" variant="ghost" asChild><Link to="/applications">All <ArrowRight /></Link></Button>}>
            <ul className="space-y-2">
              {services.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <Link to={`/applications/${a.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{a.name}</span>
                      <span className="block truncate text-[11px] text-subtle">{projects.find((p) => p.id === a.projectId)?.name}</span>
                    </span>
                    <StatusBadge map={APP_STATUS} value={a.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
          {(myTickets.length > 0 || myRequests.length > 0) && (
            <Section title="Your work">
              <ul className="space-y-2 text-[13px]">
                {myTickets.slice(0, 4).map((t) => (
                  <li key={t.id}>
                    <Link to={`/operations/tickets/${t.id}`} className="flex items-center justify-between gap-2 hover:text-primary">
                      <span className="truncate">{t.title}</span>
                      <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted">{new Date(t.dueDate) < new Date() && <AlarmClock className="size-3 text-red-600" />}{fmtDate(t.dueDate)}</span>
                    </Link>
                    <div className="text-[11px] text-subtle">{TICKET_STATUS[t.status].label}</div>
                  </li>
                ))}
                {myRequests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">Your request: {r.requestedRole}{r.projectId ? ` on ${projects.find((p) => p.id === r.projectId)?.name ?? 'a project'}` : ''}</span>
                    <Badge tone="amber">Pending</Badge>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Ask DO SAFE">
            <div className="space-y-1.5">
              {['Which application has the highest risk?', 'What remediation tasks are overdue?', 'Summarize the current security posture'].map((q) => (
                <button key={q} onClick={() => navigate(`/intelligence?q=${encodeURIComponent(q)}`)} className="flex w-full items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-left text-xs text-muted hover:text-fg cursor-pointer">
                  <Sparkles className="size-3.5 text-primary" /> {q}
                </button>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

function AttentionCard({ icon, label, value, to, sub, tone }: { icon: React.ReactNode; label: string; value: number; to: string; sub?: string; tone?: 'red' | 'violet' }) {
  return (
    <Link to={to} className="card flex items-start gap-3 p-4 transition-colors hover:border-border-strong">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-[18px]', tone === 'red' ? 'bg-red-50 text-red-600' : 'bg-primary-soft text-primary')}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs text-muted">{label}</span>
        <span className="num block text-2xl font-semibold">{value}</span>
        {sub && <span className="block truncate text-[11.5px] text-subtle">{sub}</span>}
      </span>
    </Link>
  )
}
