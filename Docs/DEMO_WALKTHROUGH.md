# DO SAFE Unified — Leadership Demo Walkthrough

> Everything shown is **simulated**: Northstar Financial Services, its people, assets, vendors, AI systems, scan results, agent runs and financial figures are fictional. Real CVE / CWE / ATT&CK / OWASP identifiers are summarized from public sources.

## Before you present

1. `cd Frontend && npm install && npm run dev`, then open http://localhost:5173. You land on **Sign in**.
2. Pick a workspace on the sign-in page:
   * **Northstar Financial Services**: a mature customer with 4 projects, 7 applications (6 protected, 1 mid-onboarding) and a full history. Use it for Demos 1–10.
   * **Acme Corporation**: a brand-new, empty customer. Use it for Demo 0, the first-run onboarding journey.
3. Sign in with a **demo account** button. You can also type any active person's email with any password of 4+ characters (for example `elena.marsh@northstar.example`). Roles are enforced, so each demo names the person to sign in as.
4. **Settings → Demo controls → Reset demo data** restores the deterministic dataset, so the record IDs below match. Set **Simulated API latency → 0 ms** for snappy transitions.
5. Use a 1440×900 or larger window. The **Interactive prototype** pill in the top bar is your answer to "is this real?".

| Demo account | Organization role | What it shows |
|---|---|---|
| Hannah Lee | Administrator | Everything, including User management and integrations |
| Priya Raman | Security analyst | All projects; triage, tickets, scans. No onboarding or user management |
| Jonas Weber | Project owner | Only *Core Banking & Payments* and *Treasury Portal Launch*; can onboard there and decide access requests |
| Ravi Shah | Viewer | Read-only, member projects only |
| Alex Rivera (Acme) | Administrator | Empty workspace → first-run journey |

Record IDs below come from the deterministic seed after a reset. If a demo has already been run without resetting, the same steps still work on any equivalent record.

---

## Demo 0 — New customer secures its first application

| | |
|---|---|
| **Sign in as** | Alex Rivera — Administrator, **Acme Corporation** workspace |
| **Starting screen** | Home (`/home`) |
| **Objective** | Show the enterprise journey: login → "what are your assets?" → map and link them → test run → actual run → SAFE application. |

**Click sequence**
1. Home asks **"What do you want to secure?"**. Point out the six application types, the six-step journey strip and the workspace setup checklist. The left panel is the enterprise workspace: Requests, SAFE applications, Asset mapping, Ticket management, Prioritization, Notifications, User management, then **Projects**, then Knowledge base, Help & Support and Settings.
2. Click **Web application** → onboarding. **Project** step: create *Customer Portal* (you become its owner) → **Continue**.
3. **Application** step: name *Customer Portal Web*, pick an owner, describe it → **Create application**.
4. **Declare assets**: the seven suggested assets are pre-selected → **Add 7 selected**. Mention the *Add manually* and *Paste a list* tabs → **Continue to mapping**.
5. **Map & link**: click **Suggest links**, then drag between two assets to add a link and choose its relation → **Save map & continue**. Explain that the map drives attack-path analysis and prioritization.
6. **Connect sources**: to show a failure, tick only one cell (e.g. the web asset under a scanner that is *not connected*) → **Save & continue to test run** → **Start test run**.
7. The test run **fails**. Each asset gets a reason ("No source assigned…", "…is not connected — finish its setup") and the full run is blocked. Click **Connect sources**.
8. Click **Recommend coverage**, then **Connect** on each recommended source → **Save & continue to test run** → **Run the test again** → **passed**.
9. **Continue to full run** → **Start full run**. Six stages animate, then the findings summary appears and the header badge turns **SAFE application**. A notification arrives.
10. Open **SAFE applications** (the app is listed as protected), then **Home**, which now shows top risks instead of the first-run screen.

**Data changes:** project, application, assets, links, coverage, connected integrations, two runs, about 10 findings, audit events and notifications.
**Final outcome:** a customer goes from zero to a monitored SAFE application in one guided flow, and nothing is scanned until a test run proves coverage.

---

## Demo 0b — Enterprise access: roles, projects and requests

| | |
|---|---|
| **Sign in as** | Ravi Shah (Viewer), then Hannah Lee (Administrator) |
| **Starting screen** | Home |

**Click sequence**
1. As **Ravi**: the sidebar has no User management or Integrations, and Projects lists only his two projects. Open `/admin` → "User management is restricted" → **Request access**, which creates an access request with a justification.
2. Sign out (user card → Sign out). Sign in as **Hannah** → **Requests**. Ravi's request shows its justification and a before/after permission impact. Approve it with a note.
3. **User management**: People (change a role inline, deactivate someone), Invitations (invite, then *Simulate acceptance*), Roles & permissions matrix, Project access (organization grant ∩ project grant), **Permission inspector** (pick a person and a project, see each capability and why), Audit log, Identity & security policy.
4. **Help & Support**: open SUP-1042, reply, and follow the Submitted → Triage → Investigating → Resolved stepper. Raise a new request; a simulated support reply arrives in about 2.5 s.
5. **Knowledge base**: open *Test run vs full run*, then use **Where to go next**.

**Final outcome:** access is role- and project-based. Restricted actions are blocked in the API layer too, not just hidden, and every decision is audited.

---

## Demo 1 — Executive views enterprise cyber risk

| | |
|---|---|
| **Sign in as** | Elena Marsh — CISO |
| **Starting screen** | Executive Dashboard (`/dashboard`) |
| **Objective** | Understand overall posture, where the business is exposed and what is being done about it, in under three minutes. |

**Click sequence**
1. Read the KPI row: posture score, open critical exposures (with KEV count), estimated annual loss (illustrative), high-risk vendors, AI systems with shadow-AI count, overdue remediation.
2. Point at **Exposure trend** (13 weeks, reconstructed from detection/closure dates) and hover for weekly counts.
3. In **Business impact by application**, click **Payment Processing** → application detail with tabs for Findings, Asset map, Assets, Runs, Details, Risk & dependencies and Incidents.
4. Back on the dashboard, click the **Critical** segment of **Severity breakdown** → Security Findings, filtered to open critical.
5. In **Active workflows**, click **Awaiting human approval** → Approvals.
6. Click **Board risk report** (header) → printable report with top scenarios, drivers and recommended investments.

**Expected transitions:** Dashboard → Application detail → filtered findings list → Approvals → Risk report.
**Data changes:** none (read-only demo).
**Final outcome:** the executive sees one consolidated picture covering exposures, money, vendors, AI and operations, and every number drills down to the underlying records.

---

## Demo 2 — Analyst investigates a critical vulnerability

| | |
|---|---|
| **Sign in as** | Priya Raman — Security Analyst |
| **Starting screen** | Vulnerabilities (`/exposures/vulnerabilities`), "Critical findings" view |
| **Objective** | Decide whether a critical finding is real, how bad it is, and what to do. |

**Click sequence**
1. Open **FND-1001: Apache Log4j2 JNDI remote code execution (Log4Shell)** on `mft-partner-01` (risk 99, CISA KEV, internet-facing).
2. **Header:** finding ID, risk score, severity, status, affected asset, first detected, last observed, owner and due date. The lifecycle stepper shows where it is.
3. **Overview tab:** executive summary (inferred), technical description, business impact (Payment Processing, PCI scope), exploitability assessment with factor bars, affected systems (the same weakness on other assets).
4. **Source & Evidence tab:** provenance chain (source → ingestion → normalization → dedup → enrichment → classification). Then three evidence items with provenance and reliability: package inventory, scanner output, out-of-band canary check. Point out the **Missing evidence** list.
5. **Root Cause tab:** inferred hypotheses. Click **Confirm** on the shared-logging-library hypothesis and add an investigation note.
6. **AI Analysis tab:** simulated summary with evidence refs, knowledge refs, model ID/version, timestamp, confidence factors and missing information. Click **Accept** to record the human review.
7. **More actions (⋯) → Run exploitability validation** → status becomes *Validated* (simulated, no exploit executed).

**Expected transitions:** Vulnerabilities list → finding detail tabs.
**Data changes:** root cause confirmed, investigation note added, AI review = accepted, validation result recorded. All appear in the **History** tab and the **Audit log**.
**Final outcome:** the analyst has an evidence-backed, explainable view of the finding and its exploitability.

---

## Demo 3 — Analyst reviews cybersecurity library mappings

| | |
|---|---|
| **Sign in as** | Priya Raman — Security Analyst |
| **Starting screen** | FND-1001 → **Classification** tab |
| **Objective** | Show how a finding is mapped to public knowledge systems, and why. |

**Click sequence**
1. Classification tab: **CVE-2021-44228** (CVE), **CWE-917 / CWE-502 / CWE-20** (weakness classes), **T1190 / T1059** (ATT&CK techniques), **A06:2021** (OWASP). Each row explains what that knowledge system represents.
2. Read the **Mapping rationale** and **Classification confidence**. Then the **CVSS** vector breakdown, **EPSS** (labelled illustrative) and **Known exploitation indicators** (KEV, exploit maturity, threat-intel matches).
3. Click **CVE-2021-44228** → Knowledge Library record: definition, CVSS, related CWE records, and every Northstar finding mapped to it.
4. Back on FND-1001, open a misconfiguration for contrast: search ⌘K "public read" → **Object storage bucket allows public read access**. Classification shows CVE **Not mapped** (no CVE applies to a customer misconfiguration), with CWE-732/668 and ATT&CK T1530.
5. Open **Knowledge Library → Internal learning** to show records derived from resolved findings and false-positive decisions (continuous learning).

**Data changes:** none.
**Final outcome:** leadership sees source identification, categorization and library mapping, including honest "Not mapped" handling, which is the core requirement from the planning meeting.

---

## Demo 4 — Analyst investigates a potential false positive

| | |
|---|---|
| **Sign in as** | Priya Raman — Security Analyst |
| **Starting screen** | Investigation Assistant (`/intelligence/investigation`) |
| **Objective** | Record an explainable, reversible false-positive decision. |

**Click sequence**
1. Type "bastion" in the finding filter and select **FND-1046: OpenSSH sshd signal handler race condition (regreSSHion)** on `idn-bastion-01`. Review **False-positive indicators**: the assistant prepares indicators but never decides.
2. Click **Open full investigation** → **Review as False Positive**.
3. Choose reason **Version not affected**, tick the package-inventory evidence item, enter supporting evidence (e.g. "Ubuntu USN shows backported fix in 1:9.6p1-3ubuntu13.3"), write analyst notes, confirm the reviewer, then tick the attestation. Submit with **Record false-positive decision**.
4. The status becomes **False positive**. Any open linked ticket is cancelled. The original evidence is preserved.
5. **History tab → False-positive decision history** shows decision v1 with reason, notes, evidence, reviewer and timestamp.
6. Click **Reopen**, enter a reason ("New authenticated scan shows vulnerable package"), and submit. Status returns to *Triaged*, and history now shows v1 (confirmed) and v2 (reopened).
7. Optional: open seeded example **FND-1043** to show an older false-positive decision.

**Data changes:** finding status false_positive → triaged; two versioned FP review entries; audit events "false positive confirmed" and "finding reopened".
**Final outcome:** false positives are explicit, evidence-backed, versioned and reversible, never automatic.

---

## Demo 5 — Security team creates and resolves remediation work

| | |
|---|---|
| **Sign in as** | Priya Raman (create), then Jonas Weber / any owner (progress), then Priya (verify) |
| **Starting screen** | FND-1001 (Log4Shell) |
| **Objective** | Run Workflow A end to end: finding → ticket → progress → verification → resolved. |

**Click sequence**
1. On FND-1001 click **Create remediation ticket**. The form is pre-filled with recommended steps and verification requirements, assignee and SLA due date. Click **Create ticket** to land on the ticket.
2. Click **Start work**, drag **Remediation progress** to 60%, click **Save**, and add a comment.
3. Click **Submit verification** → method *Rescan*, evidence "Rescan ID 88231 shows log4j-core 2.17.1; OOB canary negative", result *Passed*, then **Record verification**.
4. The ticket becomes **Done**. Open the linked finding: status is **Resolved**, the root cause is confirmed, and History shows the full timeline.
5. Go to the **Executive Dashboard**: open critical exposures and estimated annual loss have dropped. Go to **Remediation Center** and **Audit Logs** to see the records.
6. Bonus (human approval gate): **Specialized Agents → Remediation Orchestrator → Run demo**. Watch the simulated steps; it stops at **Awaiting approval**. Go to **Approvals → Approve** and the drafted tickets are created.

**Data changes:** new ticket, finding in_remediation → resolved, verification record, attack path auto-mitigated when all its findings are resolved, dashboard KPIs and CRQ exposure factor updated, audit events.
**Final outcome:** remediation is owned, tracked and verified, and risk reduction is visible.

---

## Demo 6 — Third-party risk manager evaluates a vendor

| | |
|---|---|
| **Sign in as** | Marcus Chen — TPRM Manager |
| **Starting screen** | Vendor Overview (`/tprm`) |
| **Objective** | Run Workflow C: assess a new vendor and track remediation. |

**Click sequence**
1. Review the lifecycle stages, the risk distribution and **Vendors requiring attention** (e.g. *Orbit Messaging*, which has an SMS-routing breach report).
2. **Vendor Inventory** → search "Cascade" → **Cascade HR Cloud** (intake, inherent risk shown). Review the Profile tab and inherent risk factors.
3. Click **Start assessment**. Answer the questionnaire section by section (Yes / Partial / No / N/A, comments, evidence attachment). Click **Save progress**. Try to navigate away to see the unsaved-changes guard.
4. **Submit assessment** → **Generate risk assessment (simulated)** → score, rating, section chart and gaps.
5. **Create remediation items** → select gaps → create. Open one item, record the vendor response (*Acknowledged*), and later **Submit verification**.
6. Back on the vendor: lifecycle has moved (*Remediation* or *Active*) and residual risk is updated.
7. Optional: **Onboard vendor** wizard (3 steps with validation and inherent risk); **Due Diligence → Analyze → Accept** evidence; **Contracts → Mark met**; **Offboarding → complete checklist**.

**Data changes:** assessment answers/result, remediation tickets, vendor lifecycle and residual risk, vendor responses, audit events.
**Final outcome:** the complete vendor lifecycle (intake → due diligence → remediation → monitoring → offboarding) is demonstrable.

---

## Demo 7 — AI security analyst investigates shadow AI

| | |
|---|---|
| **Sign in as** | Sofia Alvarez — AI Security Analyst |
| **Starting screen** | AI Security Overview (`/ai-security`) |
| **Objective** | Run Workflow D: from shadow AI detection to a governance decision. |

**Click sequence**
1. Review the **AI risk correlation** matrix (live activity, configuration, external exposure, compliance evidence, contract) and KPIs.
2. **Shadow AI** → card **QuickSumm AI**: detection sources (Netskope SSE, Okta OAuth grants) and evidence excerpt with provenance.
3. **Investigate finding** (FND-1239) → Source & Evidence and Classification (OWASP LLM02; CVE/CWE *Not mapped*).
4. Open the AI system (**QuickSumm AI**) → **Risk signals & graph** tab (React Flow risk graph) → **Contract & evidence** (consumer terms only).
5. Click **Create governance review** → type *Shadow AI review*, reviewer, policy references → **Open review**.
6. Record the decision **Approve with conditions**, set approval to *Under review* or *Prohibited*, add conditions, then **Record decision**. Click **Assign remediation** to create a ticket for the finding.
7. Show the AI system **History** tab and the **Audit log**.

**Data changes:** governance review created and decided, AI system approval/governance status, ticket, history and audit entries.
**Final outcome:** shadow AI is detected from multiple sources, investigated with evidence and governed by a human decision.

---

## Demo 8 — Risk manager evaluates financial impact

| | |
|---|---|
| **Sign in as** | David Okafor — Risk Manager |
| **Starting screen** | Business Services → Payment Processing (`/services/SVC-PAY`) |
| **Objective** | Run Workflow F: quantify, simulate and compare. |

**Click sequence**
1. Review the service's assets and exposures, then **Open risk scenario** → **Ransomware disrupts payment processing**.
2. Read the documented model, assumptions, loss components and the step-by-step **Calculation**.
3. Adjust **Base annual event probability**, loss estimates and control effectiveness, then toggle **Simulate remediation of all linked open findings**.
4. Compare **Before / after** bars and the **Loss exceedance curve**.
5. **Save simulation** (named), then optionally **Apply as baseline**.
6. **Investment Analysis** → select **AI gateway with DLP and guardrails** → ROSI and per-scenario reduction. **Control Effectiveness → Update** a control to show propagation.

**Data changes:** saved simulation, optional baseline/control updates, audit events.
**Final outcome:** technical exposure is translated into illustrative financial terms with transparent assumptions, clearly labelled as not actuarial.

---

## Demo 9 — Security leader asks the intelligence assistant

| | |
|---|---|
| **Sign in as** | Elena Marsh — CISO |
| **Starting screen** | Top bar **Ask DO SAFE…** or Intelligence Assistant (`/intelligence`) |
| **Objective** | Run Workflow G: get cited answers and act on them. |

**Click sequence**
1. Ask **"Summarize the current security posture."** The answer spans exposure, financial, third-party, AI and operations, with supporting records and evidence.
2. Ask **"What are our most critical vulnerabilities?"** → ranked records with risk scores and provenance-labelled evidence.
3. Click a cited finding, then its **Remediation** tab.
4. Back in the assistant, ask "Which vendors require attention?", "What is our estimated annual loss?" and "Tell me about CVE-2021-44228".
5. Ask something unsupported ("what is the weather") to show the honest limited-capability response.

**Data changes:** none.
**Final outcome:** conversational access to organizational risk with evidence-backed answers. The UI states it is a deterministic demo engine, designed so an LLM provider can replace it.

---

## Demo 10 — Administrator reviews integrations and ingestion

| | |
|---|---|
| **Sign in as** | Hannah Lee — Platform Administrator |
| **Starting screen** | Integration Marketplace (`/integrations`) |
| **Objective** | Run Workflow H: connect a source and inspect imported data. |

**Click sequence**
1. Filter **Cloud security** → **Microsoft Defender for Cloud** → read capabilities and data types.
2. Fill **Ingestion scope** ("Azure tenant northstar-prod") → **Save configuration** → **Test connection** (simulated success) → **Enable integration**.
3. The initial sync run appears under **Ingestion activity**, and **Findings sourced from Microsoft** lists newly imported findings (tagged *Imported*).
4. **Connected Sources:** health, sparkline, Sync. Open **Splunk Enterprise Security** (error state) to show the failure message and remediation guidance.
5. **Data Pipelines:** ingestion → normalization (field mapping) → deduplication → enrichment → correlation, plus provenance.
6. **Ingestion Monitoring:** connector health chart, attention panel, data quality issues (resolve / ignore).

**Data changes:** integration configured and connected, ingestion run, new findings, data-quality status changes, audit events.
**Final outcome:** connector lifecycle, ingestion health, normalization, deduplication, provenance and data quality are all visible.
