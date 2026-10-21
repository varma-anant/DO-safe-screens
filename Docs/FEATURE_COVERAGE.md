# DO SAFE Unified — Feature Coverage Matrix

Source of truth: `references/DO-safe-feature-inventory.md` (Modules 1–8, 57 features).
Prototype: `Frontend/` (React + TypeScript + Vite). All data is simulated.

**Status definitions**

| Status | Meaning |
|---|---|
| NOT STARTED | No UI representation |
| IN PROGRESS | Partially built |
| IMPLEMENTED | Screen and interactions exist, route loads without errors, but the feature's interactions are **not** exercised by an automated test |
| VERIFIED | Required interactions exercised by the automated Playwright suites (`npm run test:e2e`, 82 checks) and the route sweep (`npm run test:routes`, 69 routes) with zero console errors |

**Summary (last run 2026-10-20):** 57 / 57 features represented · **50 VERIFIED** · **7 IMPLEMENTED** · 0 in progress · 0 not started.

Test suites referenced below: **J** = `tests/e2e/journey.mjs` (v2 login, onboarding journey, roles), **W** = `tests/e2e/workflows.mjs` (Workflows A–H, agents, search, persistence), **I** = `tests/e2e/interactions.mjs`, **M** = `tests/e2e/modules.mjs`, **R** = route sweep.

---

## Module 1 — Unified Risk Dashboard

| ID | Feature | Description | UI route | Components | Demo data | Implemented interactions | Status | Known limitations |
|---|---|---|---|---|---|---|---|---|
| M1-01 | Enterprise risk overview | Consolidated posture across exposure, financial, vendor and AI risk | `/dashboard` | `ExecutiveDashboard`, `KpiCard` | Findings, scenarios, vendors, AI systems | KPI tiles drill into filtered lists; KPIs recalculate after mutations (I: KPI 37→36 after FP decision) | VERIFIED | Posture score is an illustrative index |
| M1-02 | Critical exposure summary | Highest-risk open exposures | `/dashboard` | Top prioritized risks list | 258 findings | Click → vulnerability detail (M) | VERIFIED | — |
| M1-03 | Business impact analysis | Risk connected to business services | `/dashboard`, `/services`, `/services/:id` | Business impact list, `ServiceDetail` tabs | 7 business services, 106 assets | Service list → detail with exposures, assets, scenarios, vendors, AI, incidents, attack paths (M, W-F) | VERIFIED | Service mappings are seeded, not CMDB-derived |
| M1-04 | Risk prioritization | Rank by severity, exploitability, business context | `/dashboard`, `/exposures/prioritization` | Dynamic risk score (`utils/risk.ts`) | Weights in settings | Ranking uses org weights; tuning weights re-ranks everywhere (M) | VERIFIED | Illustrative weighted-sum model |
| M1-05 | Risk trends | Posture change over time | `/dashboard`, `/analytics` | Area/line/bar charts, service×severity heatmap | Reconstructed from detection/closure timestamps | Heatmap cell → filtered findings (M); tooltips | VERIFIED | Trend is reconstructed from demo timestamps, not stored snapshots |
| M1-06 | Active workflow monitoring | Track investigations and remediation | `/dashboard` (Active workflows) | `WorkflowRow` | Incidents, approvals, tickets, validations, reviews, agent runs | Each row deep-links (M: approvals) | VERIFIED | — |
| M1-07 | AI intelligence interface | Ask questions about risk | Top bar "Ask DO SAFE", dashboard card, `/intelligence` | `AskBox`, `AssistantPage` | Demo dataset | Question from dashboard opens assistant with answer (M) | VERIFIED | Deterministic demo engine, not an LLM |

## Module 2 — CTEM

| ID | Feature | Description | UI route | Components | Demo data | Implemented interactions | Status | Known limitations |
|---|---|---|---|---|---|---|---|---|
| M2-01 | Asset inventory | Enterprise asset register | `/exposures/assets`, `/exposures/assets/:id` | `AssetsPage`, `AssetDetail`, `DataTable` | 99 assets + 7 duplicate candidates | Filter/sort/export, saved views, edit owner & criticality (M) | VERIFIED | — |
| M2-02 | Exposure discovery | Collect findings from connected sources | `/exposures`, `/integrations/:id` | CTEM loop stages, `FindingsTable` | 17 simulated connectors | Enabling a connector imports new findings (W-H) | VERIFIED | Simulated connectors only |
| M2-03 | Asset reconciliation | Identify duplicates, normalize records | `/exposures/assets` → Reconciliation tab | Match signals, side-by-side comparison | 7 candidate pairs | Merge into canonical (moves findings and provenance) / Not a duplicate (M) | VERIFIED | Match confidence is heuristic |
| M2-04 | Vulnerability management | Track vulnerabilities on assets | `/exposures/vulnerabilities`, `/exposures/vulnerabilities/:id` | `VulnerabilitiesPage`, `FindingDetailPage` (8 tabs) | 22 real CVEs (accurate public metadata) | Full Workflow A (W) | VERIFIED | — |
| M2-05 | Attack path analysis | How exposures chain into paths | `/exposures/attack-paths`, `/exposures/attack-paths/:id` | React Flow path graph | 6 attack paths | Node inspection, investigate step, accept/reactivate path, auto-mitigated when step findings resolve (M) | VERIFIED | Paths predefined, not computed live |
| M2-06 | Dynamic risk prioritization | Multi-parameter ranking | `/exposures/prioritization` | Weight sliders, re-ranked preview with rank deltas | 8 factors | Tune → preview → apply as org default (M) | VERIFIED | Illustrative model |
| M2-07 | Threat intelligence enrichment | External threat context | Finding → Classification tab, `/intelligence/threats` | KEV/EPSS/CVSS panels, threat digest | CISA KEV snapshot, EPSS (illustrative) | Digest via Threat Intelligence Agent run (M) | VERIFIED | EPSS values are illustrative snapshots |
| M2-08 | Exploitability validation | Are exposures genuinely exploitable | `/exposures/validation`, finding actions | Validation queue, results | Validation states on findings | Queue / run simulated validation updates status (M) | VERIFIED | No real exploitation — simulated from exposure data |
| M2-09 | False-positive management | Investigate and record incorrect findings | Finding → "Review as False Positive", History tab | `FalsePositiveDialog`, decision history | 19 seeded FP decisions | Workflow B: rationale, evidence, reviewer, timestamp, versioned history, reopen (W) | VERIFIED | — |
| M2-10 | Remediation orchestration | Assign and track remediation | Finding → Create ticket, `/operations/remediation`, Remediation Orchestrator | `CreateTicketDialog`, bulk ticketing, AGT-07 | 197 tickets | Ticket from finding (W-A); agent drafts → approval → tickets (W) | VERIFIED | Jira sync simulated |
| M2-11 | Risk reduction verification | Confirm remediation reduced exposure | `/operations/verification`, ticket detail | `VerifyDialog` | Verification records | Verification resolves finding, closes ticket, updates dashboard/ALE/attack paths (W-A, I) | VERIFIED | — |

## Module 3 — TPRM

| ID | Feature | Description | UI route | Components | Demo data | Implemented interactions | Status | Known limitations |
|---|---|---|---|---|---|---|---|---|
| M3-01 | Vendor inventory | Central third-party register | `/tprm/vendors` | `VendorInventory` | 24 fictional vendors | Search/filter/saved views/export (W-C) | VERIFIED | — |
| M3-02 | Vendor onboarding | Register vendors, collect information | `/tprm/vendors` → Onboard vendor | 3-step `OnboardingWizard` (RHF + zod), unsaved-changes guard | — | Validation, inherent risk, vendor + draft assessment created (I) | VERIFIED | — |
| M3-03 | Inherent risk assessment | Risk before controls | Wizard step 3, vendor profile | `computeInherentRisk` | Risk factors per vendor | Calculated live during onboarding (I) | VERIFIED | Illustrative formula |
| M3-04 | Due diligence | Collect and evaluate evidence | `/tprm/due-diligence` | `EvidenceList` | 102 evidence docs | Analyze (simulated) → accept/reject; upload (simulated) (M) | VERIFIED | No real file upload |
| M3-05 | Questionnaire management | Issue and review questionnaires | `/tprm/assessments`, `/tprm/assessments/:id` | `AssessmentDetail` (20 questions, 8 sections) | 32 assessments | Answer, comment, attach evidence, save progress, submit, unsaved-change blocker (W-C) | VERIFIED | Single questionnaire template |
| M3-06 | Evidence analysis | Analyze documents and responses | Due diligence, vendor Evidence tab | Vendor Evidence Analyzer (simulated) | Exceptions, coverage | Analysis output with provenance, analyst acceptance (M) | VERIFIED | Simulated analysis text |
| M3-07 | Vendor risk scoring | Score risk from evidence | Assessment result, vendor KPIs | `scoreAssessment` | Section scores, gaps | Generate result → residual risk updated (W-C) | VERIFIED | Illustrative scoring |
| M3-08 | Continuous monitoring | Detect posture changes | `/tprm/monitoring` | `AlertList` | 27 alerts (ratings, breach intel, leaked creds) | Acknowledge / resolve (M) | VERIFIED | Simulated feeds |
| M3-09 | Fourth-party risk | Risks from subcontractors | Vendor → Fourth parties tab, monitoring concentration panel | Concentration analysis | Fourth parties per vendor | Inspect dependencies and cross-vendor concentration (M) | VERIFIED | Fourth-party records are not editable |
| M3-10 | Remediation tracking | Outstanding vendor issues | `/tprm/remediation`, ticket detail | `TicketsTable`, vendor response | Vendor tickets | Create items from gaps, record vendor response, verify (W-C) | VERIFIED | — |
| M3-11 | Contract monitoring | Security obligations and milestones | `/tprm/contracts`, vendor Contract tab | `ContractCard` | 4 milestones per vendor | Mark milestones met/missed; renewal list (M) | VERIFIED | — |
| M3-12 | Vendor offboarding | Revoke access, close obligations | `/tprm/offboarding`, vendor Offboarding tab | `OffboardingCard` | 2 vendors | Start, checklist, residual risk statement, complete (I) | VERIFIED | — |

## Module 4 — CRQ

| ID | Feature | Description | UI route | Components | Demo data | Implemented interactions | Status | Known limitations |
|---|---|---|---|---|---|---|---|---|
| M4-01 | Business service mapping | Assets/exposures → services | `/services/:id`, scenario links | `ServiceDetail` | 7 services | Service → open risk scenario (W-F) | VERIFIED | — |
| M4-02 | Risk scenario modelling | Plausible loss scenarios | `/crq/scenarios`, `/crq/scenarios/:id` | `ScenarioDetail` | 9 scenarios | Parameter sliders, assumptions, linked exposures (W-F) | VERIFIED | — |
| M4-03 | Financial impact estimation | Potential consequences | `/crq/financial-impact` | Threat-type / loss-component charts | Loss components | Rendered and drill to scenario (M) | VERIFIED | Illustrative |
| M4-04 | Annualized Loss Expectancy | Annual loss with documented assumptions | Scenario simulator, overview | `computeScenario`, step-by-step calculation, loss exceedance curve | Params per scenario | Recalculate on change; save simulation; apply baseline (W-F) | VERIFIED | Not actuarial / FAIR-certified |
| M4-05 | Risk prioritization | Rank scenarios by materiality | `/crq` | Ranked scenario list | — | Ranking recomputes from live data; click → simulator | IMPLEMENTED | Ranking not separately asserted by a test |
| M4-06 | Control effectiveness | How controls influence risk | `/crq/controls` | Controls list, scatter, weakest controls | 13 controls | Update effectiveness/coverage → propagates to scenarios (M) | VERIFIED | — |
| M4-07 | Remediation impact | Risk reduction from fixes | Scenario "simulate remediation", financial impact chart | `aleRemediated` | Linked findings | Toggle remediation, compare before/after (W-F, M) | VERIFIED | — |
| M4-08 | Investment justification | Value of security improvements | `/crq/investments` | ROSI ranking, per-scenario impact | 6 investment options | Select option → impact breakdown (M) | VERIFIED | ROSI is illustrative |
| M4-09 | Risk reporting | Present quantified risk to leaders | `/crq/report` | Board report, Markdown export, print | — | Report renders live figures (M); export/print buttons | IMPLEMENTED | Export & print not asserted by a test |

## Module 5 — AI-SPM

| ID | Feature | Description | UI route | Components | Demo data | Implemented interactions | Status | Known limitations |
|---|---|---|---|---|---|---|---|---|
| M5-01 | AI asset inventory | Visibility into AI systems | `/ai-security/inventory`, `/ai-security/systems/:id` | `AIInventory`, `AISystemDetail` (8 tabs) | 16 AI systems (fictional) | Filters, saved views, profile tabs (M) | VERIFIED | — |
| M5-02 | Approved AI tools | Authorized AI applications | Inventory "Approved AI tools" view | Saved view | 7 approved | View + approval status change (M) | VERIFIED | — |
| M5-03 | Shadow AI discovery | Unauthorized AI usage | `/ai-security/shadow-ai` | Detection cards with source evidence | 5 shadow systems, SSE/IdP/EDR/GitHub sources | Workflow D: inspect evidence → governance review (W-D) | VERIFIED | — |
| M5-04 | Configuration assessment | Risky AI configurations | `/ai-security/config-risks`, system Configuration tab | Config checks, AI findings (OWASP LLM) | Checks per system | Inspect failing checks; findings → standard ticket flow | IMPLEMENTED | Checks are static demo results |
| M5-05 | External exposure monitoring | Externally observable risks | System signals, AI findings (exposed endpoint) | Signals matrix | AIS-008 public endpoint | Inspect signal and finding | IMPLEMENTED | Single seeded scenario |
| M5-06 | AI vendor assessment | Security posture of AI providers | `/ai-security/assessments` | Provider cards → TPRM questionnaire (AI section) | 5 AI providers | Start AI provider assessment (M) | VERIFIED | — |
| M5-07 | Contract and evidence tracking | Contracts & compliance evidence for AI | System → Contract & evidence tab | Contract terms, provider assessments, evidence | DPA / training-use terms | Inspect; navigate to vendor & assessment | IMPLEMENTED | Contract fields read-only |
| M5-08 | AI risk correlation | Connect signals to broader exposure | `/ai-security` matrix, system risk graph | 5-dimension matrix, React Flow risk graph | Signals per system | Graph renders, nodes navigate (M) | VERIFIED | — |
| M5-09 | Governance workflows | Investigate AI policy violations | `/ai-security/governance`, `/ai-security/governance/:id` | `NewGovernanceReviewDialog`, decision form | 7+ reviews | Create review, notes, record decision, set approval (W-D) | VERIFIED | — |
| M5-10 | Remediation tracking | Track AI remediation | System Remediation tab, governance "Assign remediation" | `CreateTicketDialog` (shared) | AI tickets | Ticket creation reuses verified flow | IMPLEMENTED | AI-specific ticket creation not separately asserted |

## Module 6 — Security Intelligence & AI Co-workers

| ID | Feature | Description | UI route | Components | Demo data | Implemented interactions | Status | Known limitations |
|---|---|---|---|---|---|---|---|---|
| M6-01 | Security intelligence assistant | Answer risk questions | `/intelligence` | `AssistantPage`, `services/intelligence.ts` (`IntelligenceProvider`) | 13 intents | Suggested and free questions, unsupported-question message (W-G) | VERIFIED | Not a live LLM |
| M6-02 | Finding investigation | Analyze findings & evidence | `/intelligence/investigation`, finding tabs | Evidence evaluation, FP indicators | — | Select finding → analysis (M) | VERIFIED | Deterministic analysis |
| M6-03 | Vulnerability enrichment | Retrieve vuln info & references | `/intelligence/library`, Classification tab | Knowledge library (138 records, 38 internal) | CVE/CWE/ATT&CK/OWASP/KEV/NIST + internal | Filter, record detail, linked findings (M) | VERIFIED | Static public snapshot |
| M6-04 | Root-cause assistance | Suggest causes | Finding Root Cause tab, investigation assistant | Hypotheses (inferred) | 2–3 per finding | Confirm/reject/add hypotheses, notes (M) | VERIFIED | — |
| M6-05 | Remediation recommendations | Evidence-based fixes | Remediation tab, investigation assistant | Recommendation + "backed by" | Similar resolutions (internal learning) | Navigate cited finding → remediation (W-G) | VERIFIED | — |
| M6-06 | Workflow orchestration | Coordinate workflow stages | `/operations/workflows`, agents | React Flow Workflow Center (6 workflows bound to live records) | — | Switch workflow, select record, inspect node (M) | VERIFIED | Predefined graphs, not an execution engine |
| M6-07 | Evidence-backed responses | Show supporting sources | Assistant responses, AI Analysis tab | Records + evidence + provenance badges | — | Responses list records/evidence; links work (W-G) | VERIFIED | — |
| M6-08 | Human approval gates | Approval for high-impact actions | `/operations/approvals`, agent detail | Approval queue, decision history | Pending AGT-07 run | Agent run → approval → tickets created; risk acceptance gate (W, I) | VERIFIED | — |
| M6-09 | Audit history | Record decisions & activity | `/platform/audit`, recent activity | `AuditPage` | 1,100+ seeded events | Every mutation audited; decision filter (W-A, M) | VERIFIED | Audit stored in browser |

## Module 7 — Integrations & Data Management

| ID | Feature | Description | UI route | Components | Demo data | Implemented interactions | Status | Known limitations |
|---|---|---|---|---|---|---|---|---|
| M7-01 | Integration catalogue | Browse integrations | `/integrations` | `MarketplacePage` | 20 connectors | Search, category filter, open detail (W-H) | VERIFIED | — |
| M7-02 | Connector configuration | Configure connections | `/integrations/:id` | Config form (RHF + zod) | Demo placeholders only | Save, test (success & failure), enable (W-H, M) | VERIFIED | No credentials stored |
| M7-03 | Data ingestion | Import findings & metadata | Integration detail, ingestion runs | `enableIntegration`, `syncIntegration` | 77 ingestion runs | Initial sync imports findings; manual sync (W-H, M) | VERIFIED | Simulated |
| M7-04 | Data normalization | Common format | `/integrations/pipelines` | Pipeline stages, field mapping table | — | Pipeline visualization | IMPLEMENTED | Illustrative mapping table |
| M7-05 | Deduplication | Repeated findings & assets | Pipelines, asset reconciliation | Multi-source findings, asset merge | 7 asset pairs, multi-source findings | Merge assets (M) | VERIFIED | — |
| M7-06 | Ingestion monitoring | Connector health & sync status | `/integrations/monitoring`, `/integrations/connected` | Health chart, runs table | Splunk connector in error | Sync, failed connector, attention panel (M) | VERIFIED | — |
| M7-07 | Source provenance | Preserve finding origin | Finding → Source & Evidence tab | Provenance chain, evidence per source | Source record IDs | Inspected in Workflow A; imported findings carry source (W) | VERIFIED | — |
| M7-08 | Data quality monitoring | Missing / stale / inconsistent data | `/integrations/monitoring` | Data quality table | 20 issues | Resolve / ignore / reopen (M) | VERIFIED | — |

## Module 8 — Security Operations & Remediation

| ID | Feature | Description | UI route | Components | Demo data | Implemented interactions | Status | Known limitations |
|---|---|---|---|---|---|---|---|---|
| M8-01 | Security finding lifecycle | Discovery → closure | `/operations/findings` | Lifecycle strip, `FindingsTable`, `LifecycleStepper` | 9 statuses | Status transitions, bulk triage/assign/ticket, resolution only via verification (W, I) | VERIFIED | — |
| M8-02 | Investigation workspace | Evidence, hypotheses, notes | Finding tabs (Evidence, Root Cause, AI Analysis) | — | — | Notes, hypotheses, AI review (M) | VERIFIED | — |
| M8-03 | Security event management | Record and assess events | `/operations/events` | Events table, event sheet | 57 events | Triage, dismiss with assessment, escalate (M) | VERIFIED | — |
| M8-04 | Incident management | Incidents & response | `/operations/incidents`, `/operations/incidents/:id` | Incident workspace | 8 incidents | Workflow E: escalate, investigator, notes, tasks, status flow, close with resolution (W-E) | VERIFIED | — |
| M8-05 | Ticket management | Create, assign, track tickets | `/operations/tickets`, `/operations/tickets/:id` | `TicketsTable`, `TicketDetail` | 197 tickets | Create, start, progress, comment, reassign, verify (W-A, M) | VERIFIED | — |
| M8-06 | Ownership and deadlines | Responsibilities & target dates | Assign dialog, ticket details, SLA policy | `AssignDialog`, SLA settings | SLA per severity | Owner + due date on ticket creation; overdue views (W-A, I) | VERIFIED | — |
| M8-07 | Remediation verification | Evidence corrective actions succeeded | `/operations/verification` | `VerifyDialog` | Verification records | Pass resolves; fail returns to remediation (W-A) | VERIFIED | — |
| M8-08 | False-positive review | Decisions with rationale | FP dialog | Required reason, evidence, notes, reviewer, timestamp, attestation | — | Workflow B (W-B) | VERIFIED | — |
| M8-09 | Historical decision tracking | Preserve assessment & classification history | History tab, FP decision history, audit | `Timeline`, versioned FP reviews, AI analysis versions | — | Versioned FP decisions, AI analysis versions (W-B, M) | VERIFIED | — |

---

## Enterprise workspace (v2)

| Capability | Where | Status |
|---|---|---|
| Sign-in page with workspace choice, simulated SSO and demo accounts; protected routes redirect to login | `/login`, `RequireAuth` | VERIFIED (J) |
| Landing page that asks what to secure (empty workspace) or shows work and top risks (returning) | `/home` | VERIFIED (J) |
| Onboarding journey: project → application → declare assets → map & link → connect sources → test run → full run | `/onboarding` | VERIFIED (J: fail → fix → pass → full run) |
| SAFE applications (mapped, connected, under assessment) with detail, runs, pause/resume | `/applications` | VERIFIED (J: listing), IMPLEMENTED (pause/resume) |
| Asset mapping with an editable React Flow map | `/mapping` | VERIFIED (J: suggested links saved) |
| Projects in the sidebar, project switcher, project-scoped data | Shell, `/projects` | VERIFIED (J: viewer sees member projects only) |
| Requests: access requests with justification, impact preview, approve/decline | `/requests` | IMPLEMENTED |
| User management: people, invitations, roles matrix, project access, permission inspector, audit, identity policy | `/admin/*` | VERIFIED (J: role change, admin-only gate) |
| Real role restrictions (Administrator, Security analyst, Project owner, Viewer), enforced in navigation, screens and API | `utils/permissions.ts`, `requireCap` | VERIFIED (J) |
| Help & Support tickets with status stepper and conversation; service status | `/support` | IMPLEMENTED |
| Knowledge base task guides with "where to go next", plus a jargon-free glossary | `/knowledge` | IMPLEMENTED |
| Plain-language layer: glossary tooltips (`Term`), friendly names for app types / parts / tools, plain severity and problem descriptions | `utils/plain.ts`, `components/common/Term.tsx` | VERIFIED (J: landing, parts, protection-on copy) |
| One shared journey definition (Home, wizard, sidebar "Get started" card, guide) with time estimates | `modules/onboarding/journey.tsx` | VERIFIED (J: 7 steps on Home) |
| Tool access review before connecting (reads / can change / never touches / scope / retention / disconnect / approver) and visible read-only authorization | `modules/onboarding/ConnectTool.tsx` | VERIFIED (J) |
| Coverage gate: explicit confirmation before continuing with unchecked parts; recommended coverage pre-filled | Connect step | VERIFIED (J) |
| Test-run failures with one-click repair actions | Test step | VERIFIED (J) |
| "Protection is on" completion screen and plain overview (Am I protected? / Anything urgent? / What next?) | Final step, `/home` | VERIFIED (J) |
| Accessibility & polish: WCAG AA secondary text, reduced-motion support, 44px touch targets on touch screens, focus moves to each new step, shell loading skeleton, actionable error state, pluralized copy | `styles/index.css`, `layout.tsx` | IMPLEMENTED (visual) |

## Cross-cutting requirements from the build brief

| Requirement | Where | Status |
|---|---|---|
| Application shell (grouped sidebar, breadcrumbs, title, ⌘K search, Ask DO SAFE, notifications, recent activity, project switcher, user card, prototype badge) | `layouts/AppShell.tsx` | VERIFIED (search W, notifications M, mobile nav I) |
| Global search across assets, findings, vendors, AI systems, incidents, tickets, knowledge | `layouts/GlobalSearch.tsx` | VERIFIED (W) |
| Vulnerability detail with 8 tabs, header fields, FP workflow, reopen, "Not mapped" | `modules/findings/*` | VERIFIED (W-A, W-B, M) |
| Workflows A–H | see Module rows | VERIFIED (W: 21 checks) |
| Tables: global & column filters, sort, pagination, column visibility, row/bulk selection, saved views, CSV export | `components/common/DataTable.tsx` | VERIFIED (I) |
| Charts derived from data, drill-down on click, tooltips | Dashboard, analytics, TPRM, CRQ, AI | VERIFIED (M: pie & heatmap drill-down) |
| Specialized agents with Run Demo, executions, approvals | `/intelligence/agents` | VERIFIED (W, M) |
| React Flow Workflow Center (6 workflows) | `/operations/workflows` | VERIFIED (M) |
| Loading skeletons, empty, error (simulated), no-results, confirmation dialogs, toasts, validation, unsaved-change warnings, keyboard focus | Common components | VERIFIED (I: error state, no-results; W: validation) |
| Reset demo data, persistence | Settings, user menu | VERIFIED (W, I) |
| Provenance labels (observed / external / inferred / human-reviewed / simulated) | `ProvenanceBadge` | IMPLEMENTED (visual) |
| Responsive (1440 primary; tablet/mobile) | Shell + grids | VERIFIED (I: no horizontal overflow at 390px) |

## Known limitations (overall)

* Frontend prototype only: no backend, no real scanning, exploitation, connector APIs, LLM, file upload or remediation execution.
* Persistence is per-browser `localStorage`. Reset regenerates the deterministic dataset.
* Roles and permissions are enforced in the browser only. A real deployment needs server-side authorization and a real identity provider.
* EPSS values are illustrative; CVE/CWE/ATT&CK/OWASP summaries are a static snapshot of public sources.
* CRQ, ROSI, vendor scoring and AI risk scores are documented illustrative models.
* Workflow Center graphs are predefined; attack paths are seeded.
* The main JS chunk is about 810 KB (245 KB gzipped) because the seed generator ships with the app.
