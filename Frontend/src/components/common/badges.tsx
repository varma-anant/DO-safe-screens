import * as React from 'react'
import { ShieldAlert, Flame, Info, Sparkles, Eye, Globe2, UserCheck, FlaskConical } from 'lucide-react'
import type { Criticality, FindingStatus, Provenance, Severity } from '@/types'
import { cn, titleCase } from '@/utils/format'
import { CRITICALITY, FINDING_STATUS, PROVENANCE, SEVERITY_CLASS, TONE_CLASS, type Tone } from '@/utils/labels'
import { riskBand } from '@/utils/risk'
import { Tooltip } from '@/components/ui/misc'

export function Badge({ tone = 'slate', className, children, icon }: { tone?: Tone; className?: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 [&_svg]:size-3', TONE_CLASS[tone], className)}>
      {icon}
      {children}
    </span>
  )
}

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase leading-4 tracking-wide', SEVERITY_CLASS[severity], className)}>
      <span className="size-1.5 rounded-full" style={{ background: 'currentColor' }} />
      {severity === 'informational' ? 'Info' : severity}
    </span>
  )
}

export function FindingStatusBadge({ status }: { status: FindingStatus }) {
  const s = FINDING_STATUS[status]
  return (
    <Tooltip content={s.help}>
      <span tabIndex={0}>
        <Badge tone={s.tone}>{s.label}</Badge>
      </span>
    </Tooltip>
  )
}

export function StatusBadge({ map, value }: { map: Record<string, { label: string; tone: Tone; help?: string }>; value: string }) {
  const s = map[value] ?? { label: titleCase(value), tone: 'slate' as Tone }
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export function CriticalityBadge({ value }: { value: Criticality }) {
  return <Badge tone={CRITICALITY[value].tone}>{CRITICALITY[value].label}</Badge>
}

export function RiskScore({ score, size = 'sm', label }: { score: number; size?: 'sm' | 'lg'; label?: string }) {
  const band = riskBand(score)
  const color = { critical: 'text-red-300 bg-red-500/12 ring-red-500/30', high: 'text-orange-300 bg-orange-500/12 ring-orange-500/30', medium: 'text-amber-300 bg-amber-500/12 ring-amber-500/30', low: 'text-green-300 bg-green-500/12 ring-green-500/30', informational: '' }[band]
  return (
    <Tooltip content={label ?? `Risk score ${score}/100 (${band}). Dynamic prioritization model — see Prioritization for weights.`}>
      <span tabIndex={0} className={cn('num inline-flex items-center justify-center rounded-md font-semibold ring-1', color, size === 'lg' ? 'h-11 min-w-11 px-2 text-lg' : 'h-6 min-w-8 px-1.5 text-xs')}>
        {score}
      </span>
    </Tooltip>
  )
}

const PROV_ICON: Record<Provenance, React.ReactNode> = {
  observed: <Eye />,
  external: <Globe2 />,
  inferred: <Sparkles />,
  'human-reviewed': <UserCheck />,
  simulated: <FlaskConical />,
}

export function ProvenanceBadge({ value, className }: { value: Provenance; className?: string }) {
  const p = PROVENANCE[value]
  return (
    <Tooltip content={p.help}>
      <span tabIndex={0}>
        <Badge tone={p.tone} icon={PROV_ICON[value]} className={className}>
          {p.label}
        </Badge>
      </span>
    </Tooltip>
  )
}

export function KevBadge() {
  return (
    <Tooltip content="Listed in the CISA Known Exploited Vulnerabilities catalog (demo snapshot).">
      <span tabIndex={0}>
        <Badge tone="red" icon={<Flame />}>
          CISA KEV
        </Badge>
      </span>
    </Tooltip>
  )
}

export function DemoTag({ children = 'Simulated', className }: { children?: React.ReactNode; className?: string }) {
  return (
    <Badge tone="slate" icon={<FlaskConical />} className={className}>
      {children}
    </Badge>
  )
}

export function InfoHint({ text }: { text: React.ReactNode }) {
  return (
    <Tooltip content={text}>
      <button type="button" className="inline-flex text-subtle hover:text-muted" aria-label="More information">
        <Info className="size-3.5" />
      </button>
    </Tooltip>
  )
}

export function NotMapped({ reason }: { reason?: string }) {
  return (
    <Tooltip content={reason ?? 'No applicable mapping exists in this knowledge system for this finding. DO SAFE does not invent mappings.'}>
      <span tabIndex={0} className="inline-flex items-center gap-1 text-xs italic text-subtle">
        <ShieldAlert className="size-3" /> Not mapped
      </span>
    </Tooltip>
  )
}
