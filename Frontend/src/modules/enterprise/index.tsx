import * as React from 'react'
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router'
import { ArrowRight, Search, FolderKanban, Ticket, Settings, HelpCircle } from 'lucide-react'
import { useCollections, useCurrentUser, useAction, useSettings, useCan } from '@/hooks/queries'
import { usePage } from '@/hooks/usePage'
import { useDbStore } from '@/stores/db'
import { useUiStore } from '@/stores/ui'
import { can, visibleProjectIds } from '@/utils/permissions'
import { cn } from '@/utils/format'
import * as api from '@/services/api'
import { PageHeader, Section, LoadingState, ErrorState, KpiCard, EmptyState } from '@/components/common/layout'
import { Button } from '@/components/ui/button'
import { Field, Input, NativeSelect } from '@/components/ui/input'
import { Switch } from '@/components/ui/misc'
import { IdentityPage } from '@/modules/admin'
import { MarketplacePage } from '@/modules/integrations'

export function HomePage() {
  usePage('Home', [{ label: 'Home' }])
  const me = useCurrentUser()
  const recents = useSettings().recentRecords || []
  const openSearch = useUiStore(s => s.setSearchOpen)
  const { data, isLoading, error, retry } = useCollections(['projects', 'tickets', 'accessRequests', 'notifications'] as const, { ignoreProjectFilter: true })
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={3} rows={6} />
  const tasks = data.tickets.filter(t => t.assigneeId === me.id && !['done', 'cancelled'].includes(t.status))
  const requests = data.accessRequests.filter(r => r.status === 'pending' && (r.requesterId === me.id || can(me, 'manage_users') || data.projects.some(p => p.id === r.projectId && p.ownerId === me.id)))
  const alerts = data.notifications.filter(n => !n.read).slice(0, 4)
  return <div className="space-y-6">
    <PageHeader title={`Welcome back, ${me.name.split(' ')[0]}`} description="Your projects, assigned work and pending decisions." />
    <div className="rounded-xl border border-border bg-surface px-5 py-8 sm:px-10">
      <h2 className="mb-4 text-center text-lg font-semibold">Find what you need</h2>
      <button onClick={() => openSearch(true)} className="mx-auto flex min-h-14 w-full max-w-3xl items-center gap-3 rounded-xl border border-border-strong bg-bg px-4 text-left text-muted shadow-sm hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"><Search className="size-5 text-primary" /><span className="flex-1">Search projects, applications, tickets and knowledge…</span><kbd className="hidden text-xs sm:block">⌘ K</kbd></button>
    </div>
    <div className="grid gap-4 sm:grid-cols-3"><KpiCard label="My open tickets" value={tasks.length} /><KpiCard label="Pending requests" value={requests.length} /><KpiCard label="Unread notifications" value={data.notifications.filter(n => !n.read).length} /></div>
    <div className="grid gap-5 xl:grid-cols-2">
      <Section title="Recent projects" actions={<Link className="text-xs text-primary" to="/projects">All projects</Link>}><div className="divide-y divide-border">{[...data.projects].sort((a,b) => (recents.find(r=>r.id===b.id)?.at || b.createdAt).localeCompare(recents.find(r=>r.id===a.id)?.at || a.createdAt)).slice(0,4).map(p => <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center gap-3 py-3 hover:text-primary"><FolderKanban className="size-4 text-primary" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{p.name}</span><span className="block truncate text-xs text-muted">{p.description}</span></span><ArrowRight className="size-4" /></Link>)}</div>{!data.projects.length && <EmptyState title="No projects assigned" description="Request project access from User Management." action={<Button asChild variant="secondary"><Link to="/admin/requests?new=1">Request access</Link></Button>} />}</Section>
      <Section title="My open tasks and tickets" actions={<Link className="text-xs text-primary" to="/operations/tickets">Ticket Management</Link>}>{tasks.slice(0,5).map(t => <Link key={t.id} to={`/operations/tickets/${t.id}`} className="flex items-center gap-3 border-b border-border py-3 text-sm hover:text-primary"><Ticket className="size-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate">{t.title}</span><span className="text-xs text-muted">{t.priority}</span></Link>)}{!tasks.length && <EmptyState title="No open tasks assigned" description="New assignments will appear here." />}</Section>
      <Section title="Pending requests">{requests.slice(0,4).map(r => <Link key={r.id} to="/admin/requests" className="flex justify-between border-b border-border py-3 text-sm hover:text-primary"><span>{r.kind} · {r.requestedRole}</span><span className="text-xs text-muted">Pending</span></Link>)}{!requests.length && <EmptyState title="No pending requests" description="Submit an access request when you need another project or role." />}</Section>
      <Section title="Alerts needing attention">{alerts.map(n => <Link key={n.id} to={n.link || '/platform/notifications'} className="block border-b border-border py-3 hover:text-primary"><span className="text-sm font-medium">{n.title}</span><p className="mt-1 text-xs text-muted">{n.body}</p></Link>)}{!alerts.length && <EmptyState title="You're up to date" description="New alerts will appear here." />}</Section>
    </div>
    <Section title="Quick actions"><div className="flex flex-wrap gap-3"><Button asChild variant="secondary"><Link to="/admin/requests?new=1">Request access</Link></Button>{can(me,'create_project') && <Button asChild variant="secondary"><Link to="/onboarding?new=1">Create project</Link></Button>}{can(me,'manage_users') && <Button asChild variant="secondary"><Link to="/admin/people">Manage users</Link></Button>}<Button asChild variant="secondary"><Link to="/support">Contact support</Link></Button></div></Section>
  </div>
}

export function ProjectWorkspace() {
  const { id } = useParams()
  const db = useDbStore(s => s.db)
  const project = db.projects.find(p => p.id === id && visibleProjectIds(db, db.settings.currentUserId).includes(p.id))
  React.useEffect(() => { if (project && db.settings.currentProjectId !== project.id) api.setCurrentProject(project.id) }, [project?.id, db.settings.currentProjectId])
  React.useEffect(() => { if (project) api.recordRecent('project', project.id, project.name) }, [project?.id])
  if (!project) return <EmptyState title="Project unavailable" description="This project does not exist or you do not have access." action={<Button asChild><Link to="/projects">Back to Projects</Link></Button>} />
  if (db.settings.currentProjectId !== project.id) return <LoadingState rows={6} />
  return <div className="space-y-5"><div className="rounded-xl border border-border bg-surface p-4"><Link to="/projects" className="text-xs text-primary">Projects</Link><h2 className="mt-1 text-lg font-semibold">{project.name}</h2><nav aria-label="Project workspace" className="mt-4 flex flex-wrap gap-2">{[['', 'Project Summary'], ['/mapping', 'Asset Mapping'], ['/tickets', 'Ticket Management'], ['/applications', 'Safe Applications']].map(([path,label]) => <NavLink key={path} end={path === ''} to={`/projects/${id}${path}`} className={({isActive}) => cn('rounded-lg px-3 py-2 text-sm',isActive ? 'bg-primary-soft font-medium text-primary' : 'text-muted hover:bg-surface-2')}>{label}</NavLink>)}</nav></div><Outlet /></div>
}

const SETTINGS = [['configuration','Application Configuration'],['usage','Usage & Limits'],['integrations','Integrations'],['security','SSO & Security'],['preferences','Admin Preferences']] as const
export function EnterpriseSettings() {
  usePage('Settings', [{label:'Settings'}])
  const location = useLocation()
  const section = location.pathname.split('/')[3] || 'preferences'
  const admin = useCan('manage_settings')
  const integrations = useCan('manage_integrations')
  const settings = useSettings()
  const db = useDbStore(s => s.db)
  const me = useCurrentUser()
  const [org, setOrg] = React.useState(settings.orgName)
  const [sla, setSla] = React.useState(settings.slaDays)
  const [prefs, setPrefs] = React.useState<{email:boolean; digest:string}>(() => { try { return JSON.parse(localStorage.getItem(`do-safe-preferences-${me.id}`) || '{"email":true,"digest":"daily"}') } catch { return {email:true,digest:'daily'} } })
  const [saved,setSaved] = React.useState(false)
  const {run,pending} = useAction()
  const allowed = section === 'preferences' || (section === 'integrations' ? integrations : admin)
  return <div className="space-y-5"><PageHeader title="Settings" icon={<Settings />} description="Workspace configuration and personal preferences." /><nav aria-label="Settings sections" className="flex flex-wrap gap-2">{SETTINGS.filter(([key]) => key === 'preferences' || (key === 'integrations' ? integrations : admin)).map(([key,label]) => <NavLink key={key} to={`/platform/settings/${key}`} className={cn('rounded-lg border px-3 py-2 text-sm',section === key ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface')}>{key === 'preferences' && !admin ? 'My Preferences' : label}</NavLink>)}</nav>
    {!allowed ? <EmptyState title="Administrator access required" description="Contact your platform administrator to change these settings." /> : <>
    {section === 'configuration' && <Section title="Application Configuration"><div className="max-w-xl space-y-5"><Field label="Organization name"><Input value={org} onChange={e=>setOrg(e.target.value)} /></Field><h3 className="text-sm font-medium">Ticket resolution targets (days)</h3><div className="grid grid-cols-2 gap-3">{(['critical','high','medium','low'] as const).map(s=><Field key={s} label={s}><Input type="number" min={1} value={sla[s]} onChange={e=>setSla({...sla,[s]:Number(e.target.value)})} /></Field>)}</div><Button disabled={pending || !org.trim() || Object.values(sla).some(n=>!Number.isFinite(n)||n<1)} onClick={()=>run(()=>api.updateSettings({orgName:org.trim(),slaDays:sla}),'Configuration saved')}>Save configuration</Button></div></Section>}
    {section === 'usage' && <><div className="grid gap-4 md:grid-cols-3"><KpiCard label="Active users" value={db.users.filter(u=>u.status==='active').length} /><KpiCard label="Projects" value={db.projects.length} /><KpiCard label="Applications" value={db.services.length} /></div><Section title="Workspace limits" description="Illustrative Stage 1 capacity; no billing or subscription actions.">{[['Users',db.users.length,250],['Projects',db.projects.length,100],['Applications',db.services.length,500]].map(([label,used,limit])=><div key={label} className="mb-5"><div className="mb-2 flex justify-between text-sm"><span>{label}</span><span>{used} / {limit}</span></div><progress className="h-2 w-full accent-violet-600" aria-label={`${label} capacity`} value={Number(used)} max={Number(limit)} /></div>)}</Section></>}
    {section === 'integrations' && <MarketplacePage />}
    {section === 'security' && <IdentityPage />}
    {section === 'preferences' && <Section title={admin ? 'Admin Preferences' : 'My Preferences'} description="Preferences apply to your account."><div className="max-w-xl space-y-5"><div className="text-sm">{me.name}<p className="text-xs text-muted">{me.email}</p></div><label className="flex items-center justify-between text-sm">Email notifications<Switch checked={prefs.email} onCheckedChange={email=>{setPrefs({...prefs,email});setSaved(false)}} /></label><Field label="Notification digest"><NativeSelect value={prefs.digest} onChange={e=>{setPrefs({...prefs,digest:e.target.value});setSaved(false)}}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="off">Off</option></NativeSelect></Field><Button onClick={()=>{localStorage.setItem(`do-safe-preferences-${me.id}`,JSON.stringify(prefs));setSaved(true)}}>Save preferences</Button>{saved && <p role="status" className="text-sm text-emerald-700">Preferences saved.</p>}</div></Section>}
    </>}
  </div>
}

export function HelpPage() {
  usePage('Help', [{label:'Help'}])
  return <div className="space-y-5"><PageHeader title="Help" icon={<HelpCircle />} description="Guidance for common workspace tasks." /><div className="grid gap-5 md:grid-cols-2">{[
    ['Find and manage a project','Open Projects, select a project, then use its workspace tabs for Asset Mapping, Ticket Management or Safe Applications.','/projects','Open Projects'],
    ['Track a ticket','Open Ticket Management to review status and priority across authorized projects. Select a ticket to assign work, comment, update status or verify resolution.','/operations/tickets','Open Ticket Management'],
    ['Request or approve access','Open User Management → Requests. Submit the required project or role with a business reason. Authorized administrators and project owners review requests.','/admin/requests','Open Requests'],
    ['Find operational guidance','Search Knowledge Base for procedures and feature guidance. Contact Support when you need help with an issue.','/knowledge','Open Knowledge Base'],
  ].map(([title,description,to,label])=><Section key={title} title={title}><p className="mb-4 text-sm text-muted">{description}</p><Button asChild variant="secondary"><Link to={to}>{label}</Link></Button></Section>)}</div><Section title="Keyboard navigation"><p className="text-sm text-muted">Use Tab to move between controls, Enter to activate a focused control, and Escape to close dialogs. Use ⌘K or Ctrl+K to search.</p></Section></div>
}
