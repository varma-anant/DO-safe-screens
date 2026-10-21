import * as React from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import { Bell, Check, ChevronDown, ChevronRight, ChevronsUpDown, FolderKanban, KeyRound, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, RotateCcw, Search, Sparkles, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { MAIN_NAV, FOOTER_NAV, type NavItem } from '@/app/navigation'
import { useUiStore } from '@/stores/ui'
import { useDbStore } from '@/stores/db'
import { cn, fmtRelative } from '@/utils/format'
import { can, ROLE_INFO, visibleProjectIds } from '@/utils/permissions'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Kbd, Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import * as api from '@/services/api'
import { GlobalSearch } from './GlobalSearch'
import { JOURNEY, stepFromStatus } from '@/modules/onboarding/journey'

function useMe() {
  return useDbStore((s) => s.db.users.find((u) => u.id === s.db.settings.currentUserId))
}

function useBadges() {
  return useDbStore(
    useShallow((s) => {
      const me = s.db.users.find((u) => u.id === s.db.settings.currentUserId)
      const pendingAccess = s.db.accessRequests.filter((r) => r.status === 'pending' && r.requesterId !== me?.id && (can(me, 'manage_users') || (r.projectId && s.db.projects.find((p) => p.id === r.projectId)?.ownerId === me?.id))).length
      const security = can(me, 'approve_high_impact') ? s.db.executions.filter((e) => e.approval?.status === 'pending').length + s.db.findings.filter((f) => f.riskAcceptance?.status === 'pending').length : 0
      const visible = new Set(visibleProjectIds(s.db, s.db.settings.currentUserId))
      return {
        requests: pendingAccess + security,
        notifications: s.db.notifications.filter((n) => !n.read).length,
        applications: s.db.services.filter((a) => a.status === 'active' && visible.has(a.projectId)).length,
      }
    }),
  )
}

function NavRow({ item, collapsed, badge, onNavigate }: { item: NavItem; collapsed: boolean; badge?: number; onNavigate?: () => void }) {
  return (
    <Tooltip content={collapsed ? (item.hint ? <><span className="font-semibold">{item.label}</span><span className="block text-muted">{item.hint}</span></> : item.label) : item.hint} side="right">
      {/* Wrapper element: Radix Slot would otherwise stringify NavLink's className function. */}
      <span className="block">
      <NavLink
        to={item.to}
        end={item.end ?? item.to === '/exposures'}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] transition-colors [&_svg]:size-[17px] [&_svg]:shrink-0',
            collapsed && 'justify-center px-0',
            isActive ? 'bg-surface font-medium text-fg shadow-sm ring-1 ring-border before:absolute before:inset-y-1.5 before:-left-2 before:w-[3px] before:rounded-full before:bg-primary [&_svg]:text-primary' : 'text-muted hover:bg-surface/70 hover:text-fg',
          )
        }
      >
        {item.icon}
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {!collapsed && badge ? <span className="num rounded-full bg-primary-soft px-1.5 text-[11px] font-semibold text-primary">{badge}</span> : null}
      </NavLink>
      </span>
    </Tooltip>
  )
}

/** Persistent "finish setup" card while an application is part-way through onboarding (or nothing is protected yet). */
function SetupGuide({ onNavigate }: { onNavigate?: () => void }) {
  const services = useDbStore((s) => s.db.services)
  const location = useLocation()
  const inProgress = services.find((s) => !['active', 'paused'].includes(s.status))
  const anyProtected = services.some((s) => s.status === 'active' || s.status === 'paused')
  if (location.pathname.startsWith('/onboarding') || (!inProgress && anyProtected)) return null
  const step = inProgress ? stepFromStatus(inProgress) : 0
  return (
    <Link to={inProgress ? `/onboarding?app=${inProgress.id}` : '/onboarding?new=1'} onClick={onNavigate} className="block rounded-xl border border-primary/25 bg-surface p-3 shadow-sm hover:border-primary/50">
      <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-primary">{inProgress ? 'Finish setup' : 'Get started'}</div>
      <div className="mt-0.5 truncate text-[13px] font-medium">{inProgress ? inProgress.name : 'Protect your first application'}</div>
      <div className="mt-0.5 text-[12px] text-muted">Step {step + 1} of {JOURNEY.length}: {JOURNEY[step].label}</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-primary" style={{ width: `${(step / JOURNEY.length) * 100}%` }} /></div>
    </Link>
  )
}

function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const me = useMe()
  const badges = useBadges()
  const navigate = useNavigate()
  const location = useLocation()
  const projects = useDbStore(useShallow((s) => s.db.projects.filter((p) => visibleProjectIds(s.db, s.db.settings.currentUserId).includes(p.id))))
  const currentProject = useDbStore((s) => s.db.settings.currentProjectId)
  const orgName = useDbStore((s) => s.db.settings.orgName)
  const [projectsOpen, setProjectsOpen] = React.useState(true)
  const allowed = (i: NavItem) => !i.cap || can(me, i.cap)
  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex items-center gap-2.5 px-4 pb-3 pt-4', collapsed && 'justify-center px-2')}>
        <Link to="/home" onClick={onNavigate} className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#1b1b25] text-[12px] font-bold text-white">DO</div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[15px] font-semibold leading-tight">DO SAFE</div>
              <div className="truncate text-[11.5px] leading-tight text-subtle">{orgName}</div>
            </div>
          )}
        </Link>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-3 pt-1" aria-label="Primary">
        {!collapsed && can(me, 'onboard_applications') && <SetupGuide onNavigate={onNavigate} />}
        <div>
          {!collapsed && <div className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">Workspace</div>}
          <ul className="space-y-0.5">
            {MAIN_NAV.filter(allowed).map((item) => (
              <li key={item.to}>
                <NavRow item={item} collapsed={collapsed} badge={item.badge ? badges[item.badge] : undefined} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          {!collapsed && (
            <div className="flex items-center justify-between px-2.5 pb-1.5">
              <button onClick={() => setProjectsOpen((o) => !o)} className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle hover:text-muted cursor-pointer" aria-expanded={projectsOpen}>
                Projects {projectsOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              </button>
              {can(me, 'create_project') && (
                <button onClick={() => { navigate('/onboarding?new=1'); onNavigate?.() }} className="rounded p-0.5 text-subtle hover:bg-surface hover:text-fg cursor-pointer" aria-label="New project">
                  <Plus className="size-3.5" />
                </button>
              )}
            </div>
          )}
          {(projectsOpen || collapsed) && (
            <ul className="space-y-0.5">
              {projects.map((p) => {
                const active = location.pathname === `/projects/${p.id}` || (currentProject === p.id && !location.pathname.startsWith('/projects/'))
                return (
                  <li key={p.id}>
                    <Tooltip content={collapsed ? p.name : undefined} side="right">
                      <button
                        onClick={() => { api.setCurrentProject(p.id); navigate(`/projects/${p.id}`); onNavigate?.() }}
                        className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[13.5px] cursor-pointer', collapsed && 'justify-center px-0', active ? 'bg-surface font-medium text-fg shadow-sm ring-1 ring-border' : 'text-muted hover:bg-surface/70 hover:text-fg')}
                      >
                        <FolderKanban className={cn('size-[17px] shrink-0', active && 'text-primary')} />
                        {!collapsed && <span className="truncate">{p.name}</span>}
                      </button>
                    </Tooltip>
                  </li>
                )
              })}
              {!projects.length && !collapsed && <li className="px-2.5 py-1 text-xs text-subtle">No projects yet</li>}
              {can(me, 'create_project') && !collapsed && (
                <li>
                  <button onClick={() => { navigate('/onboarding?new=1'); onNavigate?.() }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] text-primary hover:bg-surface/70 cursor-pointer">
                    <Plus className="size-[17px]" /> New project
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </nav>
      <div className="space-y-0.5 border-t border-border px-3 py-2">
        {FOOTER_NAV.filter(allowed).map((item) => (
          <NavRow key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </div>
      <div className="border-t border-border p-3">
        <UserCard collapsed={collapsed} />
      </div>
    </div>
  )
}

function UserCard({ collapsed }: { collapsed: boolean }) {
  const me = useMe()
  const navigate = useNavigate()
  const [reset, setReset] = React.useState(false)
  if (!me) return null
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn('flex w-full items-center gap-2.5 rounded-xl bg-surface px-2.5 py-2 text-left ring-1 ring-border hover:ring-border-strong cursor-pointer', collapsed && 'justify-center px-1')} aria-label="Account menu">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#4b3fa8] text-xs font-semibold text-white">{me.initials}</span>
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium leading-tight">{me.name}</span>
                <span className="block truncate text-[11.5px] leading-tight text-subtle">{ROLE_INFO[me.orgRole].label}</span>
              </span>
            )}
            {!collapsed && <ChevronsUpDown className="size-3.5 text-subtle" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-64">
          <DropdownMenuLabel>{me.email}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => navigate('/platform/settings')}>
            <UserRound /> My profile & access
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate('/requests?new=1')}>
            <KeyRound /> Request access
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setReset(true)}>
            <RotateCcw /> Reset demo data
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              api.logout()
              navigate('/login')
            }}
          >
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResetDialog open={reset} onOpenChange={setReset} />
    </>
  )
}

export function ResetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate()
  const ws = useDbStore((s) => s.db.settings.workspace)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Reset demo data?" description={ws === 'acme' ? 'Returns the Acme workspace to a brand-new, empty state.' : 'Regenerates the Northstar Financial Services dataset. Changes made in this browser are discarded.'}>
        <p className="text-xs text-muted">Only the local demo state in this browser is affected. You stay signed in.</p>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              api.resetDemo()
              onOpenChange(false)
              toast.success('Demo data reset')
              navigate('/home')
            }}
          >
            <RotateCcw /> Reset demo data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProjectSwitcher() {
  const projects = useDbStore(useShallow((s) => s.db.projects.filter((p) => visibleProjectIds(s.db, s.db.settings.currentUserId).includes(p.id))))
  const current = useDbStore((s) => s.db.settings.currentProjectId)
  const name = projects.find((p) => p.id === current)?.name ?? 'All projects'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-9 max-w-[240px] items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[13px] hover:border-border-strong cursor-pointer" aria-label="Select project">
          <FolderKanban className="size-4 shrink-0 text-primary" />
          <span className="truncate">{name}</span>
          <ChevronDown className="size-3.5 shrink-0 text-subtle" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Scope every screen to</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => api.setCurrentProject(null)}>
          <span className="flex-1">All projects</span>
          {!current && <Check className="!text-primary" />}
        </DropdownMenuItem>
        {projects.map((p) => (
          <DropdownMenuItem key={p.id} onSelect={() => api.setCurrentProject(p.id)}>
            <span className="flex-1 truncate">{p.name}</span>
            {current === p.id && <Check className="!text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Breadcrumbs() {
  const { title, crumbs } = useUiStore()
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#1b1b25] text-[9px] font-bold text-white">DO</span>
      <span className="shrink-0 text-subtle">DO SAFE</span>
      {crumbs.slice(0, -1).map((c, i) => (
        <React.Fragment key={i}>
          <span className="hidden text-subtle md:inline">/</span>
          {c.to ? (
            <Link to={c.to} className="hidden truncate text-subtle hover:text-fg md:inline">
              {c.label}
            </Link>
          ) : (
            <span className="hidden truncate text-subtle md:inline">{c.label}</span>
          )}
        </React.Fragment>
      ))}
      <span className="text-subtle">/</span>
      <span className="truncate font-medium text-fg">{title}</span>
    </nav>
  )
}

function NotificationsPopover() {
  const notifications = useDbStore((s) => s.db.notifications)
  const navigate = useNavigate()
  const unread = notifications.filter((n) => !n.read).length
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications (${unread} unread)`} className="relative">
          <Bell />
          {unread > 0 && <span className="num absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">{unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          <button className="text-xs text-primary hover:underline cursor-pointer" onClick={() => api.markNotificationRead('all')}>
            Mark all read
          </button>
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {notifications.slice(0, 10).map((n) => (
            <li key={n.id}>
              <button className={cn('flex w-full gap-3 border-b border-border/70 px-4 py-3 text-left hover:bg-surface-2 cursor-pointer', !n.read && 'bg-primary-soft/50')} onClick={() => { api.markNotificationRead(n.id); if (n.link) navigate(n.link) }}>
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-border-strong' : 'bg-primary')} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">{n.title}</span>
                  <span className="block truncate text-xs text-muted">{n.body}</span>
                  <span className="text-[11px] text-subtle">{fmtRelative(n.at)}</span>
                </span>
              </button>
            </li>
          ))}
          {!notifications.length && <li className="px-4 py-6 text-center text-xs text-muted">You're all caught up.</li>}
        </ul>
        <Link to="/platform/notifications" className="block px-4 py-2.5 text-center text-xs text-primary hover:underline">
          View all notifications
        </Link>
      </PopoverContent>
    </Popover>
  )
}

function AskBox() {
  const navigate = useNavigate()
  const [q, setQ] = React.useState('')
  return (
    <form className="relative hidden xl:block" onSubmit={(e) => { e.preventDefault(); navigate(`/intelligence?q=${encodeURIComponent(q || 'Summarize the current security posture')}`); setQ('') }}>
      <Sparkles className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-primary" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask DO SAFE…" aria-label="Ask DO SAFE" className="h-9 w-52 rounded-lg border border-border bg-surface pl-8 pr-3 text-sm placeholder:text-subtle focus:border-primary/50 focus:outline-none" />
    </form>
  )
}

/** Redirects to the login page when there is no active session. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const ok = useDbStore((s) => s.db.settings.authenticated && !!s.db.users.find((u) => u.id === s.db.settings.currentUserId && u.status === 'active'))
  const location = useLocation()
  if (!ok) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <>{children}</>
}

export function AppShell() {
  const { sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNav, setSearchOpen } = useUiStore()
  const location = useLocation()
  const mainRef = React.useRef<HTMLElement>(null)
  const me = useMe()
  React.useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [location.pathname])
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSearchOpen])
  return (
    <RequireAuth>
      <div className="flex h-full overflow-hidden bg-bg">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-white">
          Skip to content
        </a>
        <aside className={cn('hidden shrink-0 border-r border-border bg-sidebar transition-[width] lg:block', sidebarCollapsed ? 'w-[72px]' : 'w-[264px]')}>
          <Sidebar collapsed={sidebarCollapsed} />
        </aside>
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileNav(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 border-r border-border bg-sidebar">
              <Sidebar collapsed={false} onNavigate={() => setMobileNav(false)} />
            </aside>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="z-30 flex h-16 shrink-0 items-center gap-2.5 border-b border-border bg-surface/90 px-3 backdrop-blur sm:px-5">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation">
              <Menu />
            </Button>
            <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
            <div className="min-w-0 flex-1">
              <Breadcrumbs />
            </div>
            <div className="hidden md:block">
              <ProjectSwitcher />
            </div>
            <button onClick={() => setSearchOpen(true)} className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-subtle hover:border-border-strong lg:flex lg:w-52 cursor-pointer" aria-label="Search (Cmd+K)">
              <Search className="size-4" />
              <span className="flex-1 text-left">Search…</span>
              <Kbd>⌘K</Kbd>
            </button>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSearchOpen(true)} aria-label="Search">
              <Search />
            </Button>
            <AskBox />
            <Tooltip content="Interactive prototype: all records, scans, agent runs and estimates are simulated. Nothing is connected to real systems.">
              <span tabIndex={0} className="hidden items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11.5px] text-muted 2xl:inline-flex">
                <span className="size-1.5 rounded-full bg-primary" /> Interactive prototype
              </span>
            </Tooltip>
            <NotificationsPopover />
            {me && (
              <span className="hidden items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-[13px] sm:inline-flex">
                <span className="flex size-7 items-center justify-center rounded-full bg-[#4b3fa8] text-[11px] font-semibold text-white">{me.initials}</span>
                {ROLE_INFO[me.orgRole].label}
              </span>
            )}
          </header>
          <main id="main" ref={mainRef} className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1560px] px-4 py-6 sm:px-7">
              <Outlet />
            </div>
          </main>
        </div>
        <GlobalSearch />
      </div>
    </RequireAuth>
  )
}
