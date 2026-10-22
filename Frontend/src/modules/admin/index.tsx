import * as React from 'react'
import { Link, NavLink, Outlet, useLocation, Navigate } from 'react-router'
import { createColumnHelper } from '@tanstack/react-table'
import { Check, ClipboardCheck, Inbox, ShieldCheck, ShieldHalf, UserPlus, Users, X } from 'lucide-react'
import type { JobRole, OrgRole, ProjectRole, User } from '@/types'
import { useAction, useCan, useCollections, useCurrentUser, useSettings } from '@/hooks/queries'
import { usePage } from '@/hooks/usePage'
import { Callout, ErrorState, KeyValue, LoadingState, PageHeader, Section } from '@/components/common/layout'
import { Badge } from '@/components/common/badges'
import { RelTime, UserName } from '@/components/common/entities'
import { DataTable } from '@/components/common/DataTable'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, NativeSelect } from '@/components/ui/input'
import { Checkbox, Switch } from '@/components/ui/misc'
import * as api from '@/services/api'
import { useDbStore } from '@/stores/db'
import { cn, fmtDateTime } from '@/utils/format'
import { can, CAPABILITY_LABEL, explain, JOB_INFO, projectRoleOf, ROLE_INFO, VIEW_AREA, VIEW_CAPS, visibleProjectIds, type ActionCap, type Capability } from '@/utils/permissions'

const ADMIN_NAV = [
  { group: 'User Management', items: [
    { label: 'Users', to: '/admin/people', icon: <Users />, end: true },
    { label: 'Roles & Permissions', to: '/admin/roles', icon: <ShieldHalf /> },
    { label: 'Requests', to: '/admin/requests', icon: <Inbox /> },
  ] },
]

export function AdminLayout() {
  const location = useLocation()
  const pending = useDbStore((s) => s.db.accessRequests.filter((r) => r.status === 'pending').length)
  const people = useDbStore((s) => s.db.users.length)
  const allowed = useCan('manage_users')
  if (!allowed && location.pathname !== '/admin/requests') {
    if (location.pathname === '/admin') return <Navigate to="/admin/requests" replace />
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <ShieldHalf className="mx-auto size-10 text-subtle" />
        <h1 className="mt-3 text-lg font-semibold">User management is restricted</h1>
        <p className="mt-1 text-[13px] text-muted">Only administrators can manage people, roles and project access. Raise an access request if you need it.</p>
        <Button className="mt-5" asChild><Link to="/admin/requests?new=1">Request access</Link></Button>
      </div>
    )
  }
  return (
    <div className="space-y-5">
      <PageHeader title="User management" icon={<Users />} description="People, project membership, roles and access decisions — one connected enterprise workspace."  />
      <div className="flex flex-col gap-5 lg:flex-row">
        <aside className="lg:w-[230px] lg:shrink-0">
          <Card className="p-3">
            {ADMIN_NAV.map((g) => (
              <div key={g.group} className="mb-2">
                <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-subtle">{g.group}</div>
                <ul className="space-y-0.5">
                  {g.items.filter(i => allowed || i.to === '/admin/requests').map((i) => (
                    <li key={i.to}>
                      <NavLink to={i.to} end={i.end} className={({ isActive }) => cn('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] [&_svg]:size-4', isActive && !(i.to === '/admin' && location.pathname !== '/admin') ? 'bg-primary-soft font-medium text-primary' : 'text-muted hover:bg-surface-2 hover:text-fg')}>
                        {i.icon}
                        <span className="flex-1">{i.label}</span>
                        {i.label === 'Users' && <span className="text-[11px] text-subtle">{people}</span>}
                        {i.label === 'Requests' && pending > 0 && <span className="rounded-full bg-primary-soft px-1.5 text-[11px] font-semibold text-primary">{pending}</span>}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="mt-3 rounded-lg bg-surface-2 p-3 text-[11.5px] text-muted">
              <div className="font-semibold text-fg">Access decision</div>
              Organization role permissions ∩ project role permissions. Account status, expiry and project scope can restrict access further.
            </div>
          </Card>
        </aside>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- People

const pCol = createColumnHelper<User & { projects: number }>()

export function PeoplePage() {
  usePage('People', [{ label: 'User management', to: '/admin' }, { label: 'People' }])
  const me = useCurrentUser()
  const db = useDbStore((s) => s.db)
  const { run } = useAction()
  const [invite, setInvite] = React.useState(false)
  const { data, isLoading, error, retry } = useCollections(['users', 'projects'] as const, { ignoreProjectFilter: true })
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={10} />
  const rows = data.users.map((u) => ({ ...u, projects: visibleProjectIds(db, u.id).length }))
  const columns = [
    pCol.accessor('name', { header: 'Person', cell: (c) => <div className="flex items-center gap-2.5"><span className="flex size-8 items-center justify-center rounded-full bg-[#ece9fb] text-[11px] font-semibold text-primary">{c.row.original.initials}</span><div><div className="font-medium">{c.getValue()}</div><div className="text-[11.5px] text-subtle">{c.row.original.email}</div></div></div> }),
    pCol.accessor('team', { header: 'Team', cell: (c) => <span className="text-muted">{c.getValue()}</span> }),
    pCol.accessor('orgRole', {
      header: 'Access role',
      filterFn: 'multi',
      cell: (c) =>
        c.row.original.id === me.id || c.row.original.status !== 'active' ? (
          <Badge tone="violet">{ROLE_INFO[c.getValue()].label}</Badge>
        ) : (
          <NativeSelect value={c.getValue()} onClick={(e) => e.stopPropagation()} onChange={(e) => run(() => api.changeUserRole(c.row.original.id, e.target.value as OrgRole), `Role changed to ${ROLE_INFO[e.target.value as OrgRole].label}`)} className="h-8 w-44 text-xs" aria-label={`Role for ${c.row.original.name}`}>
            {(Object.keys(ROLE_INFO) as OrgRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_INFO[r].label}
              </option>
            ))}
          </NativeSelect>
        ),
    }),
    pCol.accessor('job', {
      header: 'Job',
      filterFn: 'multi',
      cell: (c) =>
        c.row.original.status !== 'active' ? (
          <span className="text-muted">{JOB_INFO[c.getValue()].label}</span>
        ) : (
          <NativeSelect value={c.getValue()} onClick={(e) => e.stopPropagation()} onChange={(e) => run(() => api.changeUserJob(c.row.original.id, e.target.value as JobRole), `Job changed to ${JOB_INFO[e.target.value as JobRole].label}`)} className="h-8 w-44 text-xs" aria-label={`Job for ${c.row.original.name}`}>
            {(Object.keys(JOB_INFO) as JobRole[]).map((j) => <option key={j} value={j}>{JOB_INFO[j].label}</option>)}
          </NativeSelect>
        ),
    }),
    pCol.accessor('projects', { header: 'Projects', cell: (c) => (can(c.row.original, 'view_all_projects') ? <span className="text-muted">All</span> : c.getValue()) }),
    pCol.accessor('mfaEnabled', { header: 'MFA', cell: (c) => (c.getValue() ? <Check className="size-4 text-emerald-600" /> : <X className="size-4 text-red-600" />) }),
    pCol.accessor('status', { header: 'Status', filterFn: 'multi', cell: (c) => <Badge tone={c.getValue() === 'active' ? 'emerald' : 'slate'}>{c.getValue()}</Badge> }),
    pCol.accessor('lastActiveAt', { header: 'Last active', cell: (c) => <RelTime iso={c.getValue()} /> }),
    pCol.display({ id: 'act', header: '', cell: (c) => (c.row.original.id === me.id ? <span className="text-xs text-subtle">You</span> : <Button size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); run(() => api.setUserStatus(c.row.original.id, c.row.original.status === 'active' ? 'deactivated' : 'active'), c.row.original.status === 'active' ? 'User deactivated' : 'User reactivated') }}>{c.row.original.status === 'active' ? 'Deactivate' : 'Reactivate'}</Button>) }),
  ]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">People</h2>
          <p className="text-[13px] text-muted">Access role decides what someone may do. Job decides what they see first and which areas they need. Project membership decides where.</p>
        </div>
        <Button onClick={() => setInvite(true)}><UserPlus /> Invite people</Button>
      </div>
      <DataTable tableId="people" data={rows} columns={columns} getRowId={(u) => u.id} searchPlaceholder="Search people…" facets={[{ columnId: 'orgRole', label: 'Access role', options: (Object.keys(ROLE_INFO) as OrgRole[]).map((r) => ({ value: r, label: ROLE_INFO[r].label })) }, { columnId: 'job', label: 'Job', options: (Object.keys(JOB_INFO) as JobRole[]).map((j) => ({ value: j, label: JOB_INFO[j].label })) }, { columnId: 'status', label: 'Status' }]} selectable={false} exportName="do-safe-people" />
      <InviteDialog open={invite} onOpenChange={setInvite} />
    </div>
  )
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const projects = useDbStore((s) => s.db.projects)
  const { run, pending } = useAction()
  const [f, setF] = React.useState({ name: '', email: '', orgRole: 'analyst' as OrgRole, job: 'security_analyst' as JobRole, projectIds: [] as string[] })
  const valid = f.name.trim().length > 1 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Invite people" description="The person receives an email invitation (simulated). Access starts when they accept and sign in with SSO.">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full name" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Work email" required error={f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email) ? 'Enter a valid email' : undefined}><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          </div>
          <Field label="Job" hint={JOB_INFO[f.job].summary}>
            <NativeSelect value={f.job} onChange={(e) => { const job = e.target.value as JobRole; setF({ ...f, job, orgRole: JOB_INFO[job].defaultRole }) }}>
              {(Object.keys(JOB_INFO) as JobRole[]).map((j) => <option key={j} value={j}>{JOB_INFO[j].label}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Access role" hint={ROLE_INFO[f.orgRole].summary}>
            <NativeSelect value={f.orgRole} onChange={(e) => setF({ ...f, orgRole: e.target.value as OrgRole })}>
              {(Object.keys(ROLE_INFO) as OrgRole[]).map((r) => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
            </NativeSelect>
          </Field>
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted">Projects</div>
            <div className="space-y-1.5">
              {projects.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 text-[13px]">
                  <Checkbox checked={f.projectIds.includes(p.id)} onCheckedChange={(c) => setF({ ...f, projectIds: c ? [...f.projectIds, p.id] : f.projectIds.filter((x) => x !== p.id) })} /> {p.name}
                </label>
              ))}
              {!projects.length && <p className="text-xs text-subtle">No projects yet.</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid} loading={pending} onClick={async () => { await run(() => api.inviteUser({ ...f, name: f.name.trim(), email: f.email.trim() }), `Invitation sent to ${f.email}`); onOpenChange(false); setF({ name: '', email: '', orgRole: 'analyst', job: 'security_analyst', projectIds: [] }) }}>Send invitation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- Invitations

export function InvitationsPage() {
  usePage('Invitations', [{ label: 'User management', to: '/admin' }, { label: 'Invitations' }])
  const [open, setOpen] = React.useState(false)
  const { run, pending } = useAction()
  const { data, isLoading, error, retry } = useCollections(['invitations', 'projects'] as const, { ignoreProjectFilter: true })
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={6} />
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Invitations</h2>
        <Button onClick={() => setOpen(true)}><UserPlus /> Invite people</Button>
      </div>
      <Card className="divide-y divide-border">
        {data.invitations.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="text-[13.5px] font-medium">{i.name} <span className="text-muted">· {i.email}</span></div>
              <div className="text-xs text-muted">{ROLE_INFO[i.orgRole].label} · {i.projectIds.map((p) => data.projects.find((x) => x.id === p)?.name).join(', ') || 'No projects'} · invited by <UserName id={i.invitedById} avatar={false} /> <RelTime iso={i.sentAt} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={i.status === 'pending' ? 'amber' : i.status === 'accepted' ? 'emerald' : 'slate'}>{i.status}</Badge>
              {i.status === 'pending' && (
                <>
                  <Button size="xs" variant="secondary" disabled={pending} onClick={() => run(() => api.setInvitationStatus(i.id, 'accepted'), 'Invitation accepted (simulated) — user created')}>Simulate acceptance</Button>
                  <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => api.setInvitationStatus(i.id, 'revoked'), 'Invitation revoked')}>Revoke</Button>
                </>
              )}
            </div>
          </div>
        ))}
        {!data.invitations.length && <p className="px-4 py-6 text-center text-xs text-muted">No invitations yet.</p>}
      </Card>
      <InviteDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}

// ---------------------------------------------------------------- Roles

export function RolesPage() {
  usePage('Roles & permissions', [{ label: 'User management', to: '/admin' }, { label: 'Roles & permissions' }])
  const actions = (Object.keys(CAPABILITY_LABEL) as Capability[]).filter((c) => !(VIEW_CAPS as string[]).includes(c)) as ActionCap[]
  const roles = Object.keys(ROLE_INFO) as OrgRole[]
  const jobs = Object.keys(JOB_INFO) as JobRole[]
  const th = 'px-3 py-3 text-center text-[12px] font-semibold'
  return (
    <div className="space-y-6">
      <Callout tone="info" icon={<ShieldCheck />} title="Two separate settings per person">
        <strong className="font-medium">Access role</strong> decides what someone may do. <strong className="font-medium">Job</strong> decides which areas they see and what their home and menus focus on. Administrators see every area — they manage roles, so hiding data from them would add no security.
      </Callout>
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Access roles — what people may do</h2>
          <p className="text-[13px] text-muted">Project roles (Owner, Contributor, Viewer) further limit actions inside a project.</p>
        </div>
        <Card className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-border bg-surface-2">
              <tr><th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-subtle">Action</th>{roles.map((r) => <th key={r} className={th}>{ROLE_INFO[r].label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {actions.map((c) => (
                <tr key={c}>
                  <td className="px-4 py-2.5">{CAPABILITY_LABEL[c]}</td>
                  {roles.map((r) => <td key={r} className="px-3 py-2.5 text-center">{ROLE_INFO[r].caps.includes(c) ? <Check className="mx-auto size-4 text-emerald-600" aria-label="Allowed" /> : <span className="text-subtle" aria-label="Not allowed">—</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Jobs — what people see</h2>
          <p className="text-[13px] text-muted">Each job gets its own home page and menu, and only the areas its work needs. Managing an area (for example vendors) also requires seeing it.</p>
        </div>
        <Card className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-border bg-surface-2">
              <tr><th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-subtle">Area</th>{jobs.map((j) => <th key={j} className={th}>{JOB_INFO[j].label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {VIEW_CAPS.map((v) => (
                <tr key={v}>
                  <td className="px-4 py-2.5">{VIEW_AREA[v]}</td>
                  {jobs.map((j) => <td key={j} className="px-3 py-2.5 text-center">{JOB_INFO[j].views.includes(v) || j === 'platform_admin' ? <Check className="mx-auto size-4 text-emerald-600" aria-label="Visible" /> : <span className="text-subtle" aria-label="Hidden">—</span>}</td>)}
                </tr>
              ))}
              <tr>
                <td className="px-4 py-2.5">Every project</td>
                {jobs.map((j) => <td key={j} className="px-3 py-2.5 text-center text-[12px] text-muted">{JOB_INFO[j].orgWide || j === 'platform_admin' ? 'Yes' : 'Member projects'}</td>)}
              </tr>
            </tbody>
          </table>
        </Card>
        <p className="text-[11.5px] text-subtle">Platform administrators are usually given the Administrator access role, which sees every area.</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((j) => (
            <Card key={j} className="p-4">
              <div className="font-semibold">{JOB_INFO[j].label}</div>
              <p className="mt-1 text-xs text-muted">{JOB_INFO[j].summary}</p>
              <div className="mt-2 text-[11.5px] text-subtle">Usual access role: {ROLE_INFO[JOB_INFO[j].defaultRole].label}</div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- Project access

export function ProjectAccessPage() {
  usePage('Project access', [{ label: 'User management', to: '/admin' }, { label: 'Project access' }])
  const { run, pending } = useAction()
  const { data, isLoading, error, retry } = useCollections(['projects', 'users'] as const, { ignoreProjectFilter: true })
  const [pid, setPid] = React.useState('')
  const [add, setAdd] = React.useState({ userId: '', role: 'contributor' as ProjectRole })
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={6} />
  const project = data.projects.find((p) => p.id === pid) ?? data.projects[0]
  if (!project) return <Card className="p-6 text-sm text-muted">No projects yet. <Link to="/onboarding?new=1" className="text-primary">Create one</Link>.</Card>
  const members = [{ userId: project.ownerId, role: 'owner' as ProjectRole }, ...project.members.filter((m) => m.userId !== project.ownerId)]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Organization / project access</div>
          <h2 className="text-lg font-semibold">Project access management</h2>
          <p className="text-[13px] text-muted">Control the project boundary independently from platform permissions.</p>
        </div>
        <NativeSelect value={project.id} onChange={(e) => setPid(e.target.value)} className="w-64" aria-label="Project">
          {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </NativeSelect>
      </div>
      <Callout tone="info" icon={<ShieldCheck />} title="Effective access = organization grant ∩ project grant">Adding someone to a project does not by itself let them change findings or approve work — their organization role must allow it too.</Callout>
      <Card className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="border-b border-border bg-surface-2 text-left text-[11px] uppercase tracking-wide text-subtle">
            <tr><th className="px-4 py-2.5">Person</th><th className="px-4 py-2.5">Access role · job</th><th className="px-4 py-2.5">Project role</th><th className="px-4 py-2.5">Effective capabilities</th><th className="px-4 py-2.5" /></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((m) => {
              const u = data.users.find((x) => x.id === m.userId)!
              const eff = ROLE_INFO[u.orgRole].caps.filter((c) => can(u, c) && (m.role !== 'viewer' || c === 'view_all_projects')).length
              return (
                <tr key={m.userId}>
                  <td className="px-4 py-2.5"><UserName id={m.userId} /></td>
                  <td className="px-4 py-2.5"><Badge>{ROLE_INFO[u.orgRole].label}</Badge> <span className="text-xs text-muted">{JOB_INFO[u.job].label}</span></td>
                  <td className="px-4 py-2.5">
                    {m.userId === project.ownerId ? <Badge tone="violet">Project owner</Badge> : (
                      <NativeSelect value={m.role} onChange={(e) => run(() => api.setProjectMember(project.id, m.userId, e.target.value as ProjectRole), 'Project role updated')} className="h-8 w-32 text-xs" aria-label="Project role">
                        <option value="owner">Owner</option><option value="contributor">Contributor</option><option value="viewer">Viewer</option>
                      </NativeSelect>
                    )}
                  </td>
                  <td className="px-4 py-2.5"><span className="num font-medium">{eff} actions</span></td>
                  <td className="px-4 py-2.5 text-right">{m.userId !== project.ownerId && <Button size="xs" variant="ghost" onClick={() => run(() => api.setProjectMember(project.id, m.userId, null), 'Removed from project')}>Remove</Button>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <Field label="Add a person">
          <NativeSelect value={add.userId} onChange={(e) => setAdd({ ...add, userId: e.target.value })} className="w-64">
            <option value="">Select…</option>
            {data.users.filter((u) => u.status === 'active' && !members.some((m) => m.userId === u.id)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Project role">
          <NativeSelect value={add.role} onChange={(e) => setAdd({ ...add, role: e.target.value as ProjectRole })} className="w-40">
            <option value="contributor">Contributor</option><option value="viewer">Viewer</option><option value="owner">Owner</option>
          </NativeSelect>
        </Field>
        <Button disabled={!add.userId} loading={pending} onClick={async () => { await run(() => api.setProjectMember(project.id, add.userId, add.role), 'Member added'); setAdd({ userId: '', role: 'contributor' }) }}><UserPlus /> Add member</Button>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- Permission inspector

export function InspectorPage() {
  usePage('Permission inspector', [{ label: 'User management', to: '/admin' }, { label: 'Permission inspector' }])
  const db = useDbStore((s) => s.db)
  const [uid, setUid] = React.useState(db.users[0]?.id ?? '')
  const [pid, setPid] = React.useState(db.projects[0]?.id ?? '')
  const u = db.users.find((x) => x.id === uid)
  const projectRole = u && pid ? (u.orgRole === 'admin' ? 'admin (all projects)' : projectRoleOf(db, pid, u.id) ?? (can(u, 'view_all_projects') ? 'not a member (sees all projects)' : 'no access')) : '—'
  const noAccess = u && pid && !visibleProjectIds(db, u.id).includes(pid)
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Permission inspector</h2>
        <p className="text-[13px] text-muted">See exactly what a person can do in a project, and why.</p>
      </div>
      <Card className="grid gap-4 p-4 sm:grid-cols-2">
        <Field label="Person"><NativeSelect value={uid} onChange={(e) => setUid(e.target.value)}>{db.users.map((x) => <option key={x.id} value={x.id}>{x.name} — {JOB_INFO[x.job].label} · {ROLE_INFO[x.orgRole].label}{x.status !== 'active' ? ` (${x.status})` : ''}</option>)}</NativeSelect></Field>
        <Field label="Project"><NativeSelect value={pid} onChange={(e) => setPid(e.target.value)}>{db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect></Field>
      </Card>
      {u && (
        <>
          <Card className="p-4"><KeyValue cols={4} items={[{ label: 'Access role', value: ROLE_INFO[u.orgRole].label }, { label: 'Job', value: JOB_INFO[u.job].label }, { label: 'Project role', value: projectRole }, { label: 'Account status', value: <Badge tone={u.status === 'active' ? 'emerald' : 'slate'}>{u.status}</Badge> }]} /></Card>
          {(noAccess || u.status !== 'active') && <Callout tone="danger">{u.status !== 'active' ? 'Account is not active — all access is denied.' : 'Not a member of this project — the project is invisible to this person.'}</Callout>}
          <Card className="divide-y divide-border">
            {(Object.keys(CAPABILITY_LABEL) as Capability[]).map((c) => {
              const allowed = !noAccess && can(u, c)
              return (
                <div key={c} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                  <span>{CAPABILITY_LABEL[c]}<span className="block text-[11.5px] text-muted">{noAccess ? 'This project isn’t visible to this person.' : explain(u, c)}</span></span>
                  <span className={cn('flex shrink-0 items-center gap-1.5 text-xs', allowed ? 'text-emerald-700' : 'text-subtle')}>{allowed ? <Check className="size-4" /> : <X className="size-4" />}{allowed ? 'Allowed' : noAccess ? 'Blocked by project scope' : 'Not allowed'}</span>
                </div>
              )
            })}
          </Card>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Audit

export function AdminAuditPage() {
  usePage('Identity & access audit', [{ label: 'User management', to: '/admin' }, { label: 'Audit log' }])
  const [q, setQ] = React.useState('')
  const { data, isLoading, error, retry } = useCollections(['audit'] as const, { ignoreProjectFilter: true })
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={8} />
  const rows = data.audit.filter((a) => a.module === 'Platform').filter((a) => !q || `${a.action} ${a.details} ${a.entityId}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Identity & access audit</h2>
          <p className="text-[13px] text-muted">Sign-ins, role edits, project grants, request outcomes and invitations.</p>
        </div>
        <Button asChild variant="secondary" size="sm"><Link to="/platform/audit">Full platform audit log</Link></Button>
      </div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, person, role or action…" aria-label="Search audit" />
      <Card className="divide-y divide-border">
        {rows.slice(0, 40).map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="flex gap-3">
              <ClipboardCheck className="mt-0.5 size-4 text-subtle" />
              <div>
                <div className="text-[13.5px] font-medium">{a.action}</div>
                <div className="text-xs text-muted">{a.details} · Actor: <UserName id={a.actorId} avatar={false} /></div>
              </div>
            </div>
            <span className="shrink-0 text-xs text-subtle">{fmtDateTime(a.at)}</span>
          </div>
        ))}
        {!rows.length && <p className="px-4 py-6 text-center text-xs text-muted">No identity events.</p>}
      </Card>
      <p className="text-[11.5px] text-subtle">Audit entries here exist in browser storage only. A production audit trail needs server-generated timestamps, authenticated actor IDs, before/after snapshots and tamper-resistant storage.</p>
    </div>
  )
}

// ---------------------------------------------------------------- Identity & security

export function IdentityPage() {
  usePage('Identity & security', [{ label: 'User management', to: '/admin' }, { label: 'Identity & security' }])
  const settings = useSettings()
  const { run, pending } = useAction()
  const [idn, setIdn] = React.useState(settings.identity)
  const dirty = JSON.stringify(idn) !== JSON.stringify(settings.identity)
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Identity & security</h2>
        <p className="text-[13px] text-muted">How people sign in, and the identity lifecycle that role assignments must not bypass.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['Shared identity service', 'One person identifier, verified sign-in and centralized session policy across DO products.', 'Integration to verify'],
          ['Corporate SSO / IdP', 'Your identity provider verifies the employee; DO SAFE maps the verified identity to an account.', 'Provider-configured'],
          ['Product authorization', 'Organization and project roles decide modules, actions and visible projects after sign-in.', 'Separate from login'],
        ].map(([t, d, tag]) => (
          <Card key={t} className="p-4">
            <div className="text-[14px] font-semibold">{t}</div>
            <p className="mt-1 text-xs text-muted">{d}</p>
            <Badge className="mt-3" tone="amber">{tag}</Badge>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Authentication policy" description="Illustrative settings for an enterprise workspace">
          <div className="space-y-4">
            <Field label="Identity provider">
              <NativeSelect value={idn.provider} onChange={(e) => setIdn({ ...idn, provider: e.target.value })}>
                {['Corporate SSO (Okta, simulated)', 'Microsoft Entra ID (simulated)', 'Google Workspace (simulated)'].map((p) => <option key={p}>{p}</option>)}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Session timeout">
                <NativeSelect value={idn.sessionTimeoutHours} onChange={(e) => setIdn({ ...idn, sessionTimeoutHours: Number(e.target.value) })}>
                  {[1, 4, 8, 12, 24].map((h) => <option key={h} value={h}>{h} hours</option>)}
                </NativeSelect>
              </Field>
              <label className="flex items-end justify-between gap-2 pb-2 text-[13px]">Require MFA<Switch checked={idn.mfaRequired} onCheckedChange={(v) => setIdn({ ...idn, mfaRequired: v })} /></label>
            </div>
            <label className="flex items-center justify-between gap-2 text-[13px]">Step-up authentication for approvals<Switch checked={idn.stepUpForApprovals} onCheckedChange={(v) => setIdn({ ...idn, stepUpForApprovals: v })} /></label>
            <div className="flex justify-end"><Button disabled={!dirty} loading={pending} onClick={() => run(() => api.updateSettings({ identity: idn }, 'Identity policy updated'), 'Identity policy saved')}>Save policy</Button></div>
            <p className="rounded-lg bg-surface-2 p-3 text-[11.5px] text-muted">For a real deployment, identity configuration and secrets belong in the centralized IAM backend and secret manager. Profile fields should be controlled by the authoritative identity source.</p>
          </div>
        </Section>
        <Section title="Provisioning & recovery cases" description="Identity lifecycle that role assignments must not bypass">
          <ol className="space-y-3">
            {[
              ['New verified SSO person', 'Link trusted subject ID → create or match identity → no default permissions.'],
              ['Role or employment change', 'Update organization role and project assignments; revoke outdated sessions.'],
              ['Employee departs', 'Deactivate account everywhere and invalidate sessions; preserve project ownership.'],
              ['External reviewer', 'Time-boxed project viewer grant; no access to unrelated projects.'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">{i + 1}</span>
                <div><div className="text-[13px] font-medium">{t}</div><div className="text-xs text-muted">{d}</div></div>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="secondary" asChild><Link to="/admin/invitations">Manage invitations</Link></Button>
            <Button size="sm" variant="secondary" asChild><Link to="/admin/people">Deactivate a user</Link></Button>
          </div>
        </Section>
      </div>
    </div>
  )
}
