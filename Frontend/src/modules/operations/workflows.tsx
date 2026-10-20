import * as React from 'react'
import { Link } from 'react-router'
import { ReactFlow, Background, Controls, Handle, Position, MarkerType, type Edge, type Node } from '@xyflow/react'
import { Bot, CheckCircle2, Circle, CircleDot, Lock, PauseCircle, Workflow, XCircle } from 'lucide-react'
import type { Database, HistoryEntry } from '@/types'
import { useCollections } from '@/hooks/queries'
import { usePage } from '@/hooks/usePage'
import { Callout, ErrorState, KeyValue, LoadingState, PageHeader, Section } from '@/components/common/layout'
import { Badge, DemoTag } from '@/components/common/badges'
import { EntityLink, Timeline } from '@/components/common/entities'
import { Card } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/input'
import { cn } from '@/utils/format'
import { isOpen } from '@/utils/labels'

type StageStatus = 'done' | 'running' | 'pending' | 'blocked' | 'skipped'

interface StageDef {
  id: string
  label: string
  description: string
  inputs: string[]
  outputs: string[]
  agent?: string
  approval?: string
  historyTypes?: HistoryEntry['type'][]
}

interface WorkflowDef {
  id: string
  name: string
  description: string
  recordLabel: string
  stages: StageDef[]
  instances: (db: Pick<Database, 'findings' | 'vendors' | 'incidents' | 'governanceReviews' | 'executions' | 'assessments' | 'agents'>) => { id: string; label: string }[]
  status: (db: Pick<Database, 'findings' | 'vendors' | 'incidents' | 'governanceReviews' | 'executions' | 'assessments' | 'agents'>, id: string) => { statuses: StageStatus[]; history: HistoryEntry[]; link: React.ReactNode }
}

const seq = (n: number, current: number, blockedAt?: number): StageStatus[] => Array.from({ length: n }, (_, i) => (i < current ? 'done' : i === current ? (blockedAt === i ? 'blocked' : 'running') : 'pending'))

const WORKFLOWS: WorkflowDef[] = [
  {
    id: 'vuln',
    name: 'Vulnerability investigation',
    description: 'From detection through enrichment, classification, AI-assisted investigation, validation and remediation to verified closure.',
    recordLabel: 'Finding',
    stages: [
      { id: 'detect', label: 'Detect & ingest', description: 'Finding received from a connected source and normalized.', inputs: ['Scanner / sensor record'], outputs: ['Normalized finding'], agent: 'Exposure Discovery Agent', historyTypes: ['discovered', 'observed'] },
      { id: 'enrich', label: 'Enrich', description: 'CVE / CWE / ATT&CK / KEV / EPSS references attached from the knowledge library.', inputs: ['Normalized finding'], outputs: ['Library mappings'], agent: 'Vulnerability Enrichment Agent', historyTypes: ['enriched'] },
      { id: 'classify', label: 'Classify', description: 'Category, weakness class and confidence with mapping rationale.', inputs: ['Evidence', 'Library mappings'], outputs: ['Classification + confidence'], agent: 'Classification Assistant', approval: 'Analyst review when confidence < 80%', historyTypes: ['classified', 'reclassified'] },
      { id: 'investigate', label: 'Investigate', description: 'AI-assisted summary and root-cause hypotheses (simulated); analyst triage and ownership.', inputs: ['Evidence', 'History'], outputs: ['Investigation summary', 'Owner'], agent: 'Investigation Assistant', historyTypes: ['ai_analysis', 'assigned', 'comment'] },
      { id: 'validate', label: 'Validate', description: 'Reachability, exploit preconditions and compensating controls.', inputs: ['Asset exposure', 'Controls'], outputs: ['Exploitable / not exploitable'], historyTypes: ['validated'] },
      { id: 'mobilize', label: 'Mobilize', description: 'Remediation ticket created and assigned with target date.', inputs: ['Validated finding'], outputs: ['Ticket'], agent: 'Remediation Orchestrator', approval: 'Human approval for bulk ticket creation', historyTypes: ['ticket_created'] },
      { id: 'remediate', label: 'Remediate', description: 'Owner implements the fix; progress tracked on the ticket.', inputs: ['Ticket'], outputs: ['Fix deployed'], historyTypes: ['remediation_update'] },
      { id: 'verify', label: 'Verify & close', description: 'Verification evidence confirms the exposure is closed.', inputs: ['Verification evidence'], outputs: ['Resolved finding', 'Internal learning record'], approval: 'Verifier records evidence', historyTypes: ['verification'] },
    ],
    instances: (db) => db.findings.filter((f) => f.domain !== 'ai').slice(0, 80).map((f) => ({ id: f.id, label: `${f.id} · ${f.title}` })),
    status: (db, id) => {
      const f = db.findings.find((x) => x.id === id)!
      const idx = { new: 3, triaged: 3, in_validation: 4, validated: 5, in_remediation: 6, pending_verification: 7, resolved: 8, false_positive: 4, risk_accepted: 5 }[f.status]
      const s = seq(8, idx)
      if (f.status === 'false_positive') s.forEach((_, i) => i >= 4 && (s[i] = 'skipped'))
      if (f.status === 'risk_accepted') s.forEach((_, i) => i >= 5 && (s[i] = 'skipped'))
      return { statuses: s, history: f.history, link: <EntityLink type="finding" id={f.id} /> }
    },
  },
  {
    id: 'validation',
    name: 'Exposure validation',
    description: 'Determine whether a reported exposure is genuinely exploitable before mobilizing remediation.',
    recordLabel: 'Finding',
    stages: [
      { id: 'select', label: 'Select candidate', description: 'Untriaged high-risk exposure selected from the validation queue.', inputs: ['Prioritized queue'], outputs: ['Candidate'] },
      { id: 'reach', label: 'Reachability', description: 'Is the vulnerable component reachable from its threat zone?', inputs: ['Network topology', 'Asset exposure'], outputs: ['Reachable / not'], agent: 'Attack Path Analysis Agent' },
      { id: 'precond', label: 'Exploit preconditions', description: 'Version, configuration and runtime conditions required by the exploit.', inputs: ['Evidence', 'CVE details'], outputs: ['Preconditions met / not'] },
      { id: 'controls', label: 'Control effectiveness', description: 'WAF, segmentation, EDR or other compensating controls that block exploitation.', inputs: ['Control inventory'], outputs: ['Control assessment'] },
      { id: 'decision', label: 'Decision', description: 'Exploitable → mobilize; not exploitable → false-positive review or risk acceptance.', inputs: ['Validation results'], outputs: ['Validation status'], approval: 'False-positive or risk acceptance requires human decision', historyTypes: ['validated', 'false_positive_review', 'risk_acceptance'] },
    ],
    instances: (db) => db.findings.filter((f) => f.domain !== 'ai' && f.validation.status !== 'not_started').slice(0, 60).map((f) => ({ id: f.id, label: `${f.id} · ${f.title}` })),
    status: (db, id) => {
      const f = db.findings.find((x) => x.id === id)!
      const v = f.validation.status
      const s: StageStatus[] = v === 'in_progress' ? seq(5, 1) : ['done', 'done', 'done', 'done', 'done']
      return { statuses: s, history: f.history.filter((h) => ['validated', 'false_positive_review', 'risk_acceptance', 'status_change'].includes(h.type)), link: <EntityLink type="finding" id={f.id} /> }
    },
  },
  {
    id: 'approval',
    name: 'Remediation approval',
    description: 'Agent-drafted remediation work passes a human approval gate before tickets are created in ITSM.',
    recordLabel: 'Agent execution',
    stages: [
      { id: 'select', label: 'Select validated findings', description: 'Validated findings without tickets are gathered.', inputs: ['Validated findings'], outputs: ['Candidate list'], agent: 'Remediation Orchestrator' },
      { id: 'route', label: 'Resolve owners', description: 'Owners derived from asset and business service mappings.', inputs: ['Ownership map'], outputs: ['Owner per finding'], agent: 'Remediation Orchestrator' },
      { id: 'draft', label: 'Draft tickets', description: 'Ticket drafts with SLA due dates and evidence.', inputs: ['Findings', 'SLA policy'], outputs: ['Ticket drafts'], agent: 'Remediation Orchestrator' },
      { id: 'gate', label: 'Human approval', description: 'A security lead approves or rejects the proposed tickets.', inputs: ['Ticket drafts'], outputs: ['Decision'], approval: 'Required — bulk ticket creation is a high-impact action' },
      { id: 'create', label: 'Create & sync', description: 'Tickets created in DO SAFE and synced to Jira (simulated).', inputs: ['Approved drafts'], outputs: ['Tickets'] },
    ],
    instances: (db) => db.executions.filter((e) => e.agentId === 'AGT-07').map((e) => ({ id: e.id, label: `${e.id} · ${e.status.replace('_', ' ')} · ${new Date(e.startedAt).toLocaleString()}` })),
    status: (db, id) => {
      const e = db.executions.find((x) => x.id === id)!
      const s: StageStatus[] = e.status === 'running' ? seq(5, Math.min(2, e.steps.filter((x) => x.status === 'done').length)) : e.status === 'awaiting_approval' ? seq(5, 3) : e.status === 'rejected' ? ['done', 'done', 'done', 'done', 'skipped'] : e.status === 'failed' ? seq(5, 2, 2) : ['done', 'done', 'done', 'done', 'done']
      return { statuses: s, history: e.steps.map((st, i) => ({ id: `${e.id}-${i}`, at: e.startedAt, actorId: 'SYSTEM', type: 'comment', summary: `${st.name}: ${st.status}`, detail: st.detail })), link: <Link to={`/intelligence/agents/${e.agentId}`} className="text-violet-300">{e.id} (Remediation Orchestrator)</Link> }
    },
  },
  {
    id: 'vendor',
    name: 'Vendor assessment',
    description: 'Third-party lifecycle from intake and inherent risk through due diligence, remediation and monitoring.',
    recordLabel: 'Vendor',
    stages: [
      { id: 'intake', label: 'Intake', description: 'Vendor registered; relationship and data access captured.', inputs: ['Onboarding form'], outputs: ['Vendor record'] },
      { id: 'inherent', label: 'Inherent risk', description: 'Risk before controls from criticality, data sensitivity and access.', inputs: ['Vendor profile'], outputs: ['Inherent risk score'] },
      { id: 'questionnaire', label: 'Questionnaire', description: 'Security questionnaire issued and answered.', inputs: ['Questionnaire template'], outputs: ['Responses'] },
      { id: 'evidence', label: 'Evidence analysis', description: 'SOC 2, pen test, policies analyzed for exceptions.', inputs: ['Evidence documents'], outputs: ['Exceptions', 'Coverage'], agent: 'Vendor Evidence Analyzer', approval: 'TPRM analyst accepts analysis' },
      { id: 'score', label: 'Risk scoring', description: 'Residual risk computed from responses and evidence.', inputs: ['Responses', 'Evidence'], outputs: ['Residual risk'] },
      { id: 'remediate', label: 'Remediation', description: 'Gaps tracked as vendor remediation items with vendor responses.', inputs: ['Gaps'], outputs: ['Remediation items'] },
      { id: 'monitor', label: 'Continuous monitoring', description: 'Ratings, breach intel, contract milestones, fourth parties.', inputs: ['Outside-in signals'], outputs: ['Alerts'], agent: 'Vendor Monitoring Agent' },
    ],
    instances: (db) => db.vendors.map((v) => ({ id: v.id, label: `${v.id} · ${v.name}` })),
    status: (db, id) => {
      const v = db.vendors.find((x) => x.id === id)!
      const hasAsm = db.assessments.some((a) => a.vendorId === id && a.answers.length > 0)
      const idx = v.lifecycle === 'intake' ? (hasAsm ? 2 : 1) : v.lifecycle === 'due_diligence' ? 3 : v.lifecycle === 'remediation' ? 5 : v.lifecycle === 'active' ? 6 : 7
      const s = seq(7, idx)
      if (v.lifecycle === 'offboarding' || v.lifecycle === 'offboarded') s.fill('done')
      return { statuses: s, history: v.history, link: <EntityLink type="vendor" id={v.id} /> }
    },
  },
  {
    id: 'aigov',
    name: 'AI governance review',
    description: 'Shadow AI or new AI use cases move through evidence collection, risk assessment and a governance decision.',
    recordLabel: 'Governance review',
    stages: [
      { id: 'discover', label: 'Discovery', description: 'AI usage detected (SSE, IdP, EDR, code) or use case submitted.', inputs: ['Usage signals'], outputs: ['AI system record'], agent: 'AI Security Posture Agent' },
      { id: 'evidence', label: 'Evidence', description: 'Usage volume, data classification, contracts, configuration.', inputs: ['Signals', 'Contracts'], outputs: ['Evidence pack'] },
      { id: 'assess', label: 'Risk assessment', description: 'OWASP LLM risks, data exposure, provider risk.', inputs: ['Evidence pack'], outputs: ['Risk rating'] },
      { id: 'review', label: 'Governance review', description: 'AI governance board reviews.', inputs: ['Risk rating'], outputs: ['Decision'], approval: 'Required — AI governance reviewer' },
      { id: 'remediate', label: 'Remediate / enforce', description: 'Conditions implemented, blocks applied, tickets tracked.', inputs: ['Decision'], outputs: ['Tickets', 'Policies'] },
    ],
    instances: (db) => db.governanceReviews.map((g) => ({ id: g.id, label: `${g.id} · ${g.title}` })),
    status: (db, id) => {
      const g = db.governanceReviews.find((x) => x.id === id)!
      const idx = g.status === 'open' ? 2 : g.status === 'in_review' ? 3 : g.status === 'closed' ? 5 : 4
      return { statuses: seq(5, idx), history: g.notes.map((n) => ({ id: n.id, at: n.at, actorId: n.authorId, type: 'comment' as const, summary: 'Review note', detail: n.text })), link: <Link to={`/ai-security/governance/${g.id}`} className="text-violet-300">{g.id}</Link> }
    },
  },
  {
    id: 'incident',
    name: 'Incident escalation',
    description: 'From a security event or finding to a declared incident, response and closure with a resolution summary.',
    recordLabel: 'Incident',
    stages: [
      { id: 'signal', label: 'Signal', description: 'Event or finding indicates potential compromise.', inputs: ['Event / finding'], outputs: ['Signal'] },
      { id: 'triage', label: 'Triage', description: 'Analyst assesses; benign events are dismissed with an assessment.', inputs: ['Signal'], outputs: ['Assessment'] },
      { id: 'declare', label: 'Declare', description: 'Incident record created and investigator assigned.', inputs: ['Assessment'], outputs: ['Incident'], approval: 'Analyst decision' },
      { id: 'contain', label: 'Contain', description: 'Containment actions executed (by humans — DO SAFE does not execute remediation).', inputs: ['Response tasks'], outputs: ['Contained'] },
      { id: 'eradicate', label: 'Eradicate & recover', description: 'Root cause removed and services restored.', inputs: ['Tasks'], outputs: ['Recovered'] },
      { id: 'close', label: 'Close', description: 'Resolution summary recorded; post-incident review.', inputs: ['All tasks done'], outputs: ['Closed incident'], approval: 'All tasks complete + resolution summary' },
    ],
    instances: (db) => db.incidents.map((i) => ({ id: i.id, label: `${i.id} · ${i.title}` })),
    status: (db, id) => {
      const i = db.incidents.find((x) => x.id === id)!
      const idx = { open: 2, investigating: 3, contained: 4, eradicated: 4, recovered: 5, closed: 6 }[i.status]
      return { statuses: seq(6, idx), history: i.timeline, link: <EntityLink type="incident" id={i.id} /> }
    },
  },
]

const STATUS_STYLE: Record<StageStatus, { icon: React.ReactNode; cls: string; label: string }> = {
  done: { icon: <CheckCircle2 className="size-3.5 text-emerald-400" />, cls: 'border-emerald-500/40', label: 'Completed' },
  running: { icon: <CircleDot className="size-3.5 text-violet-300 pulse-dot" />, cls: 'border-violet-400 shadow-violet-900/40', label: 'In progress' },
  pending: { icon: <Circle className="size-3.5 text-subtle" />, cls: 'border-border-strong opacity-70', label: 'Pending' },
  blocked: { icon: <PauseCircle className="size-3.5 text-red-400" />, cls: 'border-red-500/50', label: 'Blocked' },
  skipped: { icon: <XCircle className="size-3.5 text-subtle" />, cls: 'border-dashed border-border-strong opacity-50', label: 'Skipped' },
}

function StageNode({ data }: { data: { stage: StageDef; status: StageStatus; selected: boolean; reversed: boolean } }) {
  const st = STATUS_STYLE[data.status]
  return (
    <div className={cn('w-48 rounded-xl border bg-surface px-3 py-2.5 shadow-lg transition-all', st.cls, data.selected && 'ring-2 ring-violet-500/60')}>
      <Handle type="target" position={data.reversed ? Position.Right : Position.Left} className="!bg-violet-400" />
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-subtle">
          {st.icon} {st.label}
        </span>
        {data.stage.approval && <Lock className="size-3 text-amber-300" aria-label="Approval gate" />}
      </div>
      <div className="mt-1 text-[13px] font-medium">{data.stage.label}</div>
      {data.stage.agent && (
        <div className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted">
          <Bot className="size-3" /> {data.stage.agent}
        </div>
      )}
      <Handle type="source" position={data.reversed ? Position.Left : Position.Right} className="!bg-violet-400" />
    </div>
  )
}
const nodeTypes = { stage: StageNode }

export function WorkflowCenter() {
  usePage('Workflow Center', [{ label: 'Security Operations' }, { label: 'Workflow Center' }])
  const { data, isLoading, error, retry } = useCollections(['findings', 'vendors', 'incidents', 'governanceReviews', 'executions', 'assessments', 'agents'] as const)
  const [wfId, setWfId] = React.useState('vuln')
  const [instance, setInstance] = React.useState<string>('')
  const [sel, setSel] = React.useState(0)
  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState rows={10} />
  const wf = WORKFLOWS.find((w) => w.id === wfId)!
  const instances = wf.instances(data)
  const instId = instances.find((i) => i.id === instance)?.id ?? instances.find((i) => {
    if (wf.id !== 'vuln') return true
    const f = data.findings.find((x) => x.id === i.id)
    return f && isOpen(f.status) && f.status !== 'new'
  })?.id ?? instances[0]?.id
  const state = instId ? wf.status(data, instId) : { statuses: wf.stages.map(() => 'pending' as StageStatus), history: [], link: null }
  const perRow = 4
  const nodes: Node[] = wf.stages.map((s, i) => {
    const row = Math.floor(i / perRow)
    const col = row % 2 === 0 ? i % perRow : perRow - 1 - (i % perRow)
    return { id: s.id, type: 'stage', position: { x: col * 240, y: row * 150 }, data: { stage: s, status: state.statuses[i], selected: sel === i, reversed: row % 2 === 1 } }
  })
  const edges: Edge[] = wf.stages.slice(1).map((s, i) => {
    const done = state.statuses[i] === 'done'
    const sameRow = Math.floor(i / perRow) === Math.floor((i + 1) / perRow)
    return { id: `${wf.id}-e${i}`, source: wf.stages[i].id, target: s.id, type: sameRow ? 'default' : 'smoothstep', animated: state.statuses[i + 1] === 'running', style: { stroke: done ? '#10b981' : '#3a4360', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: done ? '#10b981' : '#3a4360' } }
  })
  const stage = wf.stages[sel] ?? wf.stages[0]
  const stageHistory = state.history.filter((h) => !stage.historyTypes || stage.historyTypes.includes(h.type))
  return (
    <div className="space-y-5">
      <PageHeader title="Workflow Center" icon={<Workflow />} description="Visual security workflows across modules. Each graph is bound to a live demo record — stage status, inputs/outputs, approval gates and execution history reflect that record's current state." />
      <Callout tone="demo">Workflows are predefined graphs for this prototype. They visualize state from demo records; they are not a production workflow engine and do not execute actions against real systems.</Callout>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {WORKFLOWS.map((w) => (
          <button key={w.id} onClick={() => { setWfId(w.id); setInstance(''); setSel(0) }} className={cn('card p-3 text-left transition-colors cursor-pointer', wfId === w.id ? 'border-violet-500/60 bg-violet-500/8' : 'hover:border-border-strong')}>
            <div className="text-[13px] font-semibold">{w.name}</div>
            <div className="mt-0.5 text-[11px] text-muted">{w.stages.length} stages · {w.instances(data).length} records</div>
          </button>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <Card className="flex flex-wrap items-center gap-3 p-3">
            <span className="text-xs text-muted">{wf.recordLabel}:</span>
            <NativeSelect value={instId ?? ''} onChange={(e) => { setInstance(e.target.value); setSel(0) }} className="h-8 max-w-xl flex-1 text-xs" aria-label="Workflow record">
              {instances.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </NativeSelect>
            <span className="text-xs">{state.link}</span>
          </Card>
          <Card className="h-[400px] overflow-hidden">
            <ReactFlow key={`${wf.id}-${instId}`} nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.2 }} onNodeClick={(_, n) => setSel(wf.stages.findIndex((s) => s.id === n.id))} nodesDraggable={false} nodesConnectable={false}>
              <Background color="#1f2638" gap={20} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </Card>
          <p className="text-xs text-muted">{wf.description}</p>
        </div>
        <div className="space-y-5">
          <Section title={stage.label} description={stage.description} actions={<Badge tone={state.statuses[sel] === 'done' ? 'emerald' : state.statuses[sel] === 'running' ? 'violet' : state.statuses[sel] === 'blocked' ? 'red' : 'slate'}>{STATUS_STYLE[state.statuses[sel] ?? 'pending'].label}</Badge>}>
            <KeyValue
              cols={1}
              items={[
                { label: 'Inputs', value: <ul className="space-y-0.5">{stage.inputs.map((x) => <li key={x}>• {x}</li>)}</ul> },
                { label: 'Outputs', value: <ul className="space-y-0.5">{stage.outputs.map((x) => <li key={x}>• {x}</li>)}</ul> },
                { label: 'Agent', value: stage.agent ? <span className="inline-flex items-center gap-1"><Bot className="size-3.5 text-violet-300" /> {stage.agent} <DemoTag /></span> : 'Human-performed' },
                { label: 'Approval requirement', value: stage.approval ? <span className="inline-flex items-center gap-1 text-amber-200"><Lock className="size-3.5" /> {stage.approval}</span> : 'None' },
              ]}
            />
          </Section>
          <Section title="Execution history for this stage">
            <Timeline entries={stageHistory.slice(-8)} empty="No recorded events for this stage on the selected record." />
          </Section>
        </div>
      </div>
    </div>
  )
}
