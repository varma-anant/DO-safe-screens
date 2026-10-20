import * as React from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Bell, ChevronDown, ChevronRight, FlaskConical, History, Menu, PanelLeftClose, PanelLeftOpen, RotateCcw, Search, Settings, Sparkles, UserRound, Building, Check } from 'lucide-react'
import { toast } from 'sonner'
import { NAV } from '@/app/navigation'
import { useUiStore } from '@/stores/ui'
import { useDbStore } from '@/stores/db'
import { useShallow } from 'zustand/react/shallow'
import { cn, fmtRelative } from '@/utils/format'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Kbd, Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import * as api from '@/services/api'
import { GlobalSearch } from './GlobalSearch'
import { EntityIcon, entityPath, UserName } from '@/components/common/entities'
import { isOpen } from '@/utils/labels'

function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const location = useLocation()
  const counts = useDbStore(useShallow((s) => ({
    critical: s.db.findings.filter((f) => f.severity === 'critical' && isOpen(f.status) && f.domain !== 'ai').length,
    approvals: s.db.executions.filter((e) => e.approval?.status === 'pending').length + s.db.findings.filter((f) => f.riskAcceptance?.status === 'pending').length + s.db.governanceReviews.filter((g) => g.status === 'open').length,
    incidents: s.db.incidents.filter((i) => i.status !== 'closed').length,
    shadow: s.db.aiSystems.filter((a) => a.approval === 'unsanctioned').length,
    running: s.db.agents.filter((a) => a.status === 'running').length,
    agents: s.db.agents.filter((a) => a.enabled).length,
  })))
  const badge: Record<string, number> = { '/exposures/vulnerabilities': counts.critical, '/operations/approvals': counts.approvals, '/operations/incidents': counts.incidents, '/ai-security/shadow-ai': counts.shadow }
  const activeGroup = NAV.find((g) => g.items.some((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to))))?.label
  const [open, setOpen] = React.useState<Record<string, boolean>>({})
  const isGroupOpen = (label: string) => open[label] ?? (label === activeGroup || label === 'Overview')

  return (
    <div className="flex h-full flex-col">
      <Link to="/dashboard" className={cn('flex items-center gap-2.5 border-b border-border px-4 py-4', collapsed && 'justify-center px-2')} onClick={onNavigate}>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-emerald-500 text-[13px] font-bold text-white shadow-lg shadow-violet-900/40">DO</div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-[15px] font-semibold leading-tight tracking-tight">DO SAFE</div>
            <div className="text-[11px] leading-tight text-muted">Unified · Autonomous Cyber Risk</div>
          </div>
        )}
      </Link>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3" aria-label="Primary">
        {NAV.map((group) => (
          <div key={group.label} className="mb-1">
            {!collapsed && (
              <button onClick={() => setOpen((o) => ({ ...o, [group.label]: !isGroupOpen(group.label) }))} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle hover:text-muted cursor-pointer" aria-expanded={isGroupOpen(group.label)}>
                <span>{group.label}</span>
                <span className="flex items-center gap-1 normal-case tracking-normal">
                  {group.module && <span className="text-[10px] font-medium text-subtle/80">{group.module}</span>}
                  {isGroupOpen(group.label) ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                </span>
              </button>
            )}
            {(collapsed || isGroupOpen(group.label)) && (
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <Tooltip content={collapsed ? item.label : undefined} side="right">
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          cn(
                            'group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors [&_svg]:size-4 [&_svg]:shrink-0',
                            collapsed && 'justify-center px-0',
                            isActive ? 'bg-primary-soft font-medium text-fg shadow-[inset_2px_0_0_#8b5cf6] [&_svg]:text-violet-300' : 'text-muted hover:bg-surface-2 hover:text-fg [&_svg]:text-subtle group-hover:[&_svg]:text-muted',
                          )
                        }
                      >
                        {item.icon}
                        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                        {!collapsed && badge[item.to] ? <span className="num rounded-md bg-red-500/15 px-1.5 text-[10px] font-semibold text-red-300">{badge[item.to]}</span> : null}
                      </NavLink>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </nav>
      <div className={cn('border-t border-border px-4 py-3 text-xs text-muted', collapsed && 'px-2 text-center')}>
        <Link to="/intelligence/agents" className="flex items-center gap-2 hover:text-fg" onClick={onNavigate}>
          <span className="pulse-dot size-2 shrink-0 rounded-full bg-emerald-400" />
          {!collapsed && (
            <span>
              {counts.agents} agents enabled · {counts.running} running <span className="text-subtle">(simulated)</span>
            </span>
          )}
        </Link>
      </div>
    </div>
  )
}

function Breadcrumbs() {
  const { title, crumbs } = useUiStore()
  return (
    <div className="min-w-0">
      {crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 overflow-hidden text-[11px] text-subtle">
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight className="size-3 shrink-0" />}
              {c.to ? (
                <Link to={c.to} className="truncate hover:text-fg">
                  {c.label}
                </Link>
              ) : (
                <span className="truncate">{c.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      <h2 className="truncate text-[15px] font-semibold leading-tight">{title}</h2>
    </div>
  )
}

function NotificationsPopover() {
  const notifications = useDbStore((s) => s.db.notifications)
  const navigate = useNavigate()
  const unread = notifications.filter((n) => !n.read).length
  const dot = { critical: 'bg-red-400', high: 'bg-orange-400', medium: 'bg-amber-400', low: 'bg-emerald-400', informational: 'bg-slate-400', info: 'bg-violet-400' }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications (${unread} unread)`} className="relative">
          <Bell />
          {unread > 0 && <span className="num absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">{unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          <button className="text-xs text-violet-300 hover:text-violet-200 cursor-pointer" onClick={() => api.markNotificationRead('all')}>
            Mark all read
          </button>
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {notifications.slice(0, 12).map((n) => (
            <li key={n.id}>
              <button
                className={cn('flex w-full gap-3 border-b border-border/60 px-4 py-3 text-left hover:bg-surface-3 cursor-pointer', !n.read && 'bg-violet-500/5')}
                onClick={() => {
                  api.markNotificationRead(n.id)
                  if (n.link) navigate(n.link)
                }}
              >
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', dot[n.severity], n.read && 'opacity-40')} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">{n.title}</span>
                  <span className="block truncate text-xs text-muted">{n.body}</span>
                  <span className="text-[11px] text-subtle">{fmtRelative(n.at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Link to="/platform/notifications" className="block px-4 py-2.5 text-center text-xs text-violet-300 hover:text-violet-200">
          View all notifications
        </Link>
      </PopoverContent>
    </Popover>
  )
}

function RecentActivityPopover() {
  const audit = useDbStore(useShallow((s) => s.db.audit.slice(0, 10)))
  const recent = useDbStore(useShallow((s) => s.db.settings.recentRecords ?? []))
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Recent activity">
          <History />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0">
        {recent.length > 0 && (
          <div className="border-b border-border px-4 py-3">
            <div className="label-xs mb-2">Recently viewed</div>
            <ul className="space-y-1.5">
              {recent.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link to={entityPath(r.type, r.id)} className="flex items-center gap-2 text-[13px] hover:text-violet-200">
                    <EntityIcon type={r.type} />
                    <span className="font-mono text-[11px] text-muted">{r.id}</span>
                    <span className="truncate">{r.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="px-4 py-3">
          <div className="label-xs mb-2">Recent platform activity</div>
          <ul className="max-h-72 space-y-2.5 overflow-y-auto">
            {audit.map((a) => (
              <li key={a.id} className="text-xs">
                <div className="text-fg">
                  <UserName id={a.actorId} avatar={false} /> <span className="text-muted">{a.action}</span> <span className="font-mono text-[11px] text-violet-300">{a.entityId}</span>
                </div>
                <div className="truncate text-subtle">
                  {a.details} · {fmtRelative(a.at)}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <Link to="/platform/audit" className="block border-t border-border px-4 py-2.5 text-center text-xs text-violet-300 hover:text-violet-200">
          Open audit log
        </Link>
      </PopoverContent>
    </Popover>
  )
}

function UserMenu() {
  const users = useDbStore((s) => s.db.users)
  const currentId = useDbStore((s) => s.db.settings.currentUserId)
  const me = users.find((u) => u.id === currentId)!
  const navigate = useNavigate()
  const [confirmReset, setConfirmReset] = React.useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-surface-2 cursor-pointer" aria-label="User menu">
            <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-emerald-600 text-xs font-bold text-white">{me.initials}</span>
            <span className="hidden text-left lg:block">
              <span className="block text-[13px] font-medium leading-tight">{me.name}</span>
              <span className="block text-[11px] leading-tight text-muted">{me.role}</span>
            </span>
            <ChevronDown className="hidden size-3.5 text-muted lg:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72">
          <DropdownMenuLabel>Switch persona (demo)</DropdownMenuLabel>
          {users.filter((u) => u.isPersona).map((u) => (
            <DropdownMenuItem
              key={u.id}
              onSelect={() => {
                api.setCurrentUser(u.id)
                toast.success(`Now acting as ${u.name} (${u.role})`)
                const landing: Record<string, string> = { CISO: '/dashboard', 'Security Analyst': '/exposures/vulnerabilities', 'TPRM Manager': '/tprm', 'AI Security Analyst': '/ai-security', 'Risk Manager': '/crq', 'Platform Administrator': '/integrations' }
                navigate(landing[u.role] ?? '/dashboard')
              }}
            >
              <UserRound />
              <span className="flex-1">
                {u.name} <span className="text-muted">· {u.role}</span>
              </span>
              {u.id === currentId && <Check className="!text-violet-300" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate('/platform/settings')}>
            <Settings /> Settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirmReset(true)} className="text-red-300">
            <RotateCcw /> Reset demo data
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResetDialog open={confirmReset} onOpenChange={setConfirmReset} />
    </>
  )
}

export function ResetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Reset demo data?" description="Regenerates the deterministic Northstar Financial Services dataset. All changes made in this browser (tickets, reviews, assessments, simulations) will be discarded.">
        <p className="text-xs text-muted">This affects only the local demo state stored in this browser.</p>
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
              navigate('/dashboard')
            }}
          >
            <RotateCcw /> Reset demo data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AskBox() {
  const navigate = useNavigate()
  const [q, setQ] = React.useState('')
  return (
    <form
      className="relative hidden xl:block"
      onSubmit={(e) => {
        e.preventDefault()
        navigate(`/intelligence?q=${encodeURIComponent(q || 'Summarize the current security posture')}`)
        setQ('')
      }}
    >
      <Sparkles className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-violet-300" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask DO SAFE…" aria-label="Ask DO SAFE intelligence" className="h-9 w-56 rounded-lg border border-violet-500/25 bg-violet-500/8 pl-8 pr-3 text-sm placeholder:text-violet-200/50 focus:border-violet-500/60 focus:outline-none" />
    </form>
  )
}

export function AppShell() {
  const { sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNav, setSearchOpen } = useUiStore()
  const location = useLocation()
  const mainRef = React.useRef<HTMLElement>(null)

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
    <div className="flex h-full overflow-hidden">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded focus:bg-violet-600 focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className={cn('hidden shrink-0 border-r border-border bg-surface/80 transition-[width] lg:block', sidebarCollapsed ? 'w-[68px]' : 'w-64')}>
        <Sidebar collapsed={sidebarCollapsed} />
      </aside>
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNav(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-border bg-surface">
            <Sidebar collapsed={false} onNavigate={() => setMobileNav(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border px-3 sm:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
          <div className="min-w-0 flex-1">
            <Breadcrumbs />
          </div>
          <button onClick={() => setSearchOpen(true)} className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-sm text-subtle hover:border-border-strong md:flex md:w-56 lg:w-64 cursor-pointer" aria-label="Search (Cmd+K)">
            <Search className="size-4" />
            <span className="flex-1 text-left">Search records…</span>
            <Kbd>⌘K</Kbd>
          </button>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSearchOpen(true)} aria-label="Search">
            <Search />
          </Button>
          <AskBox />
          <Tooltip content="Demo mode: every record, scan result, agent run and estimate in this prototype is simulated. No real systems are connected.">
            <span tabIndex={0} className="hidden items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300 sm:inline-flex">
              <FlaskConical className="size-3" /> DEMO MODE
            </span>
          </Tooltip>
          <WorkspaceMenu />
          <RecentActivityPopover />
          <NotificationsPopover />
          <UserMenu />
        </header>
        <main id="main" ref={mainRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
            <Outlet />
          </div>
        </main>
      </div>
      <GlobalSearch />
    </div>
  )
}

function WorkspaceMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="hidden 2xl:inline-flex" aria-label="Workspace">
          <Building /> Northstar Financial <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72">
        <DropdownMenuLabel>Organization / workspace</DropdownMenuLabel>
        <DropdownMenuItem>
          <Building /> <span className="flex-1">Northstar Financial Services · Production</span> <Check className="!text-violet-300" />
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toast.info('Additional workspaces are not available in the demo. Multi-workspace support is planned with the enterprise platform package.')}>
          <Building /> Northstar · M&A due diligence (sandbox)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
