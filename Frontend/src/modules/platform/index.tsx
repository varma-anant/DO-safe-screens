import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { createColumnHelper } from '@tanstack/react-table'
import { Bell, CheckCheck, ScrollText } from 'lucide-react'
import type { AuditEvent, Severity } from '@/types'
import { useCollections, useUsers } from '@/hooks/queries'
import { usePage } from '@/hooks/usePage'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/common/layout'
import { Badge } from '@/components/common/badges'
import { RelTime, UserName } from '@/components/common/entities'
import { DataTable } from '@/components/common/DataTable'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import * as api from '@/services/api'
import { cn, fmtDateTime } from '@/utils/format'

const auditCol = createColumnHelper<AuditEvent & { actor: string }>()

export function AuditPage() {
  usePage('Audit Logs', [{ label: 'Platform' }, { label: 'Audit Logs' }])
  const users = useUsers()
  const { data, isLoading, error, retry } = useCollections(['audit'] as const)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={14} />
  const rows = data.audit.map((a) => ({ ...a, actor: a.actorId === 'SYSTEM' ? 'DO SAFE (system)' : users.find((u) => u.id === a.actorId)?.name ?? a.actorId }))
  const columns = [
    auditCol.accessor('at', { header: 'Timestamp', cell: (c) => <span className="whitespace-nowrap text-xs">{fmtDateTime(c.getValue())}</span> }),
    auditCol.accessor('actor', { header: 'Actor', filterFn: 'multi', cell: (c) => <UserName id={c.row.original.actorId} /> }),
    auditCol.accessor('action', { header: 'Action', filterFn: 'multi', cell: (c) => <span className="font-medium">{c.getValue()}</span> }),
    auditCol.accessor('module', { header: 'Module', filterFn: 'multi', cell: (c) => <Badge>{c.getValue()}</Badge> }),
    auditCol.accessor('entityId', { header: 'Record', cell: (c) => <span className="font-mono text-[11px] text-violet-700">{c.getValue()}</span> }),
    auditCol.accessor('details', { header: 'Details', cell: (c) => <span className="block max-w-[460px] truncate text-xs text-muted">{c.getValue()}</span> }),
  ]
  return (
    <div className="space-y-5">
      <PageHeader title="Audit Logs" icon={<ScrollText />} description="Immutable record of important decisions and activity: status changes, false-positive decisions, approvals, agent runs, configuration changes and more." />
      <DataTable tableId="audit" data={rows} columns={columns} getRowId={(a) => a.id} searchPlaceholder="Search actions, records, details…" facets={[{ columnId: 'module', label: 'Module' }, { columnId: 'actor', label: 'Actor' }, { columnId: 'action', label: 'Action' }]} views={[{ id: 'all', label: 'All events', filters: [] }, { id: 'decisions', label: 'Analyst decisions', filters: [{ id: 'action', value: ['false positive confirmed', 'false positive review', 'finding reopened', 'risk acceptance approved', 'risk acceptance rejected', 'agent action approved', 'agent action rejected'] }] }, { id: 'agents', label: 'Agent activity', filters: [{ id: 'module', value: ['Intelligence'] }] }, { id: 'tprm', label: 'TPRM', filters: [{ id: 'module', value: ['TPRM'] }] }]} initialViewId="all" pageSize={20} selectable={false} exportName="do-safe-audit-log" exportRow={(a) => ({ timestamp: a.at, actor: a.actor, action: a.action, module: a.module, entity_type: a.entityType, entity_id: a.entityId, details: a.details })} />
    </div>
  )
}

export function NotificationsPage() {
  usePage('Notifications', [{ label: 'Platform' }, { label: 'Notifications' }])
  const navigate = useNavigate()
  const { data, isLoading, error, retry } = useCollections(['notifications'] as const)
  const [filter, setFilter] = React.useState<'all' | 'unread' | 'assignments' | 'approvals' | 'alerts'>('all')
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={10} />
  const matches = (n: typeof data.notifications[number]) => filter === 'all' || (filter === 'unread' ? !n.read : filter === 'assignments' ? /assign/i.test(n.title) : filter === 'approvals' ? /approv|request|declin/i.test(n.title) : !/assign|approv|request|declin/i.test(n.title))
  const list = data.notifications.filter(matches)
  const dot: Record<Severity | 'info', string> = { critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-amber-500', low: 'bg-emerald-500', informational: 'bg-slate-400', info: 'bg-violet-500' }
  return (
    <div className="space-y-5">
      <PageHeader title="Notifications" icon={<Bell />} description="Assignments, approvals, alerts and status changes relevant to you." actions={<Button variant="secondary" onClick={() => api.markNotificationRead('all')}><CheckCheck /> Mark all read</Button>} />
      <div className="flex flex-wrap gap-1.5">
        {(['all', 'unread', 'assignments', 'approvals', 'alerts'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn('rounded-full border px-3 py-1 text-xs capitalize cursor-pointer', filter === f ? 'border-violet-500/50 bg-violet-500/15 text-violet-700' : 'border-border text-muted')}>{f}</button>
        ))}
      </div>
      <Link to="/platform/settings/preferences" className="inline-block text-xs text-primary">Notification preferences</Link>
      <Card className="divide-y divide-border/60">
        {list.map((n) => (
          <button key={n.id} onClick={() => { api.markNotificationRead(n.id); if (n.link) navigate(n.link) }} className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-2/50 cursor-pointer', !n.read && 'bg-violet-500/5')}>
            <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', dot[n.severity], n.read && 'opacity-40')} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium">{n.title}</span>
              <span className="block text-xs text-muted">{n.body}</span>
            </span>
            <RelTime iso={n.at} className="text-xs" />
          </button>
        ))}
        {!list.length && <EmptyState title="No notifications" />}
      </Card>
    </div>
  )
}
