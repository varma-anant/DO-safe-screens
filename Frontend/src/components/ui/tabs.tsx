import * as React from 'react'
import * as T from '@radix-ui/react-tabs'
import { cn } from '@/utils/format'

export const Tabs = T.Root
export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof T.List>) {
  return <T.List className={cn('flex items-center gap-1 overflow-x-auto border-b border-border', className)} {...props} />
}
export function TabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        'relative -mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-[13px] font-medium text-muted transition-colors hover:text-fg data-[state=active]:border-violet-500 data-[state=active]:text-fg [&_svg]:size-3.5 cursor-pointer',
        className,
      )}
      {...props}
    />
  )
}
export function TabsContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof T.Content>) {
  return <T.Content className={cn('pt-4 focus:outline-none', className)} {...props} />
}
