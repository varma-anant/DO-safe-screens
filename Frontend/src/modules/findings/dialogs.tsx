import * as React from 'react'
import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ShieldOff, RotateCcw, Siren } from 'lucide-react'
import type { FalsePositiveReason, Finding, SecurityEvent } from '@/types'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/misc'
import { Callout } from '@/components/common/layout'
import { SeverityBadge } from '@/components/common/badges'
import { useAction, useCurrentUser, useUsers } from '@/hooks/queries'
import * as api from '@/services/api'
import { fmtDateTime } from '@/utils/format'

const toDateInput = (iso?: string) => (iso ? iso.slice(0, 10) : '')
const fromDateInput = (d: string) => new Date(`${d}T17:00:00`).toISOString()
const futureDate = (msg = 'Date must be today or later') => z.string().min(1, 'Required').refine((d) => new Date(`${d}T23:59:59`).getTime() >= Date.now(), msg)

// ------------------------------------------------------------------ Assign owner

const assignSchema = z.object({ ownerId: z.string().min(1, 'Select an owner'), targetDate: futureDate() })

export function AssignDialog({ finding, open, onOpenChange }: { finding: Finding; open: boolean; onOpenChange: (v: boolean) => void }) {
  const users = useUsers()
  const { run } = useAction()
  const { register, handleSubmit, formState, reset } = useForm<z.infer<typeof assignSchema>>({ resolver: zodResolver(assignSchema), values: { ownerId: finding.ownerId ?? '', targetDate: toDateInput(finding.targetDate && new Date(finding.targetDate) > new Date() ? finding.targetDate : new Date(Date.now() + 14 * 86_400_000).toISOString()) } })
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent title="Assign owner & target date" description={`${finding.id} · ${finding.title}`}>
        <form
          onSubmit={handleSubmit(async (v) => {
            await run(() => api.assignFinding(finding.id, v.ownerId, fromDateInput(v.targetDate)), 'Owner and target date updated')
            onOpenChange(false)
          })}
          className="space-y-4"
        >
          <Field label="Owner" required error={formState.errors.ownerId?.message}>
            <NativeSelect {...register('ownerId')}>
              <option value="">Select owner…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.team}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Target date" required error={formState.errors.targetDate?.message} hint="Severity SLA is applied by default; adjust when a change window requires.">
            <Input type="date" {...register('targetDate')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              Save assignment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ------------------------------------------------------------------ Create remediation ticket

const ticketSchema = z.object({
  title: z.string().min(8, 'Title must be at least 8 characters'),
  description: z.string().min(10, 'Describe the remediation work'),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']),
  assigneeId: z.string().min(1, 'Select an assignee'),
  dueDate: futureDate(),
})

export function CreateTicketDialog({ finding, open, onOpenChange }: { finding: Finding; open: boolean; onOpenChange: (v: boolean) => void }) {
  const users = useUsers()
  const navigate = useNavigate()
  const { run } = useAction()
  const pr = ({ critical: 'P1', high: 'P2', medium: 'P3', low: 'P4', informational: 'P4' } as const)[finding.severity]
  const { register, handleSubmit, formState } = useForm<z.infer<typeof ticketSchema>>({
    resolver: zodResolver(ticketSchema),
    values: {
      title: `Remediate: ${finding.title}`,
      description: `${finding.remediation.recommended}\n\nSteps:\n${finding.remediation.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nVerification: ${finding.remediation.verificationRequirements.join('; ')}`,
      priority: pr,
      assigneeId: finding.ownerId ?? '',
      dueDate: toDateInput(finding.targetDate && new Date(finding.targetDate) > new Date() ? finding.targetDate : new Date(Date.now() + 14 * 86_400_000).toISOString()),
    },
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide title="Create remediation ticket" description={`Linked to ${finding.id}. The finding moves to "In remediation" and the ticket appears in Tickets and the Remediation Center.`}>
        <form
          onSubmit={handleSubmit(async (v) => {
            const t = await run(() => api.createTicket({ ...v, dueDate: fromDateInput(v.dueDate), type: finding.domain === 'vulnerability' ? 'vulnerability' : finding.domain === 'ai' ? 'ai-governance' : 'configuration', findingId: finding.id, aiSystemId: finding.aiSystemId }), (t) => `Ticket ${t.id} created and assigned`)
            onOpenChange(false)
            if (t) navigate(`/operations/tickets/${t.id}`)
          })}
          className="space-y-4"
        >
          <Field label="Title" required error={formState.errors.title?.message}>
            <Input {...register('title')} />
          </Field>
          <Field label="Description" required error={formState.errors.description?.message}>
            <Textarea rows={7} {...register('description')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Priority" required>
              <NativeSelect {...register('priority')}>
                <option value="P1">P1 — Critical</option>
                <option value="P2">P2 — High</option>
                <option value="P3">P3 — Medium</option>
                <option value="P4">P4 — Low</option>
              </NativeSelect>
            </Field>
            <Field label="Assignee" required error={formState.errors.assigneeId?.message}>
              <NativeSelect {...register('assigneeId')}>
                <option value="">Select…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Due date" required error={formState.errors.dueDate?.message}>
              <Input type="date" {...register('dueDate')} />
            </Field>
          </div>
          <Callout tone="demo">Ticket sync to Jira is simulated — an external reference is generated but no external system is contacted.</Callout>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              Create ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ------------------------------------------------------------------ False-positive review

export const FP_REASONS: FalsePositiveReason[] = ['Version not affected', 'Component not present', 'Compensating control prevents exploitation', 'Scanner signature error', 'Asset decommissioned / misattributed', 'Duplicate of another finding', 'Intended configuration (approved exception)']

const fpSchema = z.object({
  reason: z.string().min(1, 'Select a classification reason'),
  evidenceIds: z.array(z.string()),
  supportingEvidence: z.string().min(15, 'Describe the supporting evidence (min 15 characters)'),
  analystNotes: z.string().min(30, 'Explain the rationale in at least 30 characters — this explanation is preserved in decision history'),
  reviewerId: z.string().min(1, 'Reviewer identity is required'),
  attest: z.literal(true, { message: 'You must confirm the review' }),
})

export function FalsePositiveDialog({ finding, open, onOpenChange }: { finding: Finding; open: boolean; onOpenChange: (v: boolean) => void }) {
  const users = useUsers()
  const me = useCurrentUser()
  const { run } = useAction()
  const [now] = React.useState(() => new Date().toISOString())
  const { register, handleSubmit, formState, watch, setValue } = useForm<z.infer<typeof fpSchema>>({
    resolver: zodResolver(fpSchema),
    defaultValues: { reason: '', evidenceIds: [], supportingEvidence: '', analystNotes: '', reviewerId: me.id, attest: false as unknown as true },
  })
  const evidenceIds = watch('evidenceIds')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide title="Review as false positive" description="Record an explicit, evidence-backed analyst decision. The original finding, its evidence and history are preserved; the decision can be reopened later.">
        <form
          onSubmit={handleSubmit(async (v) => {
            const refs = finding.evidence.filter((e) => v.evidenceIds.includes(e.id)).map((e) => `${e.id} (${e.label})`)
            await run(() => api.submitFalsePositiveReview(finding.id, { reason: v.reason as FalsePositiveReason, supportingEvidence: [refs.join('; '), v.supportingEvidence].filter(Boolean).join(' — '), analystNotes: v.analystNotes, reviewerId: v.reviewerId }), 'False-positive decision recorded')
            onOpenChange(false)
          })}
          className="space-y-4"
        >
          <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs">
            <SeverityBadge severity={finding.severity} /> <span className="font-mono text-muted">{finding.id}</span> <span className="truncate">{finding.title}</span>
          </div>
          {finding.validation.status === 'exploitable' && <Callout tone="warn" title="Validation indicates this finding is exploitable">A false-positive decision contradicts the latest validation result. Document why the validation result does not apply.</Callout>}
          <Field label="Classification reason" required error={formState.errors.reason?.message}>
            <NativeSelect {...register('reason')}>
              <option value="">Select a reason…</option>
              {FP_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </NativeSelect>
          </Field>
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted">Evidence reviewed (select items that support the decision)</div>
            <div className="space-y-1.5 rounded-lg border border-border p-2">
              {finding.evidence.map((e) => (
                <label key={e.id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-surface-2">
                  <Checkbox checked={evidenceIds.includes(e.id)} onCheckedChange={(c) => setValue('evidenceIds', c ? [...evidenceIds, e.id] : evidenceIds.filter((x) => x !== e.id))} className="mt-0.5" />
                  <span>
                    <span className="font-mono text-muted">{e.id}</span> {e.label} <span className="text-subtle">· {e.kind} · reliability {e.reliability}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <Field label="Supporting evidence" required error={formState.errors.supportingEvidence?.message} hint="e.g. package changelog showing backported fix, configuration screenshot, vendor advisory note">
            <Textarea rows={3} {...register('supportingEvidence')} />
          </Field>
          <Field label="Analyst notes / rationale" required error={formState.errors.analystNotes?.message}>
            <Textarea rows={4} {...register('analystNotes')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reviewer" required error={formState.errors.reviewerId?.message}>
              <NativeSelect {...register('reviewerId')}>
                {users.filter((u) => ['Security Analyst', 'Vulnerability Manager', 'CISO', 'AI Security Analyst', 'Incident Responder'].includes(u.role)).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.role}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Decision timestamp">
              <Input value={fmtDateTime(now)} readOnly className="text-muted" />
            </Field>
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <Checkbox onCheckedChange={(c) => setValue('attest', (c === true) as true, { shouldValidate: true })} className="mt-0.5" />
            <span>I confirm I reviewed the evidence and that this decision is mine. It will be recorded in decision history (version {finding.fpReviews.length + 1}) and the audit log.</span>
          </label>
          {formState.errors.attest && <p className="text-xs text-red-600">{formState.errors.attest.message}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              <ShieldOff /> Record false-positive decision
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ------------------------------------------------------------------ Reopen

export function ReopenDialog({ finding, open, onOpenChange }: { finding: Finding; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [reason, setReason] = React.useState('')
  const { run, pending } = useAction()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Reopen finding" description="The finding returns to Triaged. Previous decisions remain in history.">
        <Field label="Reason for reopening" required hint="Minimum 15 characters" error={reason.length > 0 && reason.length < 15 ? 'Please provide more detail' : undefined}>
          <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. New scanner evidence shows the vulnerable component is loaded at runtime." />
        </Field>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={reason.trim().length < 15}
            loading={pending}
            onClick={async () => {
              await run(() => api.reopenFinding(finding.id, reason.trim()), 'Finding reopened')
              setReason('')
              onOpenChange(false)
            }}
          >
            <RotateCcw /> Reopen finding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ------------------------------------------------------------------ Risk acceptance

const raSchema = z.object({ justification: z.string().min(30, 'Provide a business justification (min 30 characters)'), expiresAt: futureDate('Expiry must be in the future') })

export function RiskAcceptanceDialog({ finding, open, onOpenChange }: { finding: Finding; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { run } = useAction()
  const { register, handleSubmit, formState } = useForm<z.infer<typeof raSchema>>({ resolver: zodResolver(raSchema), defaultValues: { justification: '', expiresAt: toDateInput(new Date(Date.now() + 90 * 86_400_000).toISOString()) } })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Request risk acceptance" description="Risk acceptance is a human approval gate. The request appears in Approvals for a CISO decision.">
        <form
          onSubmit={handleSubmit(async (v) => {
            await run(() => api.requestRiskAcceptance(finding.id, v.justification, fromDateInput(v.expiresAt)), 'Risk acceptance requested — pending approval')
            onOpenChange(false)
          })}
          className="space-y-4"
        >
          <Field label="Business justification" required error={formState.errors.justification?.message}>
            <Textarea rows={4} {...register('justification')} placeholder="Why remediation is not feasible now, compensating controls in place, and residual risk." />
          </Field>
          <Field label="Acceptance expires" required error={formState.errors.expiresAt?.message}>
            <Input type="date" {...register('expiresAt')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              Submit for approval
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ------------------------------------------------------------------ Escalate to incident

const incSchema = z.object({
  title: z.string().min(8, 'Title must be at least 8 characters'),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  category: z.string().min(3, 'Category required'),
  summary: z.string().min(20, 'Summarize why this is an incident (min 20 characters)'),
  investigatorId: z.string().min(1, 'Assign an investigator'),
})

export function EscalateDialog({ finding, event, open, onOpenChange }: { finding?: Finding; event?: SecurityEvent; open: boolean; onOpenChange: (v: boolean) => void }) {
  const users = useUsers()
  const navigate = useNavigate()
  const { run } = useAction()
  const sev = (finding?.severity ?? event?.severity ?? 'high') as 'critical' | 'high' | 'medium' | 'low'
  const { register, handleSubmit, formState } = useForm<z.infer<typeof incSchema>>({
    resolver: zodResolver(incSchema),
    values: {
      title: finding ? `Investigate: ${finding.title}` : event ? `Investigate: ${event.title}` : '',
      severity: sev === ('informational' as string) ? 'low' : sev,
      category: finding ? (finding.domain === 'ai' ? 'AI policy violation' : 'Exploitation risk') : event?.type ?? 'Security event',
      summary: finding ? `${finding.executiveSummary}` : event?.rawSummary ?? '',
      investigatorId: '',
    },
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide title="Escalate to incident" description="Creates an incident record linked to this record and its evidence. Not every finding is an incident — escalate when there is indication of active threat or impact.">
        <form
          onSubmit={handleSubmit(async (v) => {
            const inc = await run(() => api.createIncident({ ...v, findingIds: finding ? [finding.id] : event?.findingId ? [event.findingId] : [], eventIds: event ? [event.id] : finding?.eventIds ?? [] }), (i) => `Incident ${i.id} created`)
            onOpenChange(false)
            if (inc) navigate(`/operations/incidents/${inc.id}`)
          })}
          className="space-y-4"
        >
          <Field label="Incident title" required error={formState.errors.title?.message}>
            <Input {...register('title')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Severity" required>
              <NativeSelect {...register('severity')}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </NativeSelect>
            </Field>
            <Field label="Category" required error={formState.errors.category?.message}>
              <Input {...register('category')} />
            </Field>
            <Field label="Investigator" required error={formState.errors.investigatorId?.message}>
              <NativeSelect {...register('investigatorId')}>
                <option value="">Select…</option>
                {users.filter((u) => ['Incident Responder', 'Security Analyst', 'AI Security Analyst'].includes(u.role)).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Summary" required error={formState.errors.summary?.message}>
            <Textarea rows={4} {...register('summary')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" loading={formState.isSubmitting}>
              <Siren /> Create incident
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
