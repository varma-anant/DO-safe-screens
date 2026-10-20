import * as React from 'react'
import { Link } from 'react-router'
import { AlertTriangle, ArrowLeft, Inbox, RefreshCw, SearchX, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/utils/format'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/misc'
import { InfoHint } from './badges'

export function PageHeader({ title, description, actions, back, badges, icon }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; back?: { to: string; label: string }; badges?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-5">
      {back && (
        <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
          <ArrowLeft className="size-3.5" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon && <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-violet-300 [&_svg]:size-5">{icon}</div>}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
              {badges}
            </div>
            {description && <p className="mt-1 max-w-3xl text-[13px] text-muted">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function KpiCard({ label, value, sub, tone, trend, onClick, help, icon }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'red' | 'amber' | 'green' | 'violet' | 'default'; trend?: { value: string; good: boolean; up: boolean }; onClick?: () => void; help?: string; icon?: React.ReactNode }) {
  const color = { red: 'text-red-300', amber: 'text-amber-300', green: 'text-emerald-300', violet: 'text-violet-300', default: 'text-fg' }[tone ?? 'default']
  return (
    <div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()) : undefined} className={cn('card flex flex-col items-start p-4 text-left transition-colors', onClick && 'cursor-pointer hover:border-border-strong hover:bg-surface-2/60')}>
      <div className="flex w-full items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted">
          {icon && <span className="text-subtle [&_svg]:size-3.5">{icon}</span>}
          {label}
          {help && <InfoHint text={help} />}
        </span>
      </div>
      <div className={cn('num mt-1.5 text-2xl font-semibold tracking-tight', color)}>{value}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
        {trend && (
          <span className={cn('inline-flex items-center gap-0.5', trend.good ? 'text-emerald-400' : 'text-red-400')}>
            {trend.up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {trend.value}
          </span>
        )}
        {sub}
      </div>
    </div>
  )
}

export function LoadingState({ rows = 6, kpis = 0 }: { rows?: number; kpis?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      {kpis > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: kpis }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-7 w-20" />
              <Skeleton className="mt-2 h-3 w-32" />
            </Card>
          ))}
        </div>
      )}
      <Card className="p-4">
        <Skeleton className="mb-4 h-4 w-48" />
        <div className="space-y-2.5">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </Card>
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error?: Error; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-center px-6 py-14 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-red-500/10 text-red-400">
        <AlertTriangle className="size-5" />
      </div>
      <h3 className="mt-3 text-sm font-semibold">Unable to load data</h3>
      <p className="mt-1 max-w-md text-xs text-muted">{error?.message ?? 'The demo API returned an error.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw /> Retry
        </Button>
      )}
    </Card>
  )
}

export function EmptyState({ title, description, action, icon, search }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode; search?: boolean }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-surface-3 text-subtle [&_svg]:size-5">{icon ?? (search ? <SearchX /> : <Inbox />)}</div>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-xs text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function NotFound({ what, back }: { what: string; back: { to: string; label: string } }) {
  return (
    <Card>
      <EmptyState title={`${what} not found`} description="The record may have been removed when demo data was reset." action={<Button asChild variant="secondary" size="sm"><Link to={back.to}>{back.label}</Link></Button>} />
    </Card>
  )
}

export function KeyValue({ items, cols = 2, className }: { items: { label: string; value: React.ReactNode; hint?: string }[]; cols?: 1 | 2 | 3 | 4; className?: string }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3', { 1: 'grid-cols-1', 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-2 lg:grid-cols-3', 4: 'grid-cols-2 lg:grid-cols-4' }[cols], className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-subtle">
            {it.label}
            {it.hint && <InfoHint text={it.hint} />}
          </dt>
          <dd className="mt-0.5 break-words text-[13px] text-fg">{it.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Section({ title, children, actions, className, description }: { title: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode; className?: string; description?: React.ReactNode }) {
  return (
    <section className={cn('card', className)}>
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div>
          <h3 className="text-[14px] font-semibold">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="px-4 pb-4">{children}</div>
    </section>
  )
}

export function Callout({ tone = 'info', title, children, icon }: { tone?: 'info' | 'warn' | 'danger' | 'success' | 'demo'; title?: string; children: React.ReactNode; icon?: React.ReactNode }) {
  const cls = { info: 'border-sky-500/25 bg-sky-500/8 text-sky-200', warn: 'border-amber-500/25 bg-amber-500/8 text-amber-200', danger: 'border-red-500/25 bg-red-500/8 text-red-200', success: 'border-emerald-500/25 bg-emerald-500/8 text-emerald-200', demo: 'border-slate-500/25 bg-slate-500/8 text-slate-300' }[tone]
  return (
    <div className={cn('flex gap-2.5 rounded-lg border px-3 py-2.5 text-xs leading-relaxed', cls)}>
      {icon && <div className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</div>}
      <div>
        {title && <div className="mb-0.5 font-semibold">{title}</div>}
        <div className="opacity-90">{children}</div>
      </div>
    </div>
  )
}

export function Stat({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg bg-surface-2 px-3 py-2', className)}>
      <div className="text-[11px] text-subtle">{label}</div>
      <div className="num text-sm font-semibold">{value}</div>
    </div>
  )
}
