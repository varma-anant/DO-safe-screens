import * as React from 'react'
import { useBlocker, useParams } from 'react-router'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis, Cell } from 'recharts'
import { CheckCircle2, ClipboardList, FileText, Save, Send, Sparkles, Wrench } from 'lucide-react'
import type { AssessmentAnswer } from '@/types'
import { useAction, useCollections } from '@/hooks/queries'
import { usePage } from '@/hooks/usePage'
import { Callout, ErrorState, LoadingState, NotFound, PageHeader, Section, Stat } from '@/components/common/layout'
import { Badge, ProvenanceBadge, SeverityBadge, StatusBadge } from '@/components/common/badges'
import { EntityLink, UserName } from '@/components/common/entities'
import { AXIS, ChartTooltip, GRID } from '@/components/common/charts'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox, Progress } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { NativeSelect, Textarea } from '@/components/ui/input'
import { QUESTIONNAIRE } from '@/data/seed/tprm'
import * as api from '@/services/api'
import { cn, fmtDate, fmtDateTime, plural } from '@/utils/format'
import { ASSESSMENT_STATUS, SEVERITY_COLOR } from '@/utils/labels'

const ANSWERS: { v: AssessmentAnswer['answer']; label: string; cls: string }[] = [
  { v: 'yes', label: 'Yes', cls: 'border-emerald-500/60 bg-emerald-500/12 text-emerald-700' },
  { v: 'partial', label: 'Partial', cls: 'border-amber-500/60 bg-amber-500/12 text-amber-700' },
  { v: 'no', label: 'No', cls: 'border-red-500/60 bg-red-500/12 text-red-700' },
  { v: 'na', label: 'N/A', cls: 'border-slate-500/60 bg-slate-500/12 text-slate-600' },
]

export function AssessmentDetail() {
  const { id } = useParams()
  const { data, isLoading, error, retry } = useCollections(['assessments', 'vendors', 'tickets'] as const, { ignoreProjectFilter: true })
  const a = data?.assessments.find((x) => x.id === id)
  const v = data?.vendors.find((x) => x.id === a?.vendorId)
  usePage(a?.name ?? 'Assessment', [{ label: 'Third-Party Risk' }, { label: 'Assessments', to: '/tprm/assessments' }, { label: id ?? '' }])
  const [answers, setAnswers] = React.useState<AssessmentAnswer[] | null>(null)
  const [section, setSection] = React.useState<string>('')
  const [remOpen, setRemOpen] = React.useState(false)
  const [picked, setPicked] = React.useState<string[]>([])
  const { run, pending } = useAction()
  const dirty = answers !== null && JSON.stringify(answers) !== JSON.stringify(a?.answers)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)

  React.useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBefore)
    return () => window.removeEventListener('beforeunload', onBefore)
  }, [dirty])

  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={10} />
  if (!a || !v) return <NotFound what="Assessment" back={{ to: '/tprm/assessments', label: 'Back to Assessments' }} />

  const qs = QUESTIONNAIRE.filter((q) => v.isAIProvider || q.section !== 'AI Usage')
  const sections = [...new Set(qs.map((q) => q.section))]
  const current = answers ?? a.answers
  const activeSection = section || sections[0]
  const editable = ['draft', 'sent', 'in_progress'].includes(a.status)
  const answeredCount = qs.filter((q) => current.some((x) => x.questionId === q.id)).length
  const missingEvidence = qs.filter((q) => q.expectsEvidence && current.find((x) => x.questionId === q.id && ['yes', 'partial'].includes(x.answer) && !x.evidenceDocId))
  const setAnswer = (qid: string, patch: Partial<AssessmentAnswer>) => {
    const base = current.find((x) => x.questionId === qid) ?? { questionId: qid, answer: 'yes' as const }
    setAnswers([...current.filter((x) => x.questionId !== qid), { ...base, ...patch }])
  }
  const tickets = data.tickets.filter((t) => t.assessmentId === a.id)
  const r = a.result

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ to: '/tprm/assessments', label: 'Assessments' }}
        title={a.name}
        icon={<ClipboardList />}
        badges={<><StatusBadge map={ASSESSMENT_STATUS} value={a.status} /><Badge tone="violet">{a.type}</Badge></>}
        description={`${a.id} · vendor `}
        actions={
          <>
            {editable && (
              <>
                <Button variant="secondary" disabled={!dirty} loading={pending} onClick={async () => { await run(() => api.saveAssessmentAnswers(a.id, current), 'Progress saved'); setAnswers(null) }}>
                  <Save /> Save progress
                </Button>
                <Button disabled={answeredCount < qs.length} loading={pending} onClick={async () => { await run(() => api.submitAssessment(a.id, current), 'Assessment submitted for review'); setAnswers(null) }}>
                  <Send /> Submit assessment
                </Button>
              </>
            )}
            {['submitted', 'under_review'].includes(a.status) && (
              <Button loading={pending} onClick={() => run(() => api.generateAssessmentResult(a.id), 'Simulated risk assessment generated')}>
                <Sparkles /> Generate risk assessment (simulated)
              </Button>
            )}
            {a.status === 'completed' && r && r.gaps.length > 0 && (
              <Button onClick={() => { setPicked(r.gaps.filter((g) => !tickets.some((t) => t.description === g.summary)).map((g) => g.questionId)); setRemOpen(true) }}>
                <Wrench /> Create remediation items
              </Button>
            )}
          </>
        }
      />
      <div className="-mt-3 text-xs text-muted">
        Vendor: <EntityLink type="vendor" id={v.id} /> · created by <UserName id={a.createdById} avatar={false} /> · due {fmtDate(a.dueDate)}
      </div>

      {editable && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px]">
              <span className="num font-semibold">{answeredCount}</span> of {qs.length} questions answered
              {dirty && <span className="ml-2 text-amber-700">· unsaved changes</span>}
            </div>
            <Progress value={(answeredCount / qs.length) * 100} className="max-w-md" tone={answeredCount === qs.length ? 'emerald' : 'violet'} />
          </div>
          {answeredCount < qs.length && <p className="mt-2 text-[11px] text-subtle">All questions must be answered before submission. Questions answered “Yes/Partial” that expect evidence should reference an evidence document.</p>}
        </Card>
      )}

      {r && (
        <div className="grid gap-5 xl:grid-cols-3">
          <Section title="Assessment result" actions={<ProvenanceBadge value={r.provenance} />}>
            <div className="flex items-end gap-4">
              <div>
                <div className="num text-4xl font-semibold">{r.score}</div>
                <div className="text-xs text-muted">control score / 100</div>
              </div>
              <div className="pb-1">
                <div className="text-xs text-muted">Rating</div>
                <SeverityBadge severity={r.rating} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Stat label="Gaps identified" value={r.gaps.length} />
              <Stat label="Vendor residual risk" value={`${v.residualRisk}/100`} />
            </div>
            <p className="mt-3 text-[11px] text-subtle">Generated {fmtDateTime(r.generatedAt)}. Illustrative scoring: weighted share of controls in place ("Partial" = 50%), N/A excluded.</p>
          </Section>
          <Section className="xl:col-span-2" title="Score by questionnaire section">
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={r.sectionScores} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid {...GRID} horizontal={false} vertical />
                  <XAxis type="number" domain={[0, 100]} {...AXIS} />
                  <YAxis type="category" dataKey="section" width={150} {...AXIS} />
                  <RTooltip content={<ChartTooltip format={(n) => `${n}/100`} />} />
                  <Bar dataKey="score" name="Score" radius={[0, 4, 4, 0]} barSize={14}>
                    {r.sectionScores.map((s) => (
                      <Cell key={s.section} fill={s.score >= 85 ? '#0d9f74' : s.score >= 65 ? '#d97706' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
          <Section className="xl:col-span-3" title={`Gaps (${r.gaps.length})`} description="Controls answered “No” or “Partial” — create remediation items to track vendor follow-up">
            <div className="divide-y divide-border/60">
              {r.gaps.map((g) => {
                const t = tickets.find((x) => x.description === g.summary)
                return (
                  <div key={g.questionId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <SeverityBadge severity={g.severity} />
                      <span className="text-[13px]">{g.summary}</span>
                    </div>
                    {t ? <EntityLink type="ticket" id={t.id} label={t.status.replace('_', ' ')} /> : <span className="text-xs text-subtle">No remediation item</span>}
                  </div>
                )
              })}
              {!r.gaps.length && <p className="py-3 text-xs text-muted">No gaps — all applicable controls in place.</p>}
            </div>
          </Section>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit p-2">
          {sections.map((s) => {
            const sq = qs.filter((q) => q.section === s)
            const done = sq.filter((q) => current.some((x) => x.questionId === q.id)).length
            return (
              <button key={s} onClick={() => setSection(s)} className={cn('flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] cursor-pointer', activeSection === s ? 'bg-primary-soft text-fg' : 'text-muted hover:bg-surface-2')}>
                <span>{s}</span>
                <span className={cn('num text-[11px]', done === sq.length ? 'text-emerald-700' : 'text-subtle')}>
                  {done}/{sq.length}
                </span>
              </button>
            )
          })}
        </Card>
        <div className="space-y-3">
          {qs.filter((q) => q.section === activeSection).map((q, i) => {
            const ans = current.find((x) => x.questionId === q.id)
            return (
              <Card key={q.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] text-subtle">
                      {q.id} · weight {q.weight}
                      {q.expectsEvidence && ' · evidence expected'}
                    </div>
                    <div className="mt-0.5 text-[13px] font-medium">
                      {i + 1}. {q.text}
                    </div>
                    {q.guidance && <div className="mt-1 text-xs text-muted">{q.guidance}</div>}
                  </div>
                  {ans && <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />}
                </div>
                <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={`Answer for ${q.id}`}>
                  {ANSWERS.map((o) => (
                    <button key={o.v} role="radio" aria-checked={ans?.answer === o.v} disabled={!editable} onClick={() => setAnswer(q.id, { answer: o.v })} className={cn('rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors enabled:cursor-pointer', ans?.answer === o.v ? o.cls : 'border-border text-muted enabled:hover:border-border-strong')}>
                      {o.label}
                    </button>
                  ))}
                </div>
                {(editable || ans?.comment || ans?.evidenceDocId) && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_260px]">
                    <Textarea rows={2} disabled={!editable} value={ans?.comment ?? ''} onChange={(e) => setAnswer(q.id, { comment: e.target.value })} placeholder="Vendor comment / explanation" aria-label="Comment" className="min-h-0" />
                    <NativeSelect disabled={!editable} value={ans?.evidenceDocId ?? ''} onChange={(e) => setAnswer(q.id, { evidenceDocId: e.target.value || undefined })} aria-label="Evidence document">
                      <option value="">No evidence attached</option>
                      {v.evidenceDocs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.type}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>
      {missingEvidence.length > 0 && a.status !== 'completed' && (
        <Callout tone="warn" icon={<FileText />} title={`${plural(missingEvidence.length, 'answer')} expect evidence`}>
          {missingEvidence.map((q) => q.id).join(', ')} — attach evidence documents (Due Diligence) to strengthen the assessment.
        </Callout>
      )}

      <Dialog open={remOpen} onOpenChange={setRemOpen}>
        <DialogContent title="Create vendor remediation items" description={`One remediation item per selected gap, assigned to the relationship owner and tracked with ${v.name}'s responses.`}>
          <div className="space-y-1.5">
            {r?.gaps.map((g) => {
              const exists = tickets.some((t) => t.description === g.summary)
              return (
                <label key={g.questionId} className={cn('flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs', exists ? 'opacity-50' : 'cursor-pointer hover:bg-surface-2')}>
                  <Checkbox disabled={exists} checked={picked.includes(g.questionId)} onCheckedChange={(c) => setPicked(c ? [...picked, g.questionId] : picked.filter((x) => x !== g.questionId))} className="mt-0.5" />
                  <span>
                    <span style={{ color: SEVERITY_COLOR[g.severity] }} className="font-semibold uppercase">{g.severity}</span> {g.summary} {exists && '(already created)'}
                  </span>
                </label>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRemOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!picked.length} loading={pending} onClick={async () => { await run(() => api.createVendorRemediation(a.id, picked), `${plural(picked.length, 'remediation item')} created`); setRemOpen(false) }}>
              Create {plural(picked.length, 'item')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={blocker.state === 'blocked'} onOpenChange={(o) => !o && blocker.reset?.()}>
        <DialogContent title="Unsaved questionnaire changes" description="You have answers that have not been saved. Leave without saving?">
          <DialogFooter>
            <Button variant="secondary" onClick={() => blocker.reset?.()}>
              Stay
            </Button>
            <Button variant="secondary" onClick={async () => { await api.saveAssessmentAnswers(a.id, current); setAnswers(null); blocker.proceed?.() }}>
              Save & leave
            </Button>
            <Button variant="destructive" onClick={() => blocker.proceed?.()}>
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
