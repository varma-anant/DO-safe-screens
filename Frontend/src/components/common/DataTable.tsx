import * as React from 'react'
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type ColumnFiltersState, type FilterFn, type Row, type SortingState, type VisibilityState, type RowSelectionState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, BookmarkPlus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns3, Download, Filter, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn, downloadCsv, titleCase } from '@/utils/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox, DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/misc'
import { EmptyState } from './layout'

/** Matches when the row value (scalar or array) intersects the selected values. */
export const multiFilter: FilterFn<unknown> = (row, columnId, filterValue: string[]) => {
  if (!filterValue?.length) return true
  const v = row.getValue(columnId)
  const vals = Array.isArray(v) ? v.map(String) : [String(v)]
  return filterValue.some((f) => vals.includes(f))
}
multiFilter.autoRemove = (v) => !v || (Array.isArray(v) && v.length === 0)

export interface Facet {
  columnId: string
  label: string
  options?: { value: string; label: string }[]
}

export interface SavedView {
  id: string
  label: string
  filters: ColumnFiltersState
  sorting?: SortingState
  global?: string
  custom?: boolean
}

interface Props<T> {
  tableId: string
  data: T[]
  columns: ColumnDef<T, any>[] // eslint-disable-line @typescript-eslint/no-explicit-any
  getRowId: (row: T) => string
  onRowClick?: (row: T) => void
  searchPlaceholder?: string
  facets?: Facet[]
  views?: SavedView[]
  initialViewId?: string
  initialFilters?: ColumnFiltersState
  initialSorting?: SortingState
  initialHidden?: string[]
  bulkActions?: (rows: T[], clear: () => void) => React.ReactNode
  exportName?: string
  exportRow?: (row: T) => Record<string, unknown>
  toolbar?: React.ReactNode
  pageSize?: number
  emptyTitle?: string
  emptyDescription?: string
  dense?: boolean
  selectable?: boolean
}

const loadCustomViews = (id: string): SavedView[] => {
  try {
    return JSON.parse(localStorage.getItem(`dosafe-views-${id}`) ?? '[]')
  } catch {
    return []
  }
}

export function DataTable<T>({ tableId, data, columns, getRowId, onRowClick, searchPlaceholder = 'Search…', facets = [], views = [], initialViewId, initialFilters, initialSorting, initialHidden = [], bulkActions, exportName, exportRow, toolbar, pageSize = 15, emptyTitle = 'No records', emptyDescription, dense, selectable = true }: Props<T>) {
  const [customViews, setCustomViews] = React.useState<SavedView[]>(() => loadCustomViews(tableId))
  const allViews = [...views, ...customViews]
  const initialView = initialFilters ? undefined : allViews.find((v) => v.id === initialViewId)
  const [activeView, setActiveView] = React.useState<string | undefined>(initialFilters ? undefined : initialView?.id ?? views[0]?.id)
  const [sorting, setSorting] = React.useState<SortingState>(initialView?.sorting ?? initialSorting ?? [])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(initialFilters ?? initialView?.filters ?? [])
  const [globalFilter, setGlobalFilter] = React.useState(initialView?.global ?? '')
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(Object.fromEntries(initialHidden.map((c) => [c, false])))
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const selectCol: ColumnDef<T> = {
    id: '__select',
    enableSorting: false,
    enableHiding: false,
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all rows on this page"
        checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? 'indeterminate' : false}
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
      />
    ),
    cell: ({ row }) => <Checkbox aria-label="Select row" checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} onClick={(e) => e.stopPropagation()} />,
    size: 32,
  }

  const table = useReactTable({
    data,
    columns: selectable ? [selectCol, ...columns] : columns,
    getRowId,
    state: { sorting, columnFilters, globalFilter, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: (u) => {
      setColumnFilters(u)
      setActiveView(undefined)
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    filterFns: { multi: multiFilter },
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    autoResetPageIndex: true,
  })

  const applyView = (v: SavedView) => {
    setActiveView(v.id)
    setColumnFilters(v.filters)
    setSorting(v.sorting ?? initialSorting ?? [])
    setGlobalFilter(v.global ?? '')
    setRowSelection({})
  }

  const saveView = () => {
    const label = window.prompt('Name this view (saved in this browser):')
    if (!label) return
    const v: SavedView = { id: `custom-${Date.now()}`, label, filters: columnFilters, sorting, global: globalFilter, custom: true }
    const next = [...customViews, v]
    setCustomViews(next)
    try {
      localStorage.setItem(`dosafe-views-${tableId}`, JSON.stringify(next))
    } catch {
      /* per-viewer convenience only */
    }
    setActiveView(v.id)
    toast.success(`View "${label}" saved`)
  }

  const removeView = (id: string) => {
    const next = customViews.filter((v) => v.id !== id)
    setCustomViews(next)
    try {
      localStorage.setItem(`dosafe-views-${tableId}`, JSON.stringify(next))
    } catch {
      /* ignore */
    }
    if (activeView === id) setActiveView(undefined)
  }

  const selected = table.getSelectedRowModel().rows.map((r) => r.original)
  const filteredRows = table.getFilteredRowModel().rows
  const doExport = () => {
    const rows = (selected.length ? selected : filteredRows.map((r) => r.original)).map((r) => (exportRow ? exportRow(r) : (r as Record<string, unknown>)))
    downloadCsv(`${exportName ?? tableId}-${new Date().toISOString().slice(0, 10)}.csv`, rows)
    toast.success(`Exported ${rows.length} rows to CSV`)
  }

  const hasFilters = columnFilters.length > 0 || !!globalFilter

  return (
    <div className="card overflow-hidden">
      {allViews.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-3 pt-2">
          {allViews.map((v) => (
            <span key={v.id} className="group relative">
              <button
                onClick={() => applyView(v)}
                className={cn('-mb-px whitespace-nowrap border-b-2 px-2.5 pb-2 pt-1 text-[13px] font-medium transition-colors cursor-pointer', activeView === v.id ? 'border-violet-500 text-fg' : 'border-transparent text-muted hover:text-fg')}
              >
                {v.label}
              </button>
              {v.custom && (
                <button onClick={() => removeView(v.id)} className="absolute -right-1 top-0 hidden rounded p-0.5 text-subtle hover:text-fg group-hover:block" aria-label={`Delete view ${v.label}`}>
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-subtle" />
          <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder={searchPlaceholder} className="h-9 pl-8" aria-label="Search table" />
        </div>
        {facets.map((f) => {
          const col = table.getColumn(f.columnId)
          if (!col) return null
          const current = (col.getFilterValue() as string[] | undefined) ?? []
          const options = f.options ?? [...new Set(data.flatMap((r) => { const v = col.accessorFn ? col.accessorFn(r, 0) : undefined; return Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)] }))].sort().map((v) => ({ value: v, label: titleCase(v) }))
          return (
            <DropdownMenu key={f.columnId}>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className={cn(current.length && 'border-violet-500/50 text-violet-700')}>
                  <Filter /> {f.label}
                  {current.length > 0 && <span className="rounded bg-violet-500/30 px-1 text-[10px]">{current.length}</span>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
                <DropdownMenuLabel>{f.label}</DropdownMenuLabel>
                {options.map((o) => (
                  <DropdownMenuCheckboxItem
                    key={o.value}
                    checked={current.includes(o.value)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(c) => col.setFilterValue(c ? [...current, o.value] : current.filter((x) => x !== o.value))}
                  >
                    {o.label}
                  </DropdownMenuCheckboxItem>
                ))}
                {current.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => col.setFilterValue(undefined)}>Clear filter</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        })}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setColumnFilters([]); setGlobalFilter(''); setActiveView(undefined) }}>
            <X /> Clear
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {toolbar}
          <Button variant="ghost" size="sm" onClick={saveView} title="Save current filters as a view">
            <BookmarkPlus /> <span className="hidden xl:inline">Save view</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Column visibility">
                <Columns3 /> <span className="hidden xl:inline">Columns</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              {table.getAllLeafColumns().filter((c) => c.getCanHide()).map((c) => (
                <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onSelect={(e) => e.preventDefault()} onCheckedChange={(v) => c.toggleVisibility(!!v)}>
                  {typeof c.columnDef.header === 'string' ? c.columnDef.header : titleCase(c.id)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="secondary" size="sm" onClick={doExport}>
            <Download /> CSV
          </Button>
        </div>
      </div>
      {selected.length > 0 && bulkActions && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-violet-500/8 px-3 py-2 text-[13px]">
          <span className="font-medium text-violet-700">{selected.length} selected</span>
          {bulkActions(selected, () => setRowSelection({}))}
          <Button variant="ghost" size="xs" onClick={() => setRowSelection({})}>
            Clear selection
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-surface-2/40">
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted()
                  return (
                    <th key={h.id} className="whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-subtle" style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }} aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}>
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button className="inline-flex items-center gap-1 hover:text-fg cursor-pointer" onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === 'asc' ? <ArrowUp className="size-3" /> : sorted === 'desc' ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row: Row<T>) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row.original) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn('border-b border-border/60 transition-colors last:border-0', onRowClick && 'cursor-pointer hover:bg-surface-2/60 focus:bg-surface-2/60 focus:outline-none', row.getIsSelected() && 'bg-violet-500/6')}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={cn('px-3 align-middle', dense ? 'py-1.5' : 'py-2.5')}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {table.getRowModel().rows.length === 0 && <EmptyState search={hasFilters} title={hasFilters ? 'No matching records' : emptyTitle} description={hasFilters ? 'Try removing filters or changing your search.' : emptyDescription} />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted">
        <span>
          {filteredRows.length} of {data.length} records{hasFilters ? ' (filtered)' : ''}
        </span>
        <div className="flex items-center gap-1">
          <span className="mr-2">
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} aria-label="First page">
            <ChevronsLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
            <ChevronRight />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} aria-label="Last page">
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}

declare module '@tanstack/react-table' {
  interface FilterFns {
    multi: FilterFn<unknown>
  }
}
