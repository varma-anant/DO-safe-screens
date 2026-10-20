import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import * as api from '@/services/api'
import type { CollectionKey, CollectionMap } from '@/services/api'
import { useDbStore } from '@/stores/db'

/** Loads several demo collections through the API layer (with simulated latency). */
export function useCollections<K extends CollectionKey>(keys: readonly K[]) {
  const results = useQueries({ queries: keys.map((k) => ({ queryKey: [k], queryFn: () => api.list(k) })) })
  const isLoading = results.some((r) => r.isPending)
  const error = results.find((r) => r.error)?.error as Error | undefined
  const data = isLoading || error ? undefined : (Object.fromEntries(keys.map((k, i) => [k, results[i].data])) as Pick<CollectionMap, K>)
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
