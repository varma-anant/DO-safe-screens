// Read-side authorization: what the signed-in person may see, applied in the data layer so a typed URL
// or a direct query can't reveal an area their job doesn't include.
import type { Database } from '@/types'
import { can, jobOf, type ViewCap } from '@/utils/permissions'
import { computeScope, scopeCollection } from '@/hooks/scope'
import type { CollectionKey, CollectionMap } from './core'

const AREA_OF: Partial<Record<CollectionKey, ViewCap>> = {
  findings: 'view_findings',
  attackPaths: 'view_findings',
  incidents: 'view_incidents',
  events: 'view_incidents',
  vendors: 'view_vendor_risk',
  assessments: 'view_vendor_risk',
  monitoringAlerts: 'view_vendor_risk',
  aiSystems: 'view_ai_governance',
  governanceReviews: 'view_ai_governance',
  scenarios: 'view_financial_risk',
  controls: 'view_financial_risk',
  investments: 'view_financial_risk',
}

export function restrictForViewer<K extends CollectionKey>(key: K, data: CollectionMap[K], db: Database): CollectionMap[K] {
  const user = db.users.find((u) => u.id === db.settings.currentUserId)
  const area = AREA_OF[key]
  if (area && !can(user, area)) return [] as unknown as CollectionMap[K]
  if (key === 'notifications') {
    const apps = computeScope(db).visibleApps
    const visible = <K extends CollectionKey>(k: K) => scopeCollection(k, restrictForViewer(k, db[k], db), db, apps)
    return (data as Database['notifications']).filter(n => {
      const link = n.link || ''
      const id = link.split('?')[0].split('/').pop()
      if (link.includes('/findings/') || link.includes('/vulnerabilities/')) return visible('findings').some(f => f.id === id)
      if (link.includes('/tickets/')) return visible('tickets').some(t => t.id === id)
      if (link.includes('/incidents/')) return visible('incidents').some(i => i.id === id)
      if (link.includes('/tprm')) return can(user,'view_vendor_risk')
      if (link.includes('/ai-security')) return can(user,'view_ai_governance')
      if (link.includes('/integrations')) return can(user,'manage_integrations')
      if (link.includes('/requests') || link.includes('/approvals')) return can(user,'manage_users') || can(user,'approve_high_impact') || n.body.includes(user?.name || '__none__')
      return jobOf(user) !== 'employee'
    }) as unknown as CollectionMap[K]
  }
  // Fix tasks belong to the area of the record they fix (a supplier, an AI system or a security problem).
  if (key === 'tickets') {
    return (data as Database['tickets']).filter((t) => (jobOf(user) !== 'employee' || t.assigneeId === user?.id || t.reporterId === user?.id) && (t.vendorId ? can(user, 'view_vendor_risk') : t.aiSystemId ? can(user, 'view_ai_governance') : true)) as unknown as CollectionMap[K]
  }
  // People who see problems but not raw evidence (e.g. executives) get the business view only.
  if (key === 'findings' && !can(user, 'view_evidence')) {
    return (data as Database['findings']).map((f) => ({ ...f, evidence: [] })) as unknown as CollectionMap[K]
  }
  return data
}

/** A copy of the database containing only what the signed-in person may see (for features that read the store directly). */
export function viewerDb(db: Database): Database {
  const apps = computeScope(db).visibleApps
  const out = { ...db } as Database
  for (const k of Object.keys(db) as (keyof Database)[]) {
    if (k === 'version' || k === 'settings') continue
    const key = k as CollectionKey
    ;(out as unknown as Record<string, unknown>)[key] = scopeCollection(key, restrictForViewer(key, db[key] as CollectionMap[typeof key], db), db, apps)
  }
  return out
}
