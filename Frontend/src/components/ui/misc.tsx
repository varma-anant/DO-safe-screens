import * as React from 'react'
import * as Tip from '@radix-ui/react-tooltip'
import * as DM from '@radix-ui/react-dropdown-menu'
import * as Pop from '@radix-ui/react-popover'
import * as Cb from '@radix-ui/react-checkbox'
import * as Sw from '@radix-ui/react-switch'
import * as Sl from '@radix-ui/react-slider'
import { Check } from 'lucide-react'
import { cn } from '@/utils/format'

export function Tooltip({ content, children, side = 'top' }: { content: React.ReactNode; children: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  if (!content) return <>{children}</>
  return (
    <Tip.Root delayDuration={200}>
      <Tip.Trigger asChild>{children}</Tip.Trigger>
      <Tip.Portal>
        <Tip.Content side={side} sideOffset={6} className="z-[70] max-w-xs rounded-md border border-border-strong bg-surface-3 px-2.5 py-1.5 text-xs text-fg shadow-xl">
          {content}
        </Tip.Content>
      </Tip.Portal>
    </Tip.Root>
  )
}
export const TooltipProvider = Tip.Provider

export const DropdownMenu = DM.Root
export const DropdownMenuTrigger = DM.Trigger
export function DropdownMenuContent({ className, align = 'end', ...props }: React.ComponentPropsWithoutRef<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content align={align} sideOffset={6} className={cn('z-[60] min-w-[180px] rounded-lg border border-border-strong bg-surface-2 p-1 shadow-xl shadow-slate-900/10', className)} {...props} />
    </DM.Portal>
  )
}
export function DropdownMenuItem({ className, ...props }: React.ComponentPropsWithoutRef<typeof DM.Item>) {
  return <DM.Item className={cn('flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-fg outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-3 [&_svg]:size-4 [&_svg]:text-muted', className)} {...props} />
}
export function DropdownMenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof DM.Label>) {
  return <DM.Label className={cn('px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle', className)} {...props} />
}
export const DropdownMenuSeparator = () => <DM.Separator className="my-1 h-px bg-border" />
export function DropdownMenuCheckboxItem({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof DM.CheckboxItem>) {
  return (
    <DM.CheckboxItem className={cn('flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] outline-none data-[highlighted]:bg-surface-3', className)} {...props}>
      <span className="flex size-4 items-center justify-center rounded border border-border-strong">
        <DM.ItemIndicator>
          <Check className="size-3 text-violet-700" />
        </DM.ItemIndicator>
      </span>
      {children}
    </DM.CheckboxItem>
  )
}

export const Popover = Pop.Root
export const PopoverTrigger = Pop.Trigger
export function PopoverContent({ className, align = 'end', ...props }: React.ComponentPropsWithoutRef<typeof Pop.Content>) {
  return (
    <Pop.Portal>
      <Pop.Content align={align} sideOffset={8} className={cn('z-[60] rounded-xl border border-border-strong bg-surface-2 shadow-2xl shadow-slate-900/10 focus:outline-none', className)} {...props} />
    </Pop.Portal>
  )
}

export function Checkbox({ className, ...props }: React.ComponentPropsWithoutRef<typeof Cb.Root>) {
  return (
    <Cb.Root className={cn('flex size-4 shrink-0 items-center justify-center rounded border border-border-strong bg-surface-2 data-[state=checked]:border-violet-500 data-[state=checked]:bg-violet-600 data-[state=indeterminate]:bg-violet-600/60 cursor-pointer', className)} {...props}>
      <Cb.Indicator>
        <Check className="size-3 text-white" />
      </Cb.Indicator>
    </Cb.Root>
  )
}

export function Switch({ className, ...props }: React.ComponentPropsWithoutRef<typeof Sw.Root>) {
  return (
    <Sw.Root className={cn('relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border-strong bg-surface-3 transition-colors data-[state=checked]:border-violet-500 data-[state=checked]:bg-violet-600 disabled:opacity-50', className)} {...props}>
      <Sw.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
    </Sw.Root>
  )
}

export function Slider({ className, ...props }: React.ComponentPropsWithoutRef<typeof Sl.Root>) {
  return (
    <Sl.Root className={cn('relative flex h-5 w-full touch-none select-none items-center', className)} {...props}>
      <Sl.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-3">
        <Sl.Range className="absolute h-full bg-violet-500" />
      </Sl.Track>
      {(props.value ?? props.defaultValue ?? [0]).map((_, i) => (
        <Sl.Thumb key={i} className="block size-4 rounded-full border-2 border-violet-400 bg-surface shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 cursor-grab" aria-label="Value" />
      ))}
    </Sl.Root>
  )
}

export function Progress({ value, className, tone = 'violet' }: { value: number; className?: string; tone?: 'violet' | 'emerald' | 'amber' | 'red' | 'sky' }) {
  const color = { violet: 'bg-violet-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', sky: 'bg-sky-500' }[tone]
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-3/70', className)} />
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-border', className)} />
}

