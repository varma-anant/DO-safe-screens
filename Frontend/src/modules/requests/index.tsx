import * as React from 'react'
import { useSearchParams } from 'react-router'
import { Check, Inbox, KeyRound, Plus, Scale, X } from 'lucide-react'
import type { AccessRequest, OrgRole } from '@/types'
import { useAction, useCan, useCollections, useCurrentUser } from '@/hooks/queries'
import { usePage } from '@/hooks/usePage'
import { Callout, EmptyState, ErrorState, KeyValue, LoadingState, PageHeader } from '@/components/common/layout'
import { Badge } from '@/components/common/badges'
import { RelTime, UserName } from '@/components/common/entities'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Progress } from '@/components/ui/misc'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApprovalsContent } from '@/modules/operations'
import * as api from '@/services/api'
import { useDbStore } from '@/stores/db'
import { cn, fmtDateTime } from '@/utils/format'
import { ROLE_INFO, projectRoleOf } from '@/utils/permissions'

const ROLE_BY_LABEL: Record<string, OrgRole> = { Administrator: 'admin', 'Security Analyst': 'analyst', 'Project Owner': 'project_owner', Viewer: 'viewer' }
const PROJECT_ROLE_CAPS: Record<string, number> = { Viewer: 0, Contributor: 3, Owner: 5 }

export function RequestsPage() {
  usePage('Requests', [{ label: 'User Management', to: '/admin' }, { label: 'Requests' }])
  const [params, setParams] = useSearchParams()
  const me = useCurrentUser()
  const canApprove = useCan('approve_high_impact')
  const db = useDbStore((s) => s.db)
  const { data, isLoading, error, retry } = useCollections(['accessRequests', 'projects', 'users'] as const, { ignoreProjectFilter: true })
  const [filter, setFilter] = React.useState<'pending' | 'mine' | 'approved' | 'declined' | 'all'>(me.orgRole === 'admin' || me.orgRole === 'project_owner' ? 'pending' : 'mine')
  const [sel, setSel] = React.useState<string | null>(null)
  const [note, setNote] = React.useState('')
  const [newOpen, setNewOpen] = React.useState(params.get('new') === '1')
  const { run, pending } = useAction()
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={8} />
  const canDecide = (r: AccessRequest) => r.requesterId !== me.id && (me.orgRole === 'admin' || (r.kind !== 'Role change' && !!r.projectId && projectRoleOf(db, r.projectId, me.id) === 'owner' && me.orgRole === 'project_owner'))
  const all = data.accessRequests
  const lists = {
    pending: all.filter((r) => r.status === 'pending' && canDecide(r)),
    mine: all.filter((r) => r.requesterId === me.id),
    approved: all.filter((r) => r.status === 'approved' && (canDecide(r) || r.requesterId === me.id || me.orgRole === 'admin')),
    declined: all.filter((r) => r.status === 'declined' && (canDecide(r) || r.requesterId === me.id || me.orgRole === 'admin')),
    all: all.filter((r) => me.orgRole === 'admin' || canDecide(r) || r.requesterId === me.id),
  }
  const list = lists[filter]
  const r = list.find((x) => x.id === sel) ?? list[0]
  const requester = data.users.find((u) => u.id === r?.requesterId)
  const before = requester ? ROLE_INFO[requester.orgRole].caps.length : 0
  const after = r && requester ? (r.kind === 'Role change' ? ROLE_INFO[ROLE_BY_LABEL[r.requestedRole] ?? requester.orgRole].caps.length : before + (PROJECT_ROLE_CAPS[r.requestedRole] ?? 0)) : 0
  return (
    <div className="space-y-5">
      <PageHeader title="Requests" icon={<Inbox />} description="Access requests and approvals that need a decision. Review why access is needed and its impact, then approve or decline with a reason." actions={<Button onClick={() => setNewOpen(true)}><Plus /> New request</Button>} />
      <Tabs defaultValue={params.get('tab') === 'approvals' && canApprove ? 'security' : 'access'}>
        <TabsList>
          <TabsTrigger value="access"><KeyRound /> Access requests</TabsTrigger>
          {canApprove && <TabsTrigger value="security"><Scale /> Security approvals</TabsTrigger>}
        </TabsList>
        <TabsContent value="access" className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {(['pending', 'mine', 'approved', 'declined', 'all'] as const).map((f) => (
              <button key={f} onClick={() => { setFilter(f); setSel(null) }} className={cn('rounded-lg border px-3 py-1.5 text-[13px] cursor-pointer', filter === f ? 'border-primary bg-primary-soft font-medium text-primary' : 'border-border bg-surface text-muted hover:text-fg')}>
                {f === 'pending' ? 'Awaiting my decision' : f === 'mine' ? 'My requests' : f[0].toUpperCase() + f.slice(1)} ({lists[f].length})
              </button>
            ))}
          </div>
          {list.length ? (
            <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
              <Card className="h-fit divide-y divide-border">
                {list.map((x) => (
                  <button key={x.id} onClick={() => { setSel(x.id); setNote('') }} className={cn('block w-full px-4 py-3 text-left cursor-pointer', r?.id === x.id ? 'bg-primary-soft' : 'hover:bg-surface-2')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13.5px] font-medium">{data.users.find((u) => u.id === x.requesterId)?.name}</span>
                      <Badge tone={x.status === 'pending' ? 'amber' : x.status === 'approved' ? 'emerald' : 'red'}>{x.status}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-muted">{x.requestedRole} · {x.projectId ? data.projects.find((p) => p.id === x.projectId)?.name : 'Organization role'}</div>
                    <div className="mt-0.5 text-[11.5px] text-subtle">{x.id} · <RelTime iso={x.createdAt} /></div>
                  </button>
                ))}
              </Card>
              {r && (
                <Card className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{r.id} / {r.kind}</div>
                      <h2 className="mt-1 text-lg font-semibold">{r.requestedRole} access for {requester?.name}</h2>
                    </div>
                    <Badge tone={r.status === 'pending' ? 'amber' : r.status === 'approved' ? 'emerald' : 'red'}>{r.status}</Badge>
                  </div>
                  <div className="mt-4 rounded-xl border border-border bg-surface-2 p-4">
                    <KeyValue cols={2} items={[{ label: 'Scope', value: r.projectId ? data.projects.find((p) => p.id === r.projectId)?.name : 'Whole organization' }, { label: 'Requested by', value: requester?.email }, { label: 'Current role', value: requester ? ROLE_INFO[requester.orgRole].label : '—' }, { label: 'Requested', value: fmtDateTime(r.createdAt) }, { label: 'Duration', value: r.durationDays ? `${r.durationDays} days` : 'Permanent' }, { label: 'Reviewer', value: r.projectId ? <UserName id={data.projects.find((p) => p.id === r.projectId)?.ownerId} /> : 'Administrators' }, { label: 'Risk', value: <Badge tone={r.risk === 'high' ? 'red' : r.risk === 'medium' ? 'amber' : 'emerald'}>{r.risk}</Badge> }]} />
                  </div>
                  <div className="mt-5">
                    <div className="text-[13px] font-semibold">Business justification</div>
                    <p className="mt-1 text-[13.5px] text-muted">{r.justification}</p>
                  </div>
                  <div className="mt-5">
                    <div className="text-[13px] font-semibold">Permission impact</div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted">
                      <span>Effective capabilities if approved</span>
                      <span className="num font-semibold text-fg">{before} → {after}</span>
                    </div>
                    <Progress value={(after / 14) * 100} className="mt-1.5" />
                  </div>
                  {r.status === 'pending' && canDecide(r) ? (
                    <div className="mt-5 space-y-3">
                      <Field label="Decision note" hint="Recorded in the audit log">
                        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Approved for 90 days — contributor only" />
                      </Field>
                      <div className="flex gap-2">
                        <Button variant="secondary" className="border-red-200 text-red-700" disabled={pending} onClick={() => run(() => api.decideAccessRequest(r.id, false, note.trim()), 'Request declined')}>
                          <X /> Decline request
                        </Button>
                        <Button disabled={pending} onClick={() => run(() => api.decideAccessRequest(r.id, true, note.trim()), 'Request approved — access granted')}>
                          <Check /> Approve request
                        </Button>
                      </div>
                    </div>
                  ) : r.status !== 'pending' ? (
                    <div className="mt-5"><Callout tone={r.status === 'approved' ? 'success' : 'danger'}>{r.status === 'approved' ? 'Approved' : 'Declined'} by <UserName id={r.reviewerId} avatar={false} /> · {fmtDateTime(r.decidedAt)}{r.decisionNote ? ` — “${r.decisionNote}”` : ''}</Callout></div>
                  ) : (
                    <div className="mt-5"><Callout tone="info">Waiting for {r.projectId ? 'the project owner or an administrator' : 'an administrator'} to decide.</Callout></div>
                  )}
                </Card>
              )}
            </div>
          ) : (
            <Card><EmptyState icon={<Inbox />} title={filter === 'pending' ? 'Nothing awaiting your decision' : 'No requests'} description={filter === 'pending' ? 'Requests for projects you own, or role changes if you are an administrator, appear here.' : undefined} /></Card>
          )}
        </TabsContent>
        {canApprove && (
          <TabsContent value="security">
            <ApprovalsContent embedded />
          </TabsContent>
        )}
      </Tabs>
      <NewRequestDialog open={newOpen} onOpenChange={(v) => { setNewOpen(v); if (!v && params.get('new')) setParams({}) }} />
    </div>
  )
}

function NewRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const me = useCurrentUser()
  const projects = useDbStore((s) => s.db.projects)
  const { run, pending } = useAction()
  const [form, setForm] = React.useState({ kind: 'Project access' as AccessRequest['kind'], projectId: '', requestedRole: 'Contributor', justification: '', durationDays: '90' })
  const valid = form.justification.trim().length >= 20 && (form.kind === 'Role change' || form.projectId)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Request access" description={`You are ${ROLE_INFO[me.orgRole].label}. Requests go to the project owner, or to administrators for role changes.`}>
        <div className="space-y-4">
          <Field label="What do you need?">
            <NativeSelect value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as AccessRequest['kind'], requestedRole: e.target.value === 'Role change' ? 'Security Analyst' : 'Contributor' })}>
              <option>Project access</option>
              <option>Role change</option>
            </NativeSelect>
          </Field>
          {form.kind === 'Project access' ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Project" required>
                <NativeSelect value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                  <option value="">Select…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Project role">
                <NativeSelect value={form.requestedRole} onChange={(e) => setForm({ ...form, requestedRole: e.target.value })}>
                  <option>Viewer</option>
                  <option>Contributor</option>
                  <option>Owner</option>
                </NativeSelect>
              </Field>
            </div>
          ) : (
            <Field label="Requested role">
              <NativeSelect value={form.requestedRole} onChange={(e) => setForm({ ...form, requestedRole: e.target.value })}>
                {Object.values(ROLE_INFO).filter((r) => r.label !== ROLE_INFO[me.orgRole].label).map((r) => (
                  <option key={r.label}>{r.label}</option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field label="Duration (days)" hint="Leave empty for permanent access">
            <Input type="number" min={1} value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} />
          </Field>
          <Field label="Business justification" required error={form.justification && form.justification.trim().length < 20 ? 'At least 20 characters' : undefined}>
            <Textarea rows={3} value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} placeholder="What you need to do and why" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid} loading={pending} onClick={async () => { await run(() => api.createAccessRequest({ kind: form.kind, projectId: form.kind === 'Project access' ? form.projectId : undefined, requestedRole: form.requestedRole, justification: form.justification.trim(), durationDays: form.durationDays ? Number(form.durationDays) : undefined }), 'Request submitted'); onOpenChange(false); setForm({ ...form, justification: '' }) }}>
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
