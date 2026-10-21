import * as React from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, CircleDashed, ClipboardPaste, FolderKanban, Loader2, Play, Plug, Plus, Radar, Rocket, ShieldCheck, Trash2, Wand2, XCircle } from 'lucide-react'
import type { Asset, AssetLink, BusinessService, Integration } from '@/types'
import { useAction, useCan, useCollections, useCurrentUser, useUsers } from '@/hooks/queries'
import { usePage } from '@/hooks/usePage'
import { Callout, EmptyState, ErrorState, LoadingState, PageHeader, Section, Stat } from '@/components/common/layout'
import { Badge, SeverityBadge } from '@/components/common/badges'
import { AssetMap } from '@/components/common/AssetMap'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Checkbox, Progress } from '@/components/ui/misc'
import * as api from '@/services/api'
import { cn, fmtDateTime } from '@/utils/format'
import { ASSET_TYPE_LABEL, SEVERITY_ORDER } from '@/utils/labels'
import { projectRoleOf } from '@/utils/permissions'
import { useDbStore } from '@/stores/db'

const STEPS = [
  { key: 'project', label: 'Project', help: 'Where this application belongs' },
  { key: 'application', label: 'Application', help: 'What you want to secure' },
  { key: 'assets', label: 'Declare assets', help: 'Servers, APIs, databases, repos…' },
  { key: 'map', label: 'Map & link', help: 'How the assets connect' },
  { key: 'connect', label: 'Connect sources', help: 'Which tools assess each asset' },
  { key: 'test', label: 'Test run', help: 'Check reachability & credentials' },
  { key: 'full', label: 'Full run', help: 'Assess and publish findings' },
] as const

function stepFromStatus(app?: BusinessService) {
  if (!app) return 0
  return { draft: 2, assets_declared: 3, mapped: 4, connected: 5, test_failed: 5, test_passed: 6, active: 6, paused: 6 }[app.status]
}

export const APP_TYPES: { type: BusinessService['appType']; blurb: string }[] = [
  { type: 'Web application', blurb: 'Customer or employee-facing web app' },
  { type: 'API service', blurb: 'Public or partner APIs and gateways' },
  { type: 'Cloud workload', blurb: 'Containers, Kubernetes, serverless' },
  { type: 'Data platform', blurb: 'Databases, data lake, pipelines' },
  { type: 'SaaS workspace', blurb: 'Collaboration and business SaaS' },
  { type: 'AI application', blurb: 'LLM apps, agents and RAG' },
]

export function OnboardingPage() {
  usePage('Onboard an application', [{ label: 'Projects' }, { label: 'Onboard an application' }])
  const [params, setParams] = useSearchParams()
  const canOnboard = useCan('onboard_applications')
  const { data, isLoading, error, retry } = useCollections(['services', 'assets', 'findings', 'integrations', 'projects'] as const, { ignoreProjectFilter: true })
  const appId = params.get('app') ?? undefined
  const app = data?.services.find((s) => s.id === appId)
  const [step, setStep] = React.useState<number | null>(null)
  const [projectId, setProjectId] = React.useState<string | null>(params.get('project'))
  const derived = stepFromStatus(app)
  const current = step ?? (app ? derived : projectId ? 1 : 0)
  // Land on the step the app's status implies, then stay there until the user moves on —
  // status changes (e.g. declaring the first asset) must not yank them to the next step.
  const appLoaded = !!app
  React.useEffect(() => setStep(appLoaded ? derived : null), [appId, appLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={8} />
  if (!canOnboard)
    return (
      <Card>
        <EmptyState icon={<ShieldCheck />} title="Onboarding needs Administrator or Project Owner access" description="Your role can view applications but cannot declare or connect assets." action={<Button asChild variant="secondary"><Link to="/requests?new=1">Request access</Link></Button>} />
      </Card>
    )
  if (appId && !app) return <Card><EmptyState title="Application not found" action={<Button asChild variant="secondary"><Link to="/onboarding?new=1">Start a new onboarding</Link></Button>} /></Card>

  const appAssets = app ? data.assets.filter((a) => a.businessServiceId === app.id) : []
  const maxReachable = app ? derived : projectId ? 1 : 0
  const go = (n: number) => setStep(Math.min(n, maxReachable))

  return (
    <div className="space-y-5">
      <PageHeader
        title={app ? `Onboard ${app.name}` : 'What do you want to secure?'}
        description={app ? `${data.projects.find((p) => p.id === app.projectId)?.name} · ${app.appType} · ${app.environment}` : 'Tell DO SAFE about an application and its assets. We test the connection first, then run a full assessment — nothing is scanned until you start a run.'}
        icon={<Rocket />}
        badges={app?.status === 'active' ? <Badge tone="emerald">SAFE application</Badge> : app ? <Badge tone="violet">Onboarding</Badge> : undefined}
      />
      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit p-3">
          <ol className="space-y-1">
            {STEPS.map((s, i) => {
              const done = i < maxReachable || app?.status === 'active'
              const reachable = i <= maxReachable
              return (
                <li key={s.key}>
                  <button disabled={!reachable} onClick={() => go(i)} className={cn('flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left enabled:cursor-pointer', current === i ? 'bg-primary-soft' : reachable ? 'hover:bg-surface-2' : 'opacity-50')}>
                    <span className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold', done && current !== i ? 'border-emerald-500 bg-emerald-500 text-white' : current === i ? 'border-primary bg-primary text-white' : 'border-border-strong text-subtle')}>{done && current !== i ? <Check className="size-3.5" /> : i + 1}</span>
                    <span>
                      <span className={cn('block text-[13px]', current === i ? 'font-semibold text-fg' : 'font-medium')}>{s.label}</span>
                      <span className="block text-[11.5px] text-subtle">{s.help}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </Card>
        <div className="min-w-0">
          {current === 0 && <ProjectStep projects={data.projects} onDone={(pid) => { setProjectId(pid); setParams({ project: pid, ...(params.get('type') ? { type: params.get('type')! } : {}) }); setStep(1) }} initial={projectId} />}
          {current === 1 && (projectId || app) && <ApplicationStep projectId={app?.projectId ?? projectId!} app={app} onBack={() => setStep(0)} onDone={(id) => { setParams({ app: id }); setStep(2) }} />}
          {current === 2 && app && <AssetsStep app={app} assets={appAssets} onDone={() => setStep(3)} />}
          {current === 3 && app && <MapStep app={app} assets={appAssets} onBack={() => setStep(2)} onDone={() => setStep(4)} />}
          {current === 4 && app && <ConnectStep app={app} assets={appAssets} integrations={data.integrations} onBack={() => setStep(3)} onDone={() => setStep(5)} />}
          {current === 5 && app && <TestStep app={app} assets={appAssets} integrations={data.integrations} onFix={() => setStep(4)} onDone={() => setStep(6)} />}
          {current === 6 && app && <FullStep app={app} findings={data.findings} />}
        </div>
      </div>
    </div>
  )
}

function StepCard({ title, description, children, footer }: { title: string; description: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Card>
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-[16px] font-semibold">{title}</h2>
        <p className="mt-0.5 text-[13px] text-muted">{description}</p>
      </div>
      <div className="px-5 py-5">{children}</div>
      {footer && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3.5">{footer}</div>}
    </Card>
  )
}

// ---------------------------------------------------------------- 0. Project

function ProjectStep({ projects, onDone, initial }: { projects: { id: string; name: string; description: string }[]; onDone: (id: string) => void; initial: string | null }) {
  const me = useCurrentUser()
  const db = useDbStore((s) => s.db)
  const writable = projects.filter((p) => me.orgRole === 'admin' || ['owner', 'contributor'].includes(projectRoleOf(db, p.id, me.id) ?? ''))
  const [mode, setMode] = React.useState<'existing' | 'new'>(writable.length && !initial ? 'existing' : writable.length ? 'existing' : 'new')
  const [pick, setPick] = React.useState(initial ?? writable[0]?.id ?? '')
  const [name, setName] = React.useState('')
  const [desc, setDesc] = React.useState('')
  const { run, pending } = useAction()
  return (
    <StepCard
      title="Choose a project"
      description="A project groups the applications you want to secure — for example a product line, environment or business unit. Access to findings and tickets follows project membership."
      footer={
        <>
          <span />
          <Button
            loading={pending}
            disabled={mode === 'existing' ? !pick : name.trim().length < 3}
            onClick={async () => {
              if (mode === 'existing') return onDone(pick)
              const p = await run(() => api.createProject({ name: name.trim(), description: desc.trim() || 'Created during onboarding', ownerId: me.id }), (x) => `Project “${x.name}” created`)
              if (p) onDone(p.id)
            }}
          >
            Continue <ArrowRight />
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {writable.length > 0 && (
          <button onClick={() => setMode('existing')} className={cn('rounded-xl border p-4 text-left cursor-pointer', mode === 'existing' ? 'border-primary ring-2 ring-primary/15' : 'border-border hover:border-border-strong')}>
            <FolderKanban className="size-5 text-primary" />
            <div className="mt-2 text-[14px] font-medium">Add to an existing project</div>
            <div className="text-xs text-muted">{writable.length} project(s) you can manage</div>
          </button>
        )}
        <button onClick={() => setMode('new')} className={cn('rounded-xl border p-4 text-left cursor-pointer', mode === 'new' ? 'border-primary ring-2 ring-primary/15' : 'border-border hover:border-border-strong')}>
          <Plus className="size-5 text-primary" />
          <div className="mt-2 text-[14px] font-medium">Create a new project</div>
          <div className="text-xs text-muted">You become the project owner</div>
        </button>
      </div>
      <div className="mt-5">
        {mode === 'existing' ? (
          <Field label="Project">
            <NativeSelect value={pick} onChange={(e) => setPick(e.target.value)}>
              {writable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project name" required error={name && name.trim().length < 3 ? 'At least 3 characters' : undefined}>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Customer Portal — Production" />
            </Field>
            <Field label="Description">
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What this project covers" />
            </Field>
          </div>
        )}
      </div>
    </StepCard>
  )
}

// ---------------------------------------------------------------- 1. Application

const appSchema = z.object({
  name: z.string().min(3, 'Name the application (min 3 characters)'),
  description: z.string().min(10, 'Describe what it does (min 10 characters)'),
  appType: z.string().min(1),
  environment: z.enum(['production', 'staging', 'development', 'corporate']),
  criticality: z.enum(['tier-1', 'tier-2', 'tier-3', 'tier-4']),
  dataClassification: z.enum(['Restricted', 'Confidential', 'Internal', 'Public']),
  ownerId: z.string().min(1, 'Select an owner'),
  regulatoryScope: z.string(),
})

function ApplicationStep({ projectId, app, onBack, onDone }: { projectId: string; app?: BusinessService; onBack: () => void; onDone: (id: string) => void }) {
  const users = useUsers()
  const me = useCurrentUser()
  const { run } = useAction()
  const [params] = useSearchParams()
  const { register, handleSubmit, formState, watch, setValue } = useForm<z.infer<typeof appSchema>>({
    resolver: zodResolver(appSchema),
    defaultValues: { name: app?.name ?? '', description: app?.description ?? '', appType: app?.appType ?? params.get('type') ?? 'Web application', environment: app?.environment ?? 'production', criticality: app?.criticality ?? 'tier-2', dataClassification: app?.dataClassification ?? 'Confidential', ownerId: app?.ownerId ?? me.id, regulatoryScope: app?.regulatoryScope.join(', ') ?? '' },
  })
  const type = watch('appType')
  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        if (app) return onDone(app.id)
        const created = await run(() => api.startApplication({ projectId, ...v, appType: v.appType as BusinessService['appType'], regulatoryScope: v.regulatoryScope.split(',').map((x) => x.trim()).filter(Boolean) }), (a) => `${a.name} created — now declare its assets`)
        if (created) onDone(created.id)
      })}
    >
      <StepCard
        title="Describe the application"
        description="Business context drives prioritization: criticality and data classification raise the risk score of everything found on this application."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={onBack}>
              <ArrowLeft /> Back
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              {app ? 'Continue' : 'Create application'} <ArrowRight />
            </Button>
          </>
        }
      >
        <div className="mb-5">
          <div className="mb-1.5 text-xs font-medium text-muted">Application type</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {APP_TYPES.map((t) => (
              <button type="button" key={t.type} disabled={!!app} onClick={() => setValue('appType', t.type)} className={cn('rounded-lg border px-3 py-2 text-left enabled:cursor-pointer', type === t.type ? 'border-primary bg-primary-soft' : 'border-border enabled:hover:border-border-strong')}>
                <div className="text-[13px] font-medium">{t.type}</div>
                <div className="text-[11.5px] text-subtle">{t.blurb}</div>
              </button>
            ))}
          </div>
        </div>
        <fieldset disabled={!!app} className="grid gap-4 sm:grid-cols-2">
          <Field label="Application name" required error={formState.errors.name?.message}>
            <Input {...register('name')} placeholder="e.g. Customer Portal" />
          </Field>
          <Field label="Owner" required error={formState.errors.ownerId?.message}>
            <NativeSelect {...register('ownerId')}>
              {users.filter((u) => u.status === 'active').map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.team}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="sm:col-span-2">
            <Field label="What does it do?" required error={formState.errors.description?.message}>
              <Textarea rows={2} {...register('description')} />
            </Field>
          </div>
          <Field label="Environment">
            <NativeSelect {...register('environment')}>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
              <option value="corporate">Corporate</option>
            </NativeSelect>
          </Field>
          <Field label="Business criticality">
            <NativeSelect {...register('criticality')}>
              <option value="tier-1">Tier 1 — business critical</option>
              <option value="tier-2">Tier 2 — important</option>
              <option value="tier-3">Tier 3 — standard</option>
              <option value="tier-4">Tier 4 — low</option>
            </NativeSelect>
          </Field>
          <Field label="Most sensitive data handled">
            <NativeSelect {...register('dataClassification')}>
              <option>Restricted</option>
              <option>Confidential</option>
              <option>Internal</option>
              <option>Public</option>
            </NativeSelect>
          </Field>
          <Field label="Regulatory scope" hint="Comma-separated, e.g. PCI DSS, GDPR">
            <Input {...register('regulatoryScope')} />
          </Field>
        </fieldset>
      </StepCard>
    </form>
  )
}

// ---------------------------------------------------------------- 2. Assets

const ASSET_TYPES = Object.keys(ASSET_TYPE_LABEL) as Asset['type'][]

function suggestionsFor(app: BusinessService): api.AssetDraft[] {
  const slug = app.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24).replace(/^-+|-+$/g, '') || 'app'
  const env = app.environment
  const base: [string, Asset['type'], boolean][] =
    app.appType === 'SaaS workspace' ? [[`${slug}-tenant`, 'saas-application', true], [`${slug}-sso`, 'identity-provider', true]]
    : app.appType === 'Data platform' ? [[`${slug}-warehouse`, 'database', false], [`${slug}-lake`, 'cloud-storage', false], [`${slug}-etl`, 'server', false], [`${slug}-api`, 'api-gateway', true], [`${slug}-pipelines`, 'code-repository', false]]
    : app.appType === 'AI application' ? [[`${slug}-chat`, 'web-application', true], [`${slug}-orchestrator`, 'container', false], [`${slug}-vector-db`, 'database', false], [`${slug}-tools-api`, 'api-gateway', false], [`${slug}-repo`, 'code-repository', false]]
    : [[`${slug}-web`, 'web-application', true], [`${slug}-api`, 'api-gateway', true], [`${slug}-svc`, 'container', false], [`${slug}-db`, 'database', false], [`${slug}-k8s`, 'kubernetes-cluster', false], [`${slug}-assets`, 'cloud-storage', false], [`${slug}-repo`, 'code-repository', false]]
  return base.map(([name, type, internet], i) => ({ name, type, environment: type === 'code-repository' ? 'development' : env, internetExposed: internet, criticality: app.criticality, fqdn: internet ? `${name}.example.com` : undefined, ipAddress: !internet && type !== 'code-repository' ? `10.40.${i + 1}.${10 + i}` : undefined }))
}

function AssetsStep({ app, assets, onDone }: { app: BusinessService; assets: Asset[]; onDone: () => void }) {
  const { run, pending } = useAction()
  const [draft, setDraft] = React.useState<api.AssetDraft>({ name: '', type: 'server', environment: app.environment, internetExposed: false, criticality: app.criticality, fqdn: '', ipAddress: '' })
  const [paste, setPaste] = React.useState('')
  const [mode, setMode] = React.useState<'manual' | 'paste' | 'discover'>('discover')
  const sugg = suggestionsFor(app).filter((s) => !assets.some((a) => a.name === s.name))
  const [picked, setPicked] = React.useState<string[]>(() => suggestionsFor(app).map((s) => s.name))
  const parsed = paste.split('\n').map((l) => l.split(',').map((x) => x.trim())).filter((p) => p[0]).map(([name, type, host]) => ({ name, type: (ASSET_TYPES.includes(type as Asset['type']) ? type : 'server') as Asset['type'], environment: app.environment, internetExposed: !!host && !/^10\.|^192\.168\.|^172\./.test(host) && /[a-z]/i.test(host), criticality: app.criticality, fqdn: host && /[a-z]/i.test(host) ? host : undefined, ipAddress: host && !/[a-z]/i.test(host) ? host : undefined }))
  return (
    <StepCard
      title="Declare the assets that make up this application"
      description="List what DO SAFE should assess. Nothing is scanned yet — you'll map, connect and test before the first run."
      footer={
        <>
          <span className="text-xs text-muted">{assets.length} asset(s) declared</span>
          <Button disabled={!assets.length} onClick={onDone}>
            Continue to mapping <ArrowRight />
          </Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap gap-1.5">
        {([
          ['discover', 'Suggested from your cloud & code inventory', <Radar key="r" />],
          ['manual', 'Add manually', <Plus key="p" />],
          ['paste', 'Paste a list', <ClipboardPaste key="c" />],
        ] as const).map(([k, l, icon]) => (
          <button key={k} onClick={() => setMode(k)} className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs cursor-pointer [&_svg]:size-3.5', mode === k ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted hover:text-fg')}>
            {icon} {l}
          </button>
        ))}
      </div>
      {mode === 'discover' && (
        <div className="rounded-xl border border-border">
          <div className="border-b border-border bg-surface-2 px-4 py-2 text-xs text-muted">Candidates matching “{app.name}” (simulated discovery — select the ones that belong to this application)</div>
          {sugg.length ? (
            <ul className="divide-y divide-border">
              {sugg.map((s) => (
                <li key={s.name} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                  <Checkbox checked={picked.includes(s.name)} onCheckedChange={(c) => setPicked(c ? [...picked, s.name] : picked.filter((x) => x !== s.name))} aria-label={`Select ${s.name}`} />
                  <span className="flex-1 font-medium">{s.name}</span>
                  <span className="text-muted">{ASSET_TYPE_LABEL[s.type]}</span>
                  <span className="w-40 truncate text-right text-xs text-subtle">{s.fqdn ?? s.ipAddress ?? '—'}</span>
                  {s.internetExposed && <Badge tone="orange">Internet-facing</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-xs text-muted">All suggestions have been added.</p>
          )}
          {sugg.length > 0 && (
            <div className="border-t border-border px-4 py-2.5">
              <Button size="sm" loading={pending} disabled={!sugg.some((s) => picked.includes(s.name))} onClick={() => run(() => api.declareAssets(app.id, sugg.filter((s) => picked.includes(s.name))), 'Assets declared')}>
                Add {sugg.filter((s) => picked.includes(s.name)).length} selected
              </Button>
            </div>
          )}
        </div>
      )}
      {mode === 'manual' && (
        <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-3">
          <Field label="Name" required>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. portal-web-01" />
          </Field>
          <Field label="Type">
            <NativeSelect value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Asset['type'] })}>
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ASSET_TYPE_LABEL[t]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Hostname, URL or IP">
            <Input value={draft.fqdn || draft.ipAddress || ''} onChange={(e) => (/[a-z]/i.test(e.target.value) ? setDraft({ ...draft, fqdn: e.target.value, ipAddress: '' }) : setDraft({ ...draft, ipAddress: e.target.value, fqdn: '' }))} placeholder="portal.example.com or 10.0.0.12" />
          </Field>
          <label className="flex items-center gap-2 text-[13px]">
            <Checkbox checked={draft.internetExposed} onCheckedChange={(c) => setDraft({ ...draft, internetExposed: c === true })} /> Reachable from the internet
          </label>
          <div className="flex items-end sm:col-span-2 sm:justify-end">
            <Button size="sm" disabled={draft.name.trim().length < 2} loading={pending} onClick={async () => { await run(() => api.declareAssets(app.id, [{ ...draft, name: draft.name.trim() }]), `${draft.name} added`); setDraft({ ...draft, name: '', fqdn: '', ipAddress: '' }) }}>
              <Plus /> Add asset
            </Button>
          </div>
        </div>
      )}
      {mode === 'paste' && (
        <div className="space-y-2 rounded-xl border border-border p-4">
          <Field label="One asset per line: name, type, host" hint={`Types: ${ASSET_TYPES.join(', ')}`}>
            <Textarea rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'portal-web, web-application, portal.example.com\nportal-db, database, 10.40.2.15'} className="font-mono text-xs" />
          </Field>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">{parsed.length} line(s) recognized</span>
            <Button size="sm" disabled={!parsed.length} loading={pending} onClick={async () => { await run(() => api.declareAssets(app.id, parsed), `${parsed.length} asset(s) imported`); setPaste('') }}>
              Import {parsed.length}
            </Button>
          </div>
        </div>
      )}
      <div className="mt-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Declared assets</div>
        {assets.length ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-[13px]">
              <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wide text-subtle">
                <tr>
                  <th className="px-4 py-2">Asset</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Address</th>
                  <th className="px-4 py-2">Exposure</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assets.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2 font-medium">{a.name}</td>
                    <td className="px-4 py-2 text-muted">{ASSET_TYPE_LABEL[a.type]}</td>
                    <td className="px-4 py-2 text-xs text-muted">{a.fqdn ?? a.ipAddress ?? '—'}</td>
                    <td className="px-4 py-2">{a.internetExposed ? <Badge tone="orange">Internet-facing</Badge> : <span className="text-xs text-muted">Internal</span>}</td>
                    <td className="px-4 py-2 text-right">
                      {app.status !== 'active' && (
                        <Button size="icon-sm" variant="ghost" aria-label={`Remove ${a.name}`} onClick={() => run(() => api.removeDeclaredAsset(app.id, a.id), 'Asset removed')}>
                          <Trash2 />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted">No assets yet — add at least one to continue.</p>
        )}
      </div>
    </StepCard>
  )
}

// ---------------------------------------------------------------- 3. Map

function MapStep({ app, assets, onBack, onDone }: { app: BusinessService; assets: Asset[]; onBack: () => void; onDone: () => void }) {
  const [links, setLinks] = React.useState<AssetLink[]>(app.assetLinks)
  const { run, pending } = useAction()
  const needsLinks = assets.length > 1 && links.length === 0
  return (
    <StepCard
      title="Map and link the assets"
      description="Show how traffic and data flow between the assets. DO SAFE uses this map to find attack paths and to judge how far a weakness can spread."
      footer={
        <>
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft /> Back
          </Button>
          <Button disabled={needsLinks} loading={pending} onClick={async () => { await run(() => api.saveAssetLinks(app.id, links.map(({ sourceAssetId, targetAssetId, relation }) => ({ sourceAssetId, targetAssetId, relation }))), 'Asset map saved'); onDone() }}>
            Save map & continue <ArrowRight />
          </Button>
        </>
      }
    >
      <AssetMap assets={assets} links={links} editable onChange={setLinks} height={420} />
      {needsLinks && <p className="mt-2 text-xs text-amber-700">Add at least one link (or use “Suggest links”) to continue.</p>}
    </StepCard>
  )
}

// ---------------------------------------------------------------- 4. Connect

const SOURCE_FIT: Record<string, Asset['type'][] | 'internet'> = {
  'INT-TEN': ['server', 'network-device', 'web-application', 'api-gateway', 'database'],
  'INT-QLY': ['server', 'endpoint', 'database'],
  'INT-WIZ': ['container', 'kubernetes-cluster', 'cloud-storage', 'serverless-function', 'database', 'server', 'api-gateway', 'web-application'],
  'INT-CRW': ['server', 'endpoint', 'container'],
  'INT-GHB': ['code-repository'],
  'INT-OKT': ['identity-provider', 'saas-application'],
  'INT-NSK': ['saas-application'],
  'INT-ASM': 'internet',
}

function fits(src: string, a: Asset) {
  const f = SOURCE_FIT[src]
  return f === 'internet' ? a.type !== 'code-repository' : f.includes(a.type)
}

function recommend(assets: Asset[], integrations: Integration[]) {
  const pref = ['INT-WIZ', 'INT-TEN', 'INT-CRW', 'INT-GHB', 'INT-OKT', 'INT-NSK', 'INT-QLY']
  return Object.fromEntries(assets.map((a) => {
    const picks = pref.filter((s) => fits(s, a)).slice(0, 2)
    if (a.internetExposed) picks.push('INT-ASM')
    return [a.id, picks.filter((s) => integrations.some((i) => i.id === s))]
  }))
}

function ConnectStep({ app, assets, integrations, onBack, onDone }: { app: BusinessService; assets: Asset[]; integrations: Integration[]; onBack: () => void; onDone: () => void }) {
  const canConnect = useCan('manage_integrations')
  const [coverage, setCoverage] = React.useState<Record<string, string[]>>(() => (Object.keys(app.coverage).length ? app.coverage : Object.fromEntries(assets.map((a) => [a.id, []]))))
  const { run, pending } = useAction()
  const [connecting, setConnecting] = React.useState<string | null>(null)
  const sources = Object.keys(SOURCE_FIT).map((id) => integrations.find((i) => i.id === id)!).filter(Boolean)
  const used = new Set(Object.values(coverage).flat())
  const toggle = (assetId: string, src: string) => setCoverage((c) => ({ ...c, [assetId]: (c[assetId] ?? []).includes(src) ? c[assetId].filter((x) => x !== src) : [...(c[assetId] ?? []), src] }))
  const uncovered = assets.filter((a) => !(coverage[a.id] ?? []).length)
  return (
    <StepCard
      title="Connect sources to the assets"
      description="Choose which of your security tools assess each asset. Sources must be connected before the test run can verify them."
      footer={
        <>
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft /> Back
          </Button>
          <Button loading={pending} disabled={uncovered.length === assets.length} onClick={async () => { await run(() => api.saveCoverage(app.id, coverage), 'Sources assigned'); onDone() }}>
            Save & continue to test run <ArrowRight />
          </Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">{uncovered.length ? `${uncovered.length} asset(s) have no source yet.` : 'Every asset has at least one source.'}</p>
        <Button size="sm" variant="secondary" onClick={() => setCoverage(recommend(assets, integrations))}>
          <Wand2 /> Recommend coverage
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-[12.5px]">
          <thead className="bg-surface-2">
            <tr>
              <th className="sticky left-0 min-w-[220px] bg-surface-2 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-subtle">Asset</th>
              {sources.map((s) => (
                <th key={s.id} className="min-w-[118px] px-2 py-2 text-center align-bottom">
                  <div className="text-[11.5px] font-medium leading-tight">{s.vendor.replace(' (built-in, simulated)', '')}</div>
                  <div className="text-[10.5px] text-subtle">{s.category}</div>
                  {s.status === 'connected' ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-[10.5px] text-emerald-700"><CheckCircle2 className="size-3" /> Connected</span>
                  ) : canConnect ? (
                    <Button size="xs" variant={used.has(s.id) ? 'default' : 'secondary'} className="mt-1" loading={connecting === s.id} onClick={async () => { setConnecting(s.id); await run(() => api.quickConnectIntegration(s.id), `${s.name} connected (simulated)`); setConnecting(null) }}>
                      <Plug /> Connect
                    </Button>
                  ) : (
                    <span className="mt-1 block text-[10.5px] text-amber-700">Not connected</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {assets.map((a) => (
              <tr key={a.id}>
                <td className="sticky left-0 min-w-[220px] bg-surface px-3 py-2">
                  <div className="font-medium">{a.name}</div>
                  <div className="text-[11px] text-subtle">{ASSET_TYPE_LABEL[a.type]}{a.internetExposed ? ' · internet-facing' : ''}</div>
                </td>
                {sources.map((s) => (
                  <td key={s.id} className="px-2 py-2 text-center">
                    {fits(s.id, a) ? <Checkbox checked={(coverage[a.id] ?? []).includes(s.id)} onCheckedChange={() => toggle(a.id, s.id)} aria-label={`${s.name} assesses ${a.name}`} className="mx-auto" /> : <span className="text-subtle">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!canConnect && sources.some((s) => used.has(s.id) && s.status !== 'connected') && <div className="mt-3"><Callout tone="warn" icon={<AlertTriangle />}>Some selected sources are not connected. Ask an administrator to connect them in Integrations, or the test run will flag those assets.</Callout></div>}
    </StepCard>
  )
}

// ---------------------------------------------------------------- 5. Test run

function RunPanel({ run }: { run: BusinessService['runs'][number] }) {
  const done = run.steps.filter((s) => s.status === 'done' || s.status === 'warning').length
  return (
    <div className="rounded-xl border border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          {run.status === 'running' ? <Loader2 className="size-4 animate-spin text-primary" /> : run.status === 'failed' ? <XCircle className="size-4 text-red-600" /> : <CheckCircle2 className="size-4 text-emerald-600" />}
          {run.kind === 'test' ? 'Test run' : 'Full run'} · {run.status === 'running' ? 'in progress' : run.status.replace(/_/g, ' ')}
        </div>
        <span className="text-[11.5px] text-subtle">{fmtDateTime(run.startedAt)} · simulated</span>
      </div>
      <div className="space-y-2 px-4 py-3">
        <Progress value={(done / run.steps.length) * 100} tone={run.status === 'failed' ? 'red' : run.status === 'running' ? 'violet' : 'emerald'} />
        <ol className="grid gap-1.5 sm:grid-cols-2">
          {run.steps.map((s) => (
            <li key={s.name} className="flex items-center gap-2 text-[12.5px]">
              {s.status === 'done' ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : s.status === 'running' ? <Loader2 className="size-3.5 animate-spin text-primary" /> : s.status === 'warning' ? <AlertTriangle className="size-3.5 text-amber-600" /> : s.status === 'failed' ? <XCircle className="size-3.5 text-red-600" /> : <CircleDashed className="size-3.5 text-subtle" />}
              <span className={s.status === 'pending' ? 'text-subtle' : ''}>{s.name}</span>
            </li>
          ))}
        </ol>
        {run.status !== 'running' && <p className="pt-1 text-[13px] text-muted">{run.summary}</p>}
      </div>
    </div>
  )
}

function TestStep({ app, assets, integrations, onFix, onDone }: { app: BusinessService; assets: Asset[]; integrations: Integration[]; onFix: () => void; onDone: () => void }) {
  const canRun = useCan('run_scans')
  const { run, pending } = useAction()
  const last = app.runs.find((r) => r.kind === 'test')
  const running = app.runs.some((r) => r.status === 'running')
  return (
    <StepCard
      title="Test run — verify before you scan"
      description="A test run checks that every asset is reachable and every source's credentials work. It runs a few safe sample checks and creates no findings or tickets."
      footer={
        <>
          <Button variant="secondary" disabled={!canRun || running} loading={pending} onClick={() => run(() => api.startTestRun(app.id), 'Test run started')}>
            <Play /> {last ? 'Run the test again' : 'Start test run'}
          </Button>
          <Button disabled={!(app.status === 'test_passed' || app.status === 'active') || running} onClick={onDone}>
            Continue to full run <ArrowRight />
          </Button>
        </>
      }
    >
      {!last ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Assets to verify" value={assets.length} />
          <Stat label="Sources involved" value={new Set(Object.values(app.coverage).flat()).size} />
          <Stat label="Findings created" value="None (test only)" />
        </div>
      ) : (
        <div className="space-y-4">
          <RunPanel run={last} />
          {last.status !== 'running' && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-[12.5px]">
                <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wide text-subtle">
                  <tr>
                    <th className="px-3 py-2">Asset</th>
                    <th className="px-3 py-2">Reachable</th>
                    <th className="px-3 py-2">Credentials</th>
                    <th className="px-3 py-2">Sources</th>
                    <th className="px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {last.assetResults.map((r) => {
                    const ok = r.reachable && r.credentialsOk
                    return (
                      <tr key={r.assetId} className={ok ? '' : 'bg-red-50/60'}>
                        <td className="px-3 py-2 font-medium">{assets.find((a) => a.id === r.assetId)?.name}</td>
                        <td className="px-3 py-2">{r.reachable ? <Check className="size-4 text-emerald-600" /> : <XCircle className="size-4 text-red-600" />}</td>
                        <td className="px-3 py-2">{r.credentialsOk ? <Check className="size-4 text-emerald-600" /> : <XCircle className="size-4 text-red-600" />}</td>
                        <td className="px-3 py-2 text-muted">{r.sourceIds.map((s) => integrations.find((i) => i.id === s)?.vendor.replace(' (built-in, simulated)', '')).join(', ') || '—'}</td>
                        <td className={cn('px-3 py-2', ok ? 'text-muted' : 'text-red-700')}>{r.note}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {last.status === 'failed' && (
            <Callout tone="danger" icon={<AlertTriangle />} title="Some assets are not ready">
              Fix the coverage in <button className="font-semibold underline cursor-pointer" onClick={onFix}>Connect sources</button>, then run the test again. The full run unlocks once the test passes.
            </Callout>
          )}
        </div>
      )}
    </StepCard>
  )
}

// ---------------------------------------------------------------- 6. Full run

function FullStep({ app, findings }: { app: BusinessService; findings: { id: string; title: string; severity: import('@/types').Severity; businessServiceId?: string; tags: string[] }[] }) {
  const canRun = useCan('run_scans')
  const navigate = useNavigate()
  const { run, pending } = useAction()
  const last = app.runs.find((r) => r.kind === 'full')
  const running = app.runs.some((r) => r.status === 'running')
  const created = last ? findings.filter((f) => last.findingIds.includes(f.id)) : []
  return (
    <StepCard
      title={app.status === 'active' ? `${app.name} is a SAFE application` : 'Full run — assess and publish findings'}
      description={app.status === 'active' ? 'Monitoring is active. DO SAFE re-assesses the application on its schedule and whenever you run it manually.' : 'The full run assesses every declared asset with its connected sources, enriches results with the knowledge library and publishes prioritized findings.'}
      footer={
        <>
          <Button variant={last ? 'secondary' : 'default'} disabled={!canRun || running} loading={pending} onClick={() => run(() => api.startFullRun(app.id), 'Full run started')}>
            <Play /> {last ? 'Run again' : 'Start full run'}
          </Button>
          {app.status === 'active' && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => navigate(`/applications/${app.id}`)}>
                Open application
              </Button>
              <Button onClick={() => { api.setCurrentProject(app.projectId); navigate('/exposures/prioritization') }}>
                Prioritize findings <ArrowRight />
              </Button>
            </div>
          )}
        </>
      }
    >
      {!last ? (
        <Callout tone="info" icon={<ShieldCheck />} title="Ready for the first full run">
          The test run passed. Starting the full run turns {app.name} into a SAFE application with continuous monitoring. In this prototype the run is simulated — findings are generated from realistic templates for the assets you declared.
        </Callout>
      ) : (
        <div className="space-y-4">
          <RunPanel run={last} />
          {last.status === 'completed' && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {SEVERITY_ORDER.slice(0, 4).map((s) => (
                  <Stat key={s} label={`${s[0].toUpperCase()}${s.slice(1)}`} value={created.filter((f) => f.severity === s).length} />
                ))}
              </div>
              <Section title={`New findings (${created.length})`} description="Each finding includes evidence, library mapping, root-cause hypotheses and remediation" className="!shadow-none">
                <ul className="divide-y divide-border">
                  {created.slice(0, 8).map((f) => (
                    <li key={f.id} className="flex items-center gap-3 py-2 text-[13px]">
                      <SeverityBadge severity={f.severity} />
                      <Link to={`/operations/findings/${f.id}`} className="min-w-0 flex-1 truncate text-primary hover:underline">
                        <span className="font-mono text-[11px] text-muted">{f.id}</span> {f.title}
                      </Link>
                    </li>
                  ))}
                  {!created.length && <li className="py-2 text-xs text-muted">No new findings in this run.</li>}
                </ul>
              </Section>
            </>
          )}
        </div>
      )}
    </StepCard>
  )
}
