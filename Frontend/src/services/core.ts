import type { AuditEvent, Database, HistoryEntry, Notification } from '@/types'
import { getDb, setDb } from '@/stores/db'
import { can, ROLE_INFO, CAPABILITY_LABEL, type Capability } from '@/utils/permissions'

export class DemoApiError extends Error {}

export type CollectionKey = Exclude<keyof Database, 'version' | 'settings'>
export type CollectionMap = { [K in CollectionKey]: Database[K] }

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Simulated network latency (and optional simulated failure) for the demo API. */
export async function latency(factor = 1, allowSimulatedError = true) {
  const { latencyMs, simulateErrors } = getDb().settings
  await sleep(latencyMs * factor * (0.6 + Math.random() * 0.8))
  if (allowSimulatedError && simulateErrors && Math.random() < 0.35) throw new DemoApiError('Simulated API error (enable/disable in Settings → Demo controls).')
}

export const now = () => new Date().toISOString()
export const actor = () => getDb().settings.currentUserId

export function nextId(existing: { id: string }[], prefix: string, width = 4) {
  const max = existing.reduce((m, x) => {
    const n = Number(x.id.replace(/\D/g, ''))
    return x.id.startsWith(prefix) && n > m ? n : m
  }, 0)
  return `${prefix}-${String(max + 1).padStart(width, '0')}`
}

// Unique across page reloads: persisted records created before a reload must never collide with new ones.
let seq = 0
export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(++seq).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`.toUpperCase()

export function historyEntry(type: HistoryEntry['type'], summary: string, detail?: string, actorId = actor()): HistoryEntry {
  return { id: uid('H'), at: now(), actorId, type, summary, detail }
}

export function audit(db: Database, e: Omit<AuditEvent, 'id' | 'at' | 'actorId'> & { actorId?: string }): Database {
  const ev: AuditEvent = { id: uid('AUD'), at: now(), actorId: e.actorId ?? actor(), ...e }
  return { ...db, audit: [ev, ...db.audit] }
}

export function notify(db: Database, n: Omit<Notification, 'id' | 'at' | 'read'>): Database {
  return { ...db, notifications: [{ id: uid('NTF'), at: now(), read: false, ...n }, ...db.notifications] }
}

export function replace<T extends { id: string }>(arr: T[], item: T): T[] {
  return arr.map((x) => (x.id === item.id ? item : x))
}

export function mustFind<T extends { id: string }>(arr: T[], id: string, label: string): T {
  const x = arr.find((i) => i.id === id)
  if (!x) throw new DemoApiError(`${label} ${id} not found`)
  return x
}

/** Applies a pure transformation to the demo database. */
export function commit(fn: (db: Database) => Database) {
  setDb(fn(getDb()))
}

export const userName = (id?: string) => (id === 'SYSTEM' ? 'DO SAFE (system)' : getDb().users.find((u) => u.id === id)?.name ?? id ?? 'Unassigned')

/** Server-side style permission check — every mutating API call enforces the caller's capabilities. */
export function requireCap(cap: Capability) {
  const db = getDb()
  const u = db.users.find((x) => x.id === db.settings.currentUserId)
  if (!db.settings.authenticated || !u) throw new DemoApiError('Your session has ended. Sign in again.')
  if (!can(u, cap)) throw new DemoApiError(`Your role (${ROLE_INFO[u.orgRole].label}) can't ${CAPABILITY_LABEL[cap].charAt(0).toLowerCase()}${CAPABILITY_LABEL[cap].slice(1)}. Request access from Requests.`)
}
