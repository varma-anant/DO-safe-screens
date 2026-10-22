// Core domain model for the DO SAFE Unified prototype.
// All records are simulated demo data (fictional organization: Northstar Financial Services).

export type ISODate = string

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'informational'
export type Criticality = 'tier-1' | 'tier-2' | 'tier-3' | 'tier-4'
export type Environment = 'production' | 'staging' | 'development' | 'corporate'

/** Distinguishes the trust level of a piece of information (see §20 of the brief). */
export type Provenance = 'observed' | 'external' | 'inferred' | 'human-reviewed' | 'simulated'

export type PersonaRole =
  | 'CISO'
  | 'Security Analyst'
  | 'Vulnerability Manager'
  | 'TPRM Manager'
  | 'AI Security Analyst'
  | 'Risk Manager'
  | 'Platform Administrator'
  | 'Engineering Owner'
  | 'Incident Responder'

/** Platform role: decides what a user may do in DO SAFE. `role` (job title) is descriptive only. */
export type OrgRole = 'admin' | 'executive' | 'analyst' | 'project_owner' | 'viewer'
/** The person's job — decides their home, navigation and level of detail (separate from what they may do). */
export type JobRole = 'executive' | 'platform_admin' | 'security_analyst' | 'incident_responder' | 'project_owner' | 'vendor_risk' | 'ai_governance' | 'risk_manager' | 'employee'
export type ProjectRole = 'owner' | 'contributor' | 'viewer'

export interface User {
  id: string
  name: string
  role: PersonaRole
  team: string
  email: string
  initials: string
  orgRole: OrgRole
  job: JobRole
  status: 'active' | 'invited' | 'deactivated'
  lastActiveAt?: ISODate
  mfaEnabled: boolean
  /** Shown as a quick sign-in option on the login page. */
  demoLogin?: boolean
}

// ---------------------------------------------------------------- Projects & onboarding

export interface Project {
  id: string
  name: string
  description: string
  ownerId: string
  members: { userId: string; role: ProjectRole; addedAt: ISODate }[]
  createdAt: ISODate
  createdById: string
}

/** Lifecycle of an application being brought under protection. `active` = a SAFE application. */
export type AppStatus = 'draft' | 'assets_declared' | 'mapped' | 'connected' | 'test_passed' | 'test_failed' | 'active' | 'paused'

export interface AssetLink {
  id: string
  sourceAssetId: string
  targetAssetId: string
  relation: 'calls' | 'hosts' | 'stores data in' | 'authenticates via' | 'deploys to' | 'routes to'
}

export interface ScanRun {
  id: string
  kind: 'test' | 'full'
  status: 'running' | 'passed' | 'passed_with_warnings' | 'failed' | 'completed'
  startedAt: ISODate
  finishedAt?: ISODate
  startedById: string
  steps: { name: string; status: 'pending' | 'running' | 'done' | 'warning' | 'failed'; detail: string }[]
  assetResults: { assetId: string; reachable: boolean; credentialsOk: boolean; sourceIds: string[]; note: string }[]
  findingIds: string[]
  summary: string
}

// ---------------------------------------------------------------- Business & assets

export interface BusinessService {
  id: string
  name: string
  description: string
  criticality: Criticality
  ownerId: string
  revenueDependency: string
  dataClassification: 'Restricted' | 'Confidential' | 'Internal' | 'Public'
  regulatoryScope: string[]
  rtoHours: number
  /** Application onboarding & protection — a business service is the customer's application. */
  projectId: string
  appType: 'Web application' | 'API service' | 'Cloud workload' | 'Data platform' | 'SaaS workspace' | 'AI application' | 'Internal platform'
  environment: Environment
  status: AppStatus
  /** Which connected sources assess which assets. */
  coverage: Record<string, string[]>
  assetLinks: AssetLink[]
  runs: ScanRun[]
  onboardingStartedAt?: ISODate
  protectedSince?: ISODate
  nextRunAt?: ISODate
  runSchedule: 'Daily' | 'Every 6 hours' | 'Weekly' | 'Manual'
}

export type AssetType =
  | 'server'
  | 'container'
  | 'kubernetes-cluster'
  | 'database'
  | 'cloud-storage'
  | 'api-gateway'
  | 'web-application'
  | 'identity-provider'
  | 'endpoint'
  | 'network-device'
  | 'saas-application'
  | 'code-repository'
  | 'serverless-function'

export interface Asset {
  id: string
  name: string
  type: AssetType
  environment: Environment
  businessServiceId: string
  ownerId: string
  ipAddress?: string
  fqdn?: string
  os?: string
  cloud?: 'AWS' | 'Azure' | 'GCP' | 'On-prem'
  region?: string
  internetExposed: boolean
  criticality: Criticality
  sourceIntegrationIds: string[]
  tags: string[]
  firstSeen: ISODate
  lastSeen: ISODate
  /** When set, this record was reconciled as a duplicate of another asset. */
  duplicateOfId?: string
  /** Candidate duplicate identified by the reconciliation engine but not yet reviewed. */
  possibleDuplicateOfId?: string
  software: { name: string; version: string }[]
}

// ---------------------------------------------------------------- Knowledge

export type KnowledgeType = 'CVE' | 'CWE' | 'ATTACK' | 'OWASP' | 'OWASP-LLM' | 'KEV' | 'NIST-CSF' | 'INTERNAL'

export interface KnowledgeRecord {
  id: string
  type: KnowledgeType
  externalId: string
  name: string
  summary: string
  url?: string
  /** For CVEs */
  cvss?: { version: '3.1' | '3.0'; score: number; vector: string; source: string }
  epss?: { score: number; percentile: number; note: string }
  kev?: boolean
  cweIds?: string[]
  affectedProducts?: string[]
  published?: string
  /** For ATT&CK */
  tactic?: string
  /** Internal learning records */
  derivedFromFindingIds?: string[]
  lastUpdated: ISODate
  source: string
}

// ---------------------------------------------------------------- Findings

export type FindingDomain = 'vulnerability' | 'misconfiguration' | 'identity' | 'exposure' | 'ai' | 'code'

export type FindingStatus =
  | 'new'
  | 'triaged'
  | 'in_validation'
  | 'validated'
  | 'in_remediation'
  | 'pending_verification'
  | 'resolved'
  | 'false_positive'
  | 'risk_accepted'

export interface EvidenceItem {
  id: string
  label: string
  kind: 'scanner-output' | 'config-snapshot' | 'log-excerpt' | 'network-probe' | 'package-manifest' | 'screenshot' | 'api-response' | 'document' | 'analyst-note' | 'traffic-sample'
  content: string
  collectedAt: ISODate
  sourceIntegrationId?: string
  provenance: Provenance
  reliability: 'high' | 'medium' | 'low'
}

export interface RootCauseHypothesis {
  id: string
  statement: string
  likelihood: 'likely' | 'possible' | 'unlikely'
  supportingEvidenceIds: string[]
  status: 'open' | 'confirmed' | 'rejected'
  provenance: Provenance
}

export interface HistoryEntry {
  id: string
  at: ISODate
  actorId: string
  type:
    | 'discovered'
    | 'observed'
    | 'classified'
    | 'reclassified'
    | 'enriched'
    | 'status_change'
    | 'assigned'
    | 'validated'
    | 'ticket_created'
    | 'incident_created'
    | 'remediation_update'
    | 'verification'
    | 'false_positive_review'
    | 'reopened'
    | 'comment'
    | 'risk_acceptance'
    | 'ai_analysis'
  summary: string
  detail?: string
}

export interface FalsePositiveReview {
  id: string
  reason: FalsePositiveReason
  supportingEvidence: string
  analystNotes: string
  reviewerId: string
  decidedAt: ISODate
  decision: 'confirmed_false_positive' | 'reopened'
  version: number
  previousStatus: FindingStatus
}

export type FalsePositiveReason =
  | 'Version not affected'
  | 'Component not present'
  | 'Compensating control prevents exploitation'
  | 'Scanner signature error'
  | 'Asset decommissioned / misattributed'
  | 'Duplicate of another finding'
  | 'Intended configuration (approved exception)'

export interface ValidationResult {
  status: 'not_started' | 'in_progress' | 'exploitable' | 'not_exploitable' | 'inconclusive'
  method?: 'Reachability analysis' | 'Safe exploit simulation' | 'Control effectiveness check' | 'Configuration verification' | 'Manual review'
  reachable?: boolean
  controlsObserved?: string[]
  summary?: string
  validatedAt?: ISODate
  validatedById?: string
  provenance: Provenance
}

export interface AIAnalysis {
  summary: string
  keyObservations: string[]
  evidenceRefs: string[]
  knowledgeRefs: string[]
  modelId: string
  modelVersion: string
  assessedAt: ISODate
  confidence: number
  confidenceFactors: { factor: string; effect: 'raises' | 'lowers' }[]
  missingInformation: string[]
  reviewStatus: 'pending_review' | 'accepted' | 'rejected' | 'needs_more_info'
  reviewedById?: string
  reviewedAt?: ISODate
  previousVersions: { modelVersion: string; assessedAt: ISODate; confidence: number; summary: string }[]
}

export interface Finding {
  id: string
  title: string
  domain: FindingDomain
  category: string
  severity: Severity
  status: FindingStatus
  assetId?: string
  aiSystemId?: string
  vendorId?: string
  businessServiceId?: string
  templateKey: string
  description: string
  executiveSummary: string
  businessImpact: string
  cveId?: string
  cweIds: string[]
  attackIds: string[]
  owaspIds: string[]
  cvss?: { version: string; score: number; vector: string }
  epss?: { score: number; percentile: number }
  kev: boolean
  exploitAvailable: boolean
  exploitMaturity: 'none' | 'poc' | 'functional' | 'weaponized'
  classificationConfidence: number
  mappingRationale: string
  firstDetected: ISODate
  lastObserved: ISODate
  resolvedAt?: ISODate
  ownerId?: string
  targetDate?: ISODate
  sourceIntegrationId: string
  sourceRecordId: string
  additionalSourceIds: string[]
  detectionMethod: string
  evidence: EvidenceItem[]
  missingEvidence: string[]
  rootCause: {
    hypotheses: RootCauseHypothesis[]
    confirmed?: string
    relatedConfigIssues: string[]
    relatedWeaknesses: string[]
    notes: { id: string; authorId: string; at: ISODate; text: string }[]
  }
  remediation: {
    recommended: string
    steps: string[]
    vendorFix?: string
    compensatingControls: string[]
    status: 'not_started' | 'planned' | 'in_progress' | 'awaiting_verification' | 'verified' | 'not_applicable'
    verificationRequirements: string[]
    similarResolutions: string[]
  }
  validation: ValidationResult
  aiAnalysis?: AIAnalysis
  history: HistoryEntry[]
  fpReviews: FalsePositiveReview[]
  ticketIds: string[]
  incidentIds: string[]
  eventIds: string[]
  relatedFindingIds: string[]
  duplicateOfId?: string
  riskAcceptance?: { requestedById: string; requestedAt: ISODate; justification: string; expiresAt: ISODate; status: 'pending' | 'approved' | 'rejected'; decidedById?: string; decidedAt?: ISODate }
  compensatingControlsInPlace: number
  attackPathIds: string[]
  /** Free-text tags, e.g. 'imported-demo' for findings created by a simulated connector run. */
  tags: string[]
}

// ---------------------------------------------------------------- Attack paths

export interface AttackPath {
  id: string
  name: string
  entryAssetId: string
  targetAssetId: string
  steps: { assetId: string; findingId?: string; techniqueId?: string; description: string }[]
  likelihood: 'high' | 'medium' | 'low'
  impact: Severity
  status: 'active' | 'mitigated' | 'accepted'
  businessServiceId: string
  discoveredAt: ISODate
}

// ---------------------------------------------------------------- Security operations

export type EventStatus = 'new' | 'triaged' | 'escalated' | 'dismissed'
export interface SecurityEvent {
  id: string
  title: string
  type: 'Detection' | 'Vulnerability signal' | 'Policy violation' | 'Authentication anomaly' | 'Data movement' | 'Configuration change' | 'Threat intel match'
  severity: Severity
  sourceIntegrationId: string
  occurredAt: ISODate
  assetId?: string
  aiSystemId?: string
  findingId?: string
  incidentId?: string
  status: EventStatus
  rawSummary: string
  assessment?: string
}

export type IncidentStatus = 'open' | 'investigating' | 'contained' | 'eradicated' | 'recovered' | 'closed'
export interface IncidentTask {
  id: string
  title: string
  assigneeId: string
  status: 'todo' | 'in_progress' | 'done'
  dueDate: ISODate
}
export interface Incident {
  id: string
  title: string
  severity: Severity
  status: IncidentStatus
  category: string
  summary: string
  investigatorId?: string
  createdById: string
  createdAt: ISODate
  updatedAt: ISODate
  closedAt?: ISODate
  findingIds: string[]
  eventIds: string[]
  assetIds: string[]
  aiSystemIds: string[]
  businessServiceIds: string[]
  tasks: IncidentTask[]
  notes: { id: string; authorId: string; at: ISODate; text: string }[]
  timeline: HistoryEntry[]
  resolutionSummary?: string
}

export type TicketStatus = 'open' | 'in_progress' | 'blocked' | 'pending_verification' | 'done' | 'cancelled'
export type TicketType = 'vulnerability' | 'configuration' | 'vendor' | 'ai-governance' | 'incident-response' | 'control-improvement'

export interface Ticket {
  id: string
  title: string
  description: string
  type: TicketType
  priority: 'P1' | 'P2' | 'P3' | 'P4'
  status: TicketStatus
  assigneeId?: string
  reporterId: string
  createdAt: ISODate
  updatedAt: ISODate
  dueDate: ISODate
  progress: number
  findingId?: string
  vendorId?: string
  aiSystemId?: string
  incidentId?: string
  assessmentId?: string
  externalRef?: string
  comments: { id: string; authorId: string; at: ISODate; text: string }[]
  vendorResponse?: { status: 'awaiting' | 'acknowledged' | 'disputed' | 'remediated'; message?: string; respondedAt?: ISODate }
  verification?: {
    evidence: string
    method: 'Rescan' | 'Configuration review' | 'Manual test' | 'Vendor attestation' | 'Control test'
    result: 'passed' | 'failed'
    verifiedById: string
    verifiedAt: ISODate
  }
  history: HistoryEntry[]
}

// ---------------------------------------------------------------- Third-party risk

export type VendorLifecycle = 'intake' | 'due_diligence' | 'active' | 'remediation' | 'offboarding' | 'offboarded'
export interface EvidenceDoc {
  id: string
  name: string
  type: 'SOC 2 Type II' | 'ISO 27001 Certificate' | 'Penetration Test Summary' | 'SIG Lite Response' | 'Data Processing Agreement' | 'BCP/DR Plan' | 'Insurance Certificate' | 'Privacy Policy' | 'AI Model Card'
  uploadedAt: ISODate
  expiresAt?: ISODate
  status: 'pending_review' | 'analyzed' | 'accepted' | 'rejected' | 'expired'
  analysis?: { summary: string; exceptions: string[]; coverage: number; analyzedBy: 'Vendor Evidence Analyzer (simulated)' | string; provenance: Provenance }
}
export interface MonitoringAlert {
  id: string
  vendorId: string
  title: string
  type: 'Security rating drop' | 'Data breach report' | 'Certificate expiry' | 'Exposed service' | 'Leaked credentials' | 'Fourth-party incident' | 'Financial / ownership change' | 'Contract obligation'
  severity: Severity
  detectedAt: ISODate
  source: string
  status: 'open' | 'acknowledged' | 'resolved'
  detail: string
}
export interface FourthParty {
  name: string
  service: string
  dataShared: boolean
  riskLevel: Severity
  concentration: number
}
export interface ContractMilestone {
  id: string
  title: string
  dueDate: ISODate
  type: 'Renewal' | 'Security review' | 'SLA' | 'Right to audit' | 'Breach notification' | 'Data deletion' | 'Insurance'
  status: 'upcoming' | 'met' | 'missed' | 'at_risk'
}
export interface Vendor {
  id: string
  name: string
  category: string
  description: string
  website: string
  tier: Criticality
  lifecycle: VendorLifecycle
  relationshipOwnerId: string
  businessServiceIds: string[]
  dataAccess: string[]
  integrationAccess: string[]
  inherentRisk: number
  residualRisk: number
  securityRating: number
  ratingTrend: number[]
  onboardedAt: ISODate
  nextReviewDate: ISODate
  contract: { id: string; value: number; start: ISODate; end: ISODate; securityClauses: string[]; milestones: ContractMilestone[] }
  evidenceDocs: EvidenceDoc[]
  fourthParties: FourthParty[]
  inherentRiskFactors: { factor: string; value: string; weight: number }[]
  offboarding?: { startedAt: ISODate; checklist: { id: string; item: string; done: boolean; doneAt?: ISODate }[]; residualRiskNote?: string }
  isAIProvider?: boolean
  history: HistoryEntry[]
}

export type AssessmentStatus = 'draft' | 'sent' | 'in_progress' | 'submitted' | 'under_review' | 'completed'
export interface QuestionnaireQuestion {
  id: string
  section: string
  text: string
  guidance: string
  weight: number
  expectsEvidence: boolean
}
export interface AssessmentAnswer {
  questionId: string
  answer: 'yes' | 'partial' | 'no' | 'na'
  comment?: string
  evidenceDocId?: string
}
export interface Assessment {
  id: string
  vendorId: string
  name: string
  type: 'Initial due diligence' | 'Annual reassessment' | 'Targeted (incident)' | 'AI provider assessment'
  status: AssessmentStatus
  createdById: string
  createdAt: ISODate
  dueDate: ISODate
  submittedAt?: ISODate
  completedAt?: ISODate
  answers: AssessmentAnswer[]
  result?: {
    score: number
    rating: Severity
    sectionScores: { section: string; score: number }[]
    gaps: { questionId: string; severity: Severity; summary: string }[]
    generatedAt: ISODate
    provenance: Provenance
  }
}

// ---------------------------------------------------------------- AI security

export type AIApproval = 'approved' | 'under_review' | 'unsanctioned' | 'prohibited'
export interface AISystem {
  id: string
  name: string
  type: 'LLM assistant' | 'RAG application' | 'AI agent' | 'Coding assistant' | 'ML model' | 'SaaS AI feature' | 'AI API'
  provider: string
  vendorId?: string
  models: string[]
  approval: AIApproval
  ownerId?: string
  businessServiceId?: string
  deployment: 'SaaS' | 'Self-hosted' | 'Cloud-managed' | 'Browser extension' | 'Embedded in SaaS'
  users: number
  dataClassification: 'Restricted' | 'Confidential' | 'Internal' | 'Public'
  dataSources: string[]
  integrations: string[]
  governanceStatus: 'compliant' | 'review_required' | 'non_compliant' | 'not_assessed'
  riskScore: number
  discoveredVia: string[]
  firstSeen: ISODate
  lastActivity: ISODate
  configChecks: { id: string; check: string; result: 'pass' | 'fail' | 'warn' | 'unknown'; detail: string }[]
  signals: { dimension: 'Live activity' | 'Configuration' | 'External exposure' | 'Compliance evidence' | 'Contract'; status: 'ok' | 'warning' | 'risk' | 'unknown'; detail: string }[]
  contract?: { reference: string; dpaSigned: boolean; trainingOnCustomerData: 'opt-out confirmed' | 'unknown' | 'allowed'; renewal: ISODate }
  history: HistoryEntry[]
}

export interface GovernanceReview {
  id: string
  aiSystemId: string
  findingId?: string
  title: string
  type: 'Shadow AI review' | 'New AI use-case approval' | 'Configuration exception' | 'Policy violation' | 'Periodic review'
  status: 'open' | 'in_review' | 'approved' | 'approved_with_conditions' | 'rejected' | 'closed'
  requestedById: string
  reviewerId?: string
  createdAt: ISODate
  decidedAt?: ISODate
  decision?: string
  conditions: string[]
  policyRefs: string[]
  notes: { id: string; authorId: string; at: ISODate; text: string }[]
}

// ---------------------------------------------------------------- CRQ

export interface Control {
  id: string
  name: string
  category: 'Identify' | 'Protect' | 'Detect' | 'Respond' | 'Recover' | 'Govern'
  description: string
  effectiveness: number
  coverage: number
  annualCost: number
  ownerId: string
  evidence: string
  lastTested: ISODate
  trend: number[]
}

export interface ScenarioParams {
  baseAEP: number
  lossLow: number
  lossMostLikely: number
  lossHigh: number
  controlEffectiveness: Record<string, number>
}

export interface RiskScenario {
  id: string
  name: string
  description: string
  threatActor: string
  threatType: 'Ransomware' | 'Data breach' | 'Business email compromise' | 'Third-party compromise' | 'Service outage (DDoS)' | 'Insider misuse' | 'AI data leakage' | 'Fraud via account takeover'
  businessServiceId: string
  findingIds: string[]
  vendorIds: string[]
  aiSystemIds: string[]
  controls: { controlId: string; relevance: number }[]
  params: ScenarioParams
  lossComponents: { component: string; share: number }[]
  assumptions: string[]
  savedSimulations: { id: string; name: string; savedAt: ISODate; savedById: string; params: ScenarioParams; ale: number; baselineAle: number }[]
}

export interface InvestmentOption {
  id: string
  name: string
  description: string
  controlId: string
  oneTimeCost: number
  annualCost: number
  effectivenessUplift: number
  scenarioIds: string[]
}

// ---------------------------------------------------------------- Agents

export type AgentStatus = 'idle' | 'running' | 'awaiting_approval' | 'error' | 'disabled'
export interface Agent {
  id: string
  name: string
  module: 'CTEM' | 'TPRM' | 'CRQ' | 'AI-SPM' | 'Intelligence' | 'Operations'
  purpose: string
  capabilities: string[]
  inputSources: string[]
  approvalRequirement: string
  requiresApprovalFor: string[]
  status: AgentStatus
  enabled: boolean
  lastRunAt: ISODate
  successRate: number
  warnings: string[]
}

export interface AgentExecutionStep {
  name: string
  status: 'pending' | 'running' | 'done' | 'skipped' | 'failed'
  detail: string
  durationMs?: number
}

export interface AgentExecution {
  id: string
  agentId: string
  trigger: 'Scheduled' | 'Manual (Run Demo)' | 'Event' | 'Workflow'
  startedAt: ISODate
  finishedAt?: ISODate
  status: 'running' | 'completed' | 'awaiting_approval' | 'approved' | 'rejected' | 'failed'
  steps: AgentExecutionStep[]
  outputs: { label: string; recordId?: string; recordType?: SearchEntityType }[]
  warnings: string[]
  approval?: { action: string; status: 'pending' | 'approved' | 'rejected'; decidedById?: string; decidedAt?: ISODate; payload?: { findingIds?: string[] } }
  inputSummary: string
  simulated: true
}

// ---------------------------------------------------------------- Integrations

export type IntegrationCategory =
  | 'Vulnerability scanner'
  | 'Cloud security'
  | 'Endpoint (EDR)'
  | 'Identity'
  | 'Ticketing / ITSM'
  | 'SIEM / Logging'
  | 'SSE / CASB'
  | 'Attack surface'
  | 'Code security'
  | 'Threat intelligence'
  | 'GRC'
  | 'Collaboration'
  | 'Vendor risk intelligence'

export interface Integration {
  id: string
  name: string
  vendor: string
  category: IntegrationCategory
  description: string
  capabilities: string[]
  dataTypes: string[]
  status: 'available' | 'configuring' | 'connected' | 'error' | 'disabled'
  config?: { endpoint: string; authMethod: string; scope: string; syncInterval: string; testedAt?: ISODate; testResult?: 'success' | 'failure' }
  lastSyncAt?: ISODate
  recordsIngested: number
  health: number
  syncHistory: number[]
}

export interface IngestionRun {
  id: string
  integrationId: string
  startedAt: ISODate
  durationSec: number
  status: 'success' | 'partial' | 'failed'
  received: number
  normalized: number
  duplicatesMerged: number
  rejected: number
  createdFindingIds: string[]
  message: string
}

export interface DataQualityIssue {
  id: string
  type: 'Missing owner' | 'Stale record' | 'Inconsistent hostname' | 'Missing business service' | 'Conflicting severity' | 'Unmapped field'
  entityType: 'asset' | 'finding' | 'vendor' | 'aiSystem'
  entityId: string
  integrationId?: string
  description: string
  detectedAt: ISODate
  status: 'open' | 'resolved' | 'ignored'
}

// ---------------------------------------------------------------- Platform

export interface AuditEvent {
  id: string
  at: ISODate
  actorId: string
  action: string
  entityType: SearchEntityType | 'integration' | 'scenario' | 'agent' | 'governance' | 'assessment' | 'settings' | 'event' | 'control'
  entityId: string
  details: string
  module: 'Dashboard' | 'CTEM' | 'TPRM' | 'CRQ' | 'AI-SPM' | 'Intelligence' | 'Operations' | 'Integrations' | 'Platform'
}

export interface Notification {
  id: string
  at: ISODate
  title: string
  body: string
  link?: string
  severity: Severity | 'info'
  read: boolean
}

export type SearchEntityType = 'asset' | 'finding' | 'vendor' | 'aiSystem' | 'incident' | 'ticket' | 'knowledge' | 'service' | 'scenario' | 'project'

export interface PrioritizationWeights {
  cvss: number
  epss: number
  kev: number
  exploit: number
  internet: number
  assetCriticality: number
  serviceCriticality: number
  compensating: number
}

export interface AccessRequest {
  id: string
  requesterId: string
  kind: 'Project access' | 'Role change' | 'Onboarding approval'
  projectId?: string
  requestedRole: string
  justification: string
  durationDays?: number
  risk: 'low' | 'medium' | 'high'
  status: 'pending' | 'approved' | 'declined'
  createdAt: ISODate
  reviewerId?: string
  decidedAt?: ISODate
  decisionNote?: string
}

export interface Invitation {
  id: string
  email: string
  name: string
  orgRole: OrgRole
  job?: JobRole
  projectIds: string[]
  invitedById: string
  sentAt: ISODate
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
}

export interface SupportTicket {
  id: string
  title: string
  category: 'Onboarding & assets' | 'Connectors & scans' | 'Access & permissions' | 'Findings & tickets' | 'Billing & account' | 'Other'
  priority: 'Low' | 'Normal' | 'High' | 'Urgent'
  status: 'submitted' | 'triage' | 'investigating' | 'waiting_on_you' | 'resolved'
  projectId?: string
  createdById: string
  createdAt: ISODate
  updatedAt: ISODate
  description: string
  impact: string
  messages: { id: string; author: string; at: ISODate; text: string }[]
}

export interface DemoSettings {
  weights: PrioritizationWeights
  currentUserId: string
  /** Session — the prototype keeps it in the browser only. */
  authenticated: boolean
  workspace: 'northstar' | 'acme'
  orgName: string
  /** Project the user is working in; null = all projects they can access. */
  currentProjectId: string | null
  identity: { provider: string; mfaRequired: boolean; sessionTimeoutHours: number; stepUpForApprovals: boolean }
  seededAt: ISODate
  latencyMs: number
  slaDays: Record<Severity, number>
  simulateErrors?: boolean
  recentRecords?: { type: SearchEntityType; id: string; label: string; at: ISODate }[]
}

export interface Database {
  version: number
  users: User[]
  projects: Project[]
  accessRequests: AccessRequest[]
  invitations: Invitation[]
  supportTickets: SupportTicket[]
  services: BusinessService[]
  assets: Asset[]
  knowledge: KnowledgeRecord[]
  findings: Finding[]
  attackPaths: AttackPath[]
  events: SecurityEvent[]
  incidents: Incident[]
  tickets: Ticket[]
  vendors: Vendor[]
  assessments: Assessment[]
  monitoringAlerts: MonitoringAlert[]
  aiSystems: AISystem[]
  governanceReviews: GovernanceReview[]
  controls: Control[]
  scenarios: RiskScenario[]
  investments: InvestmentOption[]
  agents: Agent[]
  executions: AgentExecution[]
  integrations: Integration[]
  ingestionRuns: IngestionRun[]
  dataQuality: DataQualityIssue[]
  audit: AuditEvent[]
  notifications: Notification[]
  settings: DemoSettings
}
