import { useEffect } from 'react'
import { useUiStore, type Crumb } from '@/stores/ui'
import { useSearchParams } from 'react-router'
import type { ColumnFiltersState } from '@tanstack/react-table'

/** Sets the top-bar title and breadcrumbs for the current screen. */
export function usePage(title: string, crumbs: Crumb[] = []) {
  const setPage = useUiStore((s) => s.setPage)
  const key = JSON.stringify(crumbs)
  useEffect(() => {
    setPage(title, crumbs)
    document.title = `${title} · DO SAFE Unified`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, key, setPage])
}


/** Reads table filters from the URL (e.g. ?severity=critical,high) so charts and KPIs can deep-link into lists. */
export function useUrlFilters(keys: string[]): ColumnFiltersState | undefined {
  const [params] = useSearchParams()
  const filters = keys.filter((k) => params.get(k)).map((k) => ({ id: k, value: params.get(k)!.split(',') }))
  return filters.length ? filters : undefined
}
