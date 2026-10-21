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

## Demo 0 — A non-specialist protects their first application

| | |
|---|---|
| **Sign in as** | Alex Rivera — Administrator, **Acme Corporation** workspace |
| **Starting screen** | Sign in (`/login`), then Home |
| **Objective** | Show that someone with no security background can go from login to "Protection is on" in about 10 minutes, understanding every step: what DO SAFE is, what each tool can access, why the test run matters, and what to do next. |

**Click sequence**
1. **Sign in.** The left panel explains DO SAFE in one sentence ("connects to the tools you already use, checks everything, tells you in plain words what to fix first"), shows a three-box picture (your tools → DO SAFE → a clear to-do list), and notes it is read-only. The "New to DO SAFE?" box explains invitations. Choose **Acme Corporation** → **Alex Rivera**.
2. **Home** asks one human question: *"What would hurt most if it stopped working or leaked data?"* Point out:
   * "How DO SAFE protects you": three before/after examples (open storage folder, exploited software, former employee's admin account).
   * "How setup works": the same 7 steps as the wizard, with minutes for each.
   * "Good to know": read-only, who needs to approve, progress saves.
   * The **Get started** card in the left panel, which follows you everywhere until setup is done.
3. Click **Our website or customer portal**. **Pick a project**: create *Customer Portal* → **Continue**.
4. **Describe your app**: name it, choose who's responsible and describe it in one sentence. Importance and data sensitivity are plain choice cards ("The business stops without it", "Customer, payment or health data"); tiers and compliance fields are tucked under *More details* → **Save and continue**.
5. **List its parts**: the seven typical parts appear in plain names (Website, Connection point (API), Database…), honestly labelled as a template rather than "discovered". Untick anything you don't have → **Add 7 parts and continue**.
6. **Connect the parts**: a suggested map is already drawn ("We drew a suggested map for you") → **Looks right — continue**.
7. **Connect your tools**: "0 of 7 parts will be checked" plus three recommended tool cards, each saying in one line what the tool does and which parts it checks. Click **Review access & connect** on Wiz to show the access review:
   * what DO SAFE will read
   * what it can change ("Nothing")
   * what it never touches
   * which parts it can see
   * encryption, retention, disconnecting, and who approves

   Click **Not now** to keep the failure demo.
8. Click **Continue to test run**. The confirmation "Some parts won't be checked yet" lists each unconnected tool. Choose **Continue anyway**.
9. **Test run** → **Start test run**. It finishes as **needs attention**. The "How to fix it" box has one button per missing tool (**Connect Wiz**, **Connect GitHub**, **Connect Outside-in monitor**). Each opens the same access review, followed by a visible three-step authorization and "Connected with read-only access". Then click **Run the test again** → **passed**, with a table answering "Can we reach it? / Does access work? / What to do".
10. **Continue** → **Turn on protection**. The summary explains what will happen (all parts, which tools, ~5 minutes, read-only).
11. **Protection is on**: parts checked (7 of 7), tools connected (read-only), last check and next check. "What we found" describes each problem in plain words ("A password or key is visible in your code — on the source code"), with how soon to fix it and **See how to fix**. The finding page opens with an "In plain words" box: what's wrong, how urgent, what to do.
12. **Go to my security overview**: Home now answers *Am I protected?*, *Is anything urgent?* and *What should I do next?* The charts live under **Advanced security workspace**.
13. Optional: **Knowledge base** has the same 7-step guide and a jargon-free glossary. Hover any dotted-underlined word (for example *read-only access*) for its meaning.

**Data changes:** project, application, 7 parts, map, read-only tool connections scoped to the application, two test runs, a full run, about 10 problems, notifications and audit events.
**Final outcome:** a non-specialist finishes setup without meeting unexplained jargon. They know what was connected and what it can access, and they end on an unmistakable "Protection is on" with a short list of what to do next.

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
