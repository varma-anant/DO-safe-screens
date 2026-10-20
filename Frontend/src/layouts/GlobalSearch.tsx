import * as React from 'react'
import * as D from '@radix-ui/react-dialog'
import { useNavigate } from 'react-router'
import { Search, CornerDownLeft } from 'lucide-react'
import type { SearchEntityType } from '@/types'
import { useUiStore } from '@/stores/ui'
import { useDbStore } from '@/stores/db'
import { EntityIcon, entityPath } from '@/components/common/entities'
import { cn } from '@/utils/format'

interface Result {
  type: SearchEntityType
  id: string
  title: string
  sub: string
  domain?: string
}

const TYPE_LABEL: Record<SearchEntityType, string> = { asset: 'Assets', finding: 'Findings', vendor: 'Vendors', aiSystem: 'AI systems', incident: 'Incidents', ticket: 'Tickets', knowledge: 'Knowledge records', service: 'Business services', scenario: 'Risk scenarios' }

export function GlobalSearch() {
  const { searchOpen, setSearchOpen } = useUiStore()
  const db = useDbStore((s) => s.db)
  const navigate = useNavigate()
  const [q, setQ] = React.useState('')
  const [active, setActive] = React.useState(0)

  const results = React.useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase()
    if (term.length < 2) return []
    const m = (...fields: (string | undefined)[]) => fields.some((f) => f?.toLowerCase().includes(term))
    const out: Result[] = []
    const push = (arr: Result[], limit = 6) => out.push(...arr.slice(0, limit))
    push(db.findings.filter((f) => m(f.id, f.title, f.cveId, f.category, ...f.cweIds, ...f.attackIds)).map((f) => ({ type: 'finding', id: f.id, title: f.title, sub: `${f.severity.toUpperCase()} · ${f.status.replace(/_/g, ' ')}${f.cveId ? ` · ${f.cveId}` : ''}`, domain: f.domain })), 8)
    push(db.assets.filter((a) => !a.duplicateOfId && m(a.id, a.name, a.fqdn, a.ipAddress, a.type)).map((a) => ({ type: 'asset', id: a.id, title: a.name, sub: `${a.type} · ${a.environment}${a.ipAddress ? ` · ${a.ipAddress}` : ''}` })))
    push(db.vendors.filter((v) => m(v.id, v.name, v.category)).map((v) => ({ type: 'vendor', id: v.id, title: v.name, sub: `${v.category} · ${v.tier}` })))
    push(db.aiSystems.filter((a) => m(a.id, a.name, a.provider, a.type)).map((a) => ({ type: 'aiSystem', id: a.id, title: a.name, sub: `${a.type} · ${a.approval}` })))
    push(db.incidents.filter((i) => m(i.id, i.title, i.category)).map((i) => ({ type: 'incident', id: i.id, title: i.title, sub: `${i.severity} · ${i.status}` })))
    push(db.tickets.filter((t) => m(t.id, t.title, t.externalRef)).map((t) => ({ type: 'ticket', id: t.id, title: t.title, sub: `${t.priority} · ${t.status.replace(/_/g, ' ')}${t.externalRef ? ` · ${t.externalRef}` : ''}` })))
    push(db.knowledge.filter((k) => m(k.externalId, k.name, k.summary)).map((k) => ({ type: 'knowledge', id: k.id, title: `${k.externalId} — ${k.name}`, sub: k.source })))
    push(db.services.filter((s) => m(s.id, s.name)).map((s) => ({ type: 'service', id: s.id, title: s.name, sub: `Business service · ${s.criticality}` })), 3)
    push(db.scenarios.filter((s) => m(s.id, s.name, s.threatType)).map((s) => ({ type: 'scenario', id: s.id, title: s.name, sub: `Risk scenario · ${s.threatType}` })), 3)
    return out
  }, [q, db])

  React.useEffect(() => setActive(0), [q])

  const go = (r: Result) => {
    navigate(entityPath(r.type, r.id, r.domain))
    setSearchOpen(false)
    setQ('')
  }

  const grouped = results.reduce<Record<string, Result[]>>((acc, r) => ((acc[r.type] ??= []).push(r), acc), {})
  let idx = -1

  return (
    <D.Root open={searchOpen} onOpenChange={setSearchOpen}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
        <D.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-xl border border-border-strong bg-surface shadow-2xl focus:outline-none">
          <D.Title className="sr-only">Global search</D.Title>
          <D.Description className="sr-only">Search assets, findings, vendors, AI systems, incidents, tickets and knowledge records</D.Description>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="size-4 text-subtle" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActive((a) => Math.min(results.length - 1, a + 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActive((a) => Math.max(0, a - 1))
                } else if (e.key === 'Enter' && results[active]) go(results[active])
              }}
              placeholder="Search by ID, name, CVE, CWE, ATT&CK technique, hostname, vendor…"
              className="h-14 flex-1 bg-transparent text-[15px] placeholder:text-subtle focus:outline-none"
              aria-label="Search query"
            />
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {q.trim().length < 2 ? (
              <div className="px-3 py-6 text-center text-xs text-muted">
                Type at least 2 characters. Try <button className="text-violet-300 cursor-pointer" onClick={() => setQ('CVE-2021-44228')}>CVE-2021-44228</button>, <button className="text-violet-300 cursor-pointer" onClick={() => setQ('okta')}>okta</button>, <button className="text-violet-300 cursor-pointer" onClick={() => setQ('Orbit')}>Orbit</button> or <button className="text-violet-300 cursor-pointer" onClick={() => setQ('T1190')}>T1190</button>.
              </div>
            ) : results.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <div className="text-sm font-medium">No results for “{q}”</div>
                <div className="mt-1 text-xs text-muted">Search covers the simulated Northstar dataset only.</div>
              </div>
            ) : (
              Object.entries(grouped).map(([type, items]) => (
                <div key={type} className="mb-2">
                  <div className="label-xs px-3 py-1.5">{TYPE_LABEL[type as SearchEntityType]}</div>
                  {items.map((r) => {
                    idx += 1
                    const i = idx
                    return (
                      <button key={r.type + r.id} onMouseEnter={() => setActive(i)} onClick={() => go(r)} className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left cursor-pointer', active === i ? 'bg-violet-500/12' : 'hover:bg-surface-2')}>
                        <EntityIcon type={r.type} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-[13px]">
                            <span className="font-mono text-[11px] text-muted">{r.type === 'knowledge' ? '' : r.id}</span>
                            <span className="truncate">{r.title}</span>
                          </span>
                          <span className="block truncate text-[11px] capitalize text-subtle">{r.sub}</span>
                        </span>
                        {active === i && <CornerDownLeft className="size-3.5 text-muted" />}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
