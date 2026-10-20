import type { Agent, AgentExecution, AgentExecutionStep } from '@/types'
import type { Clock, Rng } from './rng'
import { pad } from './rng'

// Proposed DO SAFE agent roles (illustrative). They are not representations of any vendor's agents.
export const AGENT_DEFS: Omit<Agent, 'lastRunAt' | 'status' | 'enabled' | 'successRate' | 'warnings'>[] = [
  { id: 'AGT-01', name: 'Exposure Discovery Agent', module: 'CTEM', purpose: 'Continuously pulls findings and assets from connected sources and detects coverage gaps and shadow assets.', capabilities: ['Connector polling', 'Shadow asset discovery', 'Coverage gap detection'], inputSources: ['Tenable', 'Qualys', 'Wiz', 'CrowdStrike', 'Attack surface monitor'], approvalRequirement: 'None — read-only', requiresApprovalFor: [] },
  { id: 'AGT-02', name: 'Asset Correlation Agent', module: 'CTEM', purpose: 'Reconciles duplicate asset records across sources and maps assets to business services and owners.', capabilities: ['Fuzzy hostname/IP matching', 'Business service mapping', 'Owner inference'], inputSources: ['Asset inventory', 'CMDB (simulated)', 'Cloud tags'], approvalRequirement: 'Human approval to merge records', requiresApprovalFor: ['Merge asset records'] },
  { id: 'AGT-03', name: 'Vulnerability Enrichment Agent', module: 'Intelligence', purpose: 'Enriches findings with CVE, CWE, ATT&CK, KEV and EPSS references from the knowledge library.', capabilities: ['CVE lookup', 'CWE mapping', 'ATT&CK technique mapping', 'KEV / EPSS enrichment'], inputSources: ['NVD / EPSS (public)', 'CISA KEV', 'MITRE CWE / ATT&CK', 'Recorded Future'], approvalRequirement: 'None — enrichment only', requiresApprovalFor: [] },
  { id: 'AGT-04', name: 'Classification Assistant', module: 'Intelligence', purpose: 'Proposes category, weakness class and confidence for new findings with a written mapping rationale.', capabilities: ['Category proposal', 'Confidence scoring', 'Rationale generation'], inputSources: ['Finding evidence', 'Knowledge library', 'Historical classifications'], approvalRequirement: 'Analyst review for confidence < 80%', requiresApprovalFor: ['Low-confidence reclassification'] },
  { id: 'AGT-05', name: 'Attack Path Analysis Agent', module: 'CTEM', purpose: 'Correlates exposures, reachability and identities to identify plausible attack paths to crown-jewel assets.', capabilities: ['Reachability graph', 'Toxic combination detection', 'Path scoring'], inputSources: ['Wiz graph', 'Network topology (simulated)', 'Identity data'], approvalRequirement: 'None — analytical', requiresApprovalFor: [] },
  { id: 'AGT-06', name: 'False Positive Review Assistant', module: 'Operations', purpose: 'Identifies findings likely to be false positives and prepares evidence packets for analyst decision.', capabilities: ['Backport detection', 'Compensating control check', 'Evidence packet preparation'], inputSources: ['Package metadata', 'Validation results', 'Past FP decisions'], approvalRequirement: 'Analyst must record every false-positive decision', requiresApprovalFor: ['Mark as false positive'] },
  { id: 'AGT-07', name: 'Remediation Orchestrator', module: 'Operations', purpose: 'Drafts remediation tickets with owners, due dates and evidence, and syncs status with ITSM.', capabilities: ['Ticket drafting', 'Owner routing', 'SLA tracking', 'Jira sync (simulated)'], inputSources: ['Prioritized findings', 'Ownership map', 'Jira (simulated)'], approvalRequirement: 'Human approval before creating tickets in bulk', requiresApprovalFor: ['Create remediation tickets'] },
  { id: 'AGT-08', name: 'Vendor Evidence Analyzer', module: 'TPRM', purpose: 'Reads vendor evidence (SOC 2, pen test summaries, questionnaires) and extracts control coverage and exceptions.', capabilities: ['Document parsing', 'Exception extraction', 'Questionnaire cross-check'], inputSources: ['Vendor evidence documents', 'Questionnaire responses'], approvalRequirement: 'TPRM analyst accepts or rejects analysis', requiresApprovalFor: ['Accept evidence analysis'] },
  { id: 'AGT-09', name: 'Vendor Monitoring Agent', module: 'TPRM', purpose: 'Watches outside-in ratings, breach reports, contract milestones and fourth-party signals for vendors.', capabilities: ['Rating change detection', 'Breach intel matching', 'Contract milestone tracking'], inputSources: ['SecurityScorecard', 'Recorded Future', 'Contract repository'], approvalRequirement: 'None — alerting', requiresApprovalFor: [] },
  { id: 'AGT-10', name: 'AI Security Posture Agent', module: 'AI-SPM', purpose: 'Discovers AI usage and evaluates AI configurations, access scopes and contract evidence.', capabilities: ['Shadow AI discovery', 'AI configuration checks', 'AI risk correlation'], inputSources: ['Netskope', 'Okta', 'CrowdStrike', 'GitHub', 'Contract repository'], approvalRequirement: 'Governance approval for blocking actions', requiresApprovalFor: ['Block AI application'] },
  { id: 'AGT-11', name: 'Risk Quantification Agent', module: 'CRQ', purpose: 'Recomputes illustrative scenario loss estimates as exposures and control effectiveness change.', capabilities: ['ALE recalculation', 'Control effectiveness update', 'Remediation impact estimation'], inputSources: ['Findings', 'Control library', 'Scenario assumptions'], approvalRequirement: 'Risk manager approves published figures', requiresApprovalFor: ['Publish risk report'] },
  { id: 'AGT-12', name: 'Threat Intelligence Agent', module: 'Intelligence', purpose: 'Matches emerging threat intelligence to Northstar assets, vendors and AI systems; produces daily digests.', capabilities: ['Intel-to-asset matching', 'Daily digest', 'Threat actor context'], inputSources: ['Recorded Future', 'CISA KEV', 'Vendor advisories'], approvalRequirement: 'None — advisory', requiresApprovalFor: [] },
]

export const AGENT_PLAYBOOKS: Record<string, { steps: string[]; outputs: (n: number) => string[]; approval?: string }> = {
  'AGT-01': { steps: ['Poll connected sources', 'Normalize records', 'Detect new assets', 'Detect coverage gaps', 'Publish summary'], outputs: (n) => [`${n} source records processed`, `${Math.max(1, n % 4)} potential shadow assets flagged for reconciliation`, '0 connectors with stale data > 24h (Splunk excluded — error)'] },
  'AGT-02': { steps: ['Load candidate pairs', 'Score similarity (hostname, IP, cloud ID)', 'Propose merges', 'Await approval'], outputs: (n) => [`${n % 7 + 3} merge candidates scored`, 'Proposals added to Asset Reconciliation queue'], approval: 'Merge proposed duplicate asset records' },
  'AGT-03': { steps: ['Select findings lacking enrichment', 'Query knowledge library', 'Attach CVE/CWE/ATT&CK refs', 'Update KEV/EPSS context'], outputs: (n) => [`${n % 20 + 8} findings enriched`, 'No new KEV additions affecting Northstar in this run'] },
  'AGT-04': { steps: ['Load unclassified findings', 'Propose categories', 'Compute confidence', 'Route low-confidence to analysts'], outputs: (n) => [`${n % 9 + 2} classifications proposed`, `${n % 3} routed for analyst review (confidence < 80%)`] },
  'AGT-05': { steps: ['Build reachability graph', 'Overlay exploitable findings', 'Score paths to tier-1 assets', 'Publish paths'], outputs: () => ['Attack paths recomputed', 'No new critical paths since last run'] },
  'AGT-06': { steps: ['Select candidates', 'Check distro backports', 'Check compensating controls', 'Prepare evidence packets'], outputs: (n) => [`${n % 5 + 1} evidence packets prepared for analyst decision`, 'No findings were marked false positive automatically'] },
  'AGT-07': { steps: ['Select validated findings without tickets', 'Resolve owners', 'Draft tickets', 'Await approval', 'Sync to Jira (simulated)'], outputs: (n) => [`${n % 4 + 2} remediation tickets drafted`], approval: 'Create remediation tickets for validated findings' },
  'AGT-08': { steps: ['Fetch pending evidence', 'Extract controls & exceptions', 'Cross-check questionnaire', 'Summarize'], outputs: (n) => [`${n % 4 + 1} documents analyzed`, 'Exceptions extracted and attached to vendor profiles'] },
  'AGT-09': { steps: ['Fetch rating changes', 'Match breach intel', 'Check contract milestones', 'Raise alerts'], outputs: (n) => [`${n % 3} new monitoring alerts`, 'Contract milestone check complete'] },
  'AGT-10': { steps: ['Pull SSE AI usage', 'Pull IdP OAuth grants', 'Evaluate AI configs', 'Correlate risk signals'], outputs: (n) => [`${n % 3} new unsanctioned AI apps observed`, 'AI configuration checks re-evaluated'] },
  'AGT-11': { steps: ['Load scenarios', 'Apply current exposure factors', 'Apply control effectiveness', 'Recompute ALE'], outputs: () => ['Illustrative ALE recomputed for 9 scenarios'] },
  'AGT-12': { steps: ['Ingest new intel', 'Match to assets/vendors', 'Generate digest'], outputs: (n) => [`${n % 6 + 2} intel items matched`, 'Daily digest generated'] },
}

export function generateAgents(rng: Rng, clock: Clock) {
  const agents: Agent[] = AGENT_DEFS.map((d) => ({
    ...d,
    status: d.id === 'AGT-07' ? 'awaiting_approval' : d.id === 'AGT-09' ? 'running' : d.id === 'AGT-01' ? 'running' : 'idle',
    enabled: true,
    lastRunAt: clock.ago(0, rng.int(0, 8), rng.int(1, 59)),
    successRate: rng.float(0.9, 1, 2),
    warnings: d.id === 'AGT-01' ? ['Splunk connector in error state — events from SIEM not ingested since last successful sync'] : d.id === 'AGT-10' ? ['Contract repository connector not configured; contract signals are manually curated'] : [],
  }))

  const executions: AgentExecution[] = []
  let seq = 1
  for (const a of agents) {
    const pb = AGENT_PLAYBOOKS[a.id]
    const runs = rng.int(3, 5)
    for (let r = 0; r < runs; r++) {
      const started = clock.ago(r * rng.int(1, 3), rng.int(0, 20), rng.int(0, 59))
      const failed = r > 0 && rng.chance(0.06)
      const steps: AgentExecutionStep[] = pb.steps.map((s, i) => ({ name: s, status: failed && i === pb.steps.length - 1 ? 'failed' : 'done', detail: failed && i === pb.steps.length - 1 ? 'Upstream source timed out (simulated)' : 'Completed', durationMs: rng.int(300, 9000) }))
      const n = rng.int(10, 200)
      const awaiting = r === 0 && a.id === 'AGT-07'
      if (awaiting) steps[steps.length - 1] = { name: steps[steps.length - 1].name, status: 'pending', detail: 'Blocked on human approval' }
      if (awaiting) steps[steps.length - 2] = { ...steps[steps.length - 2], status: 'pending', detail: 'Awaiting approval' }
      executions.push({
        id: `EXE-${pad(seq++)}`,
        agentId: a.id,
        trigger: r === 0 && a.id === 'AGT-01' ? 'Scheduled' : rng.pick(['Scheduled', 'Scheduled', 'Event', 'Workflow'] as const),
        startedAt: started,
        finishedAt: awaiting ? undefined : new Date(new Date(started).getTime() + steps.reduce((s, x) => s + (x.durationMs ?? 0), 0)).toISOString(),
        status: awaiting ? 'awaiting_approval' : failed ? 'failed' : pb.approval ? 'approved' : 'completed',
        steps,
        outputs: pb.outputs(n).map((label) => ({ label })),
        warnings: failed ? ['Run failed on final step; will retry on next schedule'] : [],
        approval: pb.approval ? { action: pb.approval, status: awaiting ? 'pending' : 'approved', decidedById: awaiting ? undefined : 'USR-007', decidedAt: awaiting ? undefined : started } : undefined,
        inputSummary: `Inputs: ${a.inputSources.slice(0, 3).join(', ')}`,
        simulated: true,
      })
    }
  }
  return { agents, executions }
}
