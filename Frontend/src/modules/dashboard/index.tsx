import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip as RTooltip, XAxis, YAxis, ZAxis, Line, LineChart } from 'recharts'
import { ArrowRight, Bot, Building2, Calculator, Clock, Cpu, Gauge, ShieldAlert, Sparkles, Siren, Ticket, Scale } from 'lucide-react'
import { useCollections, useCurrentUser, useSettings } from '@/hooks/queries'
import { usePage } from '@/hooks/usePage'
import { Term } from '@/components/common/Term'
import { ErrorState, KpiCard, LoadingState, PageHeader, Section } from '@/components/common/layout'
import { AXIS, BarList, ChartTooltip, GRID, Legend, CATEGORICAL } from '@/components/common/charts'
import { FindingStatusBadge, RiskScore, SeverityBadge } from '@/components/common/badges'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/misc'
import { cn, fmtMoney, fmtPct } from '@/utils/format'
import { isOpen, SEVERITY_COLOR, TICKET_STATUS } from '@/utils/labels'
import { computeScenario, isOverdue, postureScore, totalALE, vendorRiskBand } from '@/utils/risk'
import { mttrDays, openTrend, scoreFindings, slaCompliance } from '@/utils/derive'

const SEVS = ['critical', 'high', 'medium', 'low'] as const

// ============================================================ Executive Dashboard

export function ExecutiveDashboard() {
  usePage('Executive Dashboard', [{ label: 'Overview' }, { label: 'Executive Dashboard' }])
  const settings = useSettings()
  const me = useCurrentUser()
  const navigate = useNavigate()
  const { data, isLoading, error, retry } = useCollections(['findings', 'assets', 'services', 'scenarios', 'vendors', 'aiSystems', 'tickets', 'incidents', 'executions', 'agents', 'governanceReviews', 'controls'] as const)
  const [ask, setAsk] = React.useState('')

  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={8} />

  const { findings, assets, services, scenarios, vendors, aiSystems, tickets, incidents, executions, agents, governanceReviews } = data
  const scored = scoreFindings(findings, assets, services, settings.weights)
  const open = scored.filter((s) => isOpen(s.f.status))
  const openCritical = open.filter((s) => s.f.severity === 'critical' && s.f.domain !== 'ai')
  const posture = postureScore(findings)
  const ale = totalALE(scenarios, findings)
  const aleRemediated = scenarios.reduce((s, x) => s + computeScenario(x, findings).aleRemediated, 0)
  const highVendors = vendors.filter((v) => v.lifecycle !== 'offboarded' && vendorRiskBand(v.residualRisk) !== 'low' && vendorRiskBand(v.residualRisk) !== 'medium')
  const shadow = aiSystems.filter((a) => a.approval === 'unsanctioned')
  const overdue = findings.filter(isOverdue)
  const trend = openTrend(findings, 13)
  const first = trend[0]
  const last = trend[trend.length - 1]
  const critDelta = Number(last.critical) - Number(first.critical)

  const byService = services
    .map((svc) => {
      const svcOpen = open.filter((o) => o.f.businessServiceId === svc.id)
      const svcAle = scenarios.filter((s) => s.businessServiceId === svc.id).reduce((s, x) => s + computeScenario(x, findings).ale, 0)
      return { svc, critical: svcOpen.filter((o) => o.f.severity === 'critical').length, high: svcOpen.filter((o) => o.f.severity === 'high').length, open: svcOpen.length, ale: svcAle }
    })
    .sort((a, b) => b.ale - a.ale)

  const sevData = SEVS.map((s) => ({ name: s[0].toUpperCase() + s.slice(1), key: s, value: open.filter((o) => o.f.severity === s).length, fill: SEVERITY_COLOR[s] }))
  const top = [...open].sort((a, b) => b.score - a.score).slice(0, 8)
  const pendingApprovals = executions.filter((e) => e.approval?.status === 'pending').length + findings.filter((f) => f.riskAcceptance?.status === 'pending').length
  const activeIncidents = incidents.filter((i) => i.status !== 'closed')
  const ticketsActive = tickets.filter((t) => ['open', 'in_progress', 'blocked', 'pending_verification'].includes(t.status))
  const ticketData = (['open', 'in_progress', 'blocked', 'pending_verification', 'done'] as const).map((s) => ({ name: TICKET_STATUS[s].label, value: tickets.filter((t) => t.status === s && t.findingId).length, key: s }))
  const categories = Object.entries(open.reduce<Record<string, number>>((acc, o) => ((acc[o.f.category] = (acc[o.f.category] ?? 0) + 1), acc), {})).sort((a, b) => b[1] - a[1]).slice(0, 8)

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${me.name.split(' ')[0]}`}
        description={`Enterprise cyber risk posture for Northstar Financial Services (fictional) — viewing as ${me.role}. All figures derive from the simulated demo dataset.`}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link to="/operations/tickets" target="_blank" rel="noopener noreferrer">
                <Ticket /> Ticket Management
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/crq/report">
                <Calculator /> Board risk report
              </Link>
            </Button>
            <Button asChild>
              <Link to="/exposures/vulnerabilities?severity=critical&status=new,triaged,in_validation,validated,in_remediation,pending_verification">
                <ShieldAlert /> Review critical exposures
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Cyber posture score" icon={<Gauge />} value={`${posture}/100`} tone={posture >= 70 ? 'green' : posture >= 50 ? 'amber' : 'red'} sub="Severity-weighted open exposure" help="A 0–100 health score: 100 means no open problems. Urgent and actively exploited problems lower it most. Illustrative." onClick={() => navigate('/analytics')} />
        <KpiCard label="Open critical exposures" icon={<ShieldAlert />} value={openCritical.length} tone="red" trend={{ value: `${critDelta > 0 ? '+' : ''}${critDelta} in 90d`, good: critDelta <= 0, up: critDelta > 0 }} sub={<span>{openCritical.filter((o) => o.f.kev).length} <Term k="kev" icon={false}>being actively exploited</Term></span>} help="Critical problems still open. KEV = on the US government’s list of weaknesses attackers are using right now — fix those first." onClick={() => navigate('/exposures/vulnerabilities?severity=critical&status=new,triaged,in_validation,validated,in_remediation,pending_verification')} />
        <KpiCard label="Estimated annual loss" icon={<Calculator />} value={fmtMoney(ale)} tone="violet" sub={<span><Term k="ale" icon={false}>Expected yearly loss</Term> · {fmtMoney(ale - aleRemediated)} could be avoided</span>} help="Sum of scenario ALE using the documented illustrative model (CRQ → Risk Overview). Not a validated actuarial estimate." onClick={() => navigate('/crq')} />
        <KpiCard label="High-risk vendors" icon={<Building2 />} value={highVendors.length} tone="amber" sub={`of ${vendors.filter((v) => v.lifecycle !== 'offboarded').length} active third parties`} onClick={() => navigate('/tprm/vendors?risk=high,critical')} />
        <KpiCard label="AI systems" icon={<Bot />} value={aiSystems.length} sub={<span className="text-amber-700">{shadow.length} shadow AI detected</span>} onClick={() => navigate('/ai-security')} />
        <KpiCard label="Overdue remediation" icon={<Clock />} value={overdue.length} tone={overdue.length ? 'red' : 'green'} sub={`MTTR ${mttrDays(findings)}d · SLA ${fmtPct(slaCompliance(findings))}`} onClick={() => navigate('/operations/remediation?sla=Overdue')} />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2" title="Exposure trend" description="Open findings by severity over 13 weeks — reconstructed from detection and closure timestamps" actions={<Legend items={SEVS.map((s) => ({ label: s[0].toUpperCase() + s.slice(1), color: SEVERITY_COLOR[s] }))} />}>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={trend} margin={{ left: -18, right: 8, top: 8 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="week" {...AXIS} />
                <YAxis {...AXIS} allowDecimals={false} />
                <RTooltip content={<ChartTooltip />} />
                {[...SEVS].reverse().map((s) => (
                  <Area key={s} type="monotone" dataKey={s} name={s[0].toUpperCase() + s.slice(1)} stackId="1" stroke={SEVERITY_COLOR[s]} strokeWidth={2} fill={SEVERITY_COLOR[s]} fillOpacity={0.18} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Business impact by service" description="Illustrative ALE and open critical/high exposures" actions={<Button variant="ghost" size="xs" asChild><Link to="/applications">All services <ArrowRight /></Link></Button>}>
          <ul className="space-y-2">
            {byService.map((b) => (
              <li key={b.svc.id}>
                <Link to={`/applications/${b.svc.id}`} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2/60 px-3 py-2.5 hover:bg-surface-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: b.critical > 2 ? SEVERITY_COLOR.critical : b.critical > 0 || b.high > 3 ? SEVERITY_COLOR.high : SEVERITY_COLOR.medium }} />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium">{b.svc.name}</div>
                      <div className="text-[11px] text-muted">
                        {b.critical} critical · {b.high} high · {b.open} open
                      </div>
                    </div>
                  </div>
                  <span className="num shrink-0 text-[13px] font-semibold">{fmtMoney(b.ale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2" title="Top prioritized risks" description="Ranked by dynamic risk score (severity, exploitability, KEV/EPSS, exposure, business criticality, controls)" actions={<Button variant="ghost" size="xs" asChild><Link to="/exposures/prioritization">Tune prioritization <ArrowRight /></Link></Button>}>
          <div className="divide-y divide-border/60">
            {top.map((t) => (
              <Link key={t.f.id} to={`/exposures/vulnerabilities/${t.f.id}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-2/40">
                <RiskScore score={t.score} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{t.f.title}</div>
                  <div className="truncate text-[11px] text-muted">
                    <span className="font-mono">{t.f.id}</span> · {t.asset?.name ?? '—'} · {t.service?.name ?? '—'}
                    {t.f.kev && <span className="text-red-700"> · KEV</span>}
                    {t.asset?.internetExposed && <span className="text-orange-700"> · internet-facing</span>}
                  </div>
                </div>
                <SeverityBadge severity={t.f.severity} />
                <span className="hidden sm:block">
                  <FindingStatusBadge status={t.f.status} />
                </span>
              </Link>
            ))}
          </div>
        </Section>
        <Section title="Active workflows" description="Investigations, remediation and agent activity in flight" actions={<Button variant="ghost" size="xs" asChild><Link to="/operations/workflows">Workflow Center <ArrowRight /></Link></Button>}>
          <div className="space-y-2">
            <WorkflowRow to="/operations/incidents" icon={<Siren />} label="Open incidents" value={activeIncidents.length} detail={activeIncidents.slice(0, 2).map((i) => i.id).join(', ')} tone="red" />
            <WorkflowRow to="/operations/approvals" icon={<Scale />} label="Awaiting human approval" value={pendingApprovals} detail="Agent actions & risk acceptance" tone="amber" />
            <WorkflowRow to="/operations/tickets" icon={<Ticket />} label="Remediation tickets in progress" value={ticketsActive.length} detail={`${tickets.filter((t) => t.status === 'blocked').length} blocked`} />
            <WorkflowRow to="/exposures/validation" icon={<ShieldAlert />} label="Validations in progress" value={findings.filter((f) => f.status === 'in_validation').length} detail="Exploitability checks" />
            <WorkflowRow to="/ai-security/governance" icon={<Bot />} label="AI governance reviews" value={governanceReviews.filter((g) => ['open', 'in_review'].includes(g.status)).length} detail="Open / in review" />
            <WorkflowRow to="/intelligence/agents" icon={<Cpu />} label="Agents running (simulated)" value={agents.filter((a) => a.status === 'running').length} detail={`${executions.filter((e) => Date.now() - new Date(e.startedAt).getTime() < 86_400_000).length} runs in last 24h`} />
          </div>
        </Section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <Section title="Severity breakdown" description="Open findings — click a segment">
          <div className="relative h-44">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={sevData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={72} paddingAngle={2} stroke="#ffffff" strokeWidth={2} onClick={(d) => navigate(`/operations/findings?severity=${(d as unknown as { key: string }).key}&status=new,triaged,in_validation,validated,in_remediation,pending_verification`)} className="cursor-pointer">
                  {sevData.map((d) => (
                    <Cell key={d.key} fill={d.fill} />
                  ))}
                </Pie>
                <RTooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="num text-2xl font-semibold">{open.length}</span>
              <span className="text-[11px] text-muted">open</span>
            </div>
          </div>
          <Legend items={sevData.map((d) => ({ label: d.name, color: d.fill, value: d.value, onClick: () => navigate(`/operations/findings?severity=${d.key}&status=new,triaged,in_validation,validated,in_remediation,pending_verification`) }))} />
        </Section>
        <Section title="Findings by category" description="Open findings">
          <BarList items={categories.map(([c, n]) => ({ label: c, value: n, onClick: () => navigate(`/operations/findings?category=${encodeURIComponent(c)}&status=new,triaged,in_validation,validated,in_remediation,pending_verification`) }))} />
        </Section>
        <Section title="Remediation progress" description="Finding-linked tickets by status">
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={ticketData} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" {...AXIS} width={118} />
                <RTooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Tickets" fill={CATEGORICAL[0]} radius={[0, 4, 4, 0]} barSize={14} onClick={(d) => navigate(`/operations/tickets?status=${(d as unknown as { key: string }).key}`)} className="cursor-pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Ask DO SAFE" description="Deterministic demo assistant over local data">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              navigate(`/intelligence?q=${encodeURIComponent(ask || 'What are our most critical vulnerabilities?')}`)
            }}
            className="space-y-2"
          >
            <div className="relative">
              <Sparkles className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-violet-700" />
              <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ask about organizational risk…" className="h-9 w-full rounded-lg border border-violet-500/30 bg-violet-500/8 pl-8 pr-3 text-sm focus:outline-none focus:border-violet-500/60" aria-label="Ask DO SAFE" />
            </div>
          </form>
          <div className="mt-3 space-y-1.5">
            {['Which application has the highest risk?', 'Which vendors require attention?', 'What remediation tasks are overdue?', 'Summarize the current security posture'].map((q) => (
              <button key={q} onClick={() => navigate(`/intelligence?q=${encodeURIComponent(q)}`)} className="block w-full rounded-md bg-surface-2/70 px-2.5 py-1.5 text-left text-xs text-muted hover:bg-surface-2 hover:text-fg cursor-pointer">
                {q}
              </button>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}

function WorkflowRow({ to, icon, label, value, detail, tone }: { to: string; icon: React.ReactNode; label: string; value: number; detail?: string; tone?: 'red' | 'amber' }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-lg bg-surface-2/60 px-3 py-2 hover:bg-surface-2">
      <span className={cn('flex size-8 items-center justify-center rounded-lg [&_svg]:size-4', tone === 'red' ? 'bg-red-500/12 text-red-700' : tone === 'amber' ? 'bg-amber-500/12 text-amber-700' : 'bg-primary-soft text-violet-700')}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{label}</div>
        {detail && <div className="truncate text-[11px] text-muted">{detail}</div>}
      </div>
      <span className="num text-lg font-semibold">{value}</span>
    </Link>
  )
}

// ============================================================ Risk Analytics

export function RiskAnalytics() {
  usePage('Risk Analytics', [{ label: 'Overview' }, { label: 'Risk Analytics' }])
  const settings = useSettings()
  const navigate = useNavigate()
  const { data, isLoading, error, retry } = useCollections(['findings', 'assets', 'services', 'integrations', 'incidents'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={8} />
  const { findings, assets, services, integrations, incidents } = data
  const scored = scoreFindings(findings, assets, services, settings.weights)
  const open = scored.filter((s) => isOpen(s.f.status))
  const trend = openTrend(findings, 26)
  const mttr = SEVS.map((s) => ({ name: s[0].toUpperCase() + s.slice(1), days: mttrDays(findings, s), sla: settings.slaDays[s], fill: SEVERITY_COLOR[s] }))
  const bySource = integrations.map((i) => ({ name: i.vendor, value: findings.filter((f) => f.sourceIntegrationId === i.id).length, id: i.id })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value)
  const heat = services.map((svc) => ({ svc, cells: SEVS.map((s) => open.filter((o) => o.f.businessServiceId === svc.id && o.f.severity === s).length) }))
  const maxHeat = Math.max(1, ...heat.flatMap((h) => h.cells))
  const scatter = open.filter((o) => o.f.cvss && o.f.epss).map((o) => ({ cvss: o.f.cvss!.score, epss: Math.round(o.f.epss!.score * 100), score: o.score, id: o.f.id, name: o.f.title, fill: SEVERITY_COLOR[o.f.severity] }))
  const incidentTrend = Array.from({ length: 8 }, (_, i) => {
    const end = Date.now() - (7 - i) * 7 * 86_400_000
    return { week: new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), opened: incidents.filter((x) => { const t = new Date(x.createdAt).getTime(); return t <= end && t > end - 7 * 86_400_000 }).length }
  })
  const domains = Object.entries(open.reduce<Record<string, number>>((a, o) => ((a[o.f.domain] = (a[o.f.domain] ?? 0) + 1), a), {}))

  return (
    <div className="space-y-5">
      <PageHeader title="Risk Analytics" description="Posture trends, remediation performance and risk concentration — all derived from the simulated dataset." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Open findings" value={open.length} sub={`${findings.length} total tracked`} onClick={() => navigate('/operations/findings')} />
        <KpiCard label="Mean time to remediate" value={`${mttrDays(findings)} days`} sub="Resolved findings" />
        <KpiCard label="SLA compliance" value={fmtPct(slaCompliance(findings))} tone={slaCompliance(findings) > 0.8 ? 'green' : 'amber'} sub="Resolved within target" />
        <KpiCard label="Discovered vs closed (4w)" value={`${trend.slice(-4).reduce((s, r) => s + Number(r.discovered), 0)} / ${trend.slice(-4).reduce((s, r) => s + Number(r.closed), 0)}`} sub="New detections / closures" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Open exposure trend (26 weeks)" actions={<Legend items={SEVS.map((s) => ({ label: s, color: SEVERITY_COLOR[s] }))} />}>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ left: -18, right: 8, top: 8 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="week" {...AXIS} interval={3} />
                <YAxis {...AXIS} allowDecimals={false} />
                <RTooltip content={<ChartTooltip />} />
                {SEVS.map((s) => (
                  <Line key={s} type="monotone" dataKey={s} name={s} stroke={SEVERITY_COLOR[s]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Discovery vs closure velocity" actions={<Legend items={[{ label: 'Discovered', color: CATEGORICAL[2] }, { label: 'Closed', color: CATEGORICAL[1] }]} />}>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={trend} margin={{ left: -18, right: 8, top: 8 }} barGap={2}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="week" {...AXIS} interval={3} />
                <YAxis {...AXIS} allowDecimals={false} />
                <RTooltip content={<ChartTooltip />} />
                <Bar dataKey="discovered" name="Discovered" fill={CATEGORICAL[2]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="closed" name="Closed" fill={CATEGORICAL[1]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2" title="Risk concentration: application × severity" description="Open findings — click a cell to open the filtered list">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="py-2 text-left font-medium text-subtle">Service</th>
                  {SEVS.map((s) => (
                    <th key={s} className="py-2 text-center font-medium capitalize text-subtle">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heat.map((h) => (
                  <tr key={h.svc.id}>
                    <td className="py-1 pr-3 text-[13px]">
                      <Link to={`/applications/${h.svc.id}`} className="hover:text-violet-700">
                        {h.svc.name}
                      </Link>
                    </td>
                    {h.cells.map((n, i) => (
                      <td key={i} className="p-0.5">
                        <button onClick={() => navigate(`/operations/findings?severity=${SEVS[i]}&service=${encodeURIComponent(h.svc.name)}&status=new,triaged,in_validation,validated,in_remediation,pending_verification`)} className="num flex h-9 w-full items-center justify-center rounded-md text-[13px] font-medium cursor-pointer hover:ring-1 hover:ring-violet-400" style={{ background: n ? `${SEVERITY_COLOR[SEVS[i]]}${Math.round(20 + (n / maxHeat) * 150).toString(16).padStart(2, '0')}` : '#f6f6f9' }} aria-label={`${h.svc.name} ${SEVS[i]}: ${n}`}>
                          {n}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
        <Section title="Mean time to remediate vs SLA" description="Days, resolved findings">
          <div className="space-y-3">
            {mttr.map((m) => (
              <div key={m.name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{m.name}</span>
                  <span className={cn('num', m.days > m.sla ? 'text-red-700' : 'text-emerald-700')}>
                    {m.days}d / SLA {m.sla}d
                  </span>
                </div>
                <Progress value={Math.min(100, (m.days / (m.sla * 1.5)) * 100)} tone={m.days > m.sla ? 'red' : 'emerald'} />
              </div>
            ))}
          </div>
          <div className="mt-5">
            <div className="label-xs mb-2">Open findings by domain</div>
            <BarList items={domains.map(([d, n], i) => ({ label: <span className="capitalize">{d}</span>, value: n, color: CATEGORICAL[i % CATEGORICAL.length] }))} />
          </div>
        </Section>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2" title="Exploitability landscape" description="Open CVE-based findings: CVSS base score vs EPSS probability (illustrative snapshot). Click a point to investigate.">
          <div className="h-72">
            <ResponsiveContainer>
              <ScatterChart margin={{ left: -10, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid {...GRID} vertical />
                <XAxis type="number" dataKey="cvss" name="CVSS" domain={[4, 10]} {...AXIS} label={{ value: 'CVSS base score', position: 'insideBottom', offset: -4, fill: '#64748b', fontSize: 11 }} />
                <YAxis type="number" dataKey="epss" name="EPSS %" domain={[0, 100]} {...AXIS} />
                <ZAxis type="number" dataKey="score" range={[40, 220]} name="Risk" />
                <RTooltip content={({ active, payload }) => (active && payload?.[0] ? <div className="rounded-lg border border-border-strong bg-surface-3 px-3 py-2 text-xs"><div className="font-medium">{(payload[0].payload as { name: string }).name}</div><div className="text-muted">{(payload[0].payload as { id: string }).id} · CVSS {(payload[0].payload as { cvss: number }).cvss} · EPSS {(payload[0].payload as { epss: number }).epss}% · Risk {(payload[0].payload as { score: number }).score}</div></div> : null)} />
                <Scatter data={scatter} onClick={(d) => navigate(`/exposures/vulnerabilities/${(d as unknown as { id: string }).id}`)} className="cursor-pointer">
                  {scatter.map((s) => (
                    <Cell key={s.id} fill={s.fill} fillOpacity={0.75} stroke="#ffffff" strokeWidth={2} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <div className="space-y-5">
          <Section title="Findings by detection source">
            <BarList items={bySource.map((b) => ({ label: b.name, value: b.value, onClick: () => navigate(`/integrations/${b.id}`) }))} />
          </Section>
          <Section title="Incidents opened per week">
            <div className="h-32">
              <ResponsiveContainer>
                <BarChart data={incidentTrend} margin={{ left: -24, right: 4 }}>
                  <XAxis dataKey="week" {...AXIS} interval={1} />
                  <YAxis {...AXIS} allowDecimals={false} />
                  <RTooltip content={<ChartTooltip />} />
                  <Bar dataKey="opened" name="Incidents" fill={CATEGORICAL[4]} radius={[4, 4, 0, 0]} onClick={() => navigate('/operations/incidents')} className="cursor-pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
