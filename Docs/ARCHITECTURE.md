# DO SAFE Unified — Frontend Prototype Architecture (Phase 0)

> Scope: interactive **frontend prototype** of DO SAFE Unified. All data is simulated
> (fictional organization "Northstar Financial Services"). No scanning, exploitation,
> live integration or real remediation is performed.

## 1. Inputs reviewed

| Source | Use |
|---|---|
| `references/DO-safe-feature-inventory.md` | Source of truth for Module 1–8 features (57 features) |
| `references/DO-safe-concept.md` | Positioning, CTEM loop (Scoping → Discovery → Prioritization → Validation → Mobilization), TPRM loop (Intake → Due Diligence → Remediation → Monitoring → Offboarding) |
| `references/DO-safe-meeting-notes.md` | Leadership emphasis: source identification, categorization, library mapping (CVE/CWE/ATT&CK), false-positive explanations with version history, root cause, resolution history, model version tracking, events → incidents → tickets |
| `references/DO-safe-existing-mockup.html` | Visual direction (dark, violet + emerald, glass cards), 6 first-level screens (Overview, Exposures, Third Parties, AI Systems, Agents, Workflows) — all carried forward and deepened |

The `Frontend/` folder was empty; the prototype is a new Vite project there. No existing work was overwritten.

## 2. Assumptions

1. **Desktop first** (1440×900), with collapsible sidebar for tablet/mobile.
2. **Persistence** is browser `localStorage` (Zustand `persist`). "Reset Demo Data" in the top bar user menu and in Settings regenerates the seed.
3. **Deterministic seed**: record content is generated from a fixed-seed PRNG. Timestamps are generated *relative to the day the seed was created*, so "overdue", "last 30 days" etc. stay meaningful whenever the demo is reset.
4. **Real CVE identifiers** are used only for well-known, publicly documented vulnerabilities with metadata summarized from public sources (NVD / CISA KEV / vendor advisories). EPSS values are labelled *illustrative snapshot* because EPSS changes daily. Misconfiguration and AI findings show **"Not mapped"** for CVE where none applies. Scanner record IDs are clearly fictional (`demo-…`).
5. Integration catalogue names real tool categories and vendors as *connector targets*; every connector is simulated and labelled so.
6. The intelligence assistant is a **deterministic intent engine** over local data (`services/intelligence`), behind an `IntelligenceProvider` interface so an LLM backend can replace it.
7. CRQ uses a documented **illustrative** model (see §7) — not an actuarial model.
8. Vendor names, AI system names and AI providers are **fictional**, so the prototype never attaches simulated risk ratings to real companies.
9. "Persona" switching (CISO, analyst, TPRM manager, AI security analyst, risk manager, admin) changes the acting user recorded in audit events and the default landing emphasis; it is not access control.

## 3. Information architecture & navigation

```
OVERVIEW                 Executive Dashboard · Risk Analytics · Business Services
EXPOSURE MANAGEMENT      Exposure Inventory · Assets · Vulnerabilities · Attack Paths · Prioritization · Validation
THIRD-PARTY RISK         Vendor Overview · Vendor Inventory · Assessments · Due Diligence · Continuous Monitoring · Contracts · Remediation · Offboarding
CYBER RISK QUANT.        Risk Overview · Risk Scenarios · Financial Impact · Control Effectiveness · Investment Analysis · Risk Report
AI SECURITY              AI Security Overview · AI Inventory · Shadow AI · Configuration Risks · AI Risk Assessments · Governance
SECURITY INTELLIGENCE    Intelligence Assistant · Knowledge Library · Threat Intelligence · Investigation Assistant · Specialized Agents
SECURITY OPERATIONS      Security Findings · Events · Incidents · Tickets · Remediation Center · Verification · Approvals · Workflow Center
INTEGRATIONS             Integration Marketplace · Connected Sources · Data Pipelines · Ingestion Monitoring
PLATFORM                 Audit Logs · Notifications · Settings
```

Refinements vs. the suggested hierarchy: added **Contracts** (TPRM contract monitoring is a distinct feature), **Risk Report** (CRQ risk reporting), **Approvals** (human approval gates across agents, risk acceptance and governance). "Security Findings" is the cross-module lifecycle list (vulnerabilities + misconfigurations + AI + identity), while "Vulnerabilities" is the CTEM-scoped subset — both open the same finding investigation view.

Top bar: breadcrumbs + page title, global search (⌘K) across assets, findings, vendors, AI systems, incidents, tickets, knowledge records; "Ask DO SAFE" entry; recent activity; notifications; workspace selector; persona/user menu; DEMO MODE badge.

## 4. Route map

| Route | Screen |
|---|---|
| `/dashboard` | Executive Dashboard |
| `/analytics` | Risk Analytics |
| `/services`, `/services/:id` | Business Services list / detail |
| `/exposures` | Exposure Inventory (CTEM loop) |
| `/exposures/assets`, `/exposures/assets/:id` | Asset inventory (+ Reconciliation tab) / asset detail |
| `/exposures/vulnerabilities`, `/exposures/vulnerabilities/:id` | Vulnerabilities / **vulnerability investigation (8 tabs)** |
| `/exposures/attack-paths`, `/exposures/attack-paths/:id` | Attack paths / path graph |
| `/exposures/prioritization` | Dynamic prioritization (weight tuning) |
| `/exposures/validation` | Exploitability validation queue |
| `/tprm`, `/tprm/vendors`, `/tprm/vendors/:id` | Vendor overview / inventory (+ onboarding wizard) / vendor profile |
| `/tprm/assessments`, `/tprm/assessments/:id` | Assessments / questionnaire |
| `/tprm/due-diligence` | Evidence documents & analysis |
| `/tprm/monitoring` | Monitoring alerts & fourth parties |
| `/tprm/contracts` | Contract milestones & obligations |
| `/tprm/remediation` | Vendor remediation items |
| `/tprm/offboarding` | Offboarding checklists |
| `/crq`, `/crq/scenarios`, `/crq/scenarios/:id` | CRQ overview / scenarios / scenario simulator |
| `/crq/financial-impact`, `/crq/controls`, `/crq/investments`, `/crq/report` | Financial impact / control effectiveness / investment analysis / risk report |
| `/ai-security`, `/ai-security/inventory`, `/ai-security/systems/:id` | AI overview / inventory / AI system profile |
| `/ai-security/shadow-ai`, `/ai-security/config-risks`, `/ai-security/assessments` | Shadow AI / configuration & access risks / AI provider & risk assessments |
| `/ai-security/governance`, `/ai-security/governance/:id` | Governance reviews / review detail |
| `/ai-security/findings/:id` | AI finding investigation |
| `/intelligence`, `/intelligence/library`, `/intelligence/library/:id` | Assistant / knowledge library / record |
| `/intelligence/threats`, `/intelligence/investigation` | Threat intel / investigation assistant |
| `/intelligence/agents`, `/intelligence/agents/:id` | Agent operations / agent detail & executions |
| `/operations/findings`, `/operations/findings/:id` | Finding lifecycle / investigation |
| `/operations/events`, `/operations/incidents`, `/operations/incidents/:id` | Events / incidents / incident workspace |
| `/operations/tickets`, `/operations/tickets/:id` | Tickets / ticket detail |
| `/operations/remediation`, `/operations/verification`, `/operations/approvals` | Remediation Center / verification queue / approvals |
| `/operations/workflows` | Workflow Center (React Flow) |
| `/integrations`, `/integrations/:id` | Marketplace / connector detail & configuration |
| `/integrations/connected`, `/integrations/pipelines`, `/integrations/monitoring` | Connected sources / normalization & dedup pipeline / ingestion & data quality |
| `/platform/audit`, `/platform/notifications`, `/platform/settings` | Audit logs / notifications / settings |

## 5. Data model (src/types/index.ts)

```
BusinessService 1─* Asset 1─* Finding *─* KnowledgeRecord (CVE / CWE / ATT&CK / OWASP / KEV)
Finding 1─* Ticket, Finding *─* Incident, Finding *─* Event, Finding ─ FalsePositiveReview[] ─ HistoryEntry[]
Vendor 1─* Assessment, Vendor 1─* Ticket(type=vendor), Vendor ─ EvidenceDoc[] ─ MonitoringAlert[] ─ FourthParty[] ─ ContractMilestone[]
AISystem 1─* Finding(domain=ai), AISystem 1─* GovernanceReview, AISystem ─ Vendor (provider)
RiskScenario ─ BusinessService, RiskScenario *─* Control, RiskScenario *─* Finding
Agent 1─* AgentExecution (─ Approval)
Integration 1─* IngestionRun, Integration 1─* Finding (source provenance), DataQualityIssue
AttackPath ─ Asset[] + Finding[]
AuditEvent, Notification, User
```

Referential integrity is enforced in the seed generator (`src/data/seed/*`) and validated by `scripts/validate-seed.ts`.

## 6. Data access

`src/services/api.ts` exposes async, REST-shaped functions (`getFindings`, `getFindingById`, `updateFinding`, `createTicket`, `createIncident`, `createAssessment`, …). They read/write a Zustand store that acts as the demo backend (`src/stores/db.ts`) with simulated latency. React components use TanStack Query hooks (`src/hooks/queries.ts`); every mutation invalidates queries so dependent views refresh. Every mutation writes an `AuditEvent` and, where relevant, a `HistoryEntry` and `Notification`.

## 7. Illustrative models

* **Risk score (0–100)**: weighted sum of CVSS, EPSS, KEV listing, exploit availability, internet exposure, asset criticality, business-service criticality, minus compensating controls. Weights are user-tunable on the Prioritization screen.
* **CRQ**: `ALE = AEP_effective × LossPerEvent(most likely)`, with `AEP_effective = baseAEP × (1 + 0.04 × open high/critical linked findings, capped at +60%) × Π(1 − controlEffectiveness × relevance)`. Low/high ALE use the low/high loss estimates. A seeded triangular-distribution simulation produces the loss-exceedance curve. All values are labelled *illustrative estimates*.

## 8. Implementation phases

0. Architecture (this doc) → 1. Design system & shell → 2. Data layer & seed → 3. Dashboard → 4. CTEM & vulnerability investigation → 5. Security operations → 6. TPRM → 7. AI-SPM → 8. CRQ → 9. Intelligence & agents → 10. Integrations & workflows → 11. QA. Progress is tracked in `Docs/FEATURE_COVERAGE.md`.

**Status (2026-10-20):** all phases complete. `tsc` clean, production build passes, seed integrity validated, 69-route sweep and 82 Playwright interaction checks pass with zero console errors. See `Docs/FEATURE_COVERAGE.md` for per-feature status.
