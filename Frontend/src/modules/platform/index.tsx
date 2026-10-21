import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { createColumnHelper } from '@tanstack/react-table'
import { Bell, CheckCheck, Download, FlaskConical, RotateCcw, ScrollText, Settings } from 'lucide-react'
import type { AuditEvent, Severity } from '@/types'
import { useAction, useCollections, useCurrentUser, useSettings, useUsers } from '@/hooks/queries'
import { usePage } from '@/hooks/usePage'
import { Callout, EmptyState, ErrorState, KeyValue, LoadingState, PageHeader, Section } from '@/components/common/layout'
import { Badge } from '@/components/common/badges'
import { RelTime, UserName } from '@/components/common/entities'
import { DataTable } from '@/components/common/DataTable'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Slider, Switch } from '@/components/ui/misc'
import { ResetDialog } from '@/layouts/AppShell'
import * as api from '@/services/api'
import { getDb, useDbStore } from '@/stores/db'
import { can, CAPABILITY_LABEL, ROLE_INFO, visibleProjectIds } from '@/utils/permissions'
import { cn, downloadText, fmtDateTime } from '@/utils/format'

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
  const [filter, setFilter] = React.useState<'all' | 'unread'>('all')
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={10} />
  const list = data.notifications.filter((n) => filter === 'all' || !n.read)
  const dot: Record<Severity | 'info', string> = { critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-amber-500', low: 'bg-emerald-500', informational: 'bg-slate-400', info: 'bg-violet-500' }
  return (
    <div className="space-y-5">
      <PageHeader title="Notification Hub" icon={<Bell />} description="Assignments, approvals, alerts and status changes relevant to you." actions={<Button variant="secondary" onClick={() => api.markNotificationRead('all')}><CheckCheck /> Mark all read</Button>} />
      <div className="flex gap-1.5">
        {(['all', 'unread'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn('rounded-full border px-3 py-1 text-xs capitalize cursor-pointer', filter === f ? 'border-violet-500/50 bg-violet-500/15 text-violet-700' : 'border-border text-muted')}>{f} ({f === 'all' ? data.notifications.length : data.notifications.filter((n) => !n.read).length})</button>
        ))}
      </div>
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

export function SettingsPage() {
  usePage('Settings', [{ label: 'Platform' }, { label: 'Settings' }])
  const settings = useSettings()
  const me = useCurrentUser()
  const db = useDbStore((s) => s.db)
  const myProjects = visibleProjectIds(db, me.id)
  const { run } = useAction()
  const [reset, setReset] = React.useState(false)
  const [sla, setSla] = React.useState(settings.slaDays)
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" icon={<Settings />} description="Your profile and access, workspace policy and demo controls." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="My profile & access" description="Who you are signed in as and what your role lets you do. Access is managed in User management.">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-[#ece9fb] text-sm font-semibold text-primary">{me.initials}</span>
            <div>
              <div className="text-[14px] font-semibold">{me.name}</div>
              <div className="text-xs text-muted">{me.email} · {me.team}</div>
            </div>
            <Badge className="ml-auto" tone="violet">{ROLE_INFO[me.orgRole].label}</Badge>
          </div>
          <KeyValue className="mt-4" cols={2} items={[
            { label: 'Workspace', value: settings.orgName },
            { label: 'Sign-in', value: settings.identity.provider },
            { label: 'MFA', value: me.mfaEnabled ? 'Enabled' : 'Not enabled' },
            { label: 'Projects', value: can(me, 'view_all_projects') ? 'All projects' : `${myProjects.length} project${myProjects.length === 1 ? '' : 's'}` },
          ]} />
          <div className="mt-4 text-xs font-medium text-muted">What you can do</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ROLE_INFO[me.orgRole].caps.map((c) => <Badge key={c}>{CAPABILITY_LABEL[c]}</Badge>)}
            {!ROLE_INFO[me.orgRole].caps.length && <span className="text-xs text-subtle">Read-only access to your projects.</span>}
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="secondary" asChild><Link to="/requests?new=1">Request more access</Link></Button>
            {can(me, 'manage_users') && <Button size="sm" variant="ghost" asChild><Link to="/admin">User management</Link></Button>}
          </div>
        </Section>
        <Section title="Demo controls" description="Settings that shape the demo experience">
          <div className="space-y-5">
            <div>
              <div className="mb-1.5 flex justify-between text-xs"><span>Simulated API latency</span><span className="num">{settings.latencyMs} ms</span></div>
              <Slider value={[settings.latencyMs]} min={0} max={1200} step={20} onValueCommit={([v]) => run(() => api.updateSettings({ latencyMs: v }, `Latency → ${v}ms`))} onValueChange={() => undefined} aria-label="Latency" />
              <p className="mt-1 text-[11px] text-subtle">Controls loading states. Set to 0 for presentations.</p>
            </div>
            <label className="flex items-center justify-between gap-3 text-[13px]">
              <span>Simulate API errors <span className="block text-[11px] text-subtle">~35% of requests fail — demonstrates error and retry states</span></span>
              <Switch checked={!!settings.simulateErrors} onCheckedChange={(v) => run(() => api.updateSettings({ simulateErrors: v }, `Simulated errors ${v ? 'on' : 'off'}`), v ? 'Simulated errors enabled' : 'Simulated errors disabled')} />
            </label>
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button variant="destructive" onClick={() => setReset(true)}><RotateCcw /> Reset demo data</Button>
              <Button variant="secondary" onClick={() => downloadText(`do-safe-demo-state-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ _note: 'DO SAFE demo state — simulated data', ...getDb() }, null, 2), 'application/json')}><Download /> Export demo state (JSON)</Button>
            </div>
            <KeyValue cols={2} items={[{ label: 'Dataset seeded', value: fmtDateTime(settings.seededAt) }, { label: 'Persistence', value: 'Browser localStorage' }]} />
          </div>
        </Section>
        <Section title="Remediation SLA policy" description="Target days to remediate by severity — drives due dates and overdue status for new findings">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['critical', 'high', 'medium', 'low'] as const).map((s) => (
              <label key={s} className="text-xs">
                <span className="mb-1 block capitalize text-muted">{s}</span>
                <Input type="number" min={1} value={sla[s]} onChange={(e) => setSla({ ...sla, [s]: Number(e.target.value) })} />
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" disabled={JSON.stringify(sla) === JSON.stringify(settings.slaDays) || Object.values(sla).some((v) => !v || v < 1)} onClick={() => run(() => api.updateSettings({ slaDays: sla }, 'SLA policy updated'), 'SLA policy saved')}>Save SLA policy</Button>
          </div>
        </Section>
        <Section title="Risk prioritization" description="Weights for the dynamic risk score">
          <KeyValue cols={2} items={Object.entries(settings.weights).map(([k, v]) => ({ label: k.replace(/([A-Z])/g, ' $1'), value: v }))} />
          <Button asChild size="sm" variant="secondary" className="mt-3"><Link to="/exposures/prioritization">Tune weights</Link></Button>
        </Section>
      </div>
      <Callout tone="demo" icon={<FlaskConical />} title="About this prototype">
        DO SAFE Unified frontend prototype by DataObserve. All organizations, people, assets, findings, vendors, AI systems and figures are fictional or simulated. Real CVE / CWE / ATT&CK / OWASP identifiers are summarized from public sources as a static snapshot. No scanning, exploitation, live integration or remediation is performed.
      </Callout>
      <ResetDialog open={reset} onOpenChange={setReset} />
    </div>
  )
}
