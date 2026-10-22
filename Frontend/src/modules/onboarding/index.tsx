import * as React from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, ArrowLeft, ArrowRight, Bell, Check, CheckCircle2, ChevronDown, CircleDashed, ClipboardPaste, Clock, FolderKanban, Globe, ListChecks, Loader2, Play, Plug, Plus, RefreshCw, Save, ShieldCheck, Trash2, Wand2, Wrench, XCircle } from 'lucide-react'
import type { Asset, AssetLink, BusinessService, Finding, Integration } from '@/types'
import { useAction, useCan, useCollections, useCurrentUser, useUsers } from '@/hooks/queries'
import { usePage } from '@/hooks/usePage'
import { Callout, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/common/layout'
import { Badge } from '@/components/common/badges'
import { AssetMap } from '@/components/common/AssetMap'
import { Term } from '@/components/common/Term'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Checkbox, Progress } from '@/components/ui/misc'
import * as api from '@/services/api'
import { deriveLinks } from '@/data/seed/projects'
import { cn, fmtDateTime, fmtRelative, plural } from '@/utils/format'
import { SEVERITY_ORDER } from '@/utils/labels'
import { APP_TYPE_PLAIN, ASSET_PLAIN, assetLabel, findingPlain, SEVERITY_PLAIN, TOOL_ACCESS } from '@/utils/plain'
import { projectRoleOf } from '@/utils/permissions'
import { useDbStore } from '@/stores/db'
import { JOURNEY, stepFromStatus } from './journey'
import { ConnectToolDialog, toolName } from './ConnectTool'

export const APP_TYPES: { type: BusinessService['appType']; blurb: string }[] = (['Web application', 'API service', 'Cloud workload', 'Data platform', 'SaaS workspace', 'AI application'] as const).map((type) => ({ type, blurb: APP_TYPE_PLAIN[type].example }))

export function OnboardingPage() {
  usePage('Protect an application', [{ label: 'Projects' }, { label: 'Protect an application' }])
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
  // Move focus to the new step so keyboard and screen-reader users follow along.
  const panel = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { panel.current?.querySelector<HTMLElement>('h2')?.focus() }, [current])

  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={8} />
  if (!canOnboard)
    return (
      <Card>
        <EmptyState icon={<ShieldCheck />} title="Setting up protection needs an administrator or project owner" description="Your role can see protected applications but can't add new ones. Ask for access and we'll notify the right person." action={<Button asChild variant="secondary"><Link to="/admin/requests?new=1">Ask for access</Link></Button>} />
      </Card>
    )
  if (appId && !app) return <Card><EmptyState title="We couldn't find that application" description="It may have been removed, or the demo data was reset." action={<Button asChild variant="secondary"><Link to="/onboarding?new=1">Start again</Link></Button>} /></Card>

  const appAssets = app ? data.assets.filter((a) => a.businessServiceId === app.id) : []
  const maxReachable = app ? derived : projectId ? 1 : 0
  const go = (n: number) => setStep(Math.min(n, maxReachable))
  const protectedNow = app?.status === 'active' || app?.status === 'paused'
  const minutesLeft = JOURNEY.slice(current).reduce((s, j) => s + j.minutes, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title={app ? (protectedNow ? `${app.name} is protected` : `Protect ${app.name}`) : 'Protect an application'}
        description={app ? `${data.projects.find((p) => p.id === app.projectId)?.name} · ${APP_TYPE_PLAIN[app.appType]?.title ?? app.appType}` : 'About 10 minutes. Read-only — nothing in your systems changes. Your progress is saved, so you can stop and come back anytime.'}
        icon={<ShieldCheck />}
        badges={protectedNow ? <Badge tone="emerald">Protection on</Badge> : app ? <Badge tone="violet">Setting up</Badge> : undefined}
      />
      {/* Compact progress for small screens */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-medium">Step {current + 1} of {JOURNEY.length} · {JOURNEY[current].label}</span>
          {!protectedNow && <span className="text-muted">~{minutesLeft} min left</span>}
        </div>
        <Progress value={((protectedNow ? JOURNEY.length : current) / JOURNEY.length) * 100} className="mt-2" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[270px_1fr]">
        <Card className="hidden h-fit p-3 lg:block">
          <ol className="space-y-1">
            {JOURNEY.map((s, i) => {
              const done = i < maxReachable || protectedNow
              const reachable = i <= maxReachable
              return (
                <li key={s.key}>
                  <button disabled={!reachable} onClick={() => go(i)} aria-current={current === i ? 'step' : undefined} className={cn('flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left enabled:cursor-pointer', current === i ? 'bg-primary-soft' : reachable ? 'hover:bg-surface-2' : 'opacity-50')}>
                    <span className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold', done && current !== i ? 'border-emerald-500 bg-emerald-500 text-white' : current === i ? 'border-primary bg-primary text-white' : 'border-border-strong text-muted')}>{done && current !== i ? <Check className="size-3.5" /> : i + 1}</span>
                    <span>
                      <span className={cn('block text-[13.5px]', current === i ? 'font-semibold text-fg' : 'font-medium')}>{s.label}</span>
                      <span className="block text-[12px] text-muted">{s.help}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
          {!protectedNow && (
            <div className="mt-2 space-y-1.5 border-t border-border px-3 pt-3 text-[12px] text-muted">
              <div className="flex items-center gap-2"><Clock className="size-3.5" /> About {minutesLeft} min left</div>
              <div className="flex items-center gap-2"><Save className="size-3.5" /> Progress saves automatically</div>
            </div>
          )}
        </Card>
        <div className="min-w-0" ref={panel}>
          {current === 0 && <ProjectStep projects={data.projects} onDone={(pid) => { setProjectId(pid); setParams({ project: pid, ...(params.get('type') ? { type: params.get('type')! } : {}) }); setStep(1) }} initial={projectId} />}
          {current === 1 && (projectId || app) && <ApplicationStep projectId={app?.projectId ?? projectId!} app={app} onBack={() => setStep(0)} onDone={(id) => { setParams({ app: id }); setStep(2) }} />}
          {current === 2 && app && <AssetsStep app={app} assets={appAssets} onDone={() => setStep(3)} />}
          {current === 3 && app && <MapStep app={app} assets={appAssets} onBack={() => setStep(2)} onDone={() => setStep(4)} />}
          {current === 4 && app && <ConnectStep app={app} assets={appAssets} integrations={data.integrations} onBack={() => setStep(3)} onDone={() => setStep(5)} />}
          {current === 5 && app && <TestStep app={app} assets={appAssets} integrations={data.integrations} onFix={() => setStep(4)} onDone={() => setStep(6)} />}
          {current === 6 && app && <FullStep app={app} assets={appAssets} integrations={data.integrations} findings={data.findings} />}
        </div>
      </div>
    </div>
  )
}

function StepCard({ title, description, children, footer }: { title: string; description: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Card>
      <div className="border-b border-border px-5 py-4">
        <h2 tabIndex={-1} className="text-[17px] font-semibold outline-none">{title}</h2>
        <p className="mt-1 text-[13.5px] text-muted">{description}</p>
      </div>
      <div className="px-5 py-5">{children}</div>
      {footer && <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-b-xl border-t border-border bg-surface px-5 py-3.5">{footer}</div>}
    </Card>
  )
}

function ChoiceCard({ selected, onClick, title, sub, icon, disabled }: { selected: boolean; onClick: () => void; title: string; sub?: string; icon?: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={selected} className={cn('flex min-h-11 items-start gap-3 rounded-xl border p-3.5 text-left enabled:cursor-pointer', selected ? 'border-primary bg-primary-soft ring-2 ring-primary/10' : 'border-border enabled:hover:border-border-strong')}>
      {icon && <span className="mt-0.5 text-primary [&_svg]:size-5">{icon}</span>}
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium">{title}</span>
        {sub && <span className="block text-[12px] text-muted">{sub}</span>}
      </span>
      {selected && <CheckCircle2 className="ml-auto size-4 shrink-0 text-primary" />}
    </button>
  )
}

function Disclosure({ label, children, defaultOpen }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-xl border border-border" open={defaultOpen}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-[13px] font-medium [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border px-4 py-4">{children}</div>
    </details>
  )
}

// ---------------------------------------------------------------- 1. Project

function ProjectStep({ projects, onDone, initial }: { projects: { id: string; name: string; description: string }[]; onDone: (id: string) => void; initial: string | null }) {
  const me = useCurrentUser()
  const db = useDbStore((s) => s.db)
  const writable = projects.filter((p) => me.orgRole === 'admin' || ['owner', 'contributor'].includes(projectRoleOf(db, p.id, me.id) ?? ''))
  const [mode, setMode] = React.useState<'existing' | 'new'>(writable.length ? 'existing' : 'new')
  const [pick, setPick] = React.useState(initial ?? writable[0]?.id ?? '')
  const [name, setName] = React.useState('')
  const [desc, setDesc] = React.useState('')
  const { run, pending } = useAction()
  return (
    <StepCard
      title="Where should we keep this?"
      description={<>A <Term k="project">project</Term> is a folder for related applications — for example “Customer Portal” or “Finance systems”. Only people you add can see what's inside.</>}
      footer={
        <>
          <span className="text-[12px] text-muted">Step 1 of {JOURNEY.length}</span>
          <Button
            loading={pending}
            disabled={mode === 'existing' ? !pick : name.trim().length < 3}
            onClick={async () => {
              if (mode === 'existing') return onDone(pick)
              const p = await run(() => api.createProject({ name: name.trim(), description: desc.trim() || 'Created during setup', ownerId: me.id }))
              if (p) onDone(p.id)
            }}
          >
            Continue <ArrowRight />
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {writable.length > 0 && <ChoiceCard selected={mode === 'existing'} onClick={() => setMode('existing')} icon={<FolderKanban />} title="Use a project I already have" sub={`${plural(writable.length, 'project')} you can add to`} />}
        <ChoiceCard selected={mode === 'new'} onClick={() => setMode('new')} icon={<Plus />} title="Create a new project" sub="You'll be its owner and can invite others later" />
      </div>
      <div className="mt-5">
        {mode === 'existing' ? (
          <Field label="Project">
            <NativeSelect value={pick} onChange={(e) => setPick(e.target.value)}>
              {writable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </NativeSelect>
          </Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project name" required error={name && name.trim().length < 3 ? 'Use at least 3 characters' : undefined} hint="Something your team will recognize">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Customer Portal" />
            </Field>
            <Field label="Short description (optional)">
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Everything customers log into" />
            </Field>
          </div>
        )}
      </div>
    </StepCard>
  )
}

// ---------------------------------------------------------------- 2. Application

const appSchema = z.object({
  name: z.string().trim().min(3, 'Give it a name (at least 3 characters)'),
  description: z.string().trim().min(10, 'One sentence is enough — at least 10 characters'),
  appType: z.string().min(1),
  environment: z.enum(['production', 'staging', 'development', 'corporate']),
  criticality: z.enum(['tier-1', 'tier-2', 'tier-3', 'tier-4']),
  dataClassification: z.enum(['Restricted', 'Confidential', 'Internal', 'Public']),
  ownerId: z.string().min(1, 'Choose who is responsible'),
  regulatoryScope: z.string(),
})

const IMPORTANCE = [
  { v: 'tier-1', title: 'The business stops without it', sub: 'Customers or staff can’t work if it’s down' },
  { v: 'tier-2', title: 'Important', sub: 'People rely on it every day' },
  { v: 'tier-3', title: 'Helpful', sub: 'We could manage without it for a while' },
] as const
const DATA_KIND = [
  { v: 'Restricted', title: 'Customer, payment or health data', sub: 'Personal or financial information' },
  { v: 'Confidential', title: 'Internal company data', sub: 'Plans, contracts, staff records' },
  { v: 'Public', title: 'Only public information', sub: 'Nothing private is stored' },
] as const

function ApplicationStep({ projectId, app, onBack, onDone }: { projectId: string; app?: BusinessService; onBack: () => void; onDone: (id: string) => void }) {
  const users = useUsers()
  const me = useCurrentUser()
  const { run } = useAction()
  const [params] = useSearchParams()
  const { register, handleSubmit, formState, watch, setValue } = useForm<z.infer<typeof appSchema>>({
    resolver: zodResolver(appSchema),
    defaultValues: { name: app?.name ?? '', description: app?.description ?? '', appType: app?.appType ?? params.get('type') ?? 'Web application', environment: app?.environment ?? 'production', criticality: app?.criticality ?? 'tier-2', dataClassification: app?.dataClassification ?? 'Confidential', ownerId: app?.ownerId ?? me.id, regulatoryScope: app?.regulatoryScope.join(', ') ?? '' },
  })
  const type = watch('appType') as BusinessService['appType']
  const crit = watch('criticality')
  const dataKind = watch('dataClassification')
  const locked = !!app
  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        if (app) return onDone(app.id)
        const created = await run(() => api.startApplication({ projectId, ...v, appType: v.appType as BusinessService['appType'], regulatoryScope: v.regulatoryScope.split(',').map((x) => x.trim()).filter(Boolean) }))
        if (created) onDone(created.id)
      })}
    >
      <StepCard
        title="Tell us about the application"
        description="This helps DO SAFE decide what to warn you about first. You can change any of it later."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft /> Back</Button>
            <Button type="submit" loading={formState.isSubmitting}>{app ? 'Continue' : 'Save and continue'} <ArrowRight /></Button>
          </>
        }
      >
        <div className="space-y-6">
          <div>
            <div className="mb-2 text-[13px] font-medium">What kind of application is it?</div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {APP_TYPES.map((t) => <ChoiceCard key={t.type} disabled={locked} selected={type === t.type} onClick={() => setValue('appType', t.type)} title={APP_TYPE_PLAIN[t.type].title} sub={t.blurb} />)}
            </div>
          </div>
          <fieldset disabled={locked} className="grid gap-4 sm:grid-cols-2">
            <Field label="What do you call it?" required error={formState.errors.name?.message}>
              <Input {...register('name')} placeholder="e.g. Customer Portal" />
            </Field>
            <Field label="Who is responsible for it?" required error={formState.errors.ownerId?.message} hint="They’ll get notified about urgent problems">
              <NativeSelect {...register('ownerId')}>
                {users.filter((u) => u.status === 'active').map((u) => <option key={u.id} value={u.id}>{u.name} — {u.team}</option>)}
              </NativeSelect>
            </Field>
            <div className="sm:col-span-2">
              <Field label="What does it do, in one sentence?" required error={formState.errors.description?.message}>
                <Textarea rows={2} {...register('description')} placeholder="e.g. Customers log in to see orders and pay invoices." />
              </Field>
            </div>
          </fieldset>
          <div>
            <div className="mb-2 text-[13px] font-medium">How important is it?</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {IMPORTANCE.map((o) => <ChoiceCard key={o.v} disabled={locked} selected={crit === o.v} onClick={() => setValue('criticality', o.v)} title={o.title} sub={o.sub} />)}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[13px] font-medium">What’s the most sensitive information it handles?</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {DATA_KIND.map((o) => <ChoiceCard key={o.v} disabled={locked} selected={dataKind === o.v} onClick={() => setValue('dataClassification', o.v)} title={o.title} sub={o.sub} />)}
            </div>
          </div>
          <Disclosure label="More details (optional — for IT and compliance teams)">
            <fieldset disabled={locked} className="grid gap-4 sm:grid-cols-2">
              <Field label="Environment">
                <NativeSelect {...register('environment')}>
                  <option value="production">Live (production)</option>
                  <option value="staging">Testing (staging)</option>
                  <option value="development">Development</option>
                  <option value="corporate">Internal / corporate</option>
                </NativeSelect>
              </Field>
              <Field label="Exact criticality tier">
                <NativeSelect {...register('criticality')}>
                  <option value="tier-1">Tier 1 — business critical</option>
                  <option value="tier-2">Tier 2 — important</option>
                  <option value="tier-3">Tier 3 — standard</option>
                  <option value="tier-4">Tier 4 — low</option>
                </NativeSelect>
              </Field>
              <Field label="Data classification">
                <NativeSelect {...register('dataClassification')}>
                  <option>Restricted</option><option>Confidential</option><option>Internal</option><option>Public</option>
                </NativeSelect>
              </Field>
              <Field label="Rules it must follow" hint="Comma-separated, e.g. PCI DSS, GDPR">
                <Input {...register('regulatoryScope')} />
              </Field>
            </fieldset>
          </Disclosure>
        </div>
      </StepCard>
    </form>
  )
}

// ---------------------------------------------------------------- 3. Parts (assets)

const ASSET_TYPES = Object.keys(ASSET_PLAIN) as Asset['type'][]

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
  const sugg = suggestionsFor(app).filter((s) => !assets.some((a) => a.name === s.name))
  const [picked, setPicked] = React.useState<string[]>(() => suggestionsFor(app).map((s) => s.name))
  const pickedCount = sugg.filter((s) => picked.includes(s.name)).length
  const parsed = paste.split('\n').map((l) => l.split(',').map((x) => x.trim())).filter((p) => p[0]).map(([name, type, host]) => ({ name, type: (ASSET_TYPES.includes(type as Asset['type']) ? type : 'server') as Asset['type'], environment: app.environment, internetExposed: !!host && !/^10\.|^192\.168\.|^172\./.test(host) && /[a-z]/i.test(host), criticality: app.criticality, fqdn: host && /[a-z]/i.test(host) ? host : undefined, ipAddress: host && !/[a-z]/i.test(host) ? host : undefined }))
  const typeTitle = (APP_TYPE_PLAIN[app.appType]?.title ?? 'application').replace(/^Our /, '')
  return (
    <StepCard
      title="What is it made of?"
      description={<>Most applications are built from a few <Term k="asset">parts</Term> — a website, a database, some code. DO SAFE checks each part. Nothing is checked yet; you’ll review everything first.</>}
      footer={
        <>
          <span className="text-[13px] text-muted">{assets.length + pickedCount ? `${plural(assets.length + pickedCount, 'part')} to protect` : 'Choose at least one part'}</span>
          <Button
            disabled={!assets.length && !pickedCount}
            loading={pending}
            onClick={async () => {
              if (pickedCount) {
                const ok = await run(async () => { await api.declareAssets(app.id, sugg.filter((s) => picked.includes(s.name))); return true })
                if (!ok) return
              }
              onDone()
            }}
          >
            {pickedCount ? `Add ${plural(pickedCount, 'part')} and continue` : 'Continue'} <ArrowRight />
          </Button>
        </>
      }
    >
      {sugg.length > 0 && (
        <div className="rounded-xl border border-border">
          <div className="border-b border-border bg-surface-2 px-4 py-3">
            <div className="text-[13.5px] font-medium">Typical parts of {typeTitle.toLowerCase()}</div>
            <div className="text-[12px] text-muted">A starting template — DO SAFE hasn’t connected to anything yet, so these are not discovered. Untick anything you don’t have.</div>
          </div>
          <ul className="divide-y divide-border">
            {sugg.map((s) => (
              <li key={s.name}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-surface-2/60">
                  <Checkbox checked={picked.includes(s.name)} onCheckedChange={(c) => setPicked(c ? [...picked, s.name] : picked.filter((x) => x !== s.name))} aria-label={`Include ${assetLabel(s.type)} (${s.name})`} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{assetLabel(s.type)}</span>
                    <span className="block truncate text-[12px] text-muted">{ASSET_PLAIN[s.type]?.explain} · <span className="font-mono">{s.name}</span></span>
                  </span>
                  {s.internetExposed && <Badge tone="orange"><Globe className="size-3" /> On the internet</Badge>}
                </label>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 py-2.5 text-[12px] text-muted">You can rename parts or add real addresses later.</div>
        </div>
      )}

      <div className="mt-5">
        {assets.length > 0 && <div className="mb-2 text-[13px] font-semibold">Already added ({assets.length})</div>}
        {assets.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {assets.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">{assetLabel(a.type)}</span>
                  <span className="block truncate text-[12px] text-muted"><span className="font-mono">{a.name}</span>{a.internetExposed ? ' · on the internet' : ''}</span>
                </span>
                {app.status !== 'active' && (
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${a.name}`} onClick={() => run(() => api.removeDeclaredAsset(app.id, a.id), 'Part removed')}><Trash2 /></Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          !sugg.length && <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted">Nothing added yet — add your own parts below.</p>
        )}
      </div>

      <div className="mt-5 space-y-3">
        <Disclosure label="Add something missing">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="What kind of part?">
              <NativeSelect value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Asset['type'] })}>
                {ASSET_TYPES.map((t) => <option key={t} value={t}>{ASSET_PLAIN[t].label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Name" required hint="Whatever your team calls it">
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. portal-web-01" />
            </Field>
            <Field label="Web address or IP (optional)">
              <Input value={draft.fqdn || draft.ipAddress || ''} onChange={(e) => (/[a-z]/i.test(e.target.value) ? setDraft({ ...draft, fqdn: e.target.value, ipAddress: '' }) : setDraft({ ...draft, ipAddress: e.target.value, fqdn: '' }))} placeholder="portal.example.com" />
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-[13px]">
              <Checkbox checked={draft.internetExposed} onCheckedChange={(c) => setDraft({ ...draft, internetExposed: c === true })} /> Anyone on the internet can reach it
            </label>
            <div className="flex items-end sm:col-span-2 sm:justify-end">
              <Button size="sm" disabled={draft.name.trim().length < 2} loading={pending} onClick={async () => { await run(() => api.declareAssets(app.id, [{ ...draft, name: draft.name.trim() }]), `${draft.name} added`); setDraft({ ...draft, name: '', fqdn: '', ipAddress: '' }) }}>
                <Plus /> Add part
              </Button>
            </div>
          </div>
        </Disclosure>
        <Disclosure label="Paste a list (for IT teams)">
          <Field label="One part per line: name, type, address" hint={`Types: ${ASSET_TYPES.join(', ')}`}>
            <Textarea rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'portal-web, web-application, portal.example.com\nportal-db, database, 10.40.2.15'} className="font-mono text-xs" />
          </Field>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[12px] text-muted">{plural(parsed.length, 'line')} recognized</span>
            <Button size="sm" disabled={!parsed.length} loading={pending} onClick={async () => { await run(() => api.declareAssets(app.id, parsed), `${plural(parsed.length, 'part')} added`); setPaste('') }}><ClipboardPaste /> Add {parsed.length || ''}</Button>
          </div>
        </Disclosure>
      </div>
    </StepCard>
  )
}

// ---------------------------------------------------------------- 4. Map

function MapStep({ app, assets, onBack, onDone }: { app: BusinessService; assets: Asset[]; onBack: () => void; onDone: () => void }) {
  // Start from a suggested map so nobody faces a blank canvas.
  const [links, setLinks] = React.useState<AssetLink[]>(() => (app.assetLinks.length ? app.assetLinks : deriveLinks(assets, `SUG-${app.id}`)))
  const suggested = !app.assetLinks.length
  // Parts added on the previous step can arrive a moment after this step mounts — draw the suggestion once they do.
  const seeded = React.useRef(links.length > 0)
  React.useEffect(() => {
    if (!seeded.current && suggested && assets.length) {
      seeded.current = true
      setLinks(deriveLinks(assets, `SUG-${app.id}`))
    }
  }, [assets, suggested, app.id])
  const { run, pending } = useAction()
  const needsLinks = assets.length > 1 && links.length === 0
  return (
    <StepCard
      title="How do the parts connect?"
      description={<>This shows which parts talk to each other — for example, the website reads from the database. It helps DO SAFE tell how far a problem could spread. <Term k="map">Why it matters</Term></>}
      footer={
        <>
          <Button variant="ghost" onClick={onBack}><ArrowLeft /> Back</Button>
          <Button disabled={needsLinks} loading={pending} onClick={async () => { await run(() => api.saveAssetLinks(app.id, links.map(({ sourceAssetId, targetAssetId, relation }) => ({ sourceAssetId, targetAssetId, relation })))); onDone() }}>
            Looks right — continue <ArrowRight />
          </Button>
        </>
      }
    >
      {suggested && links.length > 0 && (
        <div className="mb-3"><Callout tone="info" icon={<Wand2 />} title="We drew a suggested map for you">Based on the kinds of parts you added. Not sure? The suggestion is fine — you can adjust it anytime.</Callout></div>
      )}
      <AssetMap assets={assets} links={links} editable onChange={setLinks} height={420} />
      {needsLinks && <p className="mt-2 text-[13px] text-amber-700">Add at least one connection (or click “Suggest connections”) to continue.</p>}
    </StepCard>
  )
}

// ---------------------------------------------------------------- 5. Connect tools

const SOURCE_FIT: Record<string, Asset['type'][] | 'internet'> = {
  'INT-WIZ': ['container', 'kubernetes-cluster', 'cloud-storage', 'serverless-function', 'database', 'server', 'api-gateway', 'web-application'],
  'INT-TEN': ['server', 'network-device', 'web-application', 'api-gateway', 'database'],
  'INT-CRW': ['server', 'endpoint', 'container'],
  'INT-GHB': ['code-repository'],
  'INT-OKT': ['identity-provider', 'saas-application'],
  'INT-NSK': ['saas-application'],
  'INT-QLY': ['server', 'endpoint', 'database'],
  'INT-ASM': 'internet',
}

function fits(src: string, a: Asset) {
  const f = SOURCE_FIT[src]
  return f === 'internet' ? a.type !== 'code-repository' : f.includes(a.type)
}

/** The smallest sensible tool set: one inside-view tool per part, plus the outside-in monitor for internet-facing parts. */
function recommend(assets: Asset[], integrations: Integration[]) {
  const pref = ['INT-WIZ', 'INT-GHB', 'INT-OKT', 'INT-NSK', 'INT-TEN', 'INT-CRW', 'INT-QLY']
  return Object.fromEntries(assets.map((a) => {
    const picks = pref.filter((s) => fits(s, a)).slice(0, 1)
    if (a.internetExposed) picks.push('INT-ASM')
    return [a.id, picks.filter((s) => integrations.some((i) => i.id === s))]
  }))
}

function coverageGaps(assets: Asset[], coverage: Record<string, string[]>, integrations: Integration[]) {
  const connected = (id: string) => integrations.find((i) => i.id === id)?.status === 'connected'
  const uncovered = assets.filter((a) => !(coverage[a.id] ?? []).length)
  const waiting = assets.filter((a) => (coverage[a.id] ?? []).length && !(coverage[a.id] ?? []).some(connected))
  const checked = assets.length - uncovered.length - waiting.length
  return { uncovered, waiting, checked }
}

function ConnectStep({ app, assets, integrations, onBack, onDone }: { app: BusinessService; assets: Asset[]; integrations: Integration[]; onBack: () => void; onDone: () => void }) {
  const [coverage, setCoverage] = React.useState<Record<string, string[]>>(() => (Object.values(app.coverage).some((v) => v.length) ? app.coverage : recommend(assets, integrations)))
  // Recommend tools for any part that arrived after this step mounted.
  React.useEffect(() => {
    const missing = assets.filter((a) => !(a.id in coverage))
    if (missing.length) setCoverage((c) => ({ ...c, ...recommend(missing, integrations) }))
  }, [assets]) // eslint-disable-line react-hooks/exhaustive-deps
  const { run, pending } = useAction()
  const [dialog, setDialog] = React.useState<string | null>(null)
  const [confirm, setConfirm] = React.useState(false)
  const order = Object.keys(SOURCE_FIT)
  const used = order.filter((id) => Object.values(coverage).some((v) => v.includes(id)))
  const tools = used.map((id) => integrations.find((i) => i.id === id)!).filter(Boolean)
  const { uncovered, waiting, checked } = coverageGaps(assets, coverage, integrations)
  const notConnected = tools.filter((t) => t.status !== 'connected')
  const toggle = (assetId: string, src: string) => setCoverage((c) => ({ ...c, [assetId]: (c[assetId] ?? []).includes(src) ? c[assetId].filter((x) => x !== src) : [...(c[assetId] ?? []), src] }))
  const partsFor = (toolId: string) => assets.filter((a) => (coverage[a.id] ?? []).includes(toolId))
  const save = async () => { const ok = await run(async () => { await api.saveCoverage(app.id, coverage); return true }); if (ok) onDone() }
  const dialogTool = integrations.find((i) => i.id === dialog) ?? null
  return (
    <StepCard
      title="Connect your security tools"
      description={<>DO SAFE doesn’t install anything. It reads results from <Term k="source">tools</Term> you already use, with <Term k="readOnly">read-only access</Term>. You’ll see exactly what each tool shares before you connect it.</>}
      footer={
        <>
          <Button variant="ghost" onClick={onBack}><ArrowLeft /> Back</Button>
          <Button loading={pending} disabled={checked === 0 && uncovered.length === assets.length} onClick={() => (uncovered.length || waiting.length ? setConfirm(true) : save())}>
            Continue to test run <ArrowRight />
          </Button>
        </>
      }
    >
      <div className="rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-[14px] font-semibold">{checked} of {plural(assets.length, 'part')} will be checked</div>
          <span className="text-[12px] text-muted">{notConnected.length ? `${plural(notConnected.length, 'tool')} still to connect` : 'All recommended tools are connected'}</span>
        </div>
        <Progress value={(checked / Math.max(1, assets.length)) * 100} tone={checked === assets.length ? 'emerald' : 'violet'} className="mt-2" />
      </div>

      <div className="mt-4 text-[13px] font-medium">We recommend {plural(tools.length, 'tool')} to check every part</div>
      <ul className="mt-2 grid gap-3 md:grid-cols-2">
        {tools.map((t) => {
          const parts = partsFor(t.id)
          return (
            <li key={t.id} className={cn('flex flex-col rounded-xl border p-4', t.status === 'connected' ? 'border-emerald-200 bg-emerald-50/40' : 'border-border')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[14px] font-semibold">{toolName(t)}</div>
                  <div className="text-[12.5px] text-muted">{TOOL_ACCESS[t.id]?.does ?? t.description}</div>
                </div>
                {t.status === 'connected' && <Badge tone="emerald"><CheckCircle2 className="size-3" /> Connected</Badge>}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {parts.map((a) => <span key={a.id} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11.5px] text-muted">{assetLabel(a.type)}</span>)}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 pt-1">
                <span className="text-[12px] text-muted">{t.status === 'connected' ? 'Read-only access' : `About ${TOOL_ACCESS[t.id]?.minutes ?? 2} min · ${TOOL_ACCESS[t.id]?.approver ?? 'Administrator'}`}</span>
                <Button size="sm" variant={t.status === 'connected' ? 'ghost' : 'default'} onClick={() => setDialog(t.id)}>
                  {t.status === 'connected' ? 'View access' : <><Plug /> Review access & connect</>}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      {uncovered.length > 0 && (
        <div className="mt-4">
          <Callout tone="warn" icon={<AlertTriangle />} title={`${plural(uncovered.length, 'part')} won’t be checked by any tool`}>
            {uncovered.map((a) => assetLabel(a.type)).join(', ')}. <button className="font-semibold underline cursor-pointer" onClick={() => setCoverage((c) => ({ ...c, ...Object.fromEntries(uncovered.map((a) => [a.id, recommend([a], integrations)[a.id]])) }))}>Use the recommended tools</button>
          </Callout>
        </div>
      )}

      <div className="mt-4">
        <Disclosure label="Choose which tool checks each part (advanced)">
          <div className="mb-3 flex justify-end"><Button size="sm" variant="secondary" onClick={() => setCoverage(recommend(assets, integrations))}><RefreshCw /> Reset to recommended</Button></div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-[12.5px]">
              <thead className="bg-surface-2">
                <tr>
                  <th className="sticky left-0 min-w-[200px] bg-surface-2 px-3 py-2 text-left text-[11.5px] font-semibold text-muted">Part</th>
                  {order.map((id) => integrations.find((i) => i.id === id)).filter(Boolean).map((s) => (
                    <th key={s!.id} className="min-w-[110px] px-2 py-2 text-center align-bottom">
                      <div className="text-[12px] font-medium leading-tight">{toolName(s!)}</div>
                      {s!.status === 'connected' ? <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-700"><CheckCircle2 className="size-3" /> Connected</span> : <button className="mt-1 text-[11px] text-primary underline cursor-pointer" onClick={() => setDialog(s!.id)}>Connect</button>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assets.map((a) => (
                  <tr key={a.id}>
                    <td className="sticky left-0 min-w-[200px] bg-surface px-3 py-2">
                      <div className="font-medium">{assetLabel(a.type)}</div>
                      <div className="font-mono text-[11px] text-muted">{a.name}</div>
                    </td>
                    {order.filter((id) => integrations.some((i) => i.id === id)).map((sid) => (
                      <td key={sid} className="px-2 py-2 text-center">
                        {fits(sid, a) ? <Checkbox checked={(coverage[a.id] ?? []).includes(sid)} onCheckedChange={() => toggle(a.id, sid)} aria-label={`${sid} checks ${a.name}`} className="mx-auto" /> : <span className="text-subtle" aria-label="Not compatible">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Disclosure>
      </div>

      <ConnectToolDialog integration={dialogTool} appName={app.name} parts={dialogTool ? partsFor(dialogTool.id).map((a) => a.name) : []} open={!!dialog} onOpenChange={(v) => !v && setDialog(null)} />

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title="Some parts won’t be checked yet" description="The test run will flag these. It’s usually quicker to fix them now.">
          <ul className="space-y-2 text-[13px]">
            {notConnected.map((t) => <li key={t.id} className="flex gap-2"><Plug className="mt-0.5 size-4 text-amber-600" /> {toolName(t)} isn’t connected — it would check {plural(partsFor(t.id).length, 'part')}.</li>)}
            {uncovered.length > 0 && <li className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 text-amber-600" /> {plural(uncovered.length, 'part')} {uncovered.length === 1 ? 'has' : 'have'} no tool at all: {uncovered.map((a) => assetLabel(a.type)).join(', ')}.</li>}
          </ul>
          <DialogFooter>
            <Button variant="secondary" loading={pending} onClick={async () => { setConfirm(false); await save() }}>Continue anyway</Button>
            <Button onClick={() => setConfirm(false)}>Fix it now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StepCard>
  )
}

// ---------------------------------------------------------------- 6. Test run

function RunPanel({ run }: { run: BusinessService['runs'][number] }) {
  const done = run.steps.filter((s) => s.status === 'done' || s.status === 'warning').length
  const label = run.kind === 'test' ? 'Test run' : 'Protection check'
  const state = run.status === 'running' ? 'in progress' : run.status === 'failed' ? 'needs attention' : run.status === 'passed' ? 'passed' : 'done'
  return (
    <div className="rounded-xl border border-border" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-[13.5px] font-medium">
          {run.status === 'running' ? <Loader2 className="size-4 animate-spin text-primary" /> : run.status === 'failed' ? <XCircle className="size-4 text-red-600" /> : <CheckCircle2 className="size-4 text-emerald-600" />}
          {label} · {state}
        </div>
        <span className="text-[12px] text-muted">{fmtDateTime(run.startedAt)} · simulated</span>
      </div>
      <div className="space-y-2 px-4 py-3">
        <Progress value={(done / run.steps.length) * 100} tone={run.status === 'failed' ? 'red' : run.status === 'running' ? 'violet' : 'emerald'} />
        <ol className="grid gap-1.5 sm:grid-cols-2">
          {run.steps.map((s) => (
            <li key={s.name} className="flex items-center gap-2 text-[13px]">
              {s.status === 'done' ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : s.status === 'running' ? <Loader2 className="size-3.5 animate-spin text-primary" /> : s.status === 'warning' ? <AlertTriangle className="size-3.5 text-amber-600" /> : s.status === 'failed' ? <XCircle className="size-3.5 text-red-600" /> : <CircleDashed className="size-3.5 text-subtle" />}
              <span className={s.status === 'pending' ? 'text-muted' : ''}>{s.name}</span>
            </li>
          ))}
        </ol>
        {run.status !== 'running' && <p className="pt-1 text-[13.5px] text-muted">{run.summary}</p>}
      </div>
    </div>
  )
}

function TestStep({ app, assets, integrations, onFix, onDone }: { app: BusinessService; assets: Asset[]; integrations: Integration[]; onFix: () => void; onDone: () => void }) {
  const canRun = useCan('run_scans')
  const { run, pending } = useAction()
  const [dialog, setDialog] = React.useState<string | null>(null)
  const last = app.runs.find((r) => r.kind === 'test')
  const running = app.runs.some((r) => r.status === 'running')
  const failedResults = last?.status === 'failed' ? last.assetResults.filter((r) => !r.reachable || !r.credentialsOk) : []
  const toConnect = [...new Set(failedResults.flatMap((r) => r.sourceIds))].map((id) => integrations.find((i) => i.id === id)!).filter((i) => i && i.status !== 'connected')
  const fixedTools = [...new Set(failedResults.flatMap((r) => r.sourceIds))].map((id) => integrations.find((i) => i.id === id)!).filter((i) => i && i.status === 'connected')
  const noTool = failedResults.filter((r) => !r.sourceIds.length)
  const passed = app.status === 'test_passed' || app.status === 'active'
  const dialogTool = integrations.find((i) => i.id === dialog) ?? null
  const nameOf = (id: string) => { const a = assets.find((x) => x.id === id); return a ? assetLabel(a.type) : id }
  return (
    <StepCard
      title="Test run — a safe check before we start"
      description={<>We make sure DO SAFE can reach every part and that each tool’s access works. <strong className="font-medium text-fg">Nothing in your systems changes</strong>, and no problems are reported yet. It takes about a minute.</>}
      footer={
        <>
          <Button variant={passed ? 'ghost' : last ? 'default' : 'default'} disabled={!canRun || running} loading={pending} onClick={() => run(() => api.startTestRun(app.id))}>
            <Play /> {last ? 'Run the test again' : 'Start test run'}
          </Button>
          <Button variant={passed ? 'default' : 'secondary'} disabled={!passed || running} onClick={onDone}>Continue <ArrowRight /></Button>
        </>
      }
    >
      {!last ? (
        <ul className="grid gap-3 sm:grid-cols-3">
          {[[ListChecks, `${plural(assets.length, 'part')} to check`], [Plug, `${plural(new Set(Object.values(app.coverage).flat()).size, 'tool')} involved`], [ShieldCheck, 'Read-only — reports no problems yet']].map(([Icon, t]) => {
            const I = Icon as typeof ListChecks
            return <li key={t as string} className="flex items-center gap-3 rounded-xl border border-border p-4 text-[13.5px]"><I className="size-5 text-primary" /> {t as string}</li>
          })}
        </ul>
      ) : (
        <div className="space-y-4">
          <RunPanel run={last} />
          {last.status === 'failed' && (
            <div role="region" aria-label="How to fix it" className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex items-center gap-2 text-[14px] font-semibold"><Wrench className="size-4 text-amber-700" /> How to fix it</div>
              <ol className="mt-2 space-y-2.5 text-[13.5px]">
                {toConnect.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>Connect <strong className="font-medium">{toolName(t)}</strong> — it checks {failedResults.filter((r) => r.sourceIds.includes(t.id)).map((r) => nameOf(r.assetId)).join(', ')}.</span>
                    <Button size="sm" onClick={() => setDialog(t.id)}><Plug /> Connect {toolName(t)}</Button>
                  </li>
                ))}
                {fixedTools.map((t) => <li key={t.id} className="flex items-center gap-2 text-emerald-800"><CheckCircle2 className="size-4" /> {toolName(t)} is connected now.</li>)}
                {noTool.length > 0 && (
                  <li className="flex flex-wrap items-center justify-between gap-2">
                    <span>{plural(noTool.length, 'part')} {noTool.length === 1 ? 'has' : 'have'} no tool: {noTool.map((r) => nameOf(r.assetId)).join(', ')}.</span>
                    <Button size="sm" variant="secondary" onClick={onFix}>Choose tools</Button>
                  </li>
                )}
              </ol>
              <p className="mt-3 text-[12.5px] text-muted">When you’re done, click <strong className="font-medium">Run the test again</strong>.</p>
            </div>
          )}
          {last.status !== 'running' && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-[13px]">
                <thead className="bg-surface-2 text-left text-[12px] text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Part</th>
                    <th className="px-3 py-2 font-medium">Can we reach it?</th>
                    <th className="px-3 py-2 font-medium">Does access work?</th>
                    <th className="px-3 py-2 font-medium">What to do</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {last.assetResults.map((r) => {
                    const ok = r.reachable && r.credentialsOk
                    return (
                      <tr key={r.assetId} className={ok ? '' : 'bg-red-50/50'}>
                        <td className="px-3 py-2"><div className="font-medium">{nameOf(r.assetId)}</div><div className="font-mono text-[11px] text-muted">{assets.find((a) => a.id === r.assetId)?.name}</div></td>
                        <td className="px-3 py-2">{r.reachable ? <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="size-4" /> Yes</span> : <span className="inline-flex items-center gap-1 text-red-700"><XCircle className="size-4" /> No</span>}</td>
                        <td className="px-3 py-2">{r.credentialsOk ? <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="size-4" /> Yes</span> : <span className="inline-flex items-center gap-1 text-red-700"><XCircle className="size-4" /> No</span>}</td>
                        <td className={cn('px-3 py-2', ok ? 'text-muted' : 'text-red-800')}>{ok ? 'Nothing — ready' : r.note}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      <ConnectToolDialog integration={dialogTool} appName={app.name} parts={dialogTool ? assets.filter((a) => (app.coverage[a.id] ?? []).includes(dialogTool.id)).map((a) => a.name) : []} open={!!dialog} onOpenChange={(v) => !v && setDialog(null)} />
    </StepCard>
  )
}

// ---------------------------------------------------------------- 7. Turn on protection (full run)

function FullStep({ app, assets, integrations, findings }: { app: BusinessService; assets: Asset[]; integrations: Integration[]; findings: Finding[] }) {
  const canRun = useCan('run_scans')
  const { run, pending } = useAction()
  const last = app.runs.find((r) => r.kind === 'full')
  const running = app.runs.some((r) => r.status === 'running')
  const toolIds = [...new Set(Object.values(app.coverage).flat())]
  const connectedTools = toolIds.map((id) => integrations.find((i) => i.id === id)).filter((i) => i?.status === 'connected') as Integration[]
  const protectedNow = (app.status === 'active' || app.status === 'paused') && last?.status === 'completed'
  if (protectedNow && last) return <ProtectionOn app={app} assets={assets} tools={connectedTools} findings={findings.filter((f) => last.findingIds.includes(f.id))} />
  return (
    <StepCard
      title="Turn on protection"
      description={<>This is the <Term k="full">full run</Term>: DO SAFE checks every part properly for the first time, then keeps checking automatically every day.</>}
      footer={
        <>
          <span className="text-[12.5px] text-muted">Read-only · nothing in your systems changes</span>
          <Button size="lg" disabled={!canRun || running} loading={pending} onClick={() => run(() => api.startFullRun(app.id))}>
            <ShieldCheck /> Turn on protection
          </Button>
        </>
      }
    >
      {!last || last.status !== 'running' ? (
        <div className="space-y-4">
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              [ListChecks, `Checks all ${plural(assets.length, 'part')}`, 'Website, data, code and the rest'],
              [Plug, `Uses ${plural(connectedTools.length, 'connected tool')}`, connectedTools.map(toolName).join(', ')],
              [Clock, 'Takes about 5 minutes', 'A few seconds in this demo'],
              [Bell, 'Tells you what to fix first', 'Every problem comes with plain instructions'],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof ListChecks
              return (
                <li key={t as string} className="flex gap-3 rounded-xl border border-border p-4">
                  <I className="mt-0.5 size-5 shrink-0 text-primary" />
                  <span><span className="block text-[13.5px] font-medium">{t as string}</span><span className="block text-[12.5px] text-muted">{d as string}</span></span>
                </li>
              )
            })}
          </ul>
          <p className="text-[12.5px] text-muted">In this prototype the check is simulated — problems are generated from realistic examples for the parts you added.</p>
        </div>
      ) : (
        <RunPanel run={last} />
      )}
    </StepCard>
  )
}

function ProtectionOn({ app, assets, tools, findings }: { app: BusinessService; assets: Asset[]; tools: Integration[]; findings: Finding[] }) {
  const navigate = useNavigate()
  const { run, pending } = useAction()
  const sorted = [...findings].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
  const urgent = findings.filter((f) => f.severity === 'critical').length
  const soon = findings.filter((f) => f.severity === 'high').length
  const checked = assets.filter((a) => (app.coverage[a.id] ?? []).some((s) => tools.some((t) => t.id === s))).length
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex flex-col items-center bg-gradient-to-b from-emerald-50 to-surface px-6 py-8 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"><ShieldCheck className="size-8" /></span>
          <h2 tabIndex={-1} className="mt-4 text-[26px] font-semibold tracking-tight outline-none">Protection is on</h2>
          <p className="mt-1 max-w-lg text-[14px] text-muted">{app.name} is now a <Term k="safe">protected application</Term>. DO SAFE checks it every day and tells you as soon as something needs attention.</p>
        </div>
        <dl className="grid grid-cols-2 divide-x divide-y divide-border border-t border-border sm:grid-cols-4 sm:divide-y-0">
          {[
            ['Parts checked', `${checked} of ${assets.length}`],
            ['Tools connected', `${tools.length} · read-only`],
            ['Last check', fmtRelative(app.runs[0]?.finishedAt) || 'Just now'],
            ['Next check', app.nextRunAt ? fmtDateTime(app.nextRunAt) : 'Tomorrow'],
          ].map(([k, v]) => (
            <div key={k} className="px-4 py-3">
              <dt className="text-[12px] text-muted">{k}</dt>
              <dd className="mt-0.5 text-[15px] font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="p-5">
        <h3 className="text-[15px] font-semibold">What we found</h3>
        <p className="mt-1 text-[13.5px] text-muted">
          {findings.length === 0 ? 'No problems found. Nice work.' : urgent ? `${plural(urgent, 'urgent problem')} to fix today${soon ? `, and ${soon} more this week` : ''}. Each one comes with step-by-step instructions.` : `${plural(findings.length, 'problem')} found, none urgent. Each one comes with step-by-step instructions.`}
        </p>
        <ul className="mt-3 divide-y divide-border">
          {sorted.slice(0, 5).map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className={cn('rounded-md px-2 py-0.5 text-[12px] font-semibold', f.severity === 'critical' ? 'bg-red-50 text-red-700' : f.severity === 'high' ? 'bg-orange-50 text-orange-700' : 'bg-amber-50 text-amber-800')}>{SEVERITY_PLAIN[f.severity].label}</span>
              <span className="min-w-0 flex-1 text-[13.5px]"><span className="font-medium">{findingPlain(f)}</span> <span className="text-muted">— on the {assetLabel(assets.find((a) => a.id === f.assetId)?.type ?? '').toLowerCase()}</span><span className="block truncate text-[12px] text-muted">{SEVERITY_PLAIN[f.severity].when} · {f.title}</span></span>
              <Link to={`/operations/findings/${f.id}`} className="text-[13px] font-medium text-primary hover:underline">See how to fix →</Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <h3 className="text-[15px] font-semibold">What happens next</h3>
        <ul className="mt-2 space-y-2 text-[13.5px] text-muted">
          <li className="flex gap-2"><RefreshCw className="mt-0.5 size-4 shrink-0 text-primary" /> DO SAFE checks {app.name} every day — you don’t need to do anything.</li>
          <li className="flex gap-2"><Bell className="mt-0.5 size-4 shrink-0 text-primary" /> You’ll get a notification for anything urgent.</li>
          <li className="flex gap-2"><Plus className="mt-0.5 size-4 shrink-0 text-primary" /> Protect another application anytime from Home.</li>
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="lg" onClick={() => navigate('/home')}>Go to Home <ArrowRight /></Button>
          <Button size="lg" variant="secondary" onClick={() => navigate(`/applications/${app.id}`)}>See all problems</Button>
          <Button size="lg" variant="ghost" loading={pending} onClick={() => run(() => api.startFullRun(app.id), 'Checking again')}><RefreshCw /> Check again now</Button>
        </div>
      </Card>
    </div>
  )
}
