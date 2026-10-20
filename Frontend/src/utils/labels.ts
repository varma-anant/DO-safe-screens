import type { AIApproval, AssessmentStatus, Criticality, EventStatus, FindingStatus, IncidentStatus, Provenance, Severity, TicketStatus, VendorLifecycle } from '@/types'

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'informational']
export const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, informational: 0 }

export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#22c55e',
  informational: '#64748b',
}

export const SEVERITY_CLASS: Record<Severity, string> = {
  critical: 'bg-red-500/15 text-red-300 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  low: 'bg-green-500/15 text-green-300 border-green-500/30',
  informational: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
}

export type Tone = 'red' | 'orange' | 'amber' | 'green' | 'violet' | 'sky' | 'slate' | 'emerald'

export const TONE_CLASS: Record<Tone, string> = {
  red: 'bg-red-500/12 text-red-300 border-red-500/25',
  orange: 'bg-orange-500/12 text-orange-300 border-orange-500/25',
  amber: 'bg-amber-500/12 text-amber-300 border-amber-500/25',
  green: 'bg-green-500/12 text-green-300 border-green-500/25',
  emerald: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/25',
  violet: 'bg-violet-500/12 text-violet-300 border-violet-500/25',
  sky: 'bg-sky-500/12 text-sky-300 border-sky-500/25',
  slate: 'bg-slate-500/12 text-slate-300 border-slate-500/25',
}

export const FINDING_STATUS: Record<FindingStatus, { label: string; tone: Tone; help: string }> = {
  new: { label: 'New', tone: 'sky', help: 'Detected and enriched; not yet reviewed by an analyst.' },
  triaged: { label: 'Triaged', tone: 'violet', help: 'Reviewed by an analyst and assigned an owner.' },
  in_validation: { label: 'In validation', tone: 'amber', help: 'Exploitability is being validated (reachability, controls).' },
  validated: { label: 'Validated', tone: 'orange', help: 'Exploitability confirmed or assumed; awaiting remediation work.' },
  in_remediation: { label: 'In remediation', tone: 'amber', help: 'A remediation ticket is open and work is in progress.' },
  pending_verification: { label: 'Pending verification', tone: 'sky', help: 'Fix deployed; waiting for verification evidence.' },
  resolved: { label: 'Resolved', tone: 'emerald', help: 'Verification evidence confirmed the exposure is closed.' },
  false_positive: { label: 'False positive', tone: 'slate', help: 'An analyst recorded a reviewed decision that the finding is incorrect. Original record preserved.' },
  risk_accepted: { label: 'Risk accepted', tone: 'slate', help: 'Risk formally accepted with approval and expiry date.' },
}

export const OPEN_STATUSES: FindingStatus[] = ['new', 'triaged', 'in_validation', 'validated', 'in_remediation', 'pending_verification']
export const isOpen = (s: FindingStatus) => OPEN_STATUSES.includes(s)

export const TICKET_STATUS: Record<TicketStatus, { label: string; tone: Tone }> = {
  open: { label: 'Open', tone: 'sky' },
  in_progress: { label: 'In progress', tone: 'amber' },
  blocked: { label: 'Blocked', tone: 'red' },
  pending_verification: { label: 'Pending verification', tone: 'violet' },
  done: { label: 'Done', tone: 'emerald' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
}

export const INCIDENT_STATUS: Record<IncidentStatus, { label: string; tone: Tone }> = {
  open: { label: 'Open', tone: 'red' },
  investigating: { label: 'Investigating', tone: 'orange' },
  contained: { label: 'Contained', tone: 'amber' },
  eradicated: { label: 'Eradicated', tone: 'violet' },
  recovered: { label: 'Recovered', tone: 'sky' },
  closed: { label: 'Closed', tone: 'emerald' },
}

export const EVENT_STATUS: Record<EventStatus, { label: string; tone: Tone }> = {
  new: { label: 'New', tone: 'sky' },
  triaged: { label: 'Triaged', tone: 'violet' },
  escalated: { label: 'Escalated', tone: 'red' },
  dismissed: { label: 'Dismissed', tone: 'slate' },
}

export const VENDOR_LIFECYCLE: Record<VendorLifecycle, { label: string; tone: Tone }> = {
  intake: { label: 'Intake', tone: 'sky' },
  due_diligence: { label: 'Due diligence', tone: 'violet' },
  active: { label: 'Active', tone: 'emerald' },
  remediation: { label: 'Remediation', tone: 'orange' },
  offboarding: { label: 'Offboarding', tone: 'amber' },
  offboarded: { label: 'Offboarded', tone: 'slate' },
}

export const ASSESSMENT_STATUS: Record<AssessmentStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'slate' },
  sent: { label: 'Sent to vendor', tone: 'sky' },
  in_progress: { label: 'In progress', tone: 'amber' },
  submitted: { label: 'Submitted', tone: 'violet' },
  under_review: { label: 'Under review', tone: 'violet' },
  completed: { label: 'Completed', tone: 'emerald' },
}

export const AI_APPROVAL: Record<AIApproval, { label: string; tone: Tone }> = {
  approved: { label: 'Approved', tone: 'emerald' },
  under_review: { label: 'Under review', tone: 'amber' },
  unsanctioned: { label: 'Unsanctioned (shadow)', tone: 'red' },
  prohibited: { label: 'Prohibited', tone: 'slate' },
}

export const CRITICALITY: Record<Criticality, { label: string; tone: Tone; weight: number }> = {
  'tier-1': { label: 'Tier 1', tone: 'red', weight: 1 },
  'tier-2': { label: 'Tier 2', tone: 'orange', weight: 0.7 },
  'tier-3': { label: 'Tier 3', tone: 'amber', weight: 0.4 },
  'tier-4': { label: 'Tier 4', tone: 'slate', weight: 0.2 },
}

export const PROVENANCE: Record<Provenance, { label: string; tone: Tone; help: string }> = {
  observed: { label: 'Observed evidence', tone: 'emerald', help: 'Collected directly from a connected source (simulated connector in this demo).' },
  external: { label: 'External reference', tone: 'sky', help: 'Public knowledge source such as NVD, CISA KEV or MITRE.' },
  inferred: { label: 'Inferred assessment', tone: 'amber', help: 'Derived by DO SAFE analytics — requires human confirmation.' },
  'human-reviewed': { label: 'Human-reviewed', tone: 'violet', help: 'Confirmed or recorded by a named analyst.' },
  simulated: { label: 'Simulated demo output', tone: 'slate', help: 'Generated by the prototype for demonstration; not a real scan or model output.' },
}

export const ASSET_TYPE_LABEL: Record<string, string> = {
  server: 'Server',
  container: 'Container workload',
  'kubernetes-cluster': 'Kubernetes cluster',
  database: 'Database',
  'cloud-storage': 'Cloud storage',
  'api-gateway': 'API gateway',
  'web-application': 'Web application',
  'identity-provider': 'Identity provider',
  endpoint: 'Endpoint',
  'network-device': 'Network device',
  'saas-application': 'SaaS application',
  'code-repository': 'Code repository',
  'serverless-function': 'Serverless function',
}
