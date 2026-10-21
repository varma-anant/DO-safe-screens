import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { AlarmClock, AppWindow, ArrowRight, Bot, Bug, Check, CheckCircle2, Clock, Cloud, Database, FileText, FolderOpen, Globe, KeyRound, LayoutDashboard, Lock, PauseCircle, Plug, Rocket, ShieldAlert, ShieldCheck, Sparkles, UserCheck, UserX, Users } from 'lucide-react'
import type { BusinessService } from '@/types'
import { useCan, useCollections, useCurrentUser, useSettings } from '@/hooks/queries'
import { usePage } from '@/hooks/usePage'
import { Callout, ErrorState, LoadingState, Section } from '@/components/common/layout'
import { Badge } from '@/components/common/badges'
import { RelTime } from '@/components/common/entities'
import { Term } from '@/components/common/Term'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { JOURNEY, JOURNEY_MINUTES, stepFromStatus } from '@/modules/onboarding/journey'
import { cn, fmtDate, fmtDateTime, plural } from '@/utils/format'
import { isOpen, TICKET_STATUS } from '@/utils/labels'
import { scoreFindings } from '@/utils/derive'
import { can, JOB_INFO, jobOf, ROLE_INFO } from '@/utils/permissions'
import { AdminSections, AISections, AnalystSections, EmployeeHome, ExecutiveSections, OwnerSections, RiskSections, VendorSections, type HomeCtx } from './roles'
import { APP_TYPE_PLAIN, findingPlain } from '@/utils/plain'

const TYPE_ICON: Record<string, React.ReactNode> = {
  'Web application': <Globe />,
  'API service': <Plug />,
  'Cloud workload': <Cloud />,
  'Data platform': <Database />,
  'SaaS workspace': <AppWindow />,
  'AI application': <Bot />,
}

const EXAMPLES = [
  { icon: <FolderOpen />, before: 'A storage folder is accidentally open to the whole internet.', after: 'DO SAFE spots it within a day and shows exactly which setting to switch off.' },
  { icon: <Bug />, before: 'Your website runs software with a weakness attackers are using.', after: 'It becomes an urgent task with step-by-step fix instructions and an owner.' },
  { icon: <UserX />, before: 'A former employee’s account still has admin rights.', after: 'DO SAFE flags it so you can remove the access before someone misuses it.' },
]

export function HomePage() {
  const me = useCurrentUser()
  const settings = useSettings()
  usePage('Home', [{ label: 'Home' }])
  const navigate = useNavigate()
  const canOnboard = useCan('onboard_applications')
  const canUsers = useCan('manage_users')
  const canIntegrations = useCan('manage_integrations')
  const { data, isLoading, error, retry } = useCollections(['services', 'projects', 'findings', 'assets', 'tickets', 'accessRequests', 'integrations', 'users', 'invitations'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={3} rows={6} />
  const { services, projects, findings, assets, tickets, accessRequests, integrations, users, invitations } = data
  const protectedApps = services.filter((s) => s.status === 'active' || s.status === 'paused')
  const onboarding = services.filter((s) => !(s.status === 'active' || s.status === 'paused'))
  const firstName = me.name.split(' ')[0]
  const greeting = `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${firstName}`

  // ---------------- First-time landing: nothing protected yet
  if (!protectedApps.length && canOnboard) {
    const inProgress = onboarding[0]
    const reached = inProgress ? stepFromStatus(inProgress) : projects.length ? 1 : 0
    const resume = inProgress ? `/onboarding?app=${inProgress.id}` : '/onboarding?new=1'
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="pt-2">
          <div className="text-[13px] font-medium text-primary">{settings.orgName}</div>
          <h1 className="mt-1 text-[30px] font-semibold tracking-tight" style={{ textWrap: 'balance' }}>{greeting}. Let’s protect your first application.</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-muted">DO SAFE connects to the tools you already use, checks everything for security problems, and tells you in plain words what to fix first. Setup takes about {JOURNEY_MINUTES} minutes and changes nothing in your systems.</p>
        </div>

        {inProgress && (
          <Callout tone="info" icon={<Rocket />} title={`You’re setting up ${inProgress.name} — step ${reached + 1} of ${JOURNEY.length}: ${JOURNEY[reached].label}`}>
            Started <RelTime iso={inProgress.onboardingStartedAt} className="text-sky-900" />. Everything so far is saved.{' '}
            <Link to={resume} className="font-semibold underline">Continue where you left off →</Link>
          </Callout>
        )}

        <section aria-labelledby="pick">
          <h2 id="pick" className="text-[17px] font-semibold">What would hurt most if it stopped working or leaked data?</h2>
          <p className="mt-0.5 text-[13.5px] text-muted">Start there. You can protect more applications later.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(TYPE_ICON) as BusinessService['appType'][]).map((t) => (
              <button key={t} onClick={() => navigate(`/onboarding?new=1&type=${encodeURIComponent(t)}`)} className="card group flex min-h-[76px] items-start gap-3 p-4 text-left transition-colors hover:border-primary/40 cursor-pointer">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary [&_svg]:size-5">{TYPE_ICON[t]}</span>
                <span>
                  <span className="block text-[14px] font-semibold group-hover:text-primary">{APP_TYPE_PLAIN[t].title}</span>
                  <span className="block text-[12.5px] text-muted">{APP_TYPE_PLAIN[t].example}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="how" className="card p-5">
          <h2 id="how" className="text-[15px] font-semibold">How DO SAFE protects you</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {EXAMPLES.map((e) => (
              <li key={e.before} className="rounded-xl border border-border p-4">
                <span className="flex size-9 items-center justify-center rounded-lg bg-red-50 text-red-600 [&_svg]:size-[18px]">{e.icon}</span>
                <p className="mt-2 text-[13.5px]"><span className="font-medium">The problem:</span> {e.before}</p>
                <p className="mt-2 flex gap-1.5 text-[13.5px] text-emerald-800"><ShieldCheck className="mt-0.5 size-4 shrink-0" /> {e.after}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">How setup works</h2>
              <span className="text-[12.5px] text-muted">About {JOURNEY_MINUTES} min in total</span>
            </div>
            <ol className="mt-3 space-y-1">
              {JOURNEY.map((j, i) => {
                const done = i < reached
                return (
                  <li key={j.key}>
                    <Link to={resume} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                      <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold', done ? 'border-emerald-500 bg-emerald-500 text-white' : i === reached ? 'border-primary bg-primary text-white' : 'border-border-strong text-muted')}>{done ? <Check className="size-3.5" /> : i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-[13.5px] font-medium', done && 'text-muted line-through')}>{j.label}</span>
                        <span className="block text-[12px] text-muted">{j.help}</span>
                      </span>
                      <span className="text-[12px] text-muted">{j.minutes} min</span>
                    </Link>
                  </li>
                )
              })}
            </ol>
            <Button className="mt-3 w-full sm:w-auto" size="lg" onClick={() => navigate(resume)}>{inProgress ? 'Continue setup' : 'Start setup'} <ArrowRight /></Button>
          </Card>
          <Card className="h-fit p-5">
            <h2 className="text-[15px] font-semibold">Good to know</h2>
            <ul className="mt-3 space-y-3 text-[13.5px]">
              <li className="flex gap-2.5"><Lock className="mt-0.5 size-4 shrink-0 text-primary" /> <span><Term k="readOnly">Read-only</Term>: DO SAFE looks, but never changes anything in your systems.</span></li>
              <li className="flex gap-2.5"><UserCheck className="mt-0.5 size-4 shrink-0 text-primary" /> {canIntegrations ? 'You can connect tools yourself. Some tools may need a quick OK from the person who manages them.' : 'An administrator will need to approve tool connections — we’ll tell you when.'}</li>
              <li className="flex gap-2.5"><Clock className="mt-0.5 size-4 shrink-0 text-primary" /> Your progress is saved. Stop anytime and pick up where you left off.</li>
              <li className="flex gap-2.5"><Sparkles className="mt-0.5 size-4 shrink-0 text-primary" /> Stuck? <Link to="/knowledge?guide=onboard" className="text-primary underline">Read the 2-minute guide</Link> or <Link to="/support?new=1" className="text-primary underline">ask support</Link>.</li>
              {canUsers && <li className="flex gap-2.5"><Users className="mt-0.5 size-4 shrink-0 text-primary" /> <Link to="/admin/people" className="text-primary underline">Invite your team</Link> whenever you’re ready (optional).</li>}
            </ul>
          </Card>
        </div>
      </div>
    )
  }

  // ---------------- Returning user — the experience depends on the person's job
  const job = jobOf(me)
  if (job === 'employee') {
    return <EmployeeHome name={firstName} myTickets={tickets.filter((t) => t.assigneeId === me.id && !['done', 'cancelled'].includes(t.status))} myRequests={accessRequests.filter((r) => r.requesterId === me.id)} />
  }
  const scored = scoreFindings(findings, assets, services, settings.weights)
  const mine = scored.filter((x) => x.f.ownerId === me.id && isOpen(x.f.status)).sort((a, b) => b.score - a.score)
  const myTickets = tickets.filter((t) => t.assigneeId === me.id && !['done', 'cancelled'].includes(t.status))
  const pendingForMe = accessRequests.filter((r) => r.status === 'pending' && r.requesterId !== me.id && (me.orgRole === 'admin' || projects.find((p) => p.id === r.projectId)?.ownerId === me.id))
  const myRequests = accessRequests.filter((r) => r.requesterId === me.id && r.status === 'pending')
  const openAll = scored.filter((x) => isOpen(x.f.status))
  const urgent = openAll.filter((x) => x.f.severity === 'critical').sort((a, b) => b.score - a.score)
  const paused = protectedApps.filter((s) => s.status === 'paused')

  // "Am I protected?" — parts with at least one connected tool, across protected applications.
  const connected = new Set(integrations.filter((i) => i.status === 'connected').map((i) => i.id))
  const protectedParts = assets.filter((a) => protectedApps.some((s) => s.id === a.businessServiceId))
  const checkedParts = protectedParts.filter((a) => {
    const svc = protectedApps.find((s) => s.id === a.businessServiceId)
    const cov = svc?.coverage[a.id] ?? a.sourceIntegrationIds
    return cov.some((id) => connected.has(id))
  })
  const lastCheck = services.flatMap((s) => s.runs).filter((r) => r.finishedAt).map((r) => r.finishedAt!).sort().pop()
  const nextCheck = protectedApps.filter((s) => s.status === 'active').map((s) => s.nextRunAt).filter(Boolean).sort()[0]
  const allGood = !paused.length && checkedParts.length === protectedParts.length

  const ctx: HomeCtx = { meId: me.id, services, findings, assets, tickets, integrations, accessRequests, openAll, pendingForMe }

  const nextActions: { key: string; label: string; to: string }[] = [
    ...(job === 'platform_admin' ? integrations.filter((i) => i.status === 'error' || (i.status === 'connected' && i.health < 80)).slice(0, 1).map((i) => ({ key: i.id, label: `Fix ${i.name} — it ${i.status === 'error' ? 'isn’t working' : 'is unhealthy'}`, to: `/integrations/${i.id}` })) : []),
    ...(job === 'executive' || job === 'platform_admin' ? [] : urgent.slice(0, 2).map((x) => ({ key: x.f.id, label: `Fix: ${findingPlain(x.f).toLowerCase()} (${x.service?.name ?? 'an application'})`, to: `/operations/findings/${x.f.id}` }))),
    ...(onboarding[0] && canOnboard ? [{ key: 'ob', label: `Finish setting up ${onboarding[0].name}`, to: `/onboarding?app=${onboarding[0].id}` }] : []),
    ...(pendingForMe.length ? [{ key: 'req', label: `Decide ${plural(pendingForMe.length, 'access request')}`, to: '/requests' }] : []),
    ...(job === 'executive' ? [{ key: 'dec', label: 'Review decisions waiting for you', to: '/requests?tab=approvals' }] : []),
  ].slice(0, 3)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-medium text-primary">{settings.orgName} · {JOB_INFO[job].label}</div>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">{greeting}</h1>
          <p className="mt-1 text-[14px] text-muted">{JOB_INFO[job].summary}</p>
          <p className="mt-0.5 text-[12.5px] text-muted">Viewing {can(me, 'view_all_projects') ? `all ${plural(projects.length, 'project')}` : `${plural(projects.length, 'project')} you belong to`} · {plural(protectedApps.length, 'protected application')} · Access: {ROLE_INFO[me.orgRole].label}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {job === 'executive' && <Button onClick={() => navigate('/crq/report')}><FileText /> Board report</Button>}
          {canOnboard && ['platform_admin', 'project_owner'].includes(job) && <Button onClick={() => navigate('/onboarding?new=1')}><ShieldCheck /> Protect another application</Button>}
          {canUsers && job === 'platform_admin' && <Button variant="secondary" onClick={() => navigate('/admin/people')}><Users /> Invite people</Button>}
          {me.orgRole === 'viewer' && <Button variant="secondary" onClick={() => navigate('/requests?new=1')}><KeyRound /> Ask for access</Button>}
        </div>
      </div>
      {me.orgRole === 'viewer' && <Callout tone="info" icon={<KeyRound />}>You can look at {plural(projects.length, 'project')} but not change anything. To work on problems, ask for contributor access.</Callout>}

      {/* Plain-language status: the three questions everyone has, in one compact strip */}
      <section aria-label="Your security at a glance" className="card grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
        <div className="flex items-center gap-3 p-4">
          <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', allGood ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600')}>{allGood ? <ShieldCheck className="size-5" /> : paused.length ? <PauseCircle className="size-5" /> : <ShieldAlert className="size-5" />}</span>
          <div className="min-w-0">
            <div className="text-[12.5px] text-muted">Am I protected?</div>
            <div className="text-[15px] font-semibold">{allGood ? 'Yes' : 'Mostly'} <span className="font-normal text-muted">· {checkedParts.length} of {plural(protectedParts.length, 'part')} checked{paused.length ? ` · ${plural(paused.length, 'app')} paused` : ''}</span></div>
            <div className="truncate text-[12px] text-muted">Last check {lastCheck ? <RelTime iso={lastCheck} /> : '—'} · next {nextCheck ? fmtDateTime(nextCheck) : '—'}</div>
          </div>
        </div>
        <Link to="/exposures/prioritization" className="flex items-center gap-3 p-4 hover:bg-surface-2/60">
          <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', urgent.length ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600')}>{urgent.length ? <ShieldAlert className="size-5" /> : <CheckCircle2 className="size-5" />}</span>
          <div className="min-w-0">
            <div className="text-[12.5px] text-muted">Is anything urgent?</div>
            <div className="text-[15px] font-semibold">{urgent.length ? plural(urgent.length, 'urgent problem') : 'Nothing urgent'}</div>
            <div className="truncate text-[12px] text-muted">{plural(openAll.length, 'open problem')} in total · see them in order</div>
          </div>
        </Link>
        <div className="flex items-center gap-3 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"><ArrowRight className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] text-muted">What should I do next?</div>
            {nextActions[0] ? (
              <Link to={nextActions[0].to} className="block truncate text-[14px] font-semibold hover:text-primary">{nextActions[0].label} →</Link>
            ) : (
              <div className="text-[15px] font-semibold">You’re all caught up</div>
            )}
            {nextActions.length > 1 && <div className="truncate text-[12px] text-muted">Then: {nextActions.slice(1).map((x) => x.label).join(' · ')}</div>}
          </div>
        </div>
      </section>

      {job === 'executive' && <ExecutiveSections ctx={ctx} />}
      {job === 'platform_admin' && <AdminSections ctx={ctx} pendingInvites={invitations.filter((i) => i.status === 'pending').length} noMfa={users.filter((u) => u.status === 'active' && !u.mfaEnabled).length} />}
      {(job === 'security_analyst' || job === 'incident_responder') && <AnalystSections ctx={ctx} top={mine.length ? mine.slice(0, 8) : [...openAll].sort((x, y) => y.score - x.score).slice(0, 8)} incidentsFirst={job === 'incident_responder'} />}
      {job === 'project_owner' && <OwnerSections ctx={ctx} myTickets={myTickets} />}
      {job === 'vendor_risk' && <VendorSections />}
      {job === 'ai_governance' && <AISections ctx={ctx} />}
      {job === 'risk_manager' && <RiskSections ctx={ctx} />}

      {(myRequests.length > 0 || (job !== 'project_owner' && myTickets.length > 0)) && (
        <Section title="Your work">
          <ul className="space-y-2 text-[13px]">
            {job !== 'project_owner' && myTickets.slice(0, 4).map((t) => (
              <li key={t.id}>
                <Link to={`/operations/tickets/${t.id}`} className="flex items-center justify-between gap-2 hover:text-primary">
                  <span className="truncate">{t.title}</span>
                  <span className="flex shrink-0 items-center gap-1 text-[12px] text-muted">{new Date(t.dueDate) < new Date() && <AlarmClock className="size-3 text-red-600" />}{fmtDate(t.dueDate)}</span>
                </Link>
                <div className="text-[12px] text-muted">{TICKET_STATUS[t.status].label}</div>
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
      {job === 'executive' || job === 'risk_manager' ? null : (
        <Link to={can(me, 'view_financial_risk') ? '/dashboard' : '/exposures'} className="card flex items-center gap-3 p-4 text-[13px] hover:border-border-strong">
          <LayoutDashboard className="size-5 text-primary" />
          <span className="flex-1"><span className="block font-medium">Advanced security workspace</span><span className="block text-[12px] text-muted">Every tool your access allows — for detailed work</span></span>
          <ArrowRight className="size-4 text-muted" />
        </Link>
      )}
    </div>
  )
}
