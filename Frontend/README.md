# DO SAFE Unified — Frontend Prototype

An interactive, enterprise-grade frontend prototype of **DO SAFE Unified** (DataObserve) covering all eight modules: Unified Risk Dashboard, CTEM, TPRM, CRQ, AI-SPM, Security Intelligence & agents, Integrations, and Security Operations.

> **Demo only.** All data is simulated, for the fictional organization *Northstar Financial Services*. No scanning, exploitation, live integration, LLM call or remediation is performed.

## Quick start

Requires Node.js 20+ (tested on 20.18).

```bash
npm install
npm run dev          # http://localhost:5173
```

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | TypeScript only |
| `npm run validate:seed` | Referential-integrity and volume checks for the demo dataset |
| `npm run test:routes -- "/dashboard,/exposures"` | Load routes and report runtime/console errors (needs dev server) |
| `npm run test:e2e` | 82 Playwright checks: Workflows A–H, interactions, all modules (needs dev server; run `npx playwright install chromium` once) |

Demo controls live in **Settings**: reset demo data, simulated latency, simulated API errors, SLA policy and persona switching. The leadership walkthrough is in [`../Docs/DEMO_WALKTHROUGH.md`](../Docs/DEMO_WALKTHROUGH.md) and feature coverage is in [`../Docs/FEATURE_COVERAGE.md`](../Docs/FEATURE_COVERAGE.md).

## Stack

React 19 · TypeScript (strict) · Vite 6 · Tailwind CSS 4 · shadcn-style components on Radix UI · Lucide · React Router 7 (data router, lazy routes) · TanStack Table & Query · Zustand · Recharts 3 · React Flow (@xyflow/react 12) · React Hook Form + Zod 4 · date-fns · Sonner.

## Project structure

```
src/
  app/            router (lazy route modules), navigation config
  layouts/        AppShell (sidebar, top bar, notifications, persona menu), GlobalSearch
  components/
    ui/           button, card, dialog/sheet, tabs, inputs, tooltip, dropdown, slider…
    common/       DataTable, badges (severity/status/provenance/KEV), layout states, charts, entity links, timeline
  modules/        one folder per product area
    dashboard/    Executive dashboard, risk analytics, business services
    ctem/         Exposure inventory, assets & reconciliation, vulnerabilities, attack paths, prioritization, validation
    findings/     8-tab finding/vulnerability investigation, dialogs (ticket, FP review, reopen, risk acceptance, escalation)
    operations/   Findings lifecycle, events, incidents, tickets, remediation, verification, approvals, Workflow Center
    tprm/         Vendor overview/inventory/profile, onboarding wizard, questionnaire, due diligence, monitoring, contracts, offboarding
    crq/          Risk overview, scenario simulator, financial impact, controls, investments, board report
    ai/           AI-SPM overview, inventory, AI system profile & risk graph, shadow AI, config risks, assessments, governance
    intelligence/ Assistant, knowledge library, threat intel, investigation assistant, agent operations
    integrations/ Marketplace, connector config, connected sources, pipelines, ingestion & data quality
    platform/     Audit log, notifications, settings
  services/
    api.ts        REST-shaped demo data-access layer (getFindings, updateFinding, createTicket, createIncident, createAssessment…)
    intelligence.ts  IntelligenceProvider interface + deterministic demo provider
    core.ts       latency/error simulation, audit & notification helpers
  stores/         Zustand demo database (persisted to localStorage), UI state
  data/seed/      deterministic seed: reference data, knowledge library, finding templates, generators
  hooks/          useCollections (TanStack Query), useAction, usePage, useUrlFilters
  utils/          risk & CRQ models, derived analytics, labels, formatting
  types/          domain model
```

## Architecture notes

* **One shared data model.** `stores/db.ts` holds a single `Database` that acts as the demo backend. Components never touch it directly; they call `services/api.ts`. Every mutation writes history entries, audit events and notifications, and any store change invalidates the affected TanStack Query keys. This is why a ticket created on a vulnerability shows up in Tickets, the Remediation Center, the finding's Remediation tab and the audit log.
* **Swappable backend.** API functions are async and REST-shaped. Replacing their bodies with `fetch` calls is the integration point for a real service.
* **Deterministic seed.** `data/seed` builds 106 assets, 258 findings (20 AI), 24 vendors, 16 AI systems, 9 risk scenarios, 13 controls, 197 tickets, 57 events, 8 incidents, 138 knowledge records, 56 agent executions, 20 connectors and more from a fixed-seed PRNG. Timestamps are relative to the moment the dataset is seeded. `npm run validate:seed` checks referential integrity.
* **Illustrative models** (documented in the UI): dynamic risk score (`utils/risk.ts`), CRQ expected loss (`ALE = AEP_effective × loss per event`, with exposure factor and control multipliers, plus a seeded loss-exceedance simulation), vendor inherent/residual risk and questionnaire scoring, and AI risk score.
* **Trust labelling.** Information is tagged *Observed evidence*, *External reference*, *Inferred assessment*, *Human-reviewed* or *Simulated demo output*.

## Assumptions

See [`../Docs/ARCHITECTURE.md`](../Docs/ARCHITECTURE.md) §2. Highlights:

* Real CVE identifiers are used only for well-known vulnerabilities, with metadata summarized from public sources. EPSS values are labelled illustrative. Misconfiguration and AI findings show **Not mapped** where no CVE applies.
* Vendor and AI provider names are fictional. Integration names refer to real product categories only as targets of simulated connectors.
* Personas switch the acting user for audit attribution. They are not access control.
