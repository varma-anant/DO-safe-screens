import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend as RLegend, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip as RTooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { Calculator, Check, DollarSign, Download, FileText, Gauge, Info, Layers, PiggyBank, Printer, RotateCcw, Save, Sigma, TrendingDown } from 'lucide-react'
import type { Control, RiskScenario, ScenarioParams } from '@/types'
import { useAction, useCollections, useCurrentUser } from '@/hooks/queries'
import { usePage } from '@/hooks/usePage'
import { Callout, EmptyState, ErrorState, KeyValue, KpiCard, LoadingState, NotFound, PageHeader, Section, Stat } from '@/components/common/layout'
import { Badge, FindingStatusBadge, InfoHint, ProvenanceBadge, SeverityBadge } from '@/components/common/badges'
import { EntityLink, UserName } from '@/components/common/entities'
import { AXIS, BarList, CATEGORICAL, ChartTooltip, GRID, Legend } from '@/components/common/charts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/input'
import { Progress, Slider } from '@/components/ui/misc'
import * as api from '@/services/api'
import { cn, downloadText, fmtDate, fmtDateTime, fmtMoney, fmtPct } from '@/utils/format'
import { isOpen, SEVERITY_RANK } from '@/utils/labels'
import { computeScenario, controlStrength, CRQ_MODEL, lossExceedance, postureScore, totalALE, vendorRiskBand, aiRiskScore } from '@/utils/risk'

function ModelNote() {
  return (
    <Callout tone="demo" icon={<Sigma />} title={CRQ_MODEL.name}>
      <div className="font-mono text-[11px]">{CRQ_MODEL.formula}</div>
      <div className="font-mono text-[11px]">{CRQ_MODEL.aep}</div>
      <div className="font-mono text-[11px]">{CRQ_MODEL.exposure}</div>
      <div className="mt-1">{CRQ_MODEL.caveat}</div>
    </Callout>
  )
}

// ============================================================ Overview

export function RiskOverview() {
  usePage('Cyber Risk Quantification', [{ label: 'Risk Quantification' }, { label: 'Risk Overview' }])
  const navigate = useNavigate()
  const { data, isLoading, error, retry } = useCollections(['scenarios', 'findings', 'services', 'controls'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={8} />
  const { scenarios, findings, services, controls } = data
  const rows = scenarios.map((s) => ({ s, r: computeScenario(s, findings) })).sort((a, b) => b.r.ale - a.r.ale)
  const ale = rows.reduce((x, y) => x + y.r.ale, 0)
  const low = rows.reduce((x, y) => x + y.r.aleLow, 0)
  const high = rows.reduce((x, y) => x + y.r.aleHigh, 0)
  const reducible = rows.reduce((x, y) => x + (y.r.ale - y.r.aleRemediated), 0)
  const bySvc = services.map((svc) => ({ name: svc.name, id: svc.id, value: Math.round(rows.filter((x) => x.s.businessServiceId === svc.id).reduce((a, b) => a + b.r.ale, 0)) })).sort((a, b) => b.value - a.value)
  return (
    <div className="space-y-5">
      <PageHeader title="Cyber Risk Quantification" icon={<Calculator />} description="Translate technical exposure into illustrative financial terms: plausible loss scenarios, estimated annual loss, control effectiveness and the value of remediation and investment." actions={<Button asChild variant="secondary"><Link to="/crq/report"><FileText /> Risk report</Link></Button>} />
      <ModelNote />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Estimated annual loss (ALE)" value={fmtMoney(ale)} tone="violet" sub={`Range ${fmtMoney(low)} – ${fmtMoney(high)}`} help="Sum of scenario ALE (most-likely loss per event). Illustrative." />
        <KpiCard label="Reducible by remediation" value={fmtMoney(reducible)} tone="green" sub="If linked high/critical findings were fixed" onClick={() => navigate('/crq/financial-impact')} />
        <KpiCard label="Scenarios modelled" value={scenarios.length} onClick={() => navigate('/crq/scenarios')} />
        <KpiCard label="Avg. control strength" value={`${Math.round(controls.reduce((s, c) => s + controlStrength(c), 0) / controls.length)}%`} sub="Effectiveness × coverage" onClick={() => navigate('/crq/controls')} />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2" title="Scenarios ranked by business materiality" description="Click a scenario to open the simulator">
          <div className="divide-y divide-border/60">
            {rows.map(({ s, r }) => (
              <Link key={s.id} to={`/crq/scenarios/${s.id}`} className="flex flex-wrap items-center gap-3 py-2.5 hover:bg-surface-2/40">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{s.name}</div>
                  <div className="text-[11px] text-muted">{services.find((x) => x.id === s.businessServiceId)?.name} · {s.threatType} · {r.exposure.openHighCritical} linked open high/critical findings</div>
                </div>
                <div className="w-40">
                  <div className="flex justify-between text-[11px] text-muted"><span>AEP {fmtPct(r.aep, 1)}</span><span>{fmtMoney(r.aleLow)}–{fmtMoney(r.aleHigh)}</span></div>
                  <Progress value={(r.ale / rows[0].r.ale) * 100} />
                </div>
                <span className="num w-20 text-right text-[14px] font-semibold">{fmtMoney(r.ale)}</span>
              </Link>
            ))}
          </div>
        </Section>
        <Section title="ALE by application">
          <BarList items={bySvc.map((b, i) => ({ label: b.name, value: b.value, color: CATEGORICAL[i % CATEGORICAL.length], onClick: () => navigate(`/applications/${b.id}`) }))} format={(v) => fmtMoney(v)} />
        </Section>
      </div>
    </div>
  )
}

// ============================================================ Scenarios list

export function ScenariosPage() {
  usePage('Risk Scenarios', [{ label: 'Risk Quantification' }, { label: 'Risk Scenarios' }])
  const { data, isLoading, error, retry } = useCollections(['scenarios', 'findings', 'services'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={8} />
  return (
    <div className="space-y-5">
      <PageHeader title="Risk Scenarios" icon={<Layers />} description="Plausible cybersecurity loss scenarios linked to applications, exposures, vendors, AI systems and controls." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.scenarios.map((s) => {
          const r = computeScenario(s, data.findings)
          return (
            <Link key={s.id} to={`/crq/scenarios/${s.id}`} className="card p-4 hover:border-border-strong">
              <div className="flex items-start justify-between gap-2">
                <div className="font-mono text-[11px] text-muted">{s.id}</div>
                <Badge tone="violet">{s.threatType}</Badge>
              </div>
              <div className="mt-1 text-[14px] font-semibold">{s.name}</div>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{s.description}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Stat label="ALE" value={fmtMoney(r.ale)} />
                <Stat label="AEP" value={fmtPct(r.aep, 1)} />
                <Stat label="Saved sims" value={s.savedSimulations.length} />
              </div>
              <div className="mt-2 text-[11px] text-subtle">{data.services.find((x) => x.id === s.businessServiceId)?.name} · {s.threatActor}</div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================ Scenario simulator

export function ScenarioDetail() {
  const { id } = useParams()
  const me = useCurrentUser()
  const { data, isLoading, error, retry } = useCollections(['scenarios', 'findings', 'controls', 'services', 'vendors', 'aiSystems', 'assets'] as const, { ignoreProjectFilter: true })
  const s = data?.scenarios.find((x) => x.id === id)
  usePage(s?.name ?? 'Scenario', [{ label: 'Risk Quantification' }, { label: 'Risk Scenarios', to: '/crq/scenarios' }, { label: id ?? '' }])
  const [params, setParams] = React.useState<ScenarioParams | null>(null)
  const [remediate, setRemediate] = React.useState(false)
  const [saveOpen, setSaveOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const { run, pending } = useAction()
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={10} />
  if (!s) return <NotFound what="Scenario" back={{ to: '/crq/scenarios', label: 'Back to Risk Scenarios' }} />
  const p = params ?? s.params
  const { findings, controls } = data
  const simFindings = remediate ? findings.map((f) => (s.findingIds.includes(f.id) && isOpen(f.status) ? { ...f, status: 'resolved' as const } : f)) : findings
  const base = computeScenario(s, findings, s.params)
  const sim = computeScenario(s, simFindings, p)
  const dirty = params !== null || remediate
  const lecBase = lossExceedance(s, findings, s.params)
  const lecSim = lossExceedance(s, simFindings, p)
  const lec = lecBase.map((b, i) => ({ loss: b.loss, baseline: Number((b.probability * 100).toFixed(2)), simulated: Number((lecSim[i].probability * 100).toFixed(2)) }))
  const linked = findings.filter((f) => s.findingIds.includes(f.id))
  const set = (patch: Partial<ScenarioParams>) => setParams({ ...p, ...patch })
  const delta = sim.ale - base.ale
  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/crq/scenarios', label: 'Risk Scenarios' }}
        title={s.name}
        icon={<Calculator />}
        badges={<Badge tone="violet">{s.threatType}</Badge>}
        description={s.description}
        actions={
          <>
            <Button variant="secondary" disabled={!dirty} onClick={() => { setParams(null); setRemediate(false) }}><RotateCcw /> Reset</Button>
            <Button variant="secondary" disabled={!params} loading={pending} onClick={async () => { await run(() => api.applyScenarioParams(s.id, p), 'Baseline assumptions updated'); setParams(null) }}><Check /> Apply as baseline</Button>
            <Button disabled={!dirty} onClick={() => { setName(`${me.name.split(' ')[0]}'s simulation ${s.savedSimulations.length + 1}`); setSaveOpen(true) }}><Save /> Save simulation</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Baseline ALE" value={fmtMoney(base.ale)} sub={`AEP ${fmtPct(base.aep, 1)} · ${fmtMoney(base.aleLow)}–${fmtMoney(base.aleHigh)}`} />
        <KpiCard label="Simulated ALE" value={fmtMoney(sim.ale)} tone="violet" sub={`AEP ${fmtPct(sim.aep, 1)} · ${fmtMoney(sim.aleLow)}–${fmtMoney(sim.aleHigh)}`} />
        <KpiCard label="Change vs baseline" value={`${delta > 0 ? '+' : ''}${fmtMoney(delta)}`} tone={delta < 0 ? 'green' : delta > 0 ? 'red' : 'default'} sub={base.ale ? `${delta > 0 ? '+' : ''}${fmtPct(delta / base.ale, 1)}` : ''} />
        <KpiCard label="Exposure factor" value={`×${sim.exposure.factor.toFixed(2)}`} sub={`${sim.exposure.openHighCritical} open high/critical linked findings`} help="Linked open high/critical findings raise event probability by 4% each (capped at +60%)." />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Section title="Simulation parameters" description="Adjust and recalculate instantly">
          <div className="space-y-4">
            <ParamSlider label="Base annual event probability" value={p.baseAEP} min={0.01} max={0.9} step={0.01} fmt={(v) => fmtPct(v)} onChange={(v) => set({ baseAEP: v })} help="Likelihood of at least one loss event per year before exposure and control adjustments." />
            <ParamSlider label="Loss per event — low" value={p.lossLow} min={50_000} max={p.lossMostLikely} step={50_000} fmt={fmtMoney} onChange={(v) => set({ lossLow: v })} />
            <ParamSlider label="Loss per event — most likely" value={p.lossMostLikely} min={p.lossLow} max={p.lossHigh} step={50_000} fmt={fmtMoney} onChange={(v) => set({ lossMostLikely: v })} />
            <ParamSlider label="Loss per event — high" value={p.lossHigh} min={p.lossMostLikely} max={60_000_000} step={250_000} fmt={fmtMoney} onChange={(v) => set({ lossHigh: v })} />
            <div className="label-xs pt-2">Control effectiveness</div>
            {s.controls.map((c) => {
              const ctl = controls.find((x) => x.id === c.controlId)!
              return <ParamSlider key={c.controlId} label={`${ctl.name} (relevance ${fmtPct(c.relevance)})`} value={p.controlEffectiveness[c.controlId] ?? ctl.effectiveness} min={0} max={0.98} step={0.01} fmt={(v) => fmtPct(v)} onChange={(v) => set({ controlEffectiveness: { ...p.controlEffectiveness, [c.controlId]: v } })} />
            })}
            <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px]">
              <span>Simulate remediation of all linked open findings</span>
              <input type="checkbox" checked={remediate} onChange={(e) => setRemediate(e.target.checked)} className="size-4 accent-violet-500" />
            </label>
          </div>
        </Section>
        <div className="space-y-5 xl:col-span-2">
          <Section title="Before / after comparison" actions={<ProvenanceBadge value="simulated" />}>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={[{ name: 'Low', baseline: base.aleLow, simulated: sim.aleLow }, { name: 'Most likely (ALE)', baseline: base.ale, simulated: sim.ale }, { name: 'High', baseline: base.aleHigh, simulated: sim.aleHigh }]} margin={{ left: 10, right: 8, top: 8 }} barGap={4}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="name" {...AXIS} />
                  <YAxis {...AXIS} tickFormatter={(v) => fmtMoney(v)} />
                  <RTooltip content={<ChartTooltip format={(v) => fmtMoney(v)} />} />
                  <Bar dataKey="baseline" name="Baseline" fill={CATEGORICAL[2]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="simulated" name="Simulated" fill={CATEGORICAL[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Legend items={[{ label: 'Baseline', color: CATEGORICAL[2] }, { label: 'Simulated', color: CATEGORICAL[0] }]} />
          </Section>
          <Section title="Loss exceedance curve" description="Probability that annual loss exceeds a given amount (seeded triangular simulation, 4,000 iterations)">
            <div className="h-56">
              <ResponsiveContainer>
                <AreaChart data={lec} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="loss" {...AXIS} tickFormatter={(v) => fmtMoney(v)} />
                  <YAxis {...AXIS} tickFormatter={(v) => `${v}%`} />
                  <RTooltip content={<ChartTooltip format={(v) => `${v}%`} labelFormat={(l) => `Loss ≥ ${fmtMoney(Number(l))}`} />} />
                  <Area type="monotone" dataKey="baseline" name="Baseline" stroke={CATEGORICAL[2]} fill={CATEGORICAL[2]} fillOpacity={0.12} strokeWidth={2} />
                  <Area type="monotone" dataKey="simulated" name="Simulated" stroke={CATEGORICAL[0]} fill={CATEGORICAL[0]} fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Section title="Calculation" description="Step-by-step for the simulated parameters">
          <KeyValue cols={1} items={[{ label: 'Base AEP', value: fmtPct(p.baseAEP, 1) }, { label: '× Exposure factor', value: sim.exposure.factor.toFixed(2) }, { label: '× Control multiplier', value: sim.controlMultiplier.toFixed(3), hint: 'Π (1 − effectiveness × relevance)' }, { label: '= Effective AEP', value: fmtPct(sim.aep, 2) }, { label: '× Loss per event (most likely)', value: fmtMoney(p.lossMostLikely, false) }, { label: '= ALE', value: <span className="font-semibold">{fmtMoney(sim.ale, false)}</span> }]} />
        </Section>
        <Section title="Assumptions" actions={<InfoHint text="Assumptions are documented so business stakeholders can challenge them." />}>
          <ul className="space-y-1.5 text-xs">
            {s.assumptions.map((a) => <li key={a} className="flex gap-1.5"><Info className="mt-0.5 size-3 shrink-0 text-sky-700" /> {a}</li>)}
          </ul>
          <div className="label-xs mb-1.5 mt-4">Loss components</div>
          {s.lossComponents.map((c) => (
            <div key={c.component} className="mb-1.5 text-xs">
              <div className="flex justify-between"><span className="text-muted">{c.component}</span><span>{fmtMoney(sim.ale * c.share)}</span></div>
              <Progress value={c.share * 100} />
            </div>
          ))}
        </Section>
        <Section title={`Linked exposures (${linked.length})`} description="Remediating these reduces the exposure factor">
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {linked.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]).map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-2 text-xs">
                <EntityLink type="finding" id={f.id} />
                <span className="flex shrink-0 gap-1"><SeverityBadge severity={f.severity} /><FindingStatusBadge status={f.status} /></span>
              </div>
            ))}
            {!linked.length && <p className="text-xs text-muted">No linked findings.</p>}
          </div>
          <div className="mt-3 text-[11px] text-subtle">Related: {s.vendorIds.map((v) => data.vendors.find((x) => x.id === v)?.name).join(', ') || 'no vendors'}{s.aiSystemIds.length ? ` · ${s.aiSystemIds.length} AI systems` : ''}</div>
        </Section>
      </div>
      <Section title={`Saved simulations (${s.savedSimulations.length})`}>
        {s.savedSimulations.length ? (
          <div className="divide-y divide-border/60">
            {s.savedSimulations.map((x) => (
              <div key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-xs">
                <span className="min-w-0 flex-1 truncate font-medium">{x.name}</span>
                <span className="text-muted">baseline {fmtMoney(x.baselineAle)} → {fmtMoney(x.ale)}</span>
                <Badge tone={x.ale < x.baselineAle ? 'emerald' : 'red'}>{x.ale < x.baselineAle ? '−' : '+'}{fmtMoney(Math.abs(x.ale - x.baselineAle))}</Badge>
                <UserName id={x.savedById} />
                <span className="text-subtle">{fmtDateTime(x.savedAt)}</span>
                <Button size="xs" variant="ghost" onClick={() => setParams(x.params)}>Load</Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No saved simulations" description="Adjust parameters and save a simulation to compare options." />
        )}
      </Section>
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent title="Save simulation" description="Saved simulations are recorded on the scenario and in the audit log.">
          <Field label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button disabled={name.trim().length < 3} loading={pending} onClick={async () => { await run(() => api.saveScenarioSimulation(s.id, `${name.trim()}${remediate ? ' (with remediation)' : ''}`, p, sim.ale, base.ale), 'Simulation saved'); setSaveOpen(false) }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ParamSlider({ label, value, min, max, step, fmt, onChange, help }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void; help?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1 text-muted">{label}{help && <InfoHint text={help} />}</span>
        <span className="num shrink-0 font-semibold">{fmt(value)}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} aria-label={label} />
    </div>
  )
}

// ============================================================ Financial impact

export function FinancialImpact() {
  usePage('Financial Impact', [{ label: 'Risk Quantification' }, { label: 'Financial Impact' }])
  const navigate = useNavigate()
  const { data, isLoading, error, retry } = useCollections(['scenarios', 'findings', 'services'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={8} />
  const rows = data.scenarios.map((s) => ({ s, r: computeScenario(s, data.findings) }))
  const byType = Object.entries(rows.reduce<Record<string, number>>((a, x) => ((a[x.s.threatType] = (a[x.s.threatType] ?? 0) + x.r.ale), a), {})).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value)
  const comps = Object.entries(rows.reduce<Record<string, number>>((a, x) => { x.s.lossComponents.forEach((c) => { const k = c.component.split(' (')[0]; a[k] = (a[k] ?? 0) + x.r.ale * c.share }); return a }, {})).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 8)
  const remed = rows.map((x) => ({ name: x.s.name.split(' ').slice(0, 3).join(' '), id: x.s.id, current: Math.round(x.r.ale), remediated: Math.round(x.r.aleRemediated) })).sort((a, b) => b.current - a.current)
  const totals = { ale: rows.reduce((a, b) => a + b.r.ale, 0), low: rows.reduce((a, b) => a + b.r.aleLow, 0), high: rows.reduce((a, b) => a + b.r.aleHigh, 0), rem: rows.reduce((a, b) => a + b.r.aleRemediated, 0) }
  return (
    <div className="space-y-5">
      <PageHeader title="Financial Impact Estimation" icon={<DollarSign />} description="Illustrative estimated annual loss by threat type and loss component, and the estimated risk reduction from remediating linked exposures." />
      <ModelNote />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Estimated annual loss" value={fmtMoney(totals.ale)} tone="violet" />
        <KpiCard label="Low estimate" value={fmtMoney(totals.low)} />
        <KpiCard label="High estimate" value={fmtMoney(totals.high)} tone="red" />
        <KpiCard label="Post-remediation ALE" value={fmtMoney(totals.rem)} tone="green" sub={`−${fmtMoney(totals.ale - totals.rem)} (${fmtPct((totals.ale - totals.rem) / totals.ale)})`} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="ALE by threat type">
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byType} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="#ffffff" strokeWidth={2}>
                  {byType.map((b, i) => <Cell key={b.name} fill={CATEGORICAL[i % CATEGORICAL.length]} />)}
                </Pie>
                <RTooltip content={<ChartTooltip format={(v) => fmtMoney(v)} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <Legend items={byType.slice(0, 6).map((b, i) => ({ label: b.name, color: CATEGORICAL[i % CATEGORICAL.length], value: fmtMoney(b.value) }))} />
        </Section>
        <Section title="Loss components (aggregated)">
          <BarList items={comps.map((c, i) => ({ label: c.name, value: c.value, color: CATEGORICAL[i % CATEGORICAL.length] }))} format={(v) => fmtMoney(v)} />
        </Section>
      </div>
      <Section title="Remediation impact by scenario" description="Current ALE vs ALE if every linked open high/critical finding were remediated — click to simulate">
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={remed} margin={{ left: 10, right: 8, top: 8 }} barGap={3}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" {...AXIS} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis {...AXIS} tickFormatter={(v) => fmtMoney(v)} />
              <RTooltip content={<ChartTooltip format={(v) => fmtMoney(v)} />} />
              <Bar dataKey="current" name="Current ALE" fill={CATEGORICAL[0]} radius={[4, 4, 0, 0]} onClick={(d) => navigate(`/crq/scenarios/${(d as unknown as { id: string }).id}`)} className="cursor-pointer" />
              <Bar dataKey="remediated" name="After remediation" fill={CATEGORICAL[1]} radius={[4, 4, 0, 0]} onClick={(d) => navigate(`/crq/scenarios/${(d as unknown as { id: string }).id}`)} className="cursor-pointer" />
              <RLegend wrapperStyle={{ fontSize: 11, color: '#6b6c80' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>
    </div>
  )
}

// ============================================================ Controls

export function ControlsPage() {
  usePage('Control Effectiveness', [{ label: 'Risk Quantification' }, { label: 'Control Effectiveness' }])
  const { data, isLoading, error, retry } = useCollections(['controls', 'scenarios', 'findings'] as const)
  const [edit, setEdit] = React.useState<Control | null>(null)
  const [vals, setVals] = React.useState({ effectiveness: 0, coverage: 0 })
  const { run, pending } = useAction()
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={10} />
  const { controls, scenarios, findings } = data
  const scatter = controls.map((c) => ({ x: Math.round(c.coverage * 100), y: Math.round(c.effectiveness * 100), z: c.annualCost, name: c.name, id: c.id }))
  return (
    <div className="space-y-5">
      <PageHeader title="Control Effectiveness" icon={<Gauge />} description="How security controls influence scenario risk. Updating effectiveness propagates to every scenario that relies on the control." />
      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2" title="Controls">
          <div className="divide-y divide-border/60">
            {controls.map((c) => {
              const used = scenarios.filter((s) => s.controls.some((x) => x.controlId === c.id))
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="text-[13px] font-medium">{c.name}</span><Badge tone="sky">{c.category}</Badge></div>
                    <div className="text-[11px] text-muted">{c.description}</div>
                    <div className="text-[11px] text-subtle">Evidence: {c.evidence} · tested {fmtDate(c.lastTested)} · used by {used.length} scenario(s)</div>
                  </div>
                  <div className="w-36 text-xs">
                    <div className="flex justify-between"><span className="text-muted">Effectiveness</span><span>{fmtPct(c.effectiveness)}</span></div>
                    <Progress value={c.effectiveness * 100} tone={c.effectiveness > 0.7 ? 'emerald' : c.effectiveness > 0.5 ? 'amber' : 'red'} />
                    <div className="mt-1 flex justify-between"><span className="text-muted">Coverage</span><span>{fmtPct(c.coverage)}</span></div>
                    <Progress value={c.coverage * 100} tone="sky" />
                  </div>
                  <div className="w-20 text-right text-xs"><div className="text-muted">Cost / yr</div><div className="num">{fmtMoney(c.annualCost)}</div></div>
                  <Button size="xs" variant="secondary" onClick={() => { setEdit(c); setVals({ effectiveness: c.effectiveness, coverage: c.coverage }) }}>Update</Button>
                </div>
              )
            })}
          </div>
        </Section>
        <div className="space-y-5">
          <Section title="Effectiveness vs coverage" description="Bubble size = annual cost">
            <div className="h-64">
              <ResponsiveContainer>
                <ScatterChart margin={{ left: -10, right: 12, top: 8, bottom: 8 }}>
                  <CartesianGrid {...GRID} vertical />
                  <XAxis type="number" dataKey="x" name="Coverage" unit="%" domain={[40, 100]} {...AXIS} />
                  <YAxis type="number" dataKey="y" name="Effectiveness" unit="%" domain={[30, 100]} {...AXIS} />
                  <ZAxis type="number" dataKey="z" range={[60, 320]} />
                  <RTooltip content={({ active, payload }) => (active && payload?.[0] ? <div className="rounded-lg border border-border-strong bg-surface-3 px-3 py-2 text-xs"><div className="font-medium">{(payload[0].payload as { name: string }).name}</div><div className="text-muted">coverage {(payload[0].payload as { x: number }).x}% · effectiveness {(payload[0].payload as { y: number }).y}%</div></div> : null)} />
                  <Scatter data={scatter} fill={CATEGORICAL[0]} fillOpacity={0.7} stroke="#ffffff" strokeWidth={2} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </Section>
          <Section title="Weakest controls by ALE influence">
            <BarList items={controls.map((c) => ({ c, infl: scenarios.filter((s) => s.controls.some((x) => x.controlId === c.id)).reduce((a, s) => a + computeScenario(s, findings).ale, 0) * (1 - c.effectiveness) })).sort((a, b) => b.infl - a.infl).slice(0, 5).map(({ c, infl }) => ({ label: c.name, value: Math.round(infl), color: '#d97706' }))} format={(v) => fmtMoney(v)} />
          </Section>
        </div>
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent title={`Update ${edit?.name}`} description="Record a new effectiveness assessment (e.g. after a control test). Scenario ALE is recalculated.">
          <div className="space-y-4">
            <ParamSlider label="Effectiveness" value={vals.effectiveness} min={0.1} max={0.98} step={0.01} fmt={(v) => fmtPct(v)} onChange={(v) => setVals({ ...vals, effectiveness: v })} />
            <ParamSlider label="Coverage" value={vals.coverage} min={0.1} max={1} step={0.01} fmt={(v) => fmtPct(v)} onChange={(v) => setVals({ ...vals, coverage: v })} />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
            <Button loading={pending} onClick={async () => { await run(() => api.updateControl(edit!.id, { effectiveness: vals.effectiveness, coverage: vals.coverage, lastTested: new Date().toISOString() }, `effectiveness ${fmtPct(edit!.effectiveness)} → ${fmtPct(vals.effectiveness)}`), 'Control updated — scenario ALE recalculated'); setEdit(null) }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================ Investments

function investmentImpact(inv: { controlId: string; effectivenessUplift: number; scenarioIds: string[] }, scenarios: RiskScenario[], findings: Parameters<typeof computeScenario>[1]) {
  return scenarios.filter((s) => inv.scenarioIds.includes(s.id) && s.controls.some((c) => c.controlId === inv.controlId)).map((s) => {
    const before = computeScenario(s, findings).ale
    const cur = s.params.controlEffectiveness[inv.controlId] ?? 0
    const after = computeScenario(s, findings, { ...s.params, controlEffectiveness: { ...s.params.controlEffectiveness, [inv.controlId]: Math.min(0.98, cur + inv.effectivenessUplift) } }).ale
    return { s, before, after, reduction: before - after }
  })
}

export function InvestmentsPage() {
  usePage('Investment Analysis', [{ label: 'Risk Quantification' }, { label: 'Investment Analysis' }])
  const { data, isLoading, error, retry } = useCollections(['investments', 'scenarios', 'findings', 'controls'] as const)
  const [sel, setSel] = React.useState<string | null>(null)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={8} />
  const rows = data.investments.map((inv) => {
    const impact = investmentImpact(inv, data.scenarios, data.findings)
    const red = impact.reduce((a, b) => a + b.reduction, 0)
    const yearCost = inv.annualCost + inv.oneTimeCost / 3
    return { inv, impact, reduction: red, yearCost, rosi: (red - yearCost) / yearCost, payback: red > inv.annualCost ? inv.oneTimeCost / (red - inv.annualCost) : Infinity }
  }).sort((a, b) => b.rosi - a.rosi)
  const s = rows.find((r) => r.inv.id === sel) ?? rows[0]
  return (
    <div className="space-y-5">
      <PageHeader title="Investment Justification" icon={<PiggyBank />} description="Estimate the risk reduction from proposed security investments and compare return on security investment (ROSI). Illustrative, for prioritization discussions." />
      <Callout tone="demo" icon={<Sigma />}>ROSI = (annual ALE reduction − annualized cost) ÷ annualized cost, with one-time cost amortized over 3 years. ALE reduction comes from raising the linked control's effectiveness in each affected scenario.</Callout>
      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2" title="Proposed investments ranked by ROSI">
          <div className="divide-y divide-border/60">
            {rows.map((r) => (
              <button key={r.inv.id} onClick={() => setSel(r.inv.id)} className={cn('flex w-full flex-wrap items-center gap-3 rounded-lg px-2 py-3 text-left cursor-pointer', s.inv.id === r.inv.id ? 'bg-violet-500/8' : 'hover:bg-surface-2/50')}>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{r.inv.name}</div>
                  <div className="text-[11px] text-muted">{data.controls.find((c) => c.id === r.inv.controlId)?.name} · +{fmtPct(r.inv.effectivenessUplift)} effectiveness · {r.impact.length} scenarios</div>
                </div>
                <Stat label="ALE reduction / yr" value={fmtMoney(r.reduction)} />
                <Stat label="Annualized cost" value={fmtMoney(r.yearCost)} />
                <Stat label="ROSI" value={<span className={r.rosi > 0 ? 'text-emerald-700' : 'text-red-700'}>{r.rosi > 0 ? '+' : ''}{fmtPct(r.rosi)}</span>} />
              </button>
            ))}
          </div>
        </Section>
        <Section title={s.inv.name} description={s.inv.description}>
          <KeyValue cols={2} items={[{ label: 'One-time cost', value: fmtMoney(s.inv.oneTimeCost) }, { label: 'Annual cost', value: fmtMoney(s.inv.annualCost) }, { label: 'ALE reduction / yr', value: fmtMoney(s.reduction) }, { label: 'Payback', value: Number.isFinite(s.payback) ? `${(s.payback * 12).toFixed(1)} months` : 'Not within horizon' }]} />
          <div className="label-xs mb-1.5 mt-4">Impact by scenario</div>
          <div className="space-y-2">
            {s.impact.map((x) => (
              <Link key={x.s.id} to={`/crq/scenarios/${x.s.id}`} className="block rounded-lg bg-surface-2 px-3 py-2 text-xs hover:bg-surface-3">
                <div className="font-medium">{x.s.name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-muted"><TrendingDown className="size-3 text-emerald-700" /> {fmtMoney(x.before)} → {fmtMoney(x.after)} (−{fmtMoney(x.reduction)})</div>
              </Link>
            ))}
          </div>
        </Section>
      </div>
      <Section title="ALE reduction vs annualized cost">
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={rows.map((r) => ({ name: r.inv.name.split(' ').slice(0, 3).join(' '), reduction: Math.round(r.reduction), cost: Math.round(r.yearCost) }))} margin={{ left: 10, right: 8, top: 8 }} barGap={3}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" {...AXIS} interval={0} />
              <YAxis {...AXIS} tickFormatter={(v) => fmtMoney(v)} />
              <RTooltip content={<ChartTooltip format={(v) => fmtMoney(v)} />} />
              <Bar dataKey="reduction" name="ALE reduction / yr" fill={CATEGORICAL[1]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="cost" name="Annualized cost" fill={CATEGORICAL[3]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Legend items={[{ label: 'ALE reduction / yr', color: CATEGORICAL[1] }, { label: 'Annualized cost', color: CATEGORICAL[3] }]} />
      </Section>
    </div>
  )
}

// ============================================================ Risk report

export function RiskReport() {
  usePage('Risk Report', [{ label: 'Risk Quantification' }, { label: 'Risk Report' }])
  const me = useCurrentUser()
  const { data, isLoading, error, retry } = useCollections(['scenarios', 'findings', 'services', 'vendors', 'aiSystems', 'investments', 'controls', 'incidents'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={12} />
  const { scenarios, findings, services, vendors, aiSystems, investments, incidents } = data
  const rows = scenarios.map((s) => ({ s, r: computeScenario(s, findings) })).sort((a, b) => b.r.ale - a.r.ale)
  const ale = totalALE(scenarios, findings)
  const open = findings.filter((f) => isOpen(f.status))
  const highVendors = vendors.filter((v) => v.lifecycle !== 'offboarded' && ['high', 'critical'].includes(vendorRiskBand(v.residualRisk)))
  const inv = investments.map((i) => ({ i, red: investmentImpact(i, scenarios, findings).reduce((a, b) => a + b.reduction, 0) })).sort((a, b) => b.red - a.red).slice(0, 3)
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const md = [
    `# Northstar Financial Services — Cyber Risk Report (${date})`,
    `> DO SAFE demo report — simulated data and illustrative estimates. Not a validated actuarial analysis.`,
    ``,
    `## Summary`,
    `- Estimated annual loss (illustrative): ${fmtMoney(ale)}`,
    `- Cyber posture score: ${postureScore(findings)}/100`,
    `- Open critical exposures: ${open.filter((f) => f.severity === 'critical').length} (${open.filter((f) => f.kev).length} KEV-listed open findings)`,
    `- High/critical-risk vendors: ${highVendors.length}`,
    `- Shadow AI systems: ${aiSystems.filter((a) => a.approval === 'unsanctioned').length}`,
    ``,
    `## Top scenarios`,
    ...rows.slice(0, 5).map(({ s, r }) => `- ${s.name}: ALE ${fmtMoney(r.ale)} (range ${fmtMoney(r.aleLow)}–${fmtMoney(r.aleHigh)})`),
    ``,
    `## Recommended investments`,
    ...inv.map(({ i, red }) => `- ${i.name}: est. ALE reduction ${fmtMoney(red)}/yr`),
    ``,
    `Model: ${CRQ_MODEL.formula}; ${CRQ_MODEL.aep}. ${CRQ_MODEL.caveat}`,
  ].join('\n')
  return (
    <div className="space-y-5">
      <PageHeader title="Cyber Risk Report" icon={<FileText />} description="Board-ready summary of quantified cyber risk. Figures are recalculated live from the demo dataset." actions={<><Button variant="secondary" onClick={() => downloadText(`northstar-cyber-risk-report-${new Date().toISOString().slice(0, 10)}.md`, md, 'text/markdown')}><Download /> Export Markdown</Button><Button variant="secondary" onClick={() => window.print()}><Printer /> Print</Button></>} />
      <Card className="mx-auto max-w-4xl p-8">
        <div className="border-b border-border pb-4">
          <div className="label-xs">Prepared for the Board Risk Committee</div>
          <h2 className="mt-1 text-2xl font-semibold">Northstar Financial Services — Cyber Risk Report</h2>
          <div className="mt-1 text-xs text-muted">{date} · prepared by <UserName id={me.id} avatar={false} /> · DO SAFE Unified (demo)</div>
          <div className="mt-3"><Callout tone="demo">Simulated data. Financial figures are illustrative estimates using a documented simplified model, not validated actuarial results.</Callout></div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Estimated annual loss" value={fmtMoney(ale)} />
          <Stat label="Posture score" value={`${postureScore(findings)}/100`} />
          <Stat label="Open critical exposures" value={open.filter((f) => f.severity === 'critical').length} />
          <Stat label="Active incidents" value={incidents.filter((i) => i.status !== 'closed').length} />
        </div>
        <h3 className="mt-8 text-base font-semibold">1. Most material risk scenarios</h3>
        <table className="mt-3 w-full text-xs">
          <thead><tr className="border-b border-border text-left text-subtle"><th className="py-2">Scenario</th><th>Service</th><th className="text-right">Probability</th><th className="text-right">ALE</th><th className="text-right">Range</th></tr></thead>
          <tbody>
            {rows.slice(0, 6).map(({ s, r }) => (
              <tr key={s.id} className="border-b border-border/50">
                <td className="py-2"><Link to={`/crq/scenarios/${s.id}`} className="text-violet-700">{s.name}</Link></td>
                <td className="text-muted">{services.find((x) => x.id === s.businessServiceId)?.name}</td>
                <td className="text-right">{fmtPct(r.aep, 1)}</td>
                <td className="text-right font-semibold">{fmtMoney(r.ale)}</td>
                <td className="text-right text-muted">{fmtMoney(r.aleLow)}–{fmtMoney(r.aleHigh)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className="mt-8 text-base font-semibold">2. Exposure drivers</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-muted">
          <li>{open.filter((f) => f.kev).length} open findings are listed in CISA KEV; {open.filter((f) => f.severity === 'critical' && f.tags.includes('internet-facing')).length} critical findings are on internet-facing assets.</li>
          <li>{highVendors.length} third parties carry high or critical residual risk, including {highVendors.slice(0, 3).map((v) => v.name).join(', ')}.</li>
          <li>{aiSystems.filter((a) => a.approval === 'unsanctioned').length} unsanctioned AI applications are in use; highest-risk AI system: {[...aiSystems].sort((a, b) => aiRiskScore(b, findings) - aiRiskScore(a, findings))[0].name}.</li>
        </ul>
        <h3 className="mt-8 text-base font-semibold">3. Recommended investments</h3>
        <ul className="mt-2 space-y-2 text-[13px]">
          {inv.map(({ i, red }) => (
            <li key={i.id} className="rounded-lg bg-surface-2 px-3 py-2"><span className="font-medium">{i.name}</span> — estimated ALE reduction <span className="text-emerald-700">{fmtMoney(red)}/yr</span> for {fmtMoney(i.oneTimeCost)} one-time + {fmtMoney(i.annualCost)}/yr.</li>
          ))}
        </ul>
        <h3 className="mt-8 text-base font-semibold">4. Methodology</h3>
        <p className="mt-2 text-xs text-muted">{CRQ_MODEL.formula}. {CRQ_MODEL.aep}. {CRQ_MODEL.exposure}. {CRQ_MODEL.caveat}</p>
      </Card>
    </div>
  )
}
