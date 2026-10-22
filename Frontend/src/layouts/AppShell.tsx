import { restrictForViewer } from '@/services/visibility'
import * as React from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import { Bell, Check, ChevronsUpDown, KeyRound, LogOut, Menu, PanelLeftClose, PanelLeftOpen, RotateCcw, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { FOOTER_NAV, mainNavFor, type NavItem } from '@/app/navigation'
import { useUiStore } from '@/stores/ui'
import { useDbStore } from '@/stores/db'
import { cn, fmtRelative } from '@/utils/format'
import { can, explain, JOB_INFO, jobOf, ROLE_INFO, VIEW_AREA, VIEW_CAPS, visibleProjectIds } from '@/utils/permissions'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import * as api from '@/services/api'
import { GlobalSearch } from './GlobalSearch'


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
        notifications: restrictForViewer('notifications', s.db.notifications, s.db).filter((n) => !n.read).length,
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

function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const me = useMe()
  const badges = useBadges()
  const orgName = useDbStore((s) => s.db.settings.orgName)
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
        <div>
          {!collapsed && <div className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">Workspace</div>}
          <ul className="space-y-0.5">
            {mainNavFor(me).map((item) => (
              <li key={item.to}>
                <NavRow item={item} collapsed={collapsed} badge={item.badge ? badges[item.badge] : undefined} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
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

/** Top-bar chip: who you are signed in as, and a plain explanation of what you can see and why. */
function AccessScope() {
  const me = useMe()!
  const db = useDbStore((s) => s.db)
  const project = db.projects.find((p) => p.id === db.settings.currentProjectId)
  const projects = visibleProjectIds(db, me.id)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="hidden items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-[13px] hover:border-border-strong sm:inline-flex cursor-pointer" aria-label="What you can see and why">
          <span className="flex size-7 items-center justify-center rounded-full bg-[#4b3fa8] text-[11px] font-semibold text-white">{me.initials}</span>
          {JOB_INFO[jobOf(me)].label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="border-b border-border px-4 py-3">
          <div className="text-[13.5px] font-semibold">{me.name}</div>
          <div className="text-[12px] text-muted">Job: {JOB_INFO[jobOf(me)].label} · Access: {ROLE_INFO[me.orgRole].label}</div>
        </div>
        <div className="space-y-3 px-4 py-3 text-[12.5px]">
          <div>
            <div className="font-medium">Viewing</div>
            <div className="text-muted">{project ? project.name : `All projects you can access (${projects.length})`}</div>
            <div className="mt-0.5 text-muted">{explain(me, 'view_all_projects')}</div>
          </div>
          <div>
            <div className="font-medium">Areas you can see</div>
            <ul className="mt-1 space-y-1">
              {VIEW_CAPS.map((v) => {
                const ok = can(me, v)
                return (
                  <li key={v} className="flex items-start gap-2">
                    {ok ? <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-label="Yes" /> : <span className="mt-0.5 size-3.5 shrink-0 text-center leading-none text-subtle" aria-label="No">–</span>}
                    <span className={ok ? '' : 'text-muted'}>{VIEW_AREA[v]}</span>
                  </li>
                )
              })}
            </ul>
          </div>
          <p className="rounded-lg bg-surface-2 p-2.5 text-muted">Your job decides what you see first and which areas you need; your access role decides what you can change. An administrator sets both.</p>
        </div>
        <div className="flex gap-2 border-t border-border px-4 py-3">
          <Button size="sm" variant="secondary" asChild><Link to="/platform/settings">My access</Link></Button>
          <Button size="sm" variant="ghost" asChild><Link to="/admin/requests?new=1">Ask for more access</Link></Button>
        </div>
      </PopoverContent>
    </Popover>
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
                <span className="block truncate text-[11.5px] leading-tight text-subtle">{JOB_INFO[jobOf(me)].label}</span>
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
          <DropdownMenuItem onSelect={() => navigate('/admin/requests?new=1')}>
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
  const db = useDbStore((s) => s.db)
  const notifications = restrictForViewer('notifications', db.notifications, db)
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
    if (['/home','/dashboard','/projects','/operations/tickets'].includes(location.pathname)) api.setCurrentProject(null)
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
            <NotificationsPopover />
            {me && <AccessScope />}
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
