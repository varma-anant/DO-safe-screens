import { CircleHelp } from 'lucide-react'
import { GLOSSARY, type GlossaryKey } from '@/utils/plain'
import { Tooltip } from '@/components/ui/misc'
import { cn } from '@/utils/format'

/** A word with a plain-language explanation on hover/focus. Children default to the plain wording. */
export function Term({ k, children, icon = true, className }: { k: GlossaryKey; children?: React.ReactNode; icon?: boolean; className?: string }) {
  const g = GLOSSARY[k]
  return (
    <Tooltip
      content={
        <span className="block max-w-[260px]">
          <span className="block font-semibold">{g.plain}{g.term !== g.plain ? <span className="font-normal text-muted"> · also called “{g.term}”</span> : null}</span>
          <span className="mt-0.5 block text-muted">{g.meaning}</span>
        </span>
      }
    >
      <span tabIndex={0} className={cn('inline-flex cursor-help items-center gap-0.5 underline decoration-dotted decoration-1 underline-offset-[3px] outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-sm', className)} aria-label={`${typeof children === 'string' ? children : g.plain}: ${g.meaning}`}>
        {children ?? g.plain}
        {icon && <CircleHelp className="size-3 shrink-0 text-subtle" aria-hidden />}
      </span>
    </Tooltip>
  )
}
