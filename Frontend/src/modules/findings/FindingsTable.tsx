import * as React from 'react'
import { useNavigate } from 'react-router'
import { createColumnHelper, type ColumnFiltersState } from '@tanstack/react-table'
import { AlarmClock, UserPlus, Ticket as TicketIcon, CheckCircle2 } from 'lucide-react'
import type { Asset, BusinessService, Finding, User } from '@/types'
import { DataTable, type SavedView } from '@/components/common/DataTable'
import { FindingStatusBadge, KevBadge, RiskScore, SeverityBadge } from '@/components/common/badges'
import { entityPath, RelTime, UserName } from '@/components/common/entities'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, NativeSelect } from '@/components/ui/input'
import { useDbStore } from '@/stores/db'
import { useAction } from '@/hooks/queries'
import * as api from '@/services/api'
import { fmtDate } from '@/utils/format'
import { FINDING_STATUS, SEVERITY_ORDER, SEVERITY_RANK } from '@/utils/labels'
import { isOverdue } from '@/utils/risk'
import type { ScoredFinding } from '@/utils/derive'

const ch = createColumnHelper<ScoredFinding>()

export const FINDING_VIEWS: SavedView[] = [
  { id: 'all', label: 'All findings', filters: [] },
  { id: 'critical', label: 'Critical findings', filters: [{ id: 'severity', value: ['critical'] }, { id: 'status', value: ['new', 'triaged', 'in_validation', 'validated', 'in_remediation', 'pending_verification'] }] },
  { id: 'internet', label: 'Internet-exposed', filters: [{ id: 'exposure', value: ['Internet-facing'] }, { id: 'status', value: ['new', 'triaged', 'in_validation', 'validated', 'in_remediation', 'pending_verification'] }] },
  { id: 'kev', label: 'Known exploited (KEV)', filters: [{ id: 'kev', value: ['KEV'] }] },
  { id: 'validation', label: 'Awaiting validation', filters: [{ id: 'status', value: ['new', 'triaged', 'in_validation'] }] },
  { id: 'overdue', label: 'Overdue remediation', filters: [{ id: 'sla', value: ['Overdue'] }] },
  { id: 'fp', label: 'False positives', filters: [{ id: 'status', value: ['false_positive'] }] },
  { id: 'resolved', label: 'Resolved', filters: [{ id: 'status', value: ['resolved'] }] },
]

export function FindingsTable({ rows, tableId, views = FINDING_VIEWS, initialViewId, initialFilters, hideColumns = [], showAI = false, pageSize }: { rows: ScoredFinding[]; tableId: string; views?: SavedView[]; initialViewId?: string; initialFilters?: ColumnFiltersState; hideColumns?: string[]; showAI?: boolean; pageSize?: number }) {
  const navigate = useNavigate()
  const integrations = useDbStore((s) => s.db.integrations)
  const aiSystems = useDbStore((s) => s.db.aiSystems)
  const users = useDbStore((s) => s.db.users)
  const [assignOpen, setAssignOpen] = React.useState<Finding[] | null>(null)
  const [ticketOpen, setTicketOpen] = React.useState<Finding[] | null>(null)
  const { run } = useAction()

  const columns = React.useMemo(
    () => [
      ch.accessor('score', { header: 'Risk', cell: (c) => <RiskScore score={c.getValue()} />, size: 60, sortDescFirst: true }),
      ch.accessor((r) => r.f.id, { id: 'id', header: 'ID', cell: (c) => <span className="font-mono text-[11px] text-muted">{c.getValue()}</span>, size: 90 }),
      ch.accessor((r) => r.f.title, {
        id: 'title',
        header: 'Finding',
        cell: (c) => (
          <div className="min-w-[240px] max-w-[380px]">
            <div className="truncate font-medium text-fg">{c.getValue()}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-subtle">
              <span>{c.row.original.f.category}</span>
              {c.row.original.f.cveId && <span className="font-mono text-sky-300/80">{c.row.original.f.cveId}</span>}
              {c.row.original.f.kev && <KevBadge />}
              {c.row.original.f.tags.includes('imported-demo') && <span className="text-emerald-300/80">· newly imported</span>}
            </div>
          </div>
        ),
      }),
      ch.accessor((r) => r.f.severity, { id: 'severity', header: 'Severity', cell: (c) => <SeverityBadge severity={c.getValue()} />, filterFn: 'multi', sortingFn: (a, b) => SEVERITY_RANK[a.original.f.severity] - SEVERITY_RANK[b.original.f.severity] }),
      ch.accessor((r) => r.f.status, { id: 'status', header: 'Status', cell: (c) => <FindingStatusBadge status={c.getValue()} />, filterFn: 'multi' }),
      ch.accessor((r) => (r.f.aiSystemId ? aiSystems.find((a) => a.id === r.f.aiSystemId)?.name : r.asset?.name) ?? '—', { id: 'target', header: showAI ? 'Asset / AI system' : 'Asset', cell: (c) => <span className="whitespace-nowrap">{c.getValue()}</span> }),
      ch.accessor((r) => r.service?.name ?? '—', { id: 'service', header: 'Business service', filterFn: 'multi', cell: (c) => <span className="whitespace-nowrap text-muted">{c.getValue()}</span> }),
      ch.accessor((r) => r.f.category, { id: 'category', header: 'Category', filterFn: 'multi', cell: (c) => <span className="text-muted">{c.getValue()}</span> }),
      ch.accessor((r) => r.f.domain, { id: 'domain', header: 'Domain', filterFn: 'multi', cell: (c) => <span className="capitalize text-muted">{c.getValue()}</span> }),
      ch.accessor((r) => (r.asset?.internetExposed || r.f.tags.includes('internet-facing') ? 'Internet-facing' : 'Internal'), { id: 'exposure', header: 'Exposure', filterFn: 'multi', cell: (c) => <span className={c.getValue() === 'Internet-facing' ? 'text-orange-300' : 'text-muted'}>{c.getValue()}</span> }),
      ch.accessor((r) => (r.f.kev ? 'KEV' : 'Not KEV'), { id: 'kev', header: 'KEV', filterFn: 'multi', enableHiding: true, cell: (c) => (c.getValue() === 'KEV' ? <span className="text-red-300">Yes</span> : <span className="text-subtle">No</span>) }),
      ch.accessor((r) => users.find((u) => u.id === r.f.ownerId)?.name ?? 'Unassigned', { id: 'owner', header: 'Owner', filterFn: 'multi', cell: (c) => <UserName id={c.row.original.f.ownerId} /> }),
      ch.accessor((r) => (isOverdue(r.f) ? 'Overdue' : 'Within SLA'), {
        id: 'sla',
        header: 'Due',
        filterFn: 'multi',
        cell: (c) => (
          <span className={`inline-flex items-center gap-1 whitespace-nowrap ${c.getValue() === 'Overdue' ? 'text-red-300' : 'text-muted'}`}>
            {c.getValue() === 'Overdue' && <AlarmClock className="size-3" />}
            {['resolved', 'false_positive', 'risk_accepted'].includes(c.row.original.f.status) ? '—' : fmtDate(c.row.original.f.targetDate)}
          </span>
        ),
        sortingFn: (a, b) => (a.original.f.targetDate ?? '').localeCompare(b.original.f.targetDate ?? ''),
      }),
      ch.accessor((r) => integrations.find((i) => i.id === r.f.sourceIntegrationId)?.vendor ?? r.f.sourceIntegrationId, { id: 'source', header: 'Source', filterFn: 'multi', cell: (c) => <span className="whitespace-nowrap text-muted">{c.getValue()}</span> }),
      ch.accessor((r) => r.f.firstDetected, { id: 'detected', header: 'First detected', cell: (c) => <RelTime iso={c.getValue()} /> }),
    ],
    [integrations, aiSystems, users, showAI],
  )

  return (
    <>
      <DataTable
        tableId={tableId}
        data={rows}
        columns={columns}
        getRowId={(r) => r.f.id}
        onRowClick={(r) => navigate(entityPath('finding', r.f.id, r.f.domain))}
        searchPlaceholder="Search ID, title, CVE, asset…"
        views={views}
        initialViewId={initialViewId}
        initialFilters={initialFilters}
        initialSorting={[{ id: 'score', desc: true }]}
        initialHidden={['domain', 'kev', 'exposure', 'category', ...hideColumns]}
        pageSize={pageSize}
        facets={[
          { columnId: 'severity', label: 'Severity', options: SEVERITY_ORDER.slice(0, 4).map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) })) },
          { columnId: 'status', label: 'Status', options: Object.entries(FINDING_STATUS).map(([value, v]) => ({ value, label: v.label })) },
          { columnId: 'service', label: 'Service' },
          { columnId: 'category', label: 'Category' },
          { columnId: 'domain', label: 'Domain' },
          { columnId: 'source', label: 'Source' },
        ]}
        exportName="do-safe-findings"
        exportRow={(r) => ({ id: r.f.id, title: r.f.title, severity: r.f.severity, status: r.f.status, risk_score: r.score, cve: r.f.cveId ?? '', cwe: r.f.cweIds.join(' '), attack: r.f.attackIds.join(' '), asset: r.asset?.name ?? '', service: r.service?.name ?? '', owner: users.find((u) => u.id === r.f.ownerId)?.name ?? '', target_date: r.f.targetDate?.slice(0, 10) ?? '', source: r.f.sourceIntegrationId, first_detected: r.f.firstDetected.slice(0, 10) })}
        bulkActions={(sel, clear) => (
          <>
            <Button size="xs" variant="secondary" onClick={() => setAssignOpen(sel.map((s) => s.f))}>
              <UserPlus /> Assign owner
            </Button>
            <Button size="xs" variant="secondary" onClick={() => setTicketOpen(sel.map((s) => s.f).filter((f) => f.ticketIds.length === 0 && !['resolved', 'false_positive', 'risk_accepted'].includes(f.status)))}>
              <TicketIcon /> Create tickets
            </Button>
            <Button
              size="xs"
              variant="secondary"
              onClick={async () => {
                const targets = sel.filter((s) => s.f.status === 'new')
                if (!targets.length) return
                await run(async () => {
                  for (const t of targets) await api.changeFindingStatus(t.f.id, 'triaged', 'Bulk triage')
                }, `${targets.length} finding(s) marked triaged`)
                clear()
              }}
            >
              <CheckCircle2 /> Mark triaged
            </Button>
          </>
        )}
      />
      <BulkAssignDialog findings={assignOpen} users={users} onClose={() => setAssignOpen(null)} />
      <BulkTicketDialog findings={ticketOpen} onClose={() => setTicketOpen(null)} />
    </>
  )
}

function BulkAssignDialog({ findings, users, onClose }: { findings: Finding[] | null; users: User[]; onClose: () => void }) {
  const [owner, setOwner] = React.useState('')
  const { run, pending } = useAction()
  return (
    <Dialog open={!!findings} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={`Assign owner to ${findings?.length ?? 0} finding(s)`} description="The owner becomes accountable for remediation and receives a notification.">
        <Field label="Owner" required>
          <NativeSelect value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Select owner…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.team}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!owner}
            loading={pending}
            onClick={async () => {
              await run(async () => {
                for (const f of findings ?? []) await api.assignFinding(f.id, owner)
              }, `Owner assigned to ${findings?.length} finding(s)`)
              onClose()
            }}
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BulkTicketDialog({ findings, onClose }: { findings: Finding[] | null; onClose: () => void }) {
  const { run, pending } = useAction()
  const [days, setDays] = React.useState('')
  return (
    <Dialog open={!!findings} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Create remediation tickets" description="One ticket per eligible finding, assigned to the finding owner. Findings that already have a ticket or are closed are skipped.">
        {findings?.length ? (
          <>
            <ul className="mb-3 max-h-48 space-y-1 overflow-y-auto text-xs">
              {findings.map((f) => (
                <li key={f.id} className="flex items-center gap-2">
                  <SeverityBadge severity={f.severity} /> <span className="font-mono text-muted">{f.id}</span> <span className="truncate">{f.title}</span>
                </li>
              ))}
            </ul>
            <Field label="Due date override (days from today)" hint="Leave empty to use the severity SLA target date.">
              <Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} placeholder="e.g. 14" />
            </Field>
          </>
        ) : (
          <p className="text-sm text-muted">None of the selected findings are eligible (they already have tickets or are closed).</p>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!findings?.length}
            loading={pending}
            onClick={async () => {
              await run(async () => {
                for (const f of findings ?? []) {
                  await api.createTicket({ title: `Remediate: ${f.title}`, description: f.remediation.recommended, type: f.domain === 'vulnerability' ? 'vulnerability' : f.domain === 'ai' ? 'ai-governance' : 'configuration', priority: f.severity === 'critical' ? 'P1' : f.severity === 'high' ? 'P2' : f.severity === 'medium' ? 'P3' : 'P4', assigneeId: f.ownerId, dueDate: days ? new Date(Date.now() + Number(days) * 86_400_000).toISOString() : f.targetDate ?? new Date(Date.now() + 30 * 86_400_000).toISOString(), findingId: f.id, aiSystemId: f.aiSystemId })
                }
              }, `${findings?.length} ticket(s) created`)
              onClose()
            }}
          >
            Create {findings?.length ?? 0} ticket(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export type { Asset, BusinessService }
