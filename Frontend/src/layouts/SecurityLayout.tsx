import * as React from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { ChevronDown, ChevronRight, FolderKanban } from 'lucide-react'
import { securityNavFor, type NavGroup } from '@/app/navigation'
import { useCurrentUser } from '@/hooks/queries'
import { useDbStore } from '@/stores/db'
import { cn } from '@/utils/format'

function isActive(pathname: string, to: string, end?: boolean) {
  return end || to === '/exposures' ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
}

/**
 * Inner navigation for the security workspace, scoped to the project selected in the top bar.
 * The person's job decides which groups come first; other areas they may open sit under "More tools".
 */
export function SecurityLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const project = useDbStore((s) => s.db.projects.find((p) => p.id === s.db.settings.currentProjectId))
  const me = useCurrentUser()
  const { focus, more } = securityNavFor(me)
  const all = [...focus, ...more]
  const overviewTo = project ? `/projects/${project.id}` : '/projects'
  const resolve = (to: string) => (to === '/projects' ? overviewTo : to)
  const activeGroup = all.find((g) => g.items.some((i) => isActive(location.pathname, resolve(i.to), i.end)))?.label
  const [open, setOpen] = React.useState<Record<string, boolean>>({})
  const [moreOpen, setMoreOpen] = React.useState(false)
  const showMore = moreOpen || more.some((g) => g.label === activeGroup)
  const groupOpen = (label: string) => open[label] ?? (label === activeGroup || label === focus[0]?.label)

  const renderGroups = (groups: NavGroup[]) =>
    groups.map((g) => (
      <div key={g.label}>
        <button onClick={() => setOpen((o) => ({ ...o, [g.label]: !groupOpen(g.label) }))} className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-subtle hover:text-muted cursor-pointer" aria-expanded={groupOpen(g.label)}>
          {g.label}
          {groupOpen(g.label) ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </button>
        {groupOpen(g.label) && (
          <ul className="mb-1 space-y-0.5">
            {g.items.map((item) => {
              const to = resolve(item.to)
              return (
                <li key={item.label}>
                  <NavLink to={to} end={item.end} className={() => cn('flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] [&_svg]:size-4 [&_svg]:shrink-0', isActive(location.pathname, to, item.end) ? 'bg-primary-soft font-medium text-primary' : 'text-muted hover:bg-surface-2 hover:text-fg')}>
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    ))

  return (
    <div className="flex gap-6">
      <aside className="hidden w-[232px] shrink-0 xl:block">
        <div className="card sticky top-0 max-h-[calc(100vh-7.5rem)] overflow-y-auto p-3">
          <Link to={overviewTo} className="mb-2 flex items-center gap-2.5 rounded-lg bg-surface-2 px-3 py-2.5 hover:bg-surface-3">
            <FolderKanban className="size-4 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-subtle">{project ? 'Project' : 'Scope'}</span>
              <span className="block truncate text-[13px] font-medium">{project?.name ?? 'All projects'}</span>
            </span>
          </Link>
          <nav aria-label="Security workspace" className="space-y-1">
            {renderGroups(focus)}
            {more.length > 0 && (
              <div className="mt-2 border-t border-border pt-2">
                <button onClick={() => setMoreOpen((v) => !v)} aria-expanded={showMore} className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[12px] font-medium text-muted hover:text-fg cursor-pointer">
                  More tools you can open
                  {showMore ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                </button>
                {showMore && renderGroups(more)}
              </div>
            )}
          </nav>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="mb-4 xl:hidden">
          <select
            aria-label="Security workspace section"
            className="h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm"
            value={all.flatMap((g) => g.items).find((i) => isActive(location.pathname, resolve(i.to), i.end))?.label ?? ''}
            onChange={(e) => {
              const item = all.flatMap((g) => g.items).find((i) => i.label === e.target.value)
              if (item) navigate(resolve(item.to))
            }}
          >
            <option value="" disabled>
              Go to section…
            </option>
            {all.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((i) => (
                  <option key={i.label} value={i.label}>
                    {i.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
