import * as React from 'react'
import { useLocation, useParams } from 'react-router'
import { BookOpen, Brain, ChevronDown, Clock, FileSearch, GitBranch, History, LayoutGrid, Link2, MoreHorizontal, RotateCcw, ShieldCheck, ShieldOff, Siren, Ticket, UserPlus, Wrench, Download, Scale, CheckCircle2 } from 'lucide-react'
import { useCollections, useAction, useSettings } from '@/hooks/queries'
import { usePage } from '@/hooks/usePage'
import { assetLabel, findingPlain, SEVERITY_PLAIN } from '@/utils/plain'
import { ErrorState, LoadingState, NotFound, PageHeader } from '@/components/common/layout'
import { Badge, FindingStatusBadge, KevBadge, RiskScore, SeverityBadge } from '@/components/common/badges'
import { EntityLink, RelTime, UserName } from '@/components/common/entities'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from '@/components/ui/misc'
import * as api from '@/services/api'
import { computeRiskScore, riskFactors } from '@/utils/risk'
import { downloadText, fmtDate } from '@/utils/format'
import { FINDING_STATUS } from '@/utils/labels'
import type { FindingStatus } from '@/types'
import { AssignDialog, CreateTicketDialog, EscalateDialog, FalsePositiveDialog, ReopenDialog, RiskAcceptanceDialog } from './dialogs'
import { AIAnalysisTab, ClassificationTab, EvidenceTab, HistoryTab, LifecycleStepper, OverviewTab, RelatedTab, RemediationTab, RootCauseTab, type FindingCtx } from './tabs'

function sectionFor(path: string) {
  if (path.startsWith('/exposures')) return { group: 'Exposure Management', list: 'Vulnerabilities', to: '/exposures/vulnerabilities' }
  if (path.startsWith('/ai-security')) return { group: 'AI Security', list: 'Configuration Risks', to: '/ai-security/config-risks' }
  return { group: 'Security Operations', list: 'Security Findings', to: '/operations/findings' }
}

export function FindingDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const settings = useSettings()
  const sec = sectionFor(location.pathname)
  const { data, isLoading, error, retry } = useCollections(['findings', 'assets', 'services', 'knowledge', 'integrations', 'tickets', 'incidents', 'events', 'attackPaths', 'aiSystems', 'vendors'] as const, { ignoreProjectFilter: true })
  const f = data?.findings.find((x) => x.id === id)
  usePage(f ? f.id : 'Finding', [{ label: sec.group }, { label: sec.list, to: sec.to }, { label: id ?? '' }])
  const [dialog, setDialog] = React.useState<null | 'assign' | 'ticket' | 'fp' | 'reopen' | 'risk' | 'escalate'>(null)
  const [tab, setTab] = React.useState('overview')
  const { run, pending } = useAction()

  React.useEffect(() => {
    if (f) api.recordRecent('finding', f.id, f.title)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f?.id])

  if (error) return <ErrorState error={error} onRetry={retry} />
  if (isLoading || !data) return <LoadingState kpis={4} rows={10} />
  if (!f) return <NotFound what="Finding" back={{ to: sec.to, label: `Back to ${sec.list}` }} />

  const asset = data.assets.find((a) => a.id === f.assetId)
  const service = data.services.find((s) => s.id === f.businessServiceId)
  const aiSystem = data.aiSystems.find((a) => a.id === f.aiSystemId)
  const ctx: FindingCtx = {
    f,
    asset,
    service,
    aiSystem,
    vendor: data.vendors.find((v) => v.id === f.vendorId),
    score: computeRiskScore(f, settings.weights, asset, service),
    factors: riskFactors(f, asset, service),
    knowledge: data.knowledge,
    integrations: data.integrations,
    tickets: data.tickets,
    incidents: data.incidents,
    events: data.events.filter((e) => f.eventIds.includes(e.id) || e.findingId === f.id),
    attackPaths: data.attackPaths,
    related: data.findings.filter((x) => f.relatedFindingIds.includes(x.id)),
    assets: data.assets,
    findings: data.findings,
    onCreateTicket: () => setDialog('ticket'),
    onRiskAcceptance: () => setDialog('risk'),
  }
  const closed = ['resolved', 'false_positive', 'risk_accepted'].includes(f.status)
  const statusTargets: FindingStatus[] = (['triaged', 'in_validation', 'validated', 'in_remediation', 'pending_verification'] as FindingStatus[]).filter((s) => s !== f.status)

  return (
    <div className="space-y-4">
      <PageHeader
        back={{ to: sec.to, label: sec.list }}
        title={f.title}
        badges={
          <>
            <SeverityBadge severity={f.severity} />
            <FindingStatusBadge status={f.status} />
            {f.kev && <KevBadge />}
            {f.tags.includes('imported-demo') && <Badge tone="emerald">Imported (simulated connector)</Badge>}
          </>
        }
        actions={
          <>
            {!closed && (
              <Button variant="secondary" onClick={() => setDialog('assign')}>
                <UserPlus /> Assign
              </Button>
            )}
            {!closed && (
              <Button variant="secondary" onClick={() => setDialog('fp')}>
                <ShieldOff /> Review as False Positive
              </Button>
            )}
            {closed && (
              <Button variant="secondary" onClick={() => setDialog('reopen')}>
                <RotateCcw /> Reopen
              </Button>
            )}
            {!closed && (
              <Button onClick={() => setDialog('ticket')}>
                <Ticket /> Create remediation ticket
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64">
                <DropdownMenuLabel>Investigation</DropdownMenuLabel>
                <DropdownMenuItem disabled={closed || pending} onSelect={() => run(() => api.runValidation(f.id), 'Validation completed (simulated)')}>
                  <ShieldCheck /> Run exploitability validation
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog('escalate')}>
                  <Siren /> Escalate to incident
                </DropdownMenuItem>
                <DropdownMenuItem disabled={closed || f.riskAcceptance?.status === 'pending'} onSelect={() => setDialog('risk')}>
                  <Scale /> Request risk acceptance
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Change status</DropdownMenuLabel>
                {!closed &&
                  statusTargets.map((s) => (
                    <DropdownMenuItem key={s} onSelect={() => run(() => api.changeFindingStatus(f.id, s), `Status changed to ${FINDING_STATUS[s].label}`)}>
                      <ChevronDown className="-rotate-90" /> {FINDING_STATUS[s].label}
                    </DropdownMenuItem>
                  ))}
                {closed && <DropdownMenuItem disabled>Reopen the finding to change status</DropdownMenuItem>}
                <DropdownMenuItem disabled>
                  <CheckCircle2 /> Resolved — requires verification evidence
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => downloadText(`${f.id}.json`, JSON.stringify({ _note: 'DO SAFE demo export — simulated data', ...f }, null, 2), 'application/json')}>
                  <Download /> Export finding (JSON)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <section aria-label="In plain words" className="card grid gap-4 p-4 md:grid-cols-3">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wide text-primary">What’s wrong</div>
          <p className="mt-1 text-[14px] font-medium">{findingPlain(f)}</p>
          <p className="mt-0.5 text-[13px] text-muted">On {asset ? <><span className="font-mono">{asset.name}</span> ({assetLabel(asset.type).toLowerCase()}{asset.internetExposed ? ', visible on the internet' : ''})</> : 'an affected system'}{service ? ` · ${service.name}` : ''}.</p>
        </div>
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wide text-primary">How urgent</div>
          <p className="mt-1 text-[14px] font-medium">{SEVERITY_PLAIN[f.severity].label} — {SEVERITY_PLAIN[f.severity].when.toLowerCase()}</p>
          <p className="mt-0.5 text-[13px] text-muted">{f.kev ? 'Attackers are actively using this weakness right now.' : asset?.internetExposed ? 'Anyone on the internet can reach the affected part.' : 'Only reachable from inside your network, which lowers the risk.'}</p>
        </div>
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wide text-primary">What to do</div>
          <p className="mt-1 text-[14px] font-medium">{f.remediation.steps[0] ?? f.remediation.recommended}</p>
          <p className="mt-0.5 text-[13px] text-muted">{closed ? 'This problem is closed.' : f.ticketIds.length ? 'A task is already assigned to fix it.' : 'Not sure how? Create a task and assign it to the person responsible.'}</p>
        </div>
      </section>

      <div className="card grid grid-cols-2 gap-x-6 gap-y-3 p-4 sm:grid-cols-4 xl:grid-cols-8">
        <HeaderStat label="Finding ID" value={<span className="font-mono">{f.id}</span>} />
        <HeaderStat label="Risk score" value={<RiskScore score={ctx.score} />} />
        <HeaderStat label="Severity" value={<SeverityBadge severity={f.severity} />} />
        <HeaderStat label="Status" value={<FindingStatusBadge status={f.status} />} />
        <HeaderStat label={aiSystem ? 'AI system' : 'Affected asset'} value={aiSystem ? <EntityLink type="aiSystem" id={aiSystem.id} showId={false} /> : <EntityLink type="asset" id={f.assetId} showId={false} />} />
        <HeaderStat label="First detected" value={<RelTime iso={f.firstDetected} className="text-fg" />} />
        <HeaderStat label="Last observed" value={<RelTime iso={f.lastObserved} className="text-fg" />} />
        <HeaderStat
          label="Assigned owner"
          value={
            <span className="flex flex-col">
              <UserName id={f.ownerId} />
              {f.targetDate && !closed && (
                <span className={`mt-0.5 flex items-center gap-1 text-[11px] ${new Date(f.targetDate) < new Date() ? 'text-red-700' : 'text-subtle'}`}>
                  <Clock className="size-3" /> due {fmtDate(f.targetDate)}
                </span>
              )}
            </span>
          }
        />
      </div>

      <LifecycleStepper f={f} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview"><LayoutGrid /> Overview</TabsTrigger>
          <TabsTrigger value="classification"><BookOpen /> Classification</TabsTrigger>
          <TabsTrigger value="evidence"><FileSearch /> Source & Evidence <span className="text-subtle">({f.evidence.length})</span></TabsTrigger>
          <TabsTrigger value="rootcause"><GitBranch /> Root Cause</TabsTrigger>
          <TabsTrigger value="remediation"><Wrench /> Remediation {f.ticketIds.length > 0 && <span className="text-subtle">({f.ticketIds.length})</span>}</TabsTrigger>
          <TabsTrigger value="history"><History /> History</TabsTrigger>
          <TabsTrigger value="ai">
            <Brain /> AI Analysis
            {f.aiAnalysis?.reviewStatus === 'pending_review' && (
              <Tooltip content="Pending human review">
                <span className="size-1.5 rounded-full bg-violet-500" />
              </Tooltip>
            )}
          </TabsTrigger>
          <TabsTrigger value="related"><Link2 /> Related Records</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab ctx={ctx} /></TabsContent>
        <TabsContent value="classification"><ClassificationTab ctx={ctx} /></TabsContent>
        <TabsContent value="evidence"><EvidenceTab ctx={ctx} /></TabsContent>
        <TabsContent value="rootcause"><RootCauseTab ctx={ctx} /></TabsContent>
        <TabsContent value="remediation"><RemediationTab ctx={ctx} /></TabsContent>
        <TabsContent value="history"><HistoryTab ctx={ctx} /></TabsContent>
        <TabsContent value="ai"><AIAnalysisTab ctx={ctx} /></TabsContent>
        <TabsContent value="related"><RelatedTab ctx={ctx} /></TabsContent>
      </Tabs>

      <AssignDialog finding={f} open={dialog === 'assign'} onOpenChange={(v) => setDialog(v ? 'assign' : null)} />
      <CreateTicketDialog finding={f} open={dialog === 'ticket'} onOpenChange={(v) => setDialog(v ? 'ticket' : null)} />
      {dialog === 'fp' && <FalsePositiveDialog finding={f} open onOpenChange={(v) => setDialog(v ? 'fp' : null)} />}
      <ReopenDialog finding={f} open={dialog === 'reopen'} onOpenChange={(v) => setDialog(v ? 'reopen' : null)} />
      <RiskAcceptanceDialog finding={f} open={dialog === 'risk'} onOpenChange={(v) => setDialog(v ? 'risk' : null)} />
      <EscalateDialog finding={f} open={dialog === 'escalate'} onOpenChange={(v) => setDialog(v ? 'escalate' : null)} />
    </div>
  )
}

function HeaderStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-subtle">{label}</div>
      <div className="mt-1 truncate text-[13px]">{value}</div>
    </div>
  )
}
