import type { Database } from '@/types'
import type { CollectionKey, CollectionMap } from '@/services/api'
import { can, visibleProjectIds } from '@/utils/permissions'

export interface Scope {
  /** Applications the user may see at all (null = everything). */
  visibleApps: Set<string> | null
  /** Applications in the selected project (null = all visible projects). */
  projectApps: Set<string> | null
}

export function computeScope(db: Database): Scope {
  const user = db.users.find((u) => u.id === db.settings.currentUserId)
  const all = can(user, 'view_all_projects')
  const projects = new Set(all ? db.projects.map((p) => p.id) : visibleProjectIds(db, db.settings.currentUserId))
  const visibleApps = all ? null : new Set(db.services.filter((s) => projects.has(s.projectId)).map((s) => s.id))
  const cur = db.settings.currentProjectId
  const projectApps = cur ? new Set(db.services.filter((s) => s.projectId === cur && (!visibleApps || visibleApps.has(s.id))).map((s) => s.id)) : null
  return { visibleApps, projectApps }
}

/** Filters a collection to the applications in scope. Collections not tied to an application pass through. */
export function scopeCollection<K extends CollectionKey>(key: K, data: CollectionMap[K], db: Database, apps: Set<string> | null): CollectionMap[K] {
  if (!apps) return data
  const inApp = (id?: string) => !!id && apps.has(id)
  const findingOk = (id?: string) => { const f = db.findings.find((x) => x.id === id); return !!f && (inApp(f.businessServiceId)) }
  const vendorOk = (id?: string) => { const v = db.vendors.find((x) => x.id === id); return !!v && v.businessServiceIds.some(inApp) }
  const aiOk = (id?: string) => { const a = db.aiSystems.find((x) => x.id === id); return !!a && inApp(a.businessServiceId) }
  const assetOk = (id?: string) => { const a = db.assets.find((x) => x.id === id); return !!a && inApp(a.businessServiceId) }
  const filters: Partial<Record<CollectionKey, (x: never) => boolean>> = {
    services: (x: Database['services'][number]) => inApp(x.id),
    projects: (x: Database['projects'][number]) => visibleProjectIds(db, db.settings.currentUserId).includes(x.id),
    assets: (x: Database['assets'][number]) => inApp(x.businessServiceId),
    findings: (x: Database['findings'][number]) => inApp(x.businessServiceId),
    tickets: (x: Database['tickets'][number]) => (x.findingId ? findingOk(x.findingId) : x.vendorId ? vendorOk(x.vendorId) : x.aiSystemId ? aiOk(x.aiSystemId) : x.incidentId ? db.incidents.some(i => i.id === x.incidentId && i.businessServiceIds.some(inApp)) : false),
    vendors: (x: Database['vendors'][number]) => x.businessServiceIds.some(inApp),
    assessments: (x: Database['assessments'][number]) => vendorOk(x.vendorId),
    monitoringAlerts: (x: Database['monitoringAlerts'][number]) => vendorOk(x.vendorId),
    aiSystems: (x: Database['aiSystems'][number]) => inApp(x.businessServiceId),
    governanceReviews: (x: Database['governanceReviews'][number]) => aiOk(x.aiSystemId),
    scenarios: (x: Database['scenarios'][number]) => inApp(x.businessServiceId),
    attackPaths: (x: Database['attackPaths'][number]) => inApp(x.businessServiceId),
    incidents: (x: Database['incidents'][number]) => x.businessServiceIds.some(inApp) || x.findingIds.some(findingOk),
    events: (x: Database['events'][number]) => assetOk(x.assetId) || aiOk(x.aiSystemId) || findingOk(x.findingId),
  }
  const f = filters[key]
  return f ? ((data as unknown[]).filter(f as (x: unknown) => boolean) as CollectionMap[K]) : data
}
