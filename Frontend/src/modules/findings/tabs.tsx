import * as React from 'react'
import { Link } from 'react-router'
import { AlertTriangle, BookOpen, Check, CheckCircle2, CircleDashed, ExternalLink, FileSearch, Lightbulb, Plus, RefreshCw, ShieldCheck, Sparkles, ThumbsDown, ThumbsUp, X, HelpCircle, ArrowRight, Database, GitMerge, Filter, Tags, Radar } from 'lucide-react'
import type { Asset, AttackPath, BusinessService, Finding, Incident, Integration, KnowledgeRecord, SecurityEvent, Ticket, AISystem, Vendor } from '@/types'
import { Badge, FindingStatusBadge, InfoHint, KevBadge, NotMapped, ProvenanceBadge, RiskScore, SeverityBadge, StatusBadge, CriticalityBadge } from '@/components/common/badges'
import { Callout, EmptyState, KeyValue, Section, Stat } from '@/components/common/layout'
import { EntityLink, IntegrationName, RelTime, Timeline, UserName } from '@/components/common/entities'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Progress } from '@/components/ui/misc'
import { useAction } from '@/hooks/queries'
import * as api from '@/services/api'
import { cn, fmtDate, fmtDateTime, fmtPct } from '@/utils/format'
import { ASSET_TYPE_LABEL, FINDING_STATUS, INCIDENT_STATUS, TICKET_STATUS, EVENT_STATUS } from '@/utils/labels'
import type { RiskFactors } from '@/utils/risk'

export interface FindingCtx {
  f: Finding
  asset?: Asset
  service?: BusinessService
  aiSystem?: AISystem
  vendor?: Vendor
  score: number
  factors: RiskFactors
  knowledge: KnowledgeRecord[]
  integrations: Integration[]
  tickets: Ticket[]
  incidents: Incident[]
  events: SecurityEvent[]
  attackPaths: AttackPath[]
  related: Finding[]
  assets: Asset[]
  findings: Finding[]
  onCreateTicket: () => void
  onRiskAcceptance: () => void
}

const kb = (ctx: FindingCtx, externalId: string) => ctx.knowledge.find((k) => k.externalId === externalId)

const CVSS_LABELS: Record<string, [string, Record<string, string>]> = {
  AV: ['Attack vector', { N: 'Network', A: 'Adjacent', L: 'Local', P: 'Physical' }],
  AC: ['Attack complexity', { L: 'Low', H: 'High' }],
  PR: ['Privileges required', { N: 'None', L: 'Low', H: 'High' }],
  UI: ['User interaction', { N: 'None', R: 'Required' }],
  S: ['Scope', { U: 'Unchanged', C: 'Changed' }],
  C: ['Confidentiality', { N: 'None', L: 'Low', H: 'High' }],
  I: ['Integrity', { N: 'None', L: 'Low', H: 'High' }],
  A: ['Availability', { N: 'None', L: 'Low', H: 'High' }],
}

function parseCvss(vector: string) {
  return vector.split('/').slice(1).map((p) => {
    const [k, v] = p.split(':')
    const def = CVSS_LABELS[k]
    return def ? { metric: def[0], value: def[1][v] ?? v, raw: `${k}:${v}`, bad: ['N', 'H', 'C'].includes(v) && !['UI'].includes(k) ? (k === 'AC' ? false : ['AV', 'PR'].includes(k) ? v === 'N' : v === 'H' || v === 'C') : k === 'UI' && v === 'N' } : null
  }).filter(Boolean) as { metric: string; value: string; raw: string; bad: boolean }[]
}

// ================================================================ 1. Overview

const STAGES = [
  { key: 'new', label: 'Discovered' },
  { key: 'triaged', label: 'Triaged' },
  { key: 'validated', label: 'Validated' },
  { key: 'in_remediation', label: 'Remediation' },
  { key: 'pending_verification', label: 'Verification' },
  { key: 'resolved', label: 'Resolved' },
]
const STAGE_INDEX: Record<string, number> = { new: 0, triaged: 1, in_validation: 1, validated: 2, in_remediation: 3, pending_verification: 4, resolved: 5 }

export function LifecycleStepper({ f }: { f: Finding }) {
  const closedOther = f.status === 'false_positive' || f.status === 'risk_accepted'
  const idx = STAGE_INDEX[f.status] ?? 1
  return (
    <div className="card px-4 py-3">
      <div className="flex items-center gap-1 overflow-x-auto">
        {STAGES.map((s, i) => {
          const done = !closedOther && i < idx
          const current = !closedOther && i === idx
          return (
            <React.Fragment key={s.key}>
              {i > 0 && <div className={cn('h-px min-w-6 flex-1', done || current ? 'bg-violet-500/60' : 'bg-border')} />}
              <div className="flex shrink-0 items-center gap-1.5">
                <span className={cn('flex size-5 items-center justify-center rounded-full border text-[10px]', done ? 'border-violet-500 bg-violet-600 text-white' : current ? 'border-violet-400 bg-violet-500/20 text-violet-200' : 'border-border-strong text-subtle')}>{done ? <Check className="size-3" /> : i + 1}</span>
                <span className={cn('text-xs', current ? 'font-semibold text-fg' : done ? 'text-muted' : 'text-subtle')}>{s.label}{current && f.status === 'in_validation' ? ' · validating' : ''}</span>
              </div>
            </React.Fragment>
          )
        })}
        {closedOther && (
          <span className="ml-3 shrink-0">
            <FindingStatusBadge status={f.status} />
          </span>
        )}
      </div>
    </div>
  )
}

export function OverviewTab({ ctx }: { ctx: FindingCtx }) {
  const { f, asset, service, aiSystem, factors } = ctx
  const affected = ctx.related.filter((r) => r.templateKey === f.templateKey)
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        <Section title="Executive summary" actions={<ProvenanceBadge value="inferred" />}>
          <p className="text-[13px] leading-relaxed text-fg">{f.executiveSummary}</p>
        </Section>
        <Section title="Technical description" actions={<ProvenanceBadge value="external" />}>
          <p className="text-[13px] leading-relaxed text-muted">{f.description}</p>
        </Section>
        <Section title="Business impact" actions={service && <Link to={`/services/${service.id}`} className="text-xs text-violet-300">{service.name} →</Link>}>
          <p className="text-[13px] leading-relaxed text-muted">{f.businessImpact}</p>
          {service && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Service criticality" value={<CriticalityBadge value={service.criticality} />} />
              <Stat label="Data classification" value={service.dataClassification} />
              <Stat label="RTO" value={`${service.rtoHours}h`} />
              <Stat label="Regulatory scope" value={<span className="text-xs">{service.regulatoryScope[0]}</span>} />
            </div>
          )}
        </Section>
        <Section title="Recommended actions" actions={<Button size="xs" onClick={ctx.onCreateTicket} disabled={['resolved', 'false_positive', 'risk_accepted'].includes(f.status)}>Create remediation ticket</Button>}>
          <ol className="space-y-1.5">
            {f.remediation.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-[13px]">
                <span className="num flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] text-muted">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </Section>
      </div>
      <div className="space-y-5">
        <Section title="Exploitability assessment" description="Inputs to the dynamic risk score" actions={<RiskScore score={ctx.score} />}>
          <div className="space-y-2.5 text-xs">
            {[
              ['CVSS base', f.cvss ? `${f.cvss.score} (v${f.cvss.version})` : 'Not applicable', factors.cvss],
              ['EPSS (illustrative)', f.epss ? fmtPct(f.epss.score, 1) : 'Not applicable', factors.epss],
              ['Known exploitation (KEV)', f.kev ? 'Listed' : 'Not listed', factors.kev],
              ['Exploit maturity', f.exploitMaturity, factors.exploit],
              ['Exposure', factors.internet ? 'Internet-facing' : 'Internal', factors.internet],
              ['Asset criticality', asset ? asset.criticality.toUpperCase() : '—', factors.assetCriticality],
              ['Compensating controls', factors.compensating ? 'Present' : 'None observed', factors.compensating],
            ].map(([label, value, w]) => (
              <div key={label as string}>
                <div className="mb-1 flex justify-between">
                  <span className="text-muted">{label}</span>
                  <span className="capitalize">{value as string}</span>
                </div>
                <Progress value={(w as number) * 100} tone={label === 'Compensating controls' ? 'emerald' : (w as number) > 0.7 ? 'red' : (w as number) > 0.4 ? 'amber' : 'sky'} />
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted">Validation</span>
              <Badge tone={f.validation.status === 'exploitable' ? 'red' : f.validation.status === 'not_exploitable' ? 'emerald' : 'slate'}>{f.validation.status.replace('_', ' ')}</Badge>
            </div>
            {f.validation.summary && <p className="mt-1 text-muted">{f.validation.summary}</p>}
          </div>
        </Section>
        <Section title="Affected systems">
          {asset ? (
            <div className="rounded-lg bg-surface-2 p-3">
              <EntityLink type="asset" id={asset.id} />
              <div className="mt-1 text-xs text-muted">
                {ASSET_TYPE_LABEL[asset.type]} · {asset.environment} · {asset.ipAddress ?? asset.fqdn}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <CriticalityBadge value={asset.criticality} />
                {asset.internetExposed && <Badge tone="orange">Internet-facing</Badge>}
                {asset.cloud && <Badge>{asset.cloud}</Badge>}
              </div>
            </div>
          ) : aiSystem ? (
            <div className="rounded-lg bg-surface-2 p-3">
              <EntityLink type="aiSystem" id={aiSystem.id} />
              <div className="mt-1 text-xs text-muted">
                {aiSystem.type} · {aiSystem.provider}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted">No asset attribution.</p>
          )}
          {affected.length > 0 && (
            <div className="mt-3">
              <div className="label-xs mb-1.5">Same weakness on other assets</div>
              <ul className="space-y-1">
                {affected.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                    <EntityLink type="asset" id={r.assetId ?? r.aiSystemId} />
                    <FindingStatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

// ================================================================ 2. Classification

function MappingRow({ label, items, emptyReason, help }: { label: string; items: React.ReactNode[]; emptyReason: string; help: string }) {
  return (
    <div className="grid gap-2 border-b border-border/60 py-3 last:border-0 sm:grid-cols-[180px_1fr]">
      <div className="flex items-center gap-1 text-xs font-medium text-muted">
        {label} <InfoHint text={help} />
      </div>
      <div className="space-y-2">{items.length ? items : <NotMapped reason={emptyReason} />}</div>
    </div>
  )
}

function KbItem({ rec, fallbackId }: { rec?: KnowledgeRecord; fallbackId: string }) {
  if (!rec) return <span className="font-mono text-xs">{fallbackId}</span>
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link to={`/intelligence/library/${rec.id}`} className="font-mono text-xs text-violet-300 hover:text-violet-200">
          {rec.externalId}
        </Link>
        <span className="text-[13px] font-medium">{rec.name}</span>
        {rec.tactic && <Badge tone="sky">{rec.tactic}</Badge>}
        <ProvenanceBadge value="external" />
      </div>
      <p className="mt-1 text-xs text-muted">{rec.summary}</p>
      {rec.url && (
        <a href={rec.url} target="_blank" rel="noreferrer noopener" className="mt-1 inline-flex items-center gap-1 text-[11px] text-subtle hover:text-violet-300">
          {rec.source} <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  )
}

export function ClassificationTab({ ctx }: { ctx: FindingCtx }) {
  const { f } = ctx
  const cve = f.cveId ? kb(ctx, f.cveId) : undefined
  const classHistory = f.history.filter((h) => ['classified', 'reclassified', 'enriched'].includes(h.type))
  const threatEvents = ctx.events.filter((e) => e.type === 'Threat intel match')
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        <Section title="Cybersecurity library mappings" description="CVE, CWE and ATT&CK are different knowledge systems: a CVE identifies a specific vulnerability instance, CWE classifies the weakness type, ATT&CK describes adversary techniques. DO SAFE shows “Not mapped” rather than inventing mappings.">
          <MappingRow label="CVE reference" help="Common Vulnerabilities and Exposures — a specific publicly disclosed vulnerability." emptyReason="No CVE applies: this is a configuration, identity or design weakness rather than a published product vulnerability." items={f.cveId ? [<KbItem key="cve" rec={cve} fallbackId={f.cveId} />] : []} />
          <MappingRow label="Weakness (CWE)" help="Common Weakness Enumeration — the class of software or configuration weakness." emptyReason="No CWE entry accurately describes this control gap; classified via OWASP / internal category only." items={f.cweIds.map((c) => <KbItem key={c} rec={kb(ctx, c)} fallbackId={c} />)} />
          <MappingRow label="MITRE ATT&CK" help="Adversary tactics and techniques that could exploit or result from this exposure." emptyReason="No ATT&CK Enterprise technique is specific to this exposure's exploitation path." items={f.attackIds.map((c) => <KbItem key={c} rec={kb(ctx, c)} fallbackId={c} />)} />
          <MappingRow label="OWASP" help="OWASP Top 10 (2021) or OWASP Top 10 for LLM Applications (2025)." emptyReason="No OWASP category applies." items={f.owaspIds.map((c) => <KbItem key={c} rec={kb(ctx, c)} fallbackId={c} />)} />
        </Section>
        <Section title="Mapping rationale" actions={<ProvenanceBadge value="inferred" />}>
          <p className="text-[13px] leading-relaxed text-muted">{f.mappingRationale}</p>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted">Classification confidence</span>
              <span className="num font-semibold">{fmtPct(f.classificationConfidence)}</span>
            </div>
            <Progress value={f.classificationConfidence * 100} tone={f.classificationConfidence > 0.85 ? 'emerald' : 'amber'} />
            <p className="mt-1 text-[11px] text-subtle">Confidence reflects evidence quality (authenticated version data vs. banners), corroborating sources and missing runtime context.</p>
          </div>
        </Section>
        <Section title="Classification history">
          <Timeline entries={classHistory} />
        </Section>
      </div>
      <div className="space-y-5">
        <Section title="Classification">
          <KeyValue cols={1} items={[{ label: 'Vulnerability category', value: f.category }, { label: 'Domain', value: <span className="capitalize">{f.domain}</span> }, { label: 'Detection method', value: f.detectionMethod }, { label: 'Severity', value: <SeverityBadge severity={f.severity} /> }]} />
        </Section>
        <Section title="CVSS" actions={f.cvss && <span className="num text-lg font-semibold">{f.cvss.score}</span>}>
          {f.cvss ? (
            <>
              <code className="block break-all rounded-md bg-surface-2 px-2 py-1.5 font-mono text-[11px] text-muted">{f.cvss.vector}</code>
              <div className="mt-3 space-y-1.5">
                {parseCvss(f.cvss.vector).map((m) => (
                  <div key={m.raw} className="flex justify-between text-xs">
                    <span className="text-muted">{m.metric}</span>
                    <span className={m.bad ? 'text-orange-300' : ''}>{m.value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-subtle">Source: {cve?.cvss?.source ?? 'NVD'}</p>
            </>
          ) : (
            <NotMapped reason="CVSS is defined for CVE-identified vulnerabilities. Severity for this finding is assigned by DO SAFE's contextual model." />
          )}
        </Section>
        <Section title="EPSS" description="Exploit Prediction Scoring System (FIRST)">
          {f.epss ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Probability (30 days)" value={fmtPct(f.epss.score, 1)} />
                <Stat label="Percentile" value={fmtPct(f.epss.percentile, 1)} />
              </div>
              <p className="mt-2 text-[11px] text-amber-300/80">{cve?.epss?.note}</p>
            </>
          ) : (
            <NotMapped reason="EPSS scores exist only for CVEs." />
          )}
        </Section>
        <Section title="Known exploitation indicators">
          <ul className="space-y-2 text-xs">
            <li className="flex items-center justify-between">
              <span className="text-muted">CISA KEV</span> {f.kev ? <KevBadge /> : <span>Not listed</span>}
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted">Exploit maturity</span> <span className="capitalize">{f.exploitMaturity}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted">Public exploit available</span> <span>{f.exploitAvailable ? 'Yes' : 'No'}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted">Threat intel matches</span> <span>{threatEvents.length}</span>
            </li>
          </ul>
          {threatEvents.map((e) => (
            <div key={e.id} className="mt-2 rounded-md bg-red-500/8 px-2.5 py-1.5 text-[11px] text-red-200">
              {e.title}
            </div>
          ))}
        </Section>
      </div>
    </div>
  )
}

// ================================================================ 3. Source & Evidence

export function EvidenceTab({ ctx }: { ctx: FindingCtx }) {
  const { f } = ctx
  const src = ctx.integrations.find((i) => i.id === f.sourceIntegrationId)
  const reliability = { high: f.evidence.filter((e) => e.reliability === 'high').length, medium: f.evidence.filter((e) => e.reliability === 'medium').length, low: f.evidence.filter((e) => e.reliability === 'low').length }
  const refs = [f.cveId, ...f.cweIds, ...f.attackIds].filter(Boolean).map((id) => kb(ctx, id!)).filter(Boolean) as KnowledgeRecord[]
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        <Section title="Data provenance" description="How this finding moved from the source system into DO SAFE">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {[
              { icon: <Radar />, label: 'Source detection', sub: src?.vendor ?? f.sourceIntegrationId },
              { icon: <Database />, label: 'Ingestion', sub: `Record ${f.sourceRecordId}` },
              { icon: <Filter />, label: 'Normalization', sub: 'Common finding schema' },
              { icon: <GitMerge />, label: 'Deduplication', sub: f.additionalSourceIds.length ? `Merged ${f.additionalSourceIds.length + 1} sources` : 'Single source' },
              { icon: <BookOpen />, label: 'Enrichment', sub: 'NVD · KEV · EPSS · MITRE' },
              { icon: <Tags />, label: 'Classification', sub: fmtPct(f.classificationConfidence) + ' confidence' },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <ArrowRight className="size-3.5 text-subtle" />}
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5">
                  <span className="text-violet-300 [&_svg]:size-3.5">{s.icon}</span>
                  <span>
                    <span className="block font-medium">{s.label}</span>
                    <span className="block text-[11px] text-subtle">{s.sub}</span>
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </Section>
        <Section title={`Evidence collected (${f.evidence.length})`} description="Raw evidence as received from sources. Content in this demo is simulated.">
          <div className="space-y-3">
            {f.evidence.map((e) => (
              <div key={e.id} id={e.id} className="rounded-lg border border-border bg-surface-2/50">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-muted">{e.id}</span>
                    <span className="text-[13px] font-medium">{e.label}</span>
                    <Badge>{e.kind}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <ProvenanceBadge value={e.provenance} />
                    <Badge tone={e.reliability === 'high' ? 'emerald' : e.reliability === 'medium' ? 'amber' : 'red'}>reliability: {e.reliability}</Badge>
                  </div>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap px-3 py-2 font-mono text-[11.5px] leading-relaxed text-slate-300">{e.content}</pre>
                <div className="flex flex-wrap gap-x-4 border-t border-border px-3 py-1.5 text-[11px] text-subtle">
                  <span>Collected {fmtDateTime(e.collectedAt)}</span>
                  <span>
                    Source: <IntegrationName id={e.sourceIntegrationId} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
      <div className="space-y-5">
        <Section title="Detection source">
          <KeyValue
            cols={1}
            items={[
              { label: 'Primary source', value: <IntegrationName id={f.sourceIntegrationId} /> },
              { label: 'Scanner / source record', value: <code className="font-mono text-xs">{f.sourceRecordId}</code> },
              { label: 'Corroborating sources', value: f.additionalSourceIds.length ? f.additionalSourceIds.map((s) => <div key={s}><IntegrationName id={s} /></div>) : 'None' },
              { label: 'Detection method', value: f.detectionMethod },
              { label: 'First detected', value: fmtDateTime(f.firstDetected) },
              { label: 'Last observed', value: fmtDateTime(f.lastObserved) },
            ]}
          />
        </Section>
        <Section title="Evidence reliability">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="High" value={reliability.high} />
            <Stat label="Medium" value={reliability.medium} />
            <Stat label="Low" value={reliability.low} />
          </div>
          <p className="mt-2 text-[11px] text-subtle">Authenticated inventory and configuration snapshots are rated high; banners and remote probes medium.</p>
        </Section>
        <Section title="Missing evidence" description="Information that would raise confidence">
          {f.missingEvidence.length ? (
            <ul className="space-y-1.5">
              {f.missingEvidence.map((m) => (
                <li key={m} className="flex gap-2 text-xs text-amber-200">
                  <CircleDashed className="mt-0.5 size-3.5 shrink-0" /> {m}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">No known evidence gaps.</p>
          )}
        </Section>
        <Section title="Supporting references">
          <ul className="space-y-1.5">
            {refs.map((r) => (
              <li key={r.id} className="text-xs">
                <a href={r.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-violet-300 hover:text-violet-200">
                  {r.externalId} — {r.source} <ExternalLink className="size-3" />
                </a>
              </li>
            ))}
            {!refs.length && <li className="text-xs text-muted">No external references — see vendor/configuration evidence.</li>}
          </ul>
        </Section>
      </div>
    </div>
  )
}

// ================================================================ 4. Root cause

export function RootCauseTab({ ctx }: { ctx: FindingCtx }) {
  const { f } = ctx
  const { run, pending } = useAction()
  const [note, setNote] = React.useState('')
  const [hyp, setHyp] = React.useState('')
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        {f.rootCause.confirmed ? (
          <Callout tone="success" icon={<CheckCircle2 />} title="Confirmed root cause">
            {f.rootCause.confirmed}
          </Callout>
        ) : (
          <Callout tone="info" icon={<HelpCircle />} title="Root cause not yet confirmed">
            Hypotheses below are inferred suggestions to guide investigation. Confirm or reject each based on evidence.
          </Callout>
        )}
        <Section title="Root-cause hypotheses" description="Generated by the Investigation Assistant (simulated) from evidence and similar historical findings">
          <div className="space-y-2.5">
            {f.rootCause.hypotheses.map((h) => (
              <div key={h.id} className={cn('rounded-lg border px-3 py-2.5', h.status === 'confirmed' ? 'border-emerald-500/40 bg-emerald-500/5' : h.status === 'rejected' ? 'border-border opacity-60' : 'border-border bg-surface-2/40')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className={cn('text-[13px]', h.status === 'rejected' && 'line-through')}>{h.statement}</p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge tone={h.likelihood === 'likely' ? 'orange' : h.likelihood === 'possible' ? 'amber' : 'slate'}>{h.likelihood}</Badge>
                    <ProvenanceBadge value={h.provenance} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] text-subtle">
                    Supporting evidence:{' '}
                    {h.supportingEvidenceIds.length
                      ? h.supportingEvidenceIds.map((id) => (
                          <a key={id} href={`#${id}`} className="mr-1 font-mono text-violet-300">
                            {id}
                          </a>
                        ))
                      : 'none linked'}
                  </div>
                  <div className="flex gap-1">
                    {h.status !== 'confirmed' && (
                      <Button size="xs" variant="secondary" disabled={pending} onClick={() => run(() => api.setHypothesisStatus(f.id, h.id, 'confirmed'), 'Root cause confirmed')}>
                        <Check /> Confirm
                      </Button>
                    )}
                    {h.status !== 'rejected' && (
                      <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => api.setHypothesisStatus(f.id, h.id, 'rejected'), 'Hypothesis rejected')}>
                        <X /> Reject
                      </Button>
                    )}
                    {h.status !== 'open' && (
                      <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => api.setHypothesisStatus(f.id, h.id, 'open'), 'Hypothesis reopened')}>
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              if (hyp.trim().length < 10) return
              await run(() => api.addHypothesis(f.id, hyp.trim()), 'Hypothesis added')
              setHyp('')
            }}
          >
            <input value={hyp} onChange={(e) => setHyp(e.target.value)} placeholder="Add your own hypothesis (min 10 characters)…" className="h-9 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-sm focus:border-violet-500/60 focus:outline-none" aria-label="New hypothesis" />
            <Button type="submit" variant="secondary" disabled={hyp.trim().length < 10}>
              <Plus /> Add
            </Button>
          </form>
        </Section>
        <Section title="Investigation notes">
          <div className="space-y-2.5">
            {f.rootCause.notes.map((n) => (
              <div key={n.id} className="rounded-lg bg-surface-2 px-3 py-2">
                <div className="flex items-center justify-between text-[11px] text-subtle">
                  <UserName id={n.authorId} />
                  <span>{fmtDateTime(n.at)}</span>
                </div>
                <p className="mt-1 text-[13px]">{n.text}</p>
              </div>
            ))}
            {!f.rootCause.notes.length && <p className="text-xs text-muted">No notes yet.</p>}
          </div>
          <div className="mt-3 space-y-2">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Record what you checked, what you found, and next steps…" rows={3} aria-label="Investigation note" />
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={note.trim().length < 5}
                loading={pending}
                onClick={async () => {
                  await run(() => api.addInvestigationNote(f.id, note.trim()), 'Note added')
                  setNote('')
                }}
              >
                Add note
              </Button>
            </div>
          </div>
        </Section>
      </div>
      <div className="space-y-5">
        <Section title="Related configuration issues">
          {f.rootCause.relatedConfigIssues.length ? (
            <ul className="space-y-1.5">
              {f.rootCause.relatedConfigIssues.map((c) => (
                <li key={c} className="flex gap-2 text-xs">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-300" /> {c}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">None identified.</p>
          )}
        </Section>
        <Section title="Related software weaknesses">
          {f.rootCause.relatedWeaknesses.length ? (
            <ul className="space-y-1.5 text-xs">
              {f.rootCause.relatedWeaknesses.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">None identified.</p>
          )}
        </Section>
        <Section title="Supporting evidence">
          <ul className="space-y-1 text-xs">
            {f.evidence.map((e) => (
              <li key={e.id}>
                <a href={`#${e.id}`} className="text-violet-300">
                  <span className="font-mono">{e.id}</span> {e.label}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  )
}

// ================================================================ 5. Remediation

export function RemediationTab({ ctx }: { ctx: FindingCtx }) {
  const { f } = ctx
  const linked = ctx.tickets.filter((t) => f.ticketIds.includes(t.id))
  const internal = ctx.knowledge.filter((k) => k.type === 'INTERNAL' && k.derivedFromFindingIds?.some((id) => ctx.findings.find((x) => x.id === id)?.templateKey === f.templateKey))
  const closed = ['resolved', 'false_positive', 'risk_accepted'].includes(f.status)
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        <Section title="Recommended remediation" actions={<div className="flex gap-2"><Button size="xs" onClick={ctx.onCreateTicket} disabled={closed}>Create ticket</Button><Button size="xs" variant="secondary" onClick={ctx.onRiskAcceptance} disabled={closed || f.riskAcceptance?.status === 'pending'}>Request risk acceptance</Button></div>}>
          <p className="text-[13px]">{f.remediation.recommended}</p>
          <ol className="mt-3 space-y-1.5">
            {f.remediation.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] text-muted">
                <span className="num flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px]">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </Section>
        <div className="grid gap-5 md:grid-cols-2">
          <Section title="Available vendor fix">
            {f.remediation.vendorFix ? <p className="text-[13px]">{f.remediation.vendorFix}</p> : <p className="text-xs text-muted">No vendor patch applies — remediate via configuration or process change. When no fix exists, use compensating controls and the source/history context to investigate.</p>}
          </Section>
          <Section title="Compensating controls">
            {f.remediation.compensatingControls.length ? (
              <ul className="space-y-1.5 text-[13px]">
                {f.remediation.compensatingControls.map((c) => (
                  <li key={c} className="flex gap-2">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-300" /> {c}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">None recommended.</p>
            )}
          </Section>
        </div>
        <Section title={`Related tickets (${linked.length})`}>
          {linked.length ? (
            <div className="space-y-2">
              {linked.map((t) => (
                <Link key={t.id} to={`/operations/tickets/${t.id}`} className="block rounded-lg bg-surface-2 px-3 py-2.5 hover:bg-surface-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px]">
                      <span className="font-mono text-[11px] text-muted">{t.id}</span> {t.title}
                    </span>
                    <StatusBadge map={TICKET_STATUS} value={t.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
                    <UserName id={t.assigneeId} /> <span>Due {fmtDate(t.dueDate)}</span> {t.externalRef && <span>{t.externalRef}</span>}
                    <Progress value={t.progress} className="max-w-32" tone={t.status === 'done' ? 'emerald' : 'violet'} />
                    <span>{t.progress}%</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No remediation tickets" description="Create a ticket to assign and track remediation." action={!closed && <Button size="sm" onClick={ctx.onCreateTicket}>Create ticket</Button>} />
          )}
        </Section>
        <Section title="How similar vulnerabilities were resolved" description="Internal learning from previously resolved findings" actions={<ProvenanceBadge value="human-reviewed" />}>
          {internal.length || f.remediation.similarResolutions.length ? (
            <ul className="space-y-2">
              {internal.map((k) => (
                <li key={k.id} className="rounded-lg bg-surface-2 px-3 py-2 text-xs">
                  <Link to={`/intelligence/library/${k.id}`} className="font-medium text-violet-300">
                    {k.name}
                  </Link>
                  <p className="mt-0.5 text-muted">{k.summary}</p>
                </li>
              ))}
              {f.remediation.similarResolutions.map((s) => (
                <li key={s} className="flex gap-2 text-xs text-muted">
                  <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-300" /> {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">No similar resolutions recorded yet. Resolution of this finding will be added to internal learning.</p>
          )}
        </Section>
      </div>
      <div className="space-y-5">
        <Section title="Remediation status">
          <KeyValue
            cols={1}
            items={[
              { label: 'Status', value: <Badge tone={f.remediation.status === 'verified' ? 'emerald' : f.remediation.status === 'in_progress' ? 'amber' : 'slate'}>{f.remediation.status.replace(/_/g, ' ')}</Badge> },
              { label: 'Assigned owner', value: <UserName id={f.ownerId} /> },
              { label: 'Target date', value: <span className={f.targetDate && new Date(f.targetDate) < new Date() && !closed ? 'text-red-300' : ''}>{fmtDate(f.targetDate)}</span> },
              { label: 'Finding status', value: <FindingStatusBadge status={f.status} /> },
            ]}
          />
        </Section>
        <Section title="Verification requirements" description="Evidence required before the finding can be resolved">
          <ul className="space-y-1.5">
            {f.remediation.verificationRequirements.map((v) => (
              <li key={v} className="flex gap-2 text-xs">
                <FileSearch className="mt-0.5 size-3.5 shrink-0 text-sky-300" /> {v}
              </li>
            ))}
          </ul>
        </Section>
        {f.riskAcceptance && (
          <Section title="Risk acceptance">
            <KeyValue cols={1} items={[{ label: 'Status', value: <Badge tone={f.riskAcceptance.status === 'approved' ? 'amber' : f.riskAcceptance.status === 'pending' ? 'violet' : 'slate'}>{f.riskAcceptance.status}</Badge> }, { label: 'Requested by', value: <UserName id={f.riskAcceptance.requestedById} /> }, { label: 'Justification', value: f.riskAcceptance.justification }, { label: 'Expires', value: fmtDate(f.riskAcceptance.expiresAt) }, ...(f.riskAcceptance.decidedById ? [{ label: 'Decided by', value: <UserName id={f.riskAcceptance.decidedById} /> }] : [])]} />
          </Section>
        )}
      </div>
    </div>
  )
}

// ================================================================ 6. History

const HIST_GROUPS: Record<string, string[]> = {
  All: [],
  Discovery: ['discovered', 'observed', 'enriched'],
  Classification: ['classified', 'reclassified'],
  'Analyst decisions': ['status_change', 'assigned', 'false_positive_review', 'reopened', 'risk_acceptance', 'comment'],
  Remediation: ['ticket_created', 'remediation_update', 'incident_created'],
  Verification: ['verification', 'validated'],
  AI: ['ai_analysis'],
}

export function HistoryTab({ ctx }: { ctx: FindingCtx }) {
  const { f } = ctx
  const [group, setGroup] = React.useState('All')
  const entries = group === 'All' ? f.history : f.history.filter((h) => HIST_GROUPS[group].includes(h.type))
  const previous = ctx.findings.filter((x) => x.id !== f.id && x.templateKey === f.templateKey && ['resolved', 'false_positive', 'risk_accepted'].includes(x.status))
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Section className="xl:col-span-2" title="Finding timeline" description="Every discovery, classification change, analyst decision, remediation update and verification event">
        <div className="mb-4 flex flex-wrap gap-1.5">
          {Object.keys(HIST_GROUPS).map((g) => (
            <button key={g} onClick={() => setGroup(g)} className={cn('rounded-full border px-2.5 py-1 text-xs cursor-pointer', group === g ? 'border-violet-500/50 bg-violet-500/15 text-violet-200' : 'border-border text-muted hover:text-fg')}>
              {g}
            </button>
          ))}
        </div>
        <Timeline entries={entries} />
      </Section>
      <div className="space-y-5">
        <Section title="False-positive decision history" description="Versioned explanations — never overwritten">
          {f.fpReviews.length ? (
            <ol className="space-y-3">
              {[...f.fpReviews].reverse().map((r) => (
                <li key={r.id} className="rounded-lg border border-border bg-surface-2/50 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <Badge tone={r.decision === 'reopened' ? 'orange' : 'slate'}>v{r.version} · {r.decision === 'reopened' ? 'Reopened' : 'Confirmed FP'}</Badge>
                    <span className="text-subtle">{fmtDateTime(r.decidedAt)}</span>
                  </div>
                  {r.decision !== 'reopened' && <div className="mt-2 font-medium">{r.reason}</div>}
                  <p className="mt-1 text-muted">{r.analystNotes}</p>
                  {r.decision !== 'reopened' && <p className="mt-1 text-subtle">Evidence: {r.supportingEvidence}</p>}
                  <div className="mt-2 flex items-center justify-between text-subtle">
                    <UserName id={r.reviewerId} />
                    <span>prior status: {FINDING_STATUS[r.previousStatus].label}</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-muted">No false-positive reviews recorded.</p>
          )}
        </Section>
        <Section title="Previous related findings" description="Same weakness, already closed">
          {previous.length ? (
            <ul className="space-y-1.5">
              {previous.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                  <EntityLink type="finding" id={p.id} label={ctx.assets.find((a) => a.id === p.assetId)?.name ?? p.title} />
                  <FindingStatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">None.</p>
          )}
        </Section>
      </div>
    </div>
  )
}

// ================================================================ 7. AI analysis

export function AIAnalysisTab({ ctx }: { ctx: FindingCtx }) {
  const { f } = ctx
  const a = f.aiAnalysis
  const { run, pending } = useAction()
  if (!a)
    return (
      <Section title="AI investigation summary">
        <EmptyState icon={<Sparkles />} title="No AI analysis yet" description="Generate a simulated investigation summary. Output is labelled as simulated and requires human review." action={<Button loading={pending} onClick={() => run(() => api.regenerateAIAnalysis(f.id), 'Simulated AI analysis generated')}><Sparkles /> Generate analysis (simulated)</Button>} />
      </Section>
    )
  return (
    <div className="space-y-5">
      <Callout tone="demo" icon={<Sparkles />} title="Simulated AI output">
        This analysis is produced by the prototype's deterministic demo engine ({a.modelId}), not a live model. It is an inferred assessment and must be reviewed by an analyst before it informs decisions.
      </Callout>
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Section title="AI-generated investigation summary" actions={<div className="flex gap-2"><ProvenanceBadge value="simulated" /><ProvenanceBadge value="inferred" /></div>}>
            <p className="text-[13px] leading-relaxed">{a.summary}</p>
            <div className="label-xs mb-1.5 mt-4">Key observations</div>
            <ul className="space-y-1.5">
              {a.keyObservations.map((o) => (
                <li key={o} className="flex gap-2 text-[13px] text-muted">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-violet-400" /> {o}
                </li>
              ))}
            </ul>
          </Section>
          <div className="grid gap-5 md:grid-cols-2">
            <Section title="Evidence references">
              <ul className="space-y-1 text-xs">
                {a.evidenceRefs.map((id) => {
                  const e = f.evidence.find((x) => x.id === id)
                  return (
                    <li key={id}>
                      <span className="font-mono text-violet-300">{id}</span> <span className="text-muted">{e?.label ?? '(evidence removed)'}</span>
                    </li>
                  )
                })}
              </ul>
            </Section>
            <Section title="Knowledge references">
              <div className="flex flex-wrap gap-1.5">
                {a.knowledgeRefs.map((k) => {
                  const rec = kb(ctx, k)
                  return rec ? (
                    <Link key={k} to={`/intelligence/library/${rec.id}`} className="rounded-md border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[11px] text-sky-200 hover:border-sky-400/50">
                      {k}
                    </Link>
                  ) : (
                    <span key={k} className="font-mono text-[11px]">{k}</span>
                  )
                })}
                {!a.knowledgeRefs.length && <span className="text-xs text-muted">None — no library mapping applies.</span>}
              </div>
            </Section>
          </div>
          <Section title="Missing information" description="What the analysis could not determine">
            {a.missingInformation.length ? (
              <ul className="space-y-1.5">
                {a.missingInformation.map((m) => (
                  <li key={m} className="flex gap-2 text-xs text-amber-200">
                    <CircleDashed className="mt-0.5 size-3.5 shrink-0" /> {m}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">None identified.</p>
            )}
          </Section>
        </div>
        <div className="space-y-5">
          <Section title="Model & assessment">
            <KeyValue cols={1} items={[{ label: 'Model identifier', value: <code className="font-mono text-xs">{a.modelId}</code> }, { label: 'Model version', value: <code className="font-mono text-xs">{a.modelVersion}</code> }, { label: 'Assessment timestamp', value: fmtDateTime(a.assessedAt) }]} />
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted">Confidence</span>
                <span className="num font-semibold">{fmtPct(a.confidence)}</span>
              </div>
              <Progress value={a.confidence * 100} tone={a.confidence > 0.85 ? 'emerald' : a.confidence > 0.7 ? 'amber' : 'red'} />
              <ul className="mt-2 space-y-1">
                {a.confidenceFactors.map((c) => (
                  <li key={c.factor} className="flex justify-between text-[11px]">
                    <span className="text-muted">{c.factor}</span>
                    <span className={c.effect === 'raises' ? 'text-emerald-300' : 'text-amber-300'}>{c.effect}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Button variant="secondary" size="sm" className="mt-4 w-full" loading={pending} onClick={() => run(() => api.regenerateAIAnalysis(f.id), 'New analysis version generated (simulated)')}>
              <RefreshCw /> Regenerate (simulated)
            </Button>
          </Section>
          <Section title="Human review status">
            <div className="mb-3 flex items-center justify-between text-xs">
              <Badge tone={a.reviewStatus === 'accepted' ? 'emerald' : a.reviewStatus === 'rejected' ? 'red' : a.reviewStatus === 'needs_more_info' ? 'amber' : 'violet'}>{a.reviewStatus.replace(/_/g, ' ')}</Badge>
              {a.reviewedById && (
                <span className="text-subtle">
                  <UserName id={a.reviewedById} avatar={false} /> · <RelTime iso={a.reviewedAt} />
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Button size="xs" variant="secondary" disabled={pending} onClick={() => run(() => api.reviewAIAnalysis(f.id, 'accepted'), 'Analysis accepted')}>
                <ThumbsUp /> Accept
              </Button>
              <Button size="xs" variant="secondary" disabled={pending} onClick={() => run(() => api.reviewAIAnalysis(f.id, 'needs_more_info'), 'Marked as needing more info')}>
                <HelpCircle /> More info
              </Button>
              <Button size="xs" variant="secondary" disabled={pending} onClick={() => run(() => api.reviewAIAnalysis(f.id, 'rejected'), 'Analysis rejected')}>
                <ThumbsDown /> Reject
              </Button>
            </div>
          </Section>
          <Section title="Previous model versions" description="Model behavior is tracked across versions">
            {a.previousVersions.length ? (
              <ul className="space-y-2">
                {a.previousVersions.map((p, i) => (
                  <li key={i} className="rounded-lg bg-surface-2 px-3 py-2 text-xs">
                    <div className="flex justify-between">
                      <code className="font-mono">{p.modelVersion}</code>
                      <span className="text-subtle">{fmtDate(p.assessedAt)} · {fmtPct(p.confidence)}</span>
                    </div>
                    <p className="mt-1 text-muted">{p.summary}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">This is the first analysis version.</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}

// ================================================================ 8. Related records

export function RelatedTab({ ctx }: { ctx: FindingCtx }) {
  const { f } = ctx
  const relAssets = [...new Set([f.assetId, ...ctx.related.map((r) => r.assetId)].filter(Boolean) as string[])]
  const incidents = ctx.incidents.filter((i) => f.incidentIds.includes(i.id))
  const tickets = ctx.tickets.filter((t) => f.ticketIds.includes(t.id))
  const paths = ctx.attackPaths.filter((p) => f.attackPathIds.includes(p.id))
  const Block = ({ title, children, empty }: { title: string; children: React.ReactNode; empty: boolean }) => (
    <Section title={title}>{empty ? <p className="text-xs text-muted">None.</p> : <ul className="space-y-2">{children}</ul>}</Section>
  )
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <Block title={`Related assets (${relAssets.length})`} empty={!relAssets.length}>
        {relAssets.map((id) => (
          <li key={id} className="text-xs">
            <EntityLink type="asset" id={id} />
          </li>
        ))}
      </Block>
      <Block title={`Related vulnerabilities (${ctx.related.length})`} empty={!ctx.related.length}>
        {ctx.related.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
            <EntityLink type="finding" id={r.id} />
            <SeverityBadge severity={r.severity} />
          </li>
        ))}
      </Block>
      <Block title={`Related incidents (${incidents.length})`} empty={!incidents.length}>
        {incidents.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-2 text-xs">
            <EntityLink type="incident" id={i.id} />
            <StatusBadge map={INCIDENT_STATUS} value={i.status} />
          </li>
        ))}
      </Block>
      <Block title={`Related tickets (${tickets.length})`} empty={!tickets.length}>
        {tickets.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 text-xs">
            <EntityLink type="ticket" id={t.id} />
            <StatusBadge map={TICKET_STATUS} value={t.status} />
          </li>
        ))}
      </Block>
      <Block title="Related business services" empty={!ctx.service}>
        {ctx.service && (
          <li className="text-xs">
            <EntityLink type="service" id={ctx.service.id} />
          </li>
        )}
      </Block>
      <Block title={`Attack paths (${paths.length})`} empty={!paths.length}>
        {paths.map((p) => (
          <li key={p.id} className="text-xs">
            <Link to={`/exposures/attack-paths/${p.id}`} className="text-violet-300">
              <span className="font-mono text-muted">{p.id}</span> {p.name}
            </Link>
          </li>
        ))}
      </Block>
      <Block title={`Security events (${ctx.events.length})`} empty={!ctx.events.length}>
        {ctx.events.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-2 text-xs">
            <Link to={`/operations/events?q=${e.id}`} className="truncate text-violet-300">
              <span className="font-mono text-muted">{e.id}</span> {e.title}
            </Link>
            <StatusBadge map={EVENT_STATUS} value={e.status} />
          </li>
        ))}
      </Block>
      {(ctx.aiSystem || ctx.vendor) && (
        <Block title="AI system / vendor" empty={false}>
          {ctx.aiSystem && (
            <li className="text-xs">
              <EntityLink type="aiSystem" id={ctx.aiSystem.id} />
            </li>
          )}
          {ctx.vendor && (
            <li className="text-xs">
              <EntityLink type="vendor" id={ctx.vendor.id} />
            </li>
          )}
        </Block>
      )}
    </div>
  )
}
