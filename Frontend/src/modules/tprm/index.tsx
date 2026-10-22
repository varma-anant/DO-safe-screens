import * as React from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { createColumnHelper } from '@tanstack/react-table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { Activity, AlertTriangle, ArrowRight, Building2, Check, CheckCircle2, ClipboardList, FileCheck2, FileSearch, FileSignature, FileUp, LogOut, Network, Plus, ShieldAlert, Sparkles, Users, Wrench, X } from 'lucide-react'
import type { Assessment, EvidenceDoc, MonitoringAlert, Vendor } from '@/types'
import { useAction, useCollections, useUsers } from '@/hooks/queries'
import { usePage, useUrlFilters } from '@/hooks/usePage'
import { Callout, EmptyState, ErrorState, KeyValue, KpiCard, LoadingState, NotFound, PageHeader, Section } from '@/components/common/layout'
import { Badge, CriticalityBadge, DemoTag, InfoHint, ProvenanceBadge, RiskScore, SeverityBadge, StatusBadge } from '@/components/common/badges'
import { EntityLink, RelTime, Timeline, UserName } from '@/components/common/entities'
import { DataTable } from '@/components/common/DataTable'
import { AXIS, ChartTooltip, GRID, Legend, CATEGORICAL } from '@/components/common/charts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Checkbox, Progress } from '@/components/ui/misc'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TicketsTable } from '@/modules/operations'
import * as api from '@/services/api'
import { cn, daysUntil, fmtDate, fmtDateTime, fmtMoney, plural } from '@/utils/format'
import { ASSESSMENT_STATUS, SEVERITY_COLOR, SEVERITY_RANK, VENDOR_LIFECYCLE } from '@/utils/labels'
import { vendorRiskBand } from '@/utils/risk'

export { AssessmentDetail } from './assessment'

const active = (v: Vendor) => v.lifecycle !== 'offboarded'

// ============================================================ Overview

export function VendorOverview() {
  usePage('Third-Party Risk Overview', [{ label: 'Third-Party Risk' }, { label: 'Vendor Overview' }])
  const navigate = useNavigate()
  const { data, isLoading, error, retry } = useCollections(['vendors', 'assessments', 'monitoringAlerts', 'tickets'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={5} rows={8} />
  const { vendors, assessments, monitoringAlerts, tickets } = data
  const live = vendors.filter(active)
  const bands = (['critical', 'high', 'medium', 'low'] as const).map((b) => ({ name: b[0].toUpperCase() + b.slice(1), key: b, value: live.filter((v) => vendorRiskBand(v.residualRisk) === b).length, fill: SEVERITY_COLOR[b] }))
  const lifecycle = (Object.keys(VENDOR_LIFECYCLE) as (keyof typeof VENDOR_LIFECYCLE)[]).map((l) => ({ name: VENDOR_LIFECYCLE[l].label, value: vendors.filter((v) => v.lifecycle === l).length, key: l }))
  const attention = live.map((v) => ({ v, alerts: monitoringAlerts.filter((a) => a.vendorId === v.id && a.status === 'open'), items: tickets.filter((t) => t.vendorId === v.id && !['done', 'cancelled'].includes(t.status)).length })).filter((x) => x.alerts.length || vendorRiskBand(x.v.residualRisk) === 'critical' || vendorRiskBand(x.v.residualRisk) === 'high').sort((a, b) => b.v.residualRisk - a.v.residualRisk).slice(0, 7)
  const openAssess = assessments.filter((a) => a.status !== 'completed')
  const loop = [
    { name: 'Intake', n: vendors.filter((v) => v.lifecycle === 'intake').length, to: '/tprm/vendors?lifecycle=intake' },
    { name: 'Due diligence', n: vendors.filter((v) => v.lifecycle === 'due_diligence').length, to: '/tprm/vendors?lifecycle=due_diligence' },
    { name: 'Remediation', n: vendors.filter((v) => v.lifecycle === 'remediation').length, to: '/tprm/remediation' },
    { name: 'Monitoring', n: vendors.filter((v) => v.lifecycle === 'active').length, to: '/tprm/monitoring' },
    { name: 'Offboarding', n: vendors.filter((v) => v.lifecycle === 'offboarding').length, to: '/tprm/offboarding' },
  ]
  return (
    <div className="space-y-5">
      <PageHeader title="Third-Party Risk Overview" icon={<Building2 />} description="The full vendor lifecycle — intake, due diligence, remediation, continuous monitoring and offboarding — with risk measured before and after controls." actions={<Button asChild><Link to="/tprm/vendors?onboard=1"><Plus /> Onboard vendor</Link></Button>} />
      <div className="grid gap-3 md:grid-cols-5">
        {loop.map((l, i) => (
          <button key={l.name} onClick={() => navigate(l.to)} className="card relative p-4 text-left hover:border-border-strong cursor-pointer">
            <div className="text-[11px] text-subtle">Stage {i + 1}</div>
            <div className="text-[14px] font-semibold">{l.name}</div>
            <div className="num mt-1 text-2xl font-semibold">{l.n}</div>
            <div className="text-[11px] text-muted">vendors</div>
            {i < 4 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden size-4 -translate-y-1/2 text-subtle md:block" />}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="Active third parties" value={live.length} sub={`${live.filter((v) => v.tier === 'tier-1').length} tier-1`} onClick={() => navigate('/tprm/vendors')} />
        <KpiCard label="High / critical residual risk" value={bands[0].value + bands[1].value} tone="red" onClick={() => navigate('/tprm/vendors?risk=critical,high')} />
        <KpiCard label="Open monitoring alerts" value={monitoringAlerts.filter((a) => a.status === 'open').length} tone="amber" onClick={() => navigate('/tprm/monitoring')} />
        <KpiCard label="Assessments in progress" value={openAssess.length} onClick={() => navigate('/tprm/assessments')} />
        <KpiCard label="Open remediation items" value={tickets.filter((t) => t.vendorId && !['done', 'cancelled'].includes(t.status)).length} onClick={() => navigate('/tprm/remediation')} />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Section title="Vendor risk distribution" description="Residual risk band — click to filter">
          <div className="h-44">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={bands} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="#ffffff" strokeWidth={2} onClick={(d) => navigate(`/tprm/vendors?risk=${(d as unknown as { key: string }).key}`)} className="cursor-pointer">
                  {bands.map((b) => <Cell key={b.key} fill={b.fill} />)}
                </Pie>
                <RTooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <Legend items={bands.map((b) => ({ label: b.name, color: b.fill, value: b.value, onClick: () => navigate(`/tprm/vendors?risk=${b.key}`) }))} />
        </Section>
        <Section className="xl:col-span-2" title="Vendors requiring attention" description="High residual risk or open monitoring alerts">
          <div className="divide-y divide-border/60">
            {attention.map(({ v, alerts, items }) => (
              <Link key={v.id} to={`/tprm/vendors/${v.id}`} className="flex flex-wrap items-center gap-3 py-2.5 hover:bg-surface-2/40">
                <RiskScore score={v.residualRisk} label={`Residual risk ${v.residualRisk}/100`} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{v.name}</div>
                  <div className="truncate text-[11px] text-muted">{alerts[0]?.title ?? v.category}</div>
                </div>
                <CriticalityBadge value={v.tier} />
                <StatusBadge map={VENDOR_LIFECYCLE} value={v.lifecycle} />
                <span className="text-[11px] text-muted">{alerts.length} alerts · {items} items</span>
              </Link>
            ))}
          </div>
        </Section>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Inherent vs residual risk" description="Tier-1 & tier-2 vendors — risk before and after assessed controls">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={live.filter((v) => ['tier-1', 'tier-2'].includes(v.tier)).map((v) => ({ name: v.name.split(' ')[0], inherent: v.inherentRisk, residual: v.residualRisk, id: v.id }))} margin={{ left: -18, right: 8, top: 8 }} barGap={2}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" {...AXIS} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis {...AXIS} domain={[0, 100]} />
                <RTooltip content={<ChartTooltip />} />
                <Bar dataKey="inherent" name="Inherent" fill={CATEGORICAL[2]} radius={[4, 4, 0, 0]} onClick={(d) => navigate(`/tprm/vendors/${(d as unknown as { id: string }).id}`)} className="cursor-pointer" />
                <Bar dataKey="residual" name="Residual" fill={CATEGORICAL[0]} radius={[4, 4, 0, 0]} onClick={(d) => navigate(`/tprm/vendors/${(d as unknown as { id: string }).id}`)} className="cursor-pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Legend items={[{ label: 'Inherent risk', color: CATEGORICAL[2] }, { label: 'Residual risk', color: CATEGORICAL[0] }]} />
        </Section>
        <Section title="Lifecycle distribution">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={lifecycle} margin={{ left: -18, right: 8, top: 8 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" {...AXIS} />
                <YAxis {...AXIS} allowDecimals={false} />
                <RTooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Vendors" fill={CATEGORICAL[1]} radius={[4, 4, 0, 0]} onClick={(d) => navigate(`/tprm/vendors?lifecycle=${(d as unknown as { key: string }).key}`)} className="cursor-pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>
    </div>
  )
}

// ============================================================ Inventory + onboarding

const vCol = createColumnHelper<Vendor & { band: string; openAlerts: number }>()

export function VendorInventory() {
  usePage('Vendor Inventory', [{ label: 'Third-Party Risk' }, { label: 'Vendor Inventory' }])
  const navigate = useNavigate()
  const initialFilters = useUrlFilters(['risk', 'lifecycle', 'tier'])
  // Read through the router so ?onboard=1 also works in the standalone (hash-routed) HTML build.
  const [params] = useSearchParams()
  const [onboard, setOnboard] = React.useState(() => params.get('onboard') === '1')
  const { data, isLoading, error, retry } = useCollections(['vendors', 'monitoringAlerts'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={12} />
  const rows = data.vendors.map((v) => ({ ...v, band: vendorRiskBand(v.residualRisk), openAlerts: data.monitoringAlerts.filter((a) => a.vendorId === v.id && a.status === 'open').length }))
  const columns = [
    vCol.accessor('name', { header: 'Vendor', cell: (c) => <div><div className="font-medium">{c.getValue()}</div><div className="text-[11px] text-subtle">{c.row.original.category}</div></div> }),
    vCol.accessor('tier', { header: 'Criticality', filterFn: 'multi', cell: (c) => <CriticalityBadge value={c.getValue()} /> }),
    vCol.accessor('lifecycle', { header: 'Lifecycle', filterFn: 'multi', cell: (c) => <StatusBadge map={VENDOR_LIFECYCLE} value={c.getValue()} /> }),
    vCol.accessor('inherentRisk', { header: 'Inherent', cell: (c) => <span className="num text-muted">{c.getValue()}</span> }),
    vCol.accessor('residualRisk', { header: 'Residual', cell: (c) => <RiskScore score={c.getValue()} label={`Residual risk ${c.getValue()}/100`} /> }),
    vCol.accessor('band', { id: 'risk', header: 'Risk band', filterFn: 'multi', cell: (c) => <SeverityBadge severity={c.getValue() as 'low'} />, sortingFn: (a, b) => SEVERITY_RANK[a.original.band as 'low'] - SEVERITY_RANK[b.original.band as 'low'] }),
    vCol.accessor('securityRating', { header: 'Security rating', cell: (c) => (c.getValue() ? <span className="num">{c.getValue()}</span> : <span className="text-subtle">Not rated</span>) }),
    vCol.accessor((v) => v.dataAccess.join(', '), { id: 'data', header: 'Data access', cell: (c) => <span className="block max-w-[220px] truncate text-xs text-muted">{c.getValue()}</span> }),
    vCol.accessor('openAlerts', { header: 'Alerts', cell: (c) => (c.getValue() ? <Badge tone="amber">{c.getValue()}</Badge> : <span className="text-subtle">0</span>) }),
    vCol.accessor('relationshipOwnerId', { header: 'Owner', cell: (c) => <UserName id={c.getValue()} /> }),
    vCol.accessor('nextReviewDate', { header: 'Next review', cell: (c) => <span className={daysUntil(c.getValue()) < 0 ? 'text-red-700' : 'text-muted'}>{fmtDate(c.getValue())}</span> }),
  ]
  return (
    <div className="space-y-5">
      <PageHeader title="Vendor Inventory" icon={<Users />} description="Centralized register of third parties with criticality, data access, inherent and residual risk." actions={<Button onClick={() => setOnboard(true)}><Plus /> Onboard vendor</Button>} />
      <DataTable key={JSON.stringify(initialFilters)} tableId="vendors" data={rows} columns={columns} getRowId={(v) => v.id} onRowClick={(v) => navigate(`/tprm/vendors/${v.id}`)} searchPlaceholder="Search vendors…" initialFilters={initialFilters} facets={[{ columnId: 'tier', label: 'Criticality' }, { columnId: 'lifecycle', label: 'Lifecycle', options: Object.entries(VENDOR_LIFECYCLE).map(([value, x]) => ({ value, label: x.label })) }, { columnId: 'risk', label: 'Risk band', options: ['critical', 'high', 'medium', 'low'].map((x) => ({ value: x, label: x })) }]} views={[{ id: 'all', label: 'All vendors', filters: [] }, { id: 'high', label: 'High-risk vendors', filters: [{ id: 'risk', value: ['critical', 'high'] }] }, { id: 'tier1', label: 'Tier 1', filters: [{ id: 'tier', value: ['tier-1'] }] }, { id: 'dd', label: 'In due diligence', filters: [{ id: 'lifecycle', value: ['intake', 'due_diligence'] }] }]} initialViewId="all" exportName="do-safe-vendors" exportRow={(v) => ({ id: v.id, name: v.name, category: v.category, tier: v.tier, lifecycle: v.lifecycle, inherent_risk: v.inherentRisk, residual_risk: v.residualRisk, rating: v.securityRating, data_access: v.dataAccess.join('; '), alerts: v.openAlerts })} selectable={false} />
      {onboard && <OnboardingWizard onClose={() => setOnboard(false)} />}
    </div>
  )
}

const DATA_OPTIONS = ['Customer PII', 'Cardholder data (PAN, tokenized)', 'Account data', 'Employee PII', 'Confidential internal documents', 'Source code', 'Biometric templates', 'None']
const onboardSchema = z.object({
  name: z.string().min(2, 'Vendor name is required'),
  category: z.string().min(3, 'Category is required'),
  website: z.string().url('Enter a valid URL (https://…)'),
  description: z.string().min(10, 'Describe the service provided'),
  tier: z.enum(['tier-1', 'tier-2', 'tier-3', 'tier-4']),
  relationshipOwnerId: z.string().min(1, 'Select a relationship owner'),
  businessServiceIds: z.array(z.string()).min(1, 'Select at least one application'),
  dataAccess: z.array(z.string()).min(1, 'Select data access (or None)'),
  integrationAccess: z.string(),
  isAIProvider: z.boolean(),
  contractValue: z.coerce.number().min(0, 'Must be positive'),
})
type OnboardForm = z.input<typeof onboardSchema>

function OnboardingWizard({ onClose }: { onClose: () => void }) {
  const users = useUsers()
  const navigate = useNavigate()
  const { data } = useCollections(['services'] as const)
  const [step, setStep] = React.useState(0)
  const [confirmClose, setConfirmClose] = React.useState(false)
  const { run } = useAction()
  const { register, handleSubmit, formState, watch, setValue, trigger } = useForm<OnboardForm, unknown, z.output<typeof onboardSchema>>({ resolver: zodResolver(onboardSchema), defaultValues: { name: '', category: '', website: 'https://', description: '', tier: 'tier-2', relationshipOwnerId: '', businessServiceIds: [], dataAccess: [], integrationAccess: '', isAIProvider: false, contractValue: 120000 } })
  const w = watch()
  const inherent = api.computeInherentRisk({ tier: w.tier, dataAccess: w.dataAccess.filter((d) => d !== 'None'), isAIProvider: w.isAIProvider, integrationAccess: w.integrationAccess ? [w.integrationAccess] : [] })
  const steps = ['Vendor basics', 'Relationship & data access', 'Inherent risk review']
  const fieldsByStep: (keyof OnboardForm)[][] = [['name', 'category', 'website', 'description', 'tier'], ['relationshipOwnerId', 'businessServiceIds', 'dataAccess', 'contractValue'], []]
  const tryClose = () => (formState.isDirty ? setConfirmClose(true) : onClose())
  const toggle = (field: 'businessServiceIds' | 'dataAccess', v: string) => setValue(field, w[field].includes(v) ? w[field].filter((x) => x !== v) : [...w[field], v], { shouldDirty: true, shouldValidate: true })
  return (
    <>
      <Dialog open onOpenChange={(o) => !o && tryClose()}>
        <DialogContent wide title="Onboard a new vendor" description="Intake validates inputs, enriches context and calculates inherent risk before controls are assessed.">
          <ol className="mb-5 flex items-center gap-2">
            {steps.map((s, i) => (
              <li key={s} className="flex flex-1 items-center gap-2">
                <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px]', i < step ? 'border-violet-500 bg-violet-600 text-white' : i === step ? 'border-violet-400 text-violet-700' : 'border-border-strong text-subtle')}>{i < step ? <Check className="size-3" /> : i + 1}</span>
                <span className={cn('text-xs', i === step ? 'font-medium' : 'text-muted')}>{s}</span>
                {i < steps.length - 1 && <span className="h-px flex-1 bg-border" />}
              </li>
            ))}
          </ol>
          <form
            onSubmit={handleSubmit(async (v) => {
              const created = await run(() => api.onboardVendor({ ...v, dataAccess: v.dataAccess.filter((d) => d !== 'None'), integrationAccess: v.integrationAccess ? [v.integrationAccess] : [] }), (x) => `${x.name} onboarded — draft due-diligence assessment created`)
              onClose()
              if (created) navigate(`/tprm/vendors/${created.id}`)
            })}
          >
            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Vendor legal name" required error={formState.errors.name?.message}>
                  <Input {...register('name')} placeholder="e.g. Cobalt Payments Ltd (fictional)" />
                </Field>
                <Field label="Category" required error={formState.errors.category?.message}>
                  <Input {...register('category')} placeholder="e.g. Payment gateway" />
                </Field>
                <Field label="Website" required error={formState.errors.website?.message}>
                  <Input {...register('website')} />
                </Field>
                <Field label="Criticality tier" required>
                  <NativeSelect {...register('tier')}>
                    <option value="tier-1">Tier 1 — critical to tier-1 services</option>
                    <option value="tier-2">Tier 2 — important</option>
                    <option value="tier-3">Tier 3 — standard</option>
                    <option value="tier-4">Tier 4 — low impact</option>
                  </NativeSelect>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Service description" required error={formState.errors.description?.message}>
                    <Textarea rows={3} {...register('description')} />
                  </Field>
                </div>
              </div>
            )}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Relationship owner" required error={formState.errors.relationshipOwnerId?.message}>
                    <NativeSelect {...register('relationshipOwnerId')}>
                      <option value="">Select…</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} — {u.team}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Annual contract value (USD)" error={formState.errors.contractValue?.message}>
                    <Input type="number" {...register('contractValue')} />
                  </Field>
                </div>
                <Field label="Applications supported" required error={formState.errors.businessServiceIds?.message}>
                  <div className="flex flex-wrap gap-2">
                    {data?.services.map((s) => (
                      <button type="button" key={s.id} onClick={() => toggle('businessServiceIds', s.id)} className={cn('rounded-lg border px-2.5 py-1 text-xs cursor-pointer', w.businessServiceIds.includes(s.id) ? 'border-violet-500/60 bg-violet-500/15 text-violet-700' : 'border-border text-muted')}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Northstar data accessed" required error={formState.errors.dataAccess?.message}>
                  <div className="flex flex-wrap gap-2">
                    {DATA_OPTIONS.map((d) => (
                      <button type="button" key={d} onClick={() => toggle('dataAccess', d)} className={cn('rounded-lg border px-2.5 py-1 text-xs cursor-pointer', w.dataAccess.includes(d) ? 'border-violet-500/60 bg-violet-500/15 text-violet-700' : 'border-border text-muted')}>
                        {d}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="System / network access" hint="e.g. API from web-banking-prod, SSO, SFTP">
                  <Input {...register('integrationAccess')} />
                </Field>
                <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                  <Checkbox checked={w.isAIProvider} onCheckedChange={(c) => setValue('isAIProvider', c === true, { shouldDirty: true })} />
                  Vendor uses AI/ML to process Northstar data (adds AI usage questionnaire section)
                </label>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 rounded-xl border border-border bg-surface-2 p-4">
                  <RiskScore score={inherent} size="lg" label="Calculated inherent risk" />
                  <div>
                    <div className="font-medium">Inherent risk: {vendorRiskBand(inherent)}</div>
                    <div className="text-xs text-muted">Risk before considering vendor controls. Drives the depth of due diligence.</div>
                  </div>
                </div>
                <KeyValue cols={2} items={[{ label: 'Vendor', value: w.name }, { label: 'Tier', value: w.tier.toUpperCase() }, { label: 'Data access', value: w.dataAccess.join(', ') }, { label: 'AI processing', value: w.isAIProvider ? 'Yes' : 'No' }, { label: 'Services', value: w.businessServiceIds.map((id) => data?.services.find((s) => s.id === id)?.name).join(', ') }, { label: 'Recommended assessment', value: inherent >= 75 ? 'Full questionnaire + evidence + continuous monitoring' : inherent >= 50 ? 'Standard questionnaire + key evidence' : 'Lite questionnaire' }]} />
                <Callout tone="info">Inherent risk model (illustrative): 60% criticality tier + data sensitivity + system access + AI processing uplift. A draft due-diligence assessment is created automatically.</Callout>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={tryClose}>
                Cancel
              </Button>
              {step > 0 && (
                <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              {step < 2 ? (
                <Button type="button" onClick={async () => (await trigger(fieldsByStep[step])) && setStep(step + 1)}>
                  Continue
                </Button>
              ) : (
                <Button type="submit" loading={formState.isSubmitting}>
                  Register vendor
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent title="Discard vendor onboarding?" description="You have unsaved onboarding details.">
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmClose(false)}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={onClose}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ============================================================ Vendor detail

export function VendorDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, error, retry } = useCollections(['vendors', 'assessments', 'monitoringAlerts', 'tickets', 'services', 'aiSystems', 'findings', 'scenarios'] as const, { ignoreProjectFilter: true })
  const v = data?.vendors.find((x) => x.id === id)
  usePage(v?.name ?? 'Vendor', [{ label: 'Third-Party Risk' }, { label: 'Vendor Inventory', to: '/tprm/vendors' }, { label: v?.name ?? id ?? '' }])
  const { run, pending } = useAction()
  const [startOpen, setStartOpen] = React.useState(false)
  const [asmType, setAsmType] = React.useState<Assessment['type']>('Annual reassessment')
  const [offOpen, setOffOpen] = React.useState(false)
  React.useEffect(() => {
    if (v) api.recordRecent('vendor', v.id, v.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v?.id])
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} />
  if (!v) return <NotFound what="Vendor" back={{ to: '/tprm/vendors', label: 'Back to Vendor Inventory' }} />
  const asms = data.assessments.filter((a) => a.vendorId === v.id)
  const alerts = data.monitoringAlerts.filter((a) => a.vendorId === v.id)
  const items = data.tickets.filter((t) => t.vendorId === v.id)
  const ais = data.aiSystems.filter((a) => a.vendorId === v.id)
  const scen = data.scenarios.filter((s) => s.vendorIds.includes(v.id))
  const latest = asms.find((a) => a.status === 'completed')
  const draft = asms.find((a) => a.status !== 'completed')
  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/tprm/vendors', label: 'Vendor Inventory' }}
        title={v.name}
        icon={<Building2 />}
        description={`${v.category} · ${v.description}`}
        badges={<><CriticalityBadge value={v.tier} /><StatusBadge map={VENDOR_LIFECYCLE} value={v.lifecycle} />{v.isAIProvider && <Badge tone="violet">AI provider</Badge>}</>}
        actions={
          v.lifecycle !== 'offboarded' && (
            <>
              {draft ? (
                <Button onClick={() => navigate(`/tprm/assessments/${draft.id}`)}>
                  <ClipboardList /> {draft.status === 'draft' ? 'Start assessment' : 'Continue assessment'}
                </Button>
              ) : (
                <Button onClick={() => setStartOpen(true)}>
                  <ClipboardList /> Start assessment
                </Button>
              )}
              {v.lifecycle !== 'offboarding' && (
                <Button variant="secondary" onClick={() => setOffOpen(true)}>
                  <LogOut /> Start offboarding
                </Button>
              )}
            </>
          )
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="Inherent risk" value={`${v.inherentRisk}/100`} sub="Before controls" help="Calculated at intake from criticality, data sensitivity, access and AI processing." />
        <KpiCard label="Residual risk" value={`${v.residualRisk}/100`} tone={vendorRiskBand(v.residualRisk) === 'critical' || vendorRiskBand(v.residualRisk) === 'high' ? 'red' : 'green'} sub={<SeverityBadge severity={vendorRiskBand(v.residualRisk)} />} help="Inherent risk adjusted by latest assessment score and remediation progress (illustrative)." />
        <KpiCard label="Security rating" value={v.securityRating || '—'} sub="Outside-in (simulated feed)" />
        <KpiCard label="Open alerts" value={alerts.filter((a) => a.status === 'open').length} tone={alerts.some((a) => a.status === 'open') ? 'amber' : 'default'} />
        <KpiCard label="Open remediation items" value={items.filter((t) => !['done', 'cancelled'].includes(t.status)).length} />
      </div>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><Building2 /> Profile</TabsTrigger>
          <TabsTrigger value="assessments"><ClipboardList /> Assessments ({asms.length})</TabsTrigger>
          <TabsTrigger value="evidence"><FileSearch /> Evidence ({v.evidenceDocs.length})</TabsTrigger>
          <TabsTrigger value="monitoring"><Activity /> Monitoring ({alerts.length})</TabsTrigger>
          <TabsTrigger value="fourth"><Network /> Fourth parties ({v.fourthParties.length})</TabsTrigger>
          <TabsTrigger value="contract"><FileSignature /> Contract</TabsTrigger>
          <TabsTrigger value="remediation"><Wrench /> Remediation ({items.length})</TabsTrigger>
          {v.offboarding && <TabsTrigger value="offboarding"><LogOut /> Offboarding</TabsTrigger>}
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <div className="grid gap-5 xl:grid-cols-3">
            <Section className="xl:col-span-2" title="Business relationship">
              <KeyValue cols={3} items={[{ label: 'Vendor ID', value: <span className="font-mono">{v.id}</span> }, { label: 'Relationship owner', value: <UserName id={v.relationshipOwnerId} /> }, { label: 'Website', value: <span className="text-xs">{v.website}</span> }, { label: 'Applications', value: v.businessServiceIds.map((s) => <div key={s}><EntityLink type="service" id={s} showId={false} /></div>) }, { label: 'Data access', value: v.dataAccess.join(', ') || 'None' }, { label: 'System / network access', value: v.integrationAccess.join('; ') || 'None' }, { label: 'Onboarded', value: fmtDate(v.onboardedAt) }, { label: 'Next review', value: fmtDate(v.nextReviewDate) }, { label: 'Contract value', value: fmtMoney(v.contract.value) }]} />
            </Section>
            <Section title="Inherent risk factors" actions={<ProvenanceBadge value="inferred" />}>
              <div className="space-y-2.5">
                {v.inherentRiskFactors.map((f) => (
                  <div key={f.factor} className="text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted">{f.factor}</span>
                      <span className="text-subtle">weight {Math.round(f.weight * 100)}%</span>
                    </div>
                    <div className="mt-0.5 text-fg">{f.value}</div>
                  </div>
                ))}
              </div>
            </Section>
            {v.ratingTrend.length > 0 && (
              <Section className="xl:col-span-2" title="Security rating trend" description="Outside-in rating, last 12 months (simulated feed)">
                <div className="h-40">
                  <ResponsiveContainer>
                    <LineChart data={v.ratingTrend.map((r, i) => ({ m: `M-${11 - i}`, rating: r }))} margin={{ left: -18, right: 8, top: 8 }}>
                      <CartesianGrid {...GRID} />
                      <XAxis dataKey="m" {...AXIS} />
                      <YAxis {...AXIS} domain={['dataMin - 30', 'dataMax + 30']} />
                      <RTooltip content={<ChartTooltip />} />
                      <Line dataKey="rating" name="Rating" stroke={CATEGORICAL[0]} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            )}
            <Section title="Related AI systems & risk scenarios">
              <ul className="space-y-1.5 text-xs">
                {ais.map((a) => <li key={a.id}><EntityLink type="aiSystem" id={a.id} /></li>)}
                {scen.map((s) => <li key={s.id}><EntityLink type="scenario" id={s.id} /></li>)}
                {!ais.length && !scen.length && <li className="text-muted">None.</li>}
              </ul>
            </Section>
          </div>
        </TabsContent>
        <TabsContent value="assessments">
          <AssessmentList assessments={asms} />
          {latest?.result && <p className="mt-3 text-xs text-muted">Latest completed score: {latest.result.score}/100 ({fmtDate(latest.completedAt)})</p>}
        </TabsContent>
        <TabsContent value="evidence">
          <EvidenceList vendors={[v]} />
        </TabsContent>
        <TabsContent value="monitoring">
          <AlertList alerts={alerts} vendors={data.vendors} />
        </TabsContent>
        <TabsContent value="fourth">
          <Section title="Fourth-party dependencies" description="Subcontractors and services the vendor relies on">
            {v.fourthParties.length ? (
              <div className="divide-y divide-border/60">
                {v.fourthParties.map((f) => (
                  <div key={f.name} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-[13px]">
                    <div>
                      <div className="font-medium">{f.name}</div>
                      <div className="text-xs text-muted">{f.service} · {f.dataShared ? 'Northstar data shared' : 'No Northstar data'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={f.riskLevel} />
                      <Badge tone={f.concentration > 2 ? 'orange' : 'slate'}>used by {plural(f.concentration, 'Northstar vendor')}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Network />} title="No fourth parties disclosed" description="Request the sub-processor list via questionnaire Q-TPM-1." />
            )}
          </Section>
        </TabsContent>
        <TabsContent value="contract">
          <ContractCard v={v} />
        </TabsContent>
        <TabsContent value="remediation">
          <TicketsTable tickets={items} tableId={`vendor-${v.id}-items`} views={[{ id: 'all', label: 'All items', filters: [] }]} />
        </TabsContent>
        {v.offboarding && (
          <TabsContent value="offboarding">
            <OffboardingCard v={v} />
          </TabsContent>
        )}
        <TabsContent value="history">
          <Section title="Vendor history">
            <Timeline entries={v.history} />
          </Section>
        </TabsContent>
      </Tabs>
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent title="Start assessment" description={`Issues a security questionnaire to ${v.name} (simulated portal).`}>
          <Field label="Assessment type">
            <NativeSelect value={asmType} onChange={(e) => setAsmType(e.target.value as Assessment['type'])}>
              {['Initial due diligence', 'Annual reassessment', 'Targeted (incident)', 'AI provider assessment'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </NativeSelect>
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setStartOpen(false)}>
              Cancel
            </Button>
            <Button loading={pending} onClick={async () => { const a = await run(() => api.createAssessment(v.id, asmType), (x) => `Assessment ${x.id} started`); setStartOpen(false); if (a) navigate(`/tprm/assessments/${a.id}`) }}>
              Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={offOpen} onOpenChange={setOffOpen}>
        <DialogContent title={`Start offboarding ${v.name}?`} description="Creates an exit checklist: access revocation, data return/destruction, open obligations and audit record.">
          {items.some((t) => !['done', 'cancelled'].includes(t.status)) && <Callout tone="warn">This vendor has open remediation items — they must be closed or recorded as residual risk before offboarding completes.</Callout>}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOffOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" loading={pending} onClick={async () => { await run(() => api.startOffboarding(v.id), 'Offboarding started'); setOffOpen(false) }}>
              Start offboarding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------- shared lists

const aCol = createColumnHelper<Assessment & { vendor: string }>()

function AssessmentList({ assessments, vendors }: { assessments: Assessment[]; vendors?: Vendor[] }) {
  const navigate = useNavigate()
  const rows = assessments.map((a) => ({ ...a, vendor: vendors?.find((v) => v.id === a.vendorId)?.name ?? '' }))
  const columns = [
    aCol.accessor('id', { header: 'ID', cell: (c) => <span className="font-mono text-[11px] text-muted">{c.getValue()}</span> }),
    aCol.accessor('name', { header: 'Assessment', cell: (c) => <span className="font-medium">{c.getValue()}</span> }),
    ...(vendors ? [aCol.accessor('vendor', { header: 'Vendor', filterFn: 'multi' })] : []),
    aCol.accessor('type', { header: 'Type', filterFn: 'multi', cell: (c) => <span className="text-muted">{c.getValue()}</span> }),
    aCol.accessor('status', { header: 'Status', filterFn: 'multi', cell: (c) => <StatusBadge map={ASSESSMENT_STATUS} value={c.getValue()} /> }),
    aCol.accessor((a) => a.answers.length, { id: 'progress', header: 'Answers', cell: (c) => <span className="num text-muted">{c.getValue()}</span> }),
    aCol.accessor((a) => a.result?.score ?? -1, { id: 'score', header: 'Score', cell: (c) => (c.getValue() >= 0 ? <span className="num font-semibold">{c.getValue()}</span> : <span className="text-subtle">—</span>) }),
    aCol.accessor('dueDate', { header: 'Due', cell: (c) => <span className={daysUntil(c.getValue()) < 0 && c.row.original.status !== 'completed' ? 'text-red-700' : 'text-muted'}>{fmtDate(c.getValue())}</span> }),
  ]
  return <DataTable tableId={vendors ? 'assessments' : `asm-${assessments[0]?.vendorId}`} data={rows} columns={columns as never} getRowId={(a: Assessment) => a.id} onRowClick={(a: Assessment) => navigate(`/tprm/assessments/${a.id}`)} facets={vendors ? [{ columnId: 'status', label: 'Status', options: Object.entries(ASSESSMENT_STATUS).map(([value, x]) => ({ value, label: x.label })) }, { columnId: 'type', label: 'Type' }, { columnId: 'vendor', label: 'Vendor' }] : []} views={vendors ? [{ id: 'open', label: 'In progress', filters: [{ id: 'status', value: ['draft', 'sent', 'in_progress', 'submitted', 'under_review'] }] }, { id: 'review', label: 'Awaiting review', filters: [{ id: 'status', value: ['submitted', 'under_review'] }] }, { id: 'done', label: 'Completed', filters: [{ id: 'status', value: ['completed'] }] }, { id: 'all', label: 'All', filters: [] }] : []} initialViewId="open" exportName="do-safe-assessments" selectable={false} />
}

function EvidenceList({ vendors }: { vendors: Vendor[] }) {
  const { run, pending } = useAction()
  const [busy, setBusy] = React.useState<string | null>(null)
  const [upload, setUpload] = React.useState<Vendor | null>(null)
  const [doc, setDoc] = React.useState<{ name: string; type: EvidenceDoc['type'] }>({ name: '', type: 'SOC 2 Type II' })
  const docs = vendors.flatMap((v) => v.evidenceDocs.map((d) => ({ v, d })))
  return (
    <div className="space-y-3">
      {vendors.length === 1 && (
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" onClick={() => setUpload(vendors[0])}>
            <FileUp /> Upload evidence (simulated)
          </Button>
        </div>
      )}
      {docs.map(({ v, d }) => (
        <Card key={d.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <FileCheck2 className="size-4 text-violet-700" />
                <span className="text-[13px] font-medium">{d.name}</span>
                <Badge>{d.type}</Badge>
              </div>
              <div className="mt-0.5 text-[11px] text-muted">
                {vendors.length > 1 && <><EntityLink type="vendor" id={v.id} showId={false} /> · </>}uploaded {fmtDate(d.uploadedAt)}
                {d.expiresAt && <> · {new Date(d.expiresAt) < new Date() ? <span className="text-red-700">expired {fmtDate(d.expiresAt)}</span> : `expires ${fmtDate(d.expiresAt)}`}</>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={d.status === 'accepted' ? 'emerald' : d.status === 'rejected' || d.status === 'expired' ? 'red' : d.status === 'analyzed' ? 'violet' : 'amber'}>{d.status.replace('_', ' ')}</Badge>
              {d.status === 'pending_review' && (
                <Button size="xs" variant="secondary" loading={busy === d.id} disabled={!!busy} onClick={async () => { setBusy(d.id); await run(() => api.analyzeEvidence(v.id, d.id), 'Evidence analyzed (simulated)'); setBusy(null) }}>
                  <Sparkles /> Analyze
                </Button>
              )}
              {d.status === 'analyzed' && (
                <>
                  <Button size="xs" variant="secondary" disabled={pending} onClick={() => run(() => api.setEvidenceStatus(v.id, d.id, 'accepted'), 'Evidence accepted')}>
                    <Check /> Accept
                  </Button>
                  <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => api.setEvidenceStatus(v.id, d.id, 'rejected'), 'Evidence rejected')}>
                    <X /> Reject
                  </Button>
                </>
              )}
            </div>
          </div>
          {d.analysis && (
            <div className="mt-3 rounded-lg bg-surface-2 p-3 text-xs">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-subtle">{d.analysis.analyzedBy}</span>
                <span className="flex items-center gap-2">
                  <ProvenanceBadge value={d.analysis.provenance} />
                  <span className="text-muted">coverage {d.analysis.coverage}%</span>
                </span>
              </div>
              <p className="text-muted">{d.analysis.summary}</p>
              {d.analysis.exceptions.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {d.analysis.exceptions.map((x) => (
                    <li key={x} className="flex gap-1.5 text-amber-700">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" /> {x}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>
      ))}
      {!docs.length && <Card><EmptyState icon={<FileSearch />} title="No evidence documents" description="Upload SOC 2 reports, certificates or pen-test summaries to support due diligence." /></Card>}
      <Dialog open={!!upload} onOpenChange={(o) => !o && setUpload(null)}>
        <DialogContent title="Upload evidence (simulated)" description="No file is transmitted — a demo evidence record is created for analysis.">
          <div className="space-y-4">
            <Field label="Document type">
              <NativeSelect value={doc.type} onChange={(e) => setDoc({ ...doc, type: e.target.value as EvidenceDoc['type'] })}>
                {['SOC 2 Type II', 'ISO 27001 Certificate', 'Penetration Test Summary', 'SIG Lite Response', 'Data Processing Agreement', 'BCP/DR Plan', 'Insurance Certificate', 'Privacy Policy', 'AI Model Card'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="File name" required>
              <Input value={doc.name} onChange={(e) => setDoc({ ...doc, name: e.target.value })} placeholder="e.g. soc2-type2-2026.pdf" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setUpload(null)}>
              Cancel
            </Button>
            <Button disabled={doc.name.trim().length < 3} loading={pending} onClick={async () => { await run(() => api.uploadEvidence(upload!.id, { name: doc.name.trim(), type: doc.type, expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString() }), 'Evidence uploaded — ready for analysis'); setUpload(null); setDoc({ name: '', type: 'SOC 2 Type II' }) }}>
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AlertList({ alerts, vendors }: { alerts: MonitoringAlert[]; vendors: Vendor[] }) {
  const { run, pending } = useAction()
  const sorted = [...alerts].sort((a, b) => (a.status === 'resolved' ? 1 : 0) - (b.status === 'resolved' ? 1 : 0) || SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
  return (
    <div className="space-y-2.5">
      {sorted.map((a) => (
        <Card key={a.id} className={cn('p-4', a.status === 'resolved' && 'opacity-60')}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={a.severity} />
                <span className="text-[13px] font-medium">{a.title}</span>
                <Badge>{a.type}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted">{a.detail}</p>
              <div className="mt-1 text-[11px] text-subtle">
                <EntityLink type="vendor" id={a.vendorId} label={vendors.find((v) => v.id === a.vendorId)?.name} showId={false} /> · {a.source} · <RelTime iso={a.detectedAt} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={a.status === 'open' ? 'amber' : a.status === 'acknowledged' ? 'violet' : 'emerald'}>{a.status}</Badge>
              {a.status === 'open' && <Button size="xs" variant="secondary" disabled={pending} onClick={() => run(() => api.updateAlertStatus(a.id, 'acknowledged'), 'Alert acknowledged')}>Acknowledge</Button>}
              {a.status !== 'resolved' && <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => api.updateAlertStatus(a.id, 'resolved'), 'Alert resolved')}>Resolve</Button>}
            </div>
          </div>
        </Card>
      ))}
      {!alerts.length && <Card><EmptyState icon={<CheckCircle2 />} title="No monitoring alerts" /></Card>}
    </div>
  )
}

function ContractCard({ v }: { v: Vendor }) {
  const { run, pending } = useAction()
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Section title="Contract">
        <KeyValue cols={1} items={[{ label: 'Contract ID', value: <span className="font-mono">{v.contract.id}</span> }, { label: 'Value', value: fmtMoney(v.contract.value) }, { label: 'Term', value: `${fmtDate(v.contract.start)} → ${fmtDate(v.contract.end)}` }, { label: 'Days to expiry', value: daysUntil(v.contract.end) >= 0 ? `${daysUntil(v.contract.end)} days` : 'Expired' }]} />
        <div className="label-xs mb-1.5 mt-4">Security obligations</div>
        <ul className="space-y-1 text-xs">
          {v.contract.securityClauses.map((c) => (
            <li key={c} className="flex gap-1.5"><ShieldAlert className="mt-0.5 size-3 shrink-0 text-violet-700" /> {c}</li>
          ))}
        </ul>
      </Section>
      <Section className="xl:col-span-2" title="Contract milestones">
        <div className="divide-y divide-border/60">
          {v.contract.milestones.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div>
                <div className="text-[13px] font-medium">{m.title}</div>
                <div className="text-xs text-muted">{m.type} · due {fmtDate(m.dueDate)}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={m.status === 'met' ? 'emerald' : m.status === 'missed' ? 'red' : m.status === 'at_risk' ? 'amber' : 'slate'}>{m.status.replace('_', ' ')}</Badge>
                {m.status !== 'met' && <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => api.setMilestoneStatus(v.id, m.id, 'met'), 'Milestone marked met')}>Mark met</Button>}
                {m.status !== 'missed' && m.status !== 'met' && new Date(m.dueDate) < new Date() && <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => api.setMilestoneStatus(v.id, m.id, 'missed'), 'Milestone marked missed')}>Mark missed</Button>}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

function OffboardingCard({ v }: { v: Vendor }) {
  const { run, pending } = useAction()
  const [note, setNote] = React.useState('')
  const ob = v.offboarding!
  const done = ob.checklist.filter((c) => c.done).length
  return (
    <Section title={`Offboarding checklist (${done}/${ob.checklist.length})`} description={`Started ${fmtDate(ob.startedAt)}`} actions={<Progress value={(done / ob.checklist.length) * 100} className="w-40" tone={done === ob.checklist.length ? 'emerald' : 'amber'} />}>
      <div className="space-y-1.5">
        {ob.checklist.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
            <span className="flex items-center gap-2.5 text-[13px]">
              <Checkbox disabled={v.lifecycle === 'offboarded' || pending} checked={c.done} onCheckedChange={(x) => run(() => api.toggleOffboardingItem(v.id, c.id, x === true))} />
              <span className={c.done ? 'text-muted line-through' : ''}>{c.item}</span>
            </span>
            {c.doneAt && <span className="text-[11px] text-subtle">{fmtDateTime(c.doneAt)}</span>}
          </label>
        ))}
      </div>
      {v.lifecycle === 'offboarded' ? (
        <Callout tone="success" icon={<CheckCircle2 />} title="Offboarding complete — audit-ready record archived">{ob.residualRiskNote}</Callout>
      ) : (
        <div className="mt-4 space-y-2">
          <Field label="Residual risk statement" hint="Required to complete offboarding">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. All access revoked, data destruction certificate received, no residual risk." />
          </Field>
          <div className="flex justify-end">
            <Button disabled={done < ob.checklist.length || note.trim().length < 10} loading={pending} onClick={() => run(() => api.completeOffboarding(v.id, note.trim()), 'Offboarding completed')}>
              Complete offboarding
            </Button>
          </div>
        </div>
      )}
    </Section>
  )
}

// ============================================================ Other TPRM pages

export function AssessmentsPage() {
  usePage('Assessments', [{ label: 'Third-Party Risk' }, { label: 'Assessments' }])
  const { data, isLoading, error, retry } = useCollections(['assessments', 'vendors'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={10} />
  const { assessments, vendors } = data
  return (
    <div className="space-y-5">
      <PageHeader title="Security Assessments" icon={<ClipboardList />} description="Issue and review security questionnaires. Completed assessments generate a scored result (simulated) and gaps that become vendor remediation items." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="In progress" value={assessments.filter((a) => ['draft', 'sent', 'in_progress'].includes(a.status)).length} />
        <KpiCard label="Awaiting review" value={assessments.filter((a) => ['submitted', 'under_review'].includes(a.status)).length} tone="violet" />
        <KpiCard label="Completed" value={assessments.filter((a) => a.status === 'completed').length} tone="green" />
        <KpiCard label="Overdue" value={assessments.filter((a) => a.status !== 'completed' && daysUntil(a.dueDate) < 0).length} tone="red" />
      </div>
      <AssessmentList assessments={assessments} vendors={vendors} />
    </div>
  )
}

export function DueDiligencePage() {
  usePage('Due Diligence', [{ label: 'Third-Party Risk' }, { label: 'Due Diligence' }])
  const { data, isLoading, error, retry } = useCollections(['vendors'] as const)
  const [filter, setFilter] = React.useState('pending_review')
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={8} />
  const all = data.vendors.flatMap((v) => v.evidenceDocs)
  const vendors = data.vendors.map((v) => ({ ...v, evidenceDocs: filter === 'all' ? v.evidenceDocs : v.evidenceDocs.filter((d) => d.status === filter) })).filter((v) => v.evidenceDocs.length)
  return (
    <div className="space-y-5">
      <PageHeader title="Due Diligence & Evidence Analysis" icon={<FileSearch />} description="Collect and evaluate vendor security evidence. The Vendor Evidence Analyzer (simulated) extracts control coverage and exceptions; an analyst accepts or rejects each analysis." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(['pending_review', 'analyzed', 'accepted', 'expired'] as const).map((s) => (
          <KpiCard key={s} label={s.replace('_', ' ')} value={all.filter((d) => d.status === s).length} onClick={() => setFilter(s)} tone={s === 'expired' ? 'red' : s === 'pending_review' ? 'amber' : s === 'accepted' ? 'green' : 'violet'} />
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {['pending_review', 'analyzed', 'accepted', 'rejected', 'expired', 'all'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={cn('rounded-full border px-3 py-1 text-xs capitalize cursor-pointer', filter === s ? 'border-violet-500/50 bg-violet-500/15 text-violet-700' : 'border-border text-muted')}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>
      <EvidenceList vendors={vendors} />
    </div>
  )
}

export function MonitoringPage() {
  usePage('Continuous Monitoring', [{ label: 'Third-Party Risk' }, { label: 'Continuous Monitoring' }])
  const { data, isLoading, error, retry } = useCollections(['vendors', 'monitoringAlerts'] as const)
  const [status, setStatus] = React.useState<'open' | 'all'>('open')
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={8} />
  const { vendors, monitoringAlerts } = data
  const fourth = new Map<string, { name: string; vendors: string[]; risk: string; data: boolean }>()
  vendors.forEach((v) => v.fourthParties.forEach((f) => {
    const e = fourth.get(f.name) ?? { name: f.name, vendors: [], risk: f.riskLevel, data: false }
    e.vendors.push(v.name)
    e.data ||= f.dataShared
    fourth.set(f.name, e)
  }))
  const types = Object.entries(monitoringAlerts.reduce<Record<string, number>>((a, m) => ((a[m.type] = (a[m.type] ?? 0) + 1), a), {}))
  return (
    <div className="space-y-5">
      <PageHeader title="Continuous Monitoring" icon={<Activity />} description="Changes in vendor security posture: outside-in ratings, breach intelligence, exposed services, leaked credentials, contract obligations and fourth-party risk. Feeds are simulated." actions={<DemoTag>Simulated feeds</DemoTag>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Open alerts" value={monitoringAlerts.filter((a) => a.status === 'open').length} tone="amber" />
        <KpiCard label="Critical / high" value={monitoringAlerts.filter((a) => a.status !== 'resolved' && ['critical', 'high'].includes(a.severity)).length} tone="red" />
        <KpiCard label="Vendors monitored" value={vendors.filter((v) => ['active', 'remediation'].includes(v.lifecycle)).length} />
        <KpiCard label="Fourth parties tracked" value={fourth.size} sub={`${[...fourth.values()].filter((f) => f.vendors.length > 1).length} shared by multiple vendors`} />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <div className="flex gap-1.5">
            {(['open', 'all'] as const).map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={cn('rounded-full border px-3 py-1 text-xs capitalize cursor-pointer', status === s ? 'border-violet-500/50 bg-violet-500/15 text-violet-700' : 'border-border text-muted')}>
                {s === 'open' ? 'Open & acknowledged' : 'All alerts'}
              </button>
            ))}
          </div>
          <AlertList alerts={status === 'open' ? monitoringAlerts.filter((a) => a.status !== 'resolved') : monitoringAlerts} vendors={vendors} />
        </div>
        <div className="space-y-5">
          <Section title="Alerts by type">
            <div className="h-48">
              <ResponsiveContainer>
                <BarChart data={types.map(([name, value]) => ({ name, value }))} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={150} {...AXIS} />
                  <RTooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Alerts" fill={CATEGORICAL[3]} radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
          <Section title="Fourth-party concentration" description="Dependencies shared across Northstar's vendors" actions={<InfoHint text="A fourth party used by many vendors is a concentration risk: one incident can affect several relationships." />}>
            <div className="space-y-2">
              {[...fourth.values()].sort((a, b) => b.vendors.length - a.vendors.length).slice(0, 8).map((f) => (
                <div key={f.name} className="rounded-lg bg-surface-2 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{f.name}</span>
                    <SeverityBadge severity={f.risk as 'low'} />
                  </div>
                  <div className="mt-0.5 text-muted">via {f.vendors.join(', ')}{f.data && ' · Northstar data shared'}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

export function ContractsPage() {
  usePage('Contracts', [{ label: 'Third-Party Risk' }, { label: 'Contracts' }])
  const navigate = useNavigate()
  const { data, isLoading, error, retry } = useCollections(['vendors'] as const)
  const { run, pending } = useAction()
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={10} />
  const ms = data.vendors.filter(active).flatMap((v) => v.contract.milestones.map((m) => ({ v, m }))).sort((a, b) => a.m.dueDate.localeCompare(b.m.dueDate))
  const renewals = data.vendors.filter((v) => active(v) && daysUntil(v.contract.end) <= 120 && daysUntil(v.contract.end) >= 0)
  return (
    <div className="space-y-5">
      <PageHeader title="Contract Monitoring" icon={<FileSignature />} description="Security obligations and contract milestones: renewals, annual reviews, right-to-audit windows, insurance and breach notification commitments." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Milestones at risk" value={ms.filter((x) => x.m.status === 'at_risk').length} tone="amber" />
        <KpiCard label="Missed obligations" value={ms.filter((x) => x.m.status === 'missed').length} tone="red" />
        <KpiCard label="Renewals in 120 days" value={renewals.length} />
        <KpiCard label="Total contract value" value={fmtMoney(data.vendors.filter(active).reduce((s, v) => s + v.contract.value, 0))} />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2" title="Upcoming & overdue milestones">
          <div className="divide-y divide-border/60">
            {ms.filter((x) => x.m.status !== 'met').slice(0, 30).map(({ v, m }) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium">{m.title}</div>
                  <div className="text-xs text-muted">
                    <button className="text-violet-700 cursor-pointer" onClick={() => navigate(`/tprm/vendors/${v.id}`)}>{v.name}</button> · {m.type} · due {fmtDate(m.dueDate)} ({daysUntil(m.dueDate) >= 0 ? `in ${daysUntil(m.dueDate)}d` : `${-daysUntil(m.dueDate)}d ago`})
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={m.status === 'missed' ? 'red' : m.status === 'at_risk' ? 'amber' : 'slate'}>{m.status.replace('_', ' ')}</Badge>
                  <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => api.setMilestoneStatus(v.id, m.id, 'met'), 'Milestone marked met')}>Mark met</Button>
                </div>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Renewal decisions" description="Contracts ending in the next 120 days">
          {renewals.map((v) => (
            <Link key={v.id} to={`/tprm/vendors/${v.id}`} className="mb-2 block rounded-lg bg-surface-2 px-3 py-2 hover:bg-surface-3">
              <div className="flex justify-between text-[13px]">
                <span>{v.name}</span>
                <span className="text-muted">{daysUntil(v.contract.end)}d</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                residual risk <RiskScore score={v.residualRisk} /> · {fmtMoney(v.contract.value)}
              </div>
            </Link>
          ))}
          {!renewals.length && <p className="text-xs text-muted">No renewals due.</p>}
        </Section>
      </div>
    </div>
  )
}

export function VendorRemediationPage() {
  usePage('Vendor Remediation', [{ label: 'Third-Party Risk' }, { label: 'Remediation' }])
  const { data, isLoading, error, retry } = useCollections(['tickets'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={10} />
  const items = data.tickets.filter((t) => t.vendorId)
  const open = items.filter((t) => !['done', 'cancelled'].includes(t.status))
  return (
    <div className="space-y-5">
      <PageHeader title="Vendor Remediation Tracking" icon={<Wrench />} description="Outstanding vendor security issues from assessments and monitoring, with vendor responses and verification." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Open items" value={open.length} />
        <KpiCard label="Awaiting vendor response" value={open.filter((t) => t.vendorResponse?.status === 'awaiting').length} tone="amber" />
        <KpiCard label="Disputed by vendor" value={open.filter((t) => t.vendorResponse?.status === 'disputed').length} tone="red" />
        <KpiCard label="Vendor claims remediated" value={open.filter((t) => t.vendorResponse?.status === 'remediated').length} tone="violet" sub="Pending verification" />
      </div>
      <TicketsTable tickets={items} tableId="vendor-remediation" />
    </div>
  )
}

export function OffboardingPage() {
  usePage('Vendor Offboarding', [{ label: 'Third-Party Risk' }, { label: 'Offboarding' }])
  const { data, isLoading, error, retry } = useCollections(['vendors'] as const)
  const { run, pending } = useAction()
  const [pick, setPick] = React.useState('')
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={6} />
  const off = data.vendors.filter((v) => v.offboarding)
  const candidates = data.vendors.filter((v) => !v.offboarding && v.lifecycle === 'active')
  return (
    <div className="space-y-5">
      <PageHeader title="Vendor Offboarding" icon={<LogOut />} description="Exit checklists: revoke access, close data and contract obligations, confirm residual risk, and produce an audit-ready record." />
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <Field label="Start offboarding for an active vendor">
          <NativeSelect value={pick} onChange={(e) => setPick(e.target.value)} className="w-72">
            <option value="">Select vendor…</option>
            {candidates.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Button variant="destructive" disabled={!pick} loading={pending} onClick={async () => { await run(() => api.startOffboarding(pick), 'Offboarding started'); setPick('') }}>
          Start offboarding
        </Button>
      </Card>
      <div className="space-y-4">
        {off.map((v) => (
          <div key={v.id}>
            <div className="mb-2 flex items-center gap-2">
              <EntityLink type="vendor" id={v.id} />
              <StatusBadge map={VENDOR_LIFECYCLE} value={v.lifecycle} />
            </div>
            <OffboardingCard v={v} />
          </div>
        ))}
        {!off.length && <Card><EmptyState title="No vendors in offboarding" /></Card>}
      </div>
    </div>
  )
}
