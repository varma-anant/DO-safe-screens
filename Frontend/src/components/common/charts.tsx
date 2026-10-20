import * as React from 'react'
import type { TooltipContentProps } from 'recharts'

/** Categorical order validated for the dark surface (#111522) with the dataviz palette validator. Fixed order — never cycled. */
export const CATEGORICAL = ['#8b5cf6', '#0d9f74', '#2b8fd6', '#d97706', '#db2777', '#65a30d']
/** Single-hue sequential ramp (violet), light → dark for magnitude. */
export const SEQUENTIAL = ['#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9']

export const AXIS = { stroke: '#2a3146', tick: { fill: '#94a3b8', fontSize: 11 }, tickLine: false, axisLine: false } as const
export const GRID = { stroke: '#1f2638', vertical: false } as const

type Fmt = (v: number, name?: string) => string

/** Shared tooltip: text in ink tokens; a color chip carries series identity. */
export function ChartTooltip({ active, payload, label, format, labelFormat }: Partial<TooltipContentProps<number, string>> & { format?: Fmt; labelFormat?: (l: string) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border-strong bg-surface-3 px-3 py-2 text-xs shadow-xl">
      {label !== undefined && label !== '' && <div className="mb-1 font-medium text-fg">{labelFormat ? labelFormat(String(label)) : String(label)}</div>}
      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="size-2 rounded-sm" style={{ background: (p.color as string) ?? (p.payload as { fill?: string })?.fill }} />
            <span className="text-muted">{p.name}</span>
            <span className="num ml-auto pl-3 font-semibold text-fg">{format ? format(Number(p.value), String(p.name)) : Number(p.value).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string; value?: React.ReactNode; onClick?: () => void }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
      {items.map((it) => (
        <li key={it.label}>
          <button type="button" onClick={it.onClick} disabled={!it.onClick} className="inline-flex items-center gap-1.5 text-muted enabled:hover:text-fg enabled:cursor-pointer">
            <span className="size-2.5 rounded-sm" style={{ background: it.color }} />
            {it.label}
            {it.value !== undefined && <span className="num font-medium text-fg">{it.value}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Horizontal bar list — an accessible, clickable alternative to small bar charts. */
export function BarList({ items, format = (v) => v.toLocaleString(), max }: { items: { label: React.ReactNode; value: number; color?: string; onClick?: () => void; sub?: React.ReactNode }[]; format?: (v: number) => string; max?: number }) {
  const m = max ?? Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="space-y-2">
      {items.map((it, idx) => (
        <li key={idx}>
          <button type="button" onClick={it.onClick} disabled={!it.onClick} className="group w-full text-left enabled:cursor-pointer">
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate text-fg group-enabled:group-hover:text-violet-200">{it.label}</span>
              <span className="num shrink-0 font-medium text-muted">{format(it.value)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full transition-all" style={{ width: `${(it.value / m) * 100}%`, background: it.color ?? CATEGORICAL[0] }} />
            </div>
            {it.sub && <div className="mt-0.5 text-[11px] text-subtle">{it.sub}</div>}
          </button>
        </li>
      ))}
    </ul>
  )
}
