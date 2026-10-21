import * as React from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Activity, ArrowRight, BookOpen, CheckCircle2, CircleHelp, FileSearch, GitBranch, LifeBuoy, Network, Plus, Search, Send, ShieldCheck, Ticket, UserCog, Building2, PlayCircle, Filter } from 'lucide-react'
import type { SupportTicket } from '@/types'
import { useAction, useCollections, useCurrentUser } from '@/hooks/queries'
import { usePage } from '@/hooks/usePage'
import { Callout, EmptyState, ErrorState, KeyValue, LoadingState, PageHeader, Section } from '@/components/common/layout'
import { Badge } from '@/components/common/badges'
import { RelTime, UserName } from '@/components/common/entities'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import * as api from '@/services/api'
import { useDbStore } from '@/stores/db'
import { cn } from '@/utils/format'
import { GLOSSARY } from '@/utils/plain'

// ---------------------------------------------------------------- Support center

const STATUS_STEPS: { key: SupportTicket['status']; label: string }[] = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'triage', label: 'Triage' },
  { key: 'investigating', label: 'Investigating' },
  { key: 'resolved', label: 'Resolved' },
]
const STATUS_TONE: Record<SupportTicket['status'], 'slate' | 'sky' | 'violet' | 'amber' | 'emerald'> = { submitted: 'slate', triage: 'sky', investigating: 'violet', waiting_on_you: 'amber', resolved: 'emerald' }
const STATUS_LABEL: Record<SupportTicket['status'], string> = { submitted: 'Submitted', triage: 'Triage', investigating: 'Investigating', waiting_on_you: 'Waiting on you', resolved: 'Resolved' }
const CATEGORIES: SupportTicket['category'][] = ['Onboarding & assets', 'Connectors & scans', 'Access & permissions', 'Findings & tickets', 'Billing & account', 'Other']

export function SupportPage() {
  usePage('Help & Support', [{ label: 'Help & Support' }])
  const [params, setParams] = useSearchParams()
  const me = useCurrentUser()
  const [scope, setScope] = React.useState<'mine' | 'all' | 'open'>('mine')
  const { data, isLoading, error, retry } = useCollections(['supportTickets', 'integrations', 'agents'] as const, { ignoreProjectFilter: true })
  const [selected, setSelected] = React.useState<string | null>(null)
  const creating = params.get('new') === '1'
  const setCreating = (v: boolean) => setParams((p) => { if (v) p.set('new', '1'); else p.delete('new'); return p }, { replace: true })
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={8} />
  const tickets = data.supportTickets.filter((t) => (scope === 'mine' ? t.createdById === me.id : scope === 'open' ? t.status !== 'resolved' : true))
  const current = data.supportTickets.find((t) => t.id === selected) ?? tickets[0]
  const connected = data.integrations.filter((i) => i.status !== 'available')
  const degraded = connected.filter((i) => i.status === 'error' || i.health < 80)
  return (
    <div className="space-y-5">
      <PageHeader title="Help & Support" icon={<LifeBuoy />} description="Raise a support request, follow its progress, and check service status." actions={<Button onClick={() => setCreating(true)}><Plus /> New support request</Button>} />
      <Tabs defaultValue="tickets">
        <TabsList>
          <TabsTrigger value="tickets">My support tickets</TabsTrigger>
          <TabsTrigger value="status">Service status{degraded.length > 0 && <span className="ml-1.5 size-1.5 rounded-full bg-amber-500" />}</TabsTrigger>
          <TabsTrigger value="help">Help topics</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <Card className="overflow-hidden">
              <div className="flex gap-1 border-b border-border p-2">
                {(['mine', 'open', 'all'] as const).map((s) => (
                  <button key={s} onClick={() => setScope(s)} className={cn('rounded-md px-2.5 py-1 text-xs', scope === s ? 'bg-primary-soft font-medium text-primary' : 'text-muted hover:bg-surface-2')}>
                    {s === 'mine' ? 'Raised by me' : s === 'open' ? 'Open' : 'All in workspace'}
                  </button>
                ))}
              </div>
              <ul className="max-h-[560px] divide-y divide-border overflow-y-auto">
                {tickets.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => setSelected(t.id)} className={cn('w-full px-4 py-3 text-left hover:bg-surface-2', current?.id === t.id && 'bg-primary-soft/60')}>
                      <div className="flex items-center justify-between gap-2"><span className="font-mono text-[11px] text-subtle">{t.id}</span><Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge></div>
                      <div className="mt-1 text-[13px] font-medium">{t.title}</div>
                      <div className="mt-0.5 text-[11.5px] text-muted">{t.category} · updated <RelTime iso={t.updatedAt} /></div>
                    </button>
                  </li>
                ))}
                {!tickets.length && <li className="px-4 py-8 text-center text-xs text-muted">No support tickets here.<br /><button className="mt-2 text-primary" onClick={() => setCreating(true)}>Raise a request</button></li>}
              </ul>
            </Card>
            {current ? <TicketDetail ticket={current} /> : <EmptyState title="No support ticket selected" description="Raise a request and the support team will pick it up." action={<Button onClick={() => setCreating(true)}><Plus /> New support request</Button>} />}
          </div>
        </TabsContent>

        <TabsContent value="status" className="mt-4 space-y-4">
          <Callout tone={degraded.length ? 'warn' : 'success'} icon={<Activity />} title={degraded.length ? `${degraded.length} connected source${degraded.length > 1 ? 's' : ''} need attention` : 'All connected sources are healthy'}>
            Service status is derived from your connected integrations and AI agents in this workspace (simulated).
          </Callout>
          <div className="grid gap-4 xl:grid-cols-2">
            <Section title="Connected sources">
              <ul className="divide-y divide-border">
                {connected.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                    <Link to={`/integrations/${i.id}`} className="font-medium hover:text-primary">{i.name}</Link>
                    <span className="flex items-center gap-3 text-xs text-muted">{i.lastSyncAt && <span>synced <RelTime iso={i.lastSyncAt} /></span>}<Badge tone={i.status === 'error' ? 'red' : i.health < 80 ? 'amber' : 'emerald'}>{i.status === 'error' ? 'Error' : i.health < 80 ? 'Degraded' : 'Operational'}</Badge></span>
                  </li>
                ))}
                {!connected.length && <li className="py-4 text-xs text-muted">No sources connected yet — connect them while onboarding an application.</li>}
              </ul>
            </Section>
            <Section title="DO SAFE platform">
              <ul className="divide-y divide-border">
                {['Web application', 'Scan orchestration', 'Findings pipeline', 'Notifications', 'Identity & SSO'].map((n) => (
                  <li key={n} className="flex items-center justify-between py-2.5 text-[13px]">{n}<Badge tone="emerald">Operational</Badge></li>
                ))}
                <li className="flex items-center justify-between py-2.5 text-[13px]">AI agents<Badge tone={data.agents.some((a) => a.status === 'error') ? 'amber' : 'emerald'}>{data.agents.some((a) => a.status === 'error') ? 'Partial' : 'Operational'}</Badge></li>
              </ul>
            </Section>
          </div>
        </TabsContent>

        <TabsContent value="help" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {GUIDES.slice(0, 6).map((g) => (
              <Link key={g.id} to={`/knowledge?guide=${g.id}`} className="rounded-xl border border-border bg-surface p-4 shadow-sm hover:border-primary/40">
                <div className="flex items-center gap-2 font-medium [&_svg]:size-4 [&_svg]:text-primary">{g.icon}{g.title}</div>
                <p className="mt-1 text-xs text-muted">{g.summary}</p>
              </Link>
            ))}
          </div>
          <div className="mt-4 text-right"><Button variant="secondary" asChild><Link to="/knowledge">Open the knowledge base <ArrowRight /></Link></Button></div>
        </TabsContent>
      </Tabs>
      <NewSupportDialog open={creating} onOpenChange={setCreating} onCreated={setSelected} />
    </div>
  )
}

function TicketDetail({ ticket }: { ticket: SupportTicket }) {
  const me = useCurrentUser()
  const projects = useDbStore((s) => s.db.projects)
  const { run, pending } = useAction()
  const [reply, setReply] = React.useState('')
  const stepIdx = ticket.status === 'waiting_on_you' ? 2 : STATUS_STEPS.findIndex((s) => s.key === ticket.status)
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-xs text-subtle">{ticket.id}</div>
          <h2 className="text-lg font-semibold">{ticket.title}</h2>
        </div>
        {ticket.status !== 'resolved' ? (
          <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => api.setSupportStatus(ticket.id, 'resolved'), 'Marked as resolved')}><CheckCircle2 /> Mark resolved</Button>
        ) : (
          <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => api.setSupportStatus(ticket.id, 'investigating'), 'Ticket reopened')}>Reopen</Button>
        )}
      </div>
      <ol className="mt-4 flex items-center gap-2">
        {STATUS_STEPS.map((s, i) => (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold', i <= stepIdx ? 'bg-primary text-white' : 'bg-surface-3 text-subtle')}>{i < stepIdx || ticket.status === 'resolved' ? '✓' : i + 1}</span>
            <span className={cn('text-xs', i <= stepIdx ? 'font-medium text-fg' : 'text-subtle')}>{s.label}</span>
            {i < STATUS_STEPS.length - 1 && <span className={cn('h-px flex-1', i < stepIdx ? 'bg-primary' : 'bg-border')} />}
          </li>
        ))}
      </ol>
      {ticket.status === 'waiting_on_you' && <Callout tone="warn" title="Support is waiting on your reply">Add the requested details below to move this ticket forward.</Callout>}
      <KeyValue className="mt-4" cols={4} items={[
        { label: 'Category', value: ticket.category },
        { label: 'Priority', value: <Badge tone={ticket.priority === 'Urgent' ? 'red' : ticket.priority === 'High' ? 'amber' : 'slate'}>{ticket.priority}</Badge> },
        { label: 'Project', value: projects.find((p) => p.id === ticket.projectId)?.name ?? '—' },
        { label: 'Raised by', value: <UserName id={ticket.createdById} avatar={false} /> },
      ]} />
      {ticket.impact && <p className="mt-3 rounded-lg bg-surface-2 p-3 text-xs text-muted"><span className="font-medium text-fg">Business impact: </span>{ticket.impact}</p>}
      <div className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-subtle">Conversation</div>
      <ul className="mt-2 space-y-3">
        {ticket.messages.map((m) => {
          const support = m.author === 'Support'
          return (
            <li key={m.id} className={cn('rounded-xl border p-3 text-[13px]', support ? 'border-primary/20 bg-primary-soft/50' : 'border-border bg-surface')}>
              <div className="mb-1 flex items-center justify-between text-xs text-muted">{support ? <span className="font-medium text-primary">DO SAFE Support</span> : <UserName id={m.author} avatar={false} />}<RelTime iso={m.at} /></div>
              <p className="whitespace-pre-wrap">{m.text}</p>
            </li>
          )
        })}
      </ul>
      {ticket.status !== 'resolved' && (
        <div className="mt-4 space-y-2">
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder={`Reply as ${me.name}…`} aria-label="Reply" />
          <div className="flex justify-end">
            <Button size="sm" disabled={!reply.trim()} loading={pending} onClick={async () => { await run(() => api.addSupportMessage(ticket.id, reply.trim()), 'Reply sent'); setReply('') }}><Send /> Send reply</Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function NewSupportDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void }) {
  const projects = useDbStore((s) => s.db.projects)
  const currentProjectId = useDbStore((s) => s.db.settings.currentProjectId)
  const { run, pending } = useAction()
  const blank = { title: '', category: 'Onboarding & assets' as SupportTicket['category'], priority: 'Normal' as SupportTicket['priority'], projectId: currentProjectId ?? '', description: '', impact: '' }
  const [f, setF] = React.useState(blank)
  const valid = f.title.trim().length >= 5 && f.description.trim().length >= 10
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New support request" description="Tell us what's blocked. The support team replies in the ticket (simulated reply in this demo).">
        <div className="space-y-4">
          <Field label="Summary" required error={f.title && f.title.trim().length < 5 ? 'At least 5 characters' : undefined}><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Test run fails for the payments gateway" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Category"><NativeSelect value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as SupportTicket['category'] })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field>
            <Field label="Priority"><NativeSelect value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as SupportTicket['priority'] })}>{['Low', 'Normal', 'High', 'Urgent'].map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field>
            <Field label="Project"><NativeSelect value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}><option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect></Field>
          </div>
          <Field label="What happened?" required hint="Steps you took, what you expected and what you saw."><Textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Business impact"><Input value={f.impact} onChange={(e) => setF({ ...f, impact: e.target.value })} placeholder="e.g. Blocks go-live of the treasury portal on Friday" /></Field>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid} loading={pending} onClick={async () => {
            const t = await run(() => api.createSupportTicket({ ...f, title: f.title.trim(), description: f.description.trim(), projectId: f.projectId || undefined }), 'Support request submitted')
            if (t) onCreated(t.id)
            setF(blank)
            onOpenChange(false)
          }}>Submit request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- Knowledge base

interface Guide {
  id: string
  title: string
  category: 'Getting started' | 'Daily work' | 'Administration'
  summary: string
  icon: React.ReactNode
  steps: string[]
  next: { label: string; to: string }[]
}

const GUIDES: Guide[] = [
  { id: 'onboard', title: 'Protect your first application', category: 'Getting started', icon: <PlayCircle />, summary: 'Seven short steps, about 10 minutes. Nothing in your systems changes.', steps: ['Pick a project — a folder that keeps related applications together.', 'Describe your app: what it is, who is responsible, how important it is and what kind of data it handles.', 'List its parts. We suggest the typical parts (website, database, code…); untick what you don’t have and add anything missing.', 'Connect the parts. We draw a suggested map of how they talk to each other — adjust it if needed.', 'Connect your tools. For each tool you see exactly what DO SAFE can read (and that it can change nothing) before you allow read-only access.', 'Test run: a one-minute safe check that every part is reachable. If something isn’t ready, it tells you exactly what to fix.', 'Turn on protection: the full run checks everything, then DO SAFE keeps checking every day. You get a clear “Protection is on” summary and a list of what to fix first.'], next: [{ label: 'Start setup', to: '/onboarding?new=1' }, { label: 'Protected applications', to: '/applications' }] },
  { id: 'map', title: 'Show how the parts connect', category: 'Getting started', icon: <Network />, summary: 'Why the map matters and how to adjust it.', steps: ['Open Asset mapping and pick an application.', 'Click “Suggest connections” — DO SAFE draws the usual connections for the kinds of parts you have.', 'To add one, drag from the dot on the right of a part to another part, and pick what the connection means (for example “reads from”).', 'Click a connection to relabel or remove it.', 'Save. DO SAFE uses the map to tell whether a problem could reach important data.'], next: [{ label: 'Open Asset mapping', to: '/mapping' }] },
  { id: 'runs', title: 'Test run vs turning on protection', category: 'Getting started', icon: <GitBranch />, summary: 'Why there is a quick safe check before the real one.', steps: ['The test run is a dry run. It checks that DO SAFE can reach every part and that each connected tool’s access works.', 'It changes nothing and reports no problems — it only answers “are we ready?”.', 'If a part isn’t ready, the result says why in plain words (for example “Wiz isn’t connected yet”) with a button to fix it.', '“Turn on protection” starts the full run: every part is checked properly, problems are explained and ranked, and daily checks begin.', 'You can pause protection from the application page at any time.'], next: [{ label: 'Protected applications', to: '/applications' }] },
  { id: 'triage', title: 'Triage a finding', category: 'Daily work', icon: <FileSearch />, summary: 'Confirm, assign and ticket the findings that matter first.', steps: ['Start at Prioritization — it ranks findings by exploitability, exposure, asset criticality and business impact.', 'Open a finding to see evidence, the affected asset and the attack path it belongs to.', 'Confirm it, or mark it as a false positive with a reason (that goes to review).', 'Assign an owner and create a remediation ticket with an SLA.', 'Verification re-tests the fix before the finding closes.'], next: [{ label: 'Prioritization', to: '/exposures/prioritization' }, { label: 'Ticket management', to: '/operations/tickets' }] },
  { id: 'fp', title: 'Review a false-positive claim', category: 'Daily work', icon: <ShieldCheck />, summary: 'How false-positive and risk-acceptance decisions are approved.', steps: ['Claims appear in Requests → Security approvals.', 'Read the evidence and the analyst reasoning.', 'Approve to close the finding as false positive, or reject with a note to send it back.', 'Every decision is written to the audit log.'], next: [{ label: 'Security approvals', to: '/requests?tab=approvals' }] },
  { id: 'vendor', title: 'Assess a vendor', category: 'Daily work', icon: <Building2 />, summary: 'Send a questionnaire, score responses and track remediation.', steps: ['Open Third-party risk inside a project.', 'Start an assessment for the vendor and choose a questionnaire.', 'Score responses and attach evidence.', 'Raise remediation items for gaps and track them to closure.'], next: [{ label: 'Third-party risk', to: '/tprm' }] },
  { id: 'access', title: 'Manage access', category: 'Administration', icon: <UserCog />, summary: 'Organization roles decide what someone can do; project membership decides where.', steps: ['Invite people from User management → People.', 'Give them an organization role: Administrator, Security analyst, Project owner or Viewer.', 'Add them to projects with a project role (Owner, Contributor, Viewer).', 'People without access can raise a request from Requests; project owners and admins decide.', 'Use the permission inspector to see why someone can or cannot do something.'], next: [{ label: 'User management', to: '/admin' }, { label: 'Requests', to: '/requests' }] },
  { id: 'support', title: 'Raise a support request', category: 'Administration', icon: <LifeBuoy />, summary: 'Get help from the DO SAFE support team.', steps: ['Open Help & Support and choose "New support request".', 'Pick a category and priority and link the project if relevant.', 'Describe what happened and the business impact.', 'Follow progress: Submitted → Triage → Investigating → Resolved.'], next: [{ label: 'Help & Support', to: '/support?new=1' }] },
]

export function KnowledgePage() {
  usePage('Knowledge base', [{ label: 'Knowledge base' }])
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [q, setQ] = React.useState('')
  const [cat, setCat] = React.useState<Guide['category'] | 'All'>('All')
  const openId = params.get('guide')
  const open = GUIDES.find((g) => g.id === openId)
  const terms = Object.values(GLOSSARY).filter((g) => !q || `${g.term} ${g.plain} ${g.meaning}`.toLowerCase().includes(q.toLowerCase()))
  const list = GUIDES.filter((g) => (cat === 'All' || g.category === cat) && (!q || `${g.title} ${g.summary} ${g.steps.join(' ')}`.toLowerCase().includes(q.toLowerCase())))
  return (
    <div className="space-y-5">
      <PageHeader title="Knowledge base" icon={<BookOpen />} description="Task guides for working in DO SAFE, plus the security knowledge library." actions={<Button variant="secondary" asChild><Link to="/support?new=1"><CircleHelp /> Contact support</Link></Button>} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" placeholder="Search guides and the glossary — e.g. test run, KEV, read-only" aria-label="Search guides" />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
          <Filter className="mx-1 size-3.5 text-subtle" />
          {(['All', 'Getting started', 'Daily work', 'Administration'] as const).map((c) => (
            <button key={c} onClick={() => setCat(c)} className={cn('rounded-md px-2.5 py-1 text-xs', cat === c ? 'bg-primary-soft font-medium text-primary' : 'text-muted hover:bg-surface-2')}>{c}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-2">
          {list.map((g) => (
            <button key={g.id} onClick={() => setParams({ guide: g.id }, { replace: true })} className={cn('flex w-full gap-3 rounded-xl border bg-surface p-4 text-left shadow-sm hover:border-primary/40', open?.id === g.id ? 'border-primary/50 ring-2 ring-primary/10' : 'border-border')}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary [&_svg]:size-4">{g.icon}</span>
              <span>
                <span className="block text-[13.5px] font-medium">{g.title}</span>
                <span className="block text-xs text-muted">{g.summary}</span>
                <span className="mt-1 block text-[11px] text-subtle">{g.category} · {g.steps.length} steps</span>
              </span>
            </button>
          ))}
          {!list.length && <EmptyState search title="No guides match" description="Try a different search, or ask support." />}
          <Link to="/intelligence/library" className="flex items-center justify-between rounded-xl border border-dashed border-border-strong p-4 text-[13px] hover:border-primary/40">
            <span><span className="font-medium">Security knowledge library</span><span className="block text-xs text-muted">Vulnerabilities, techniques, playbooks and control guidance.</span></span>
            <ArrowRight className="size-4 text-subtle" />
          </Link>
        </div>
        {open ? (
          <Card className="h-fit p-5 lg:sticky lg:top-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{open.category}</div>
            <h2 className="mt-1 text-lg font-semibold">{open.title}</h2>
            <p className="mt-1 text-[13px] text-muted">{open.summary}</p>
            <ol className="mt-4 space-y-3">
              {open.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-[13px]">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-2 text-xs font-medium text-muted">Where to go next</div>
              <div className="flex flex-wrap gap-2">
                {open.next.map((n, i) => <Button key={n.to} size="sm" variant={i === 0 ? 'default' : 'secondary'} onClick={() => navigate(n.to)}>{n.label} <ArrowRight /></Button>)}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="flex h-fit flex-col items-center p-8 text-center">
            <Ticket className="size-8 text-subtle" />
            <div className="mt-2 font-medium">Pick a guide</div>
            <p className="mt-1 text-xs text-muted">Each guide lists the steps and links to the exact screen.</p>
          </Card>
        )}
      </div>
      <Card className="p-5" id="glossary">
        <h2 className="text-[15px] font-semibold">Jargon-free glossary</h2>
        <p className="mt-0.5 text-[13px] text-muted">Security words you might see, explained in plain English. {q && `Filtered by “${q}”.`}</p>
        <dl className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">
          {terms.map((g) => (
            <div key={g.term}>
              <dt className="text-[13.5px] font-semibold">{g.plain}{g.term !== g.plain && <span className="font-normal text-muted"> · “{g.term}”</span>}</dt>
              <dd className="mt-0.5 text-[13px] text-muted">{g.meaning}</dd>
            </div>
          ))}
          {!terms.length && <p className="text-[13px] text-muted">No glossary terms match.</p>}
        </dl>
      </Card>
    </div>
  )
}
