import * as React from 'react'
import { Link } from 'react-router'
import { Bot, Box, Building2, FileWarning, Ticket as TicketIcon, Siren, BookOpen, Briefcase, Calculator } from 'lucide-react'
import type { HistoryEntry, SearchEntityType } from '@/types'
import { useDbStore } from '@/stores/db'
import { cn, fmtDateTime, fmtRelative } from '@/utils/format'
import { Tooltip } from '@/components/ui/misc'

export function entityPath(type: SearchEntityType, id: string, domain?: string) {
  switch (type) {
    case 'asset':
      return `/exposures/assets/${id}`
    case 'finding':
      return domain === 'ai' ? `/ai-security/findings/${id}` : domain === 'vulnerability' ? `/exposures/vulnerabilities/${id}` : `/operations/findings/${id}`
    case 'vendor':
      return `/tprm/vendors/${id}`
    case 'aiSystem':
      return `/ai-security/systems/${id}`
    case 'incident':
      return `/operations/incidents/${id}`
    case 'ticket':
      return `/operations/tickets/${id}`
    case 'knowledge':
      return `/intelligence/library/${id}`
    case 'service':
      return `/services/${id}`
    case 'scenario':
      return `/crq/scenarios/${id}`
  }
}

const ICONS: Record<SearchEntityType, React.ReactNode> = {
  asset: <Box />,
  finding: <FileWarning />,
  vendor: <Building2 />,
  aiSystem: <Bot />,
  incident: <Siren />,
  ticket: <TicketIcon />,
  knowledge: <BookOpen />,
  service: <Briefcase />,
  scenario: <Calculator />,
}

export function EntityIcon({ type, className }: { type: SearchEntityType; className?: string }) {
  return <span className={cn('inline-flex text-subtle [&_svg]:size-3.5', className)}>{ICONS[type]}</span>
}

/** Link to any record by id; resolves its display label from the demo store. */
export function EntityLink({ type, id, showId = true, className, label }: { type: SearchEntityType; id?: string; showId?: boolean; className?: string; label?: string }) {
  const db = useDbStore((s) => s.db)
  if (!id) return <span className="text-subtle">—</span>
  let name = label
  let domain: string | undefined
  if (!name) {
    if (type === 'asset') name = db.assets.find((x) => x.id === id)?.name
    else if (type === 'finding') {
      const f = db.findings.find((x) => x.id === id)
      name = f?.title
      domain = f?.domain
    } else if (type === 'vendor') name = db.vendors.find((x) => x.id === id)?.name
    else if (type === 'aiSystem') name = db.aiSystems.find((x) => x.id === id)?.name
    else if (type === 'incident') name = db.incidents.find((x) => x.id === id)?.title
    else if (type === 'ticket') name = db.tickets.find((x) => x.id === id)?.title
    else if (type === 'knowledge') name = db.knowledge.find((x) => x.id === id)?.name
    else if (type === 'service') name = db.services.find((x) => x.id === id)?.name
    else if (type === 'scenario') name = db.scenarios.find((x) => x.id === id)?.name
  } else if (type === 'finding') domain = db.findings.find((x) => x.id === id)?.domain
  return (
    <Link to={entityPath(type, id, domain)} className={cn('group inline-flex min-w-0 items-center gap-1.5 text-violet-300 hover:text-violet-200', className)}>
      {showId && <span className="shrink-0 font-mono text-[11px] text-muted group-hover:text-violet-300">{id}</span>}
      {name && <span className="truncate">{name}</span>}
    </Link>
  )
}

export function UserName({ id, avatar = true, className }: { id?: string; avatar?: boolean; className?: string }) {
  const u = useDbStore((s) => s.db.users.find((x) => x.id === id))
  if (id === 'SYSTEM')
    return (
      <span className={cn('inline-flex items-center gap-1.5', className)}>
        {avatar && <span className="flex size-5 items-center justify-center rounded-full bg-primary-soft text-[9px] font-bold text-violet-300">DO</span>}
        <span className="text-muted">DO SAFE (system)</span>
      </span>
    )
  if (!u) return <span className="text-subtle">Unassigned</span>
  return (
    <Tooltip content={`${u.role} · ${u.team}`}>
      <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
        {avatar && <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600/70 to-emerald-600/70 text-[9px] font-bold text-white">{u.initials}</span>}
        <span className="truncate">{u.name}</span>
      </span>
    </Tooltip>
  )
}

export function IntegrationName({ id }: { id?: string }) {
  const i = useDbStore((s) => s.db.integrations.find((x) => x.id === id))
  if (!i) return <span className="text-subtle">{id ?? '—'}</span>
  return (
    <Link to={`/integrations/${i.id}`} className="text-violet-300 hover:text-violet-200">
      {i.name}
    </Link>
  )
}

export function RelTime({ iso, className }: { iso?: string; className?: string }) {
  return (
    <Tooltip content={fmtDateTime(iso)}>
      <time dateTime={iso} tabIndex={0} className={cn('whitespace-nowrap text-muted', className)}>
        {fmtRelative(iso)}
      </time>
    </Tooltip>
  )
}

const HIST_COLOR: Partial<Record<HistoryEntry['type'], string>> = {
  discovered: 'bg-sky-400',
  verification: 'bg-emerald-400',
  false_positive_review: 'bg-slate-400',
  reopened: 'bg-orange-400',
  incident_created: 'bg-red-400',
  ticket_created: 'bg-violet-400',
  risk_acceptance: 'bg-amber-400',
  ai_analysis: 'bg-fuchsia-400',
}

export function Timeline({ entries, empty = 'No activity yet.' }: { entries: HistoryEntry[]; empty?: string }) {
  if (!entries.length) return <p className="py-4 text-xs text-muted">{empty}</p>
  const sorted = [...entries].sort((a, b) => b.at.localeCompare(a.at))
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {sorted.map((e) => (
        <li key={e.id} className="relative">
          <span className={cn('absolute -left-[25px] top-1.5 size-2.5 rounded-full ring-4 ring-surface', HIST_COLOR[e.type] ?? 'bg-violet-400/70')} />
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[13px] font-medium">{e.summary}</span>
            <span className="text-[11px] text-subtle">{fmtDateTime(e.at)}</span>
          </div>
          <div className="mt-0.5 text-xs text-muted">
            <UserName id={e.actorId} avatar={false} />
          </div>
          {e.detail && <p className="mt-1 whitespace-pre-line rounded-md bg-surface-2 px-2.5 py-1.5 text-xs text-muted">{e.detail}</p>}
        </li>
      ))}
    </ol>
  )
}
