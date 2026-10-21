import { useQueries, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import * as api from '@/services/api'
import type { CollectionKey, CollectionMap } from '@/services/api'
import { getDb, useDbStore } from '@/stores/db'
import { computeScope, scopeCollection } from './scope'
import { can, type Capability } from '@/utils/permissions'

/**
 * Loads several demo collections through the API layer (with simulated latency).
 * Results are scoped to what the user may see and, unless `ignoreProjectFilter` is set (detail pages),
 * to the project selected in the top bar.
 */
export function useCollections<K extends CollectionKey>(keys: readonly K[], opts: { ignoreProjectFilter?: boolean } = {}) {
  const results = useQueries({ queries: keys.map((k) => ({ queryKey: [k], queryFn: () => api.list(k) })) })
  const isLoading = results.some((r) => r.isPending)
  const error = results.find((r) => r.error)?.error as Error | undefined
  const scopeKey = useDbStore((s) => `${s.db.settings.currentUserId}|${s.db.settings.currentProjectId}|${s.db.projects.length}|${s.db.services.length}`)
  const data = React.useMemo(() => {
    if (isLoading || error) return undefined
    const db = getDb()
    const scope = computeScope(db)
    const apps = opts.ignoreProjectFilter ? scope.visibleApps : scope.projectApps ?? scope.visibleApps
    return Object.fromEntries(keys.map((k, i) => [k, scopeCollection(k, results[i].data as CollectionMap[typeof k], db, apps)])) as Pick<CollectionMap, K>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, error, scopeKey, opts.ignoreProjectFilter, ...results.map((r) => r.data)])
  const qc = useQueryClient()
  const retry = useCallback(() => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] })), [qc, keys])
  return { data, isLoading, error, retry }
}

/** Current settings and acting user straight from the demo store (synchronous, used by chrome). */
export function useSettings() {
  return useDbStore((s) => s.db.settings)
}
export function useCurrentUser() {
  return useDbStore((s) => s.db.users.find((u) => u.id === s.db.settings.currentUserId)!)
}
export function useUsers() {
  return useDbStore((s) => s.db.users)
}

/** Wraps an API mutation with pending state and toasts. */
export function useAction() {
  const [pending, setPending] = useState(false)
  const run = useCallback(async <T,>(fn: () => Promise<T>, success?: string | ((r: T) => string)): Promise<T | undefined> => {
    setPending(true)
    try {
      const r = await fn()
      if (success) toast.success(typeof success === 'function' ? success(r) : success)
      return r
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
      return undefined
    } finally {
      setPending(false)
    }
  }, [])
  return { run, pending }
}

/** Whether the signed-in user holds a capability (UI hint — the API enforces it too). */
export function useCan(cap: Capability) {
  return useDbStore((s) => can(s.db.users.find((u) => u.id === s.db.settings.currentUserId), cap))
}
