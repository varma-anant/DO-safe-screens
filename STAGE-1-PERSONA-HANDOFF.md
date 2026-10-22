# DO SAFE — Stage 1 screen and persona handoff

Stage 1 is a clickable enterprise frontend prototype. SSO, integrations, scans, approvals and ticket changes are simulated in the browser. There is no backend, identity-provider connection, email delivery or production security enforcement. Changes persist locally; different browsers and the standalone HTML have separate data.

**Revision: 22 October 2026 — persona, workflow and UI planning baseline.** This document describes the current implementation, the Stage 1 UI changes required after the product review, and the unresolved product decisions that block safe implementation. The matrices below are the source for interpreting screen narratives. They describe the normal seeded persona/role combinations, not every possible combination an administrator can configure.

Requirement labels used throughout this document:

- **Stage 1 change:** approved corrective work within the existing product scope and visual system. A development plan may create implementation tickets for it.
- **Current behavior:** what the reviewed prototype does today. It is evidence, not automatically the desired production behavior.
- **Decision required:** unresolved policy. Do not convert it into a development requirement until the product owner confirms it.
- **Later-stage proposal:** a potential new enterprise capability. It is not approved scope and must be proposed separately.

The approved Dashboard visual language remains unchanged. Stage 1 changes may correct metric meaning, labels, ordering, filters, action priority and states without redesigning its visual style.

This review changes documentation only. It does not change application permissions, screens or the previously generated HTML.

## Navigation

Main left navigation: Home → Dashboards (authorized personas only) → Projects → User Management → Notifications → Settings → Support → Knowledge Base → Help.

Global Ticket Management is **not** a top-level left-navigation item. It is opened from the Ticket Management button on the approved Dashboard or from a role-appropriate action on Home. The Dashboard button remains immediately left of Board Risk Report and opens the global ticket dashboard in a new browser tab. Because analysts and project owners do not receive the executive Dashboard, Home must provide them a prominent, reliable global-ticket entry. This is navigation to an existing scoped screen, not a new feature.

User Management: Users, Roles & Permissions, Requests. Non-administrators enter Requests and cannot open administrative user screens.

Settings: Application Configuration, Usage & Limits, Integrations, SSO & Security, Admin Preferences. Non-administrators see My Preferences; integrations are available only with the relevant permission.

Inside a selected project: Project Summary, Asset Mapping, Ticket Management, Safe Applications. These tabs sit in the content area, beneath the project name. They are not global sidebar entries. Global Ticket Management always covers all authorized projects, irrespective of the project previously opened.

## Personas used in the prototype

| Persona | Example | First priority on entry | Frequent work | Must not see or do by default |
| --- | --- | --- | --- | --- |
| Platform administrator | Hannah Lee | Access decisions, configuration attention and capacity | Manage identities, access, integrations and workspace configuration | Domain operations should not crowd out administrative decisions; separate administrator duties remain D01. |
| Executive | Elena Marsh | Material exposure, trend and decisions awaiting sponsorship | Review business impact and approve eligible high-impact decisions | Routine remediation editing, identity administration or integration configuration. |
| Security analyst | Priya Raman | Overdue, critical, unassigned, blocked and verification work | Investigate findings, manage tickets and verify outcomes in authorized scope | Organization identity/security administration or unauthorized project data. |
| Application / project owner | Jonas Weber | Owned-project health, coverage, access decisions and blocked work | Coordinate onboarding, membership and remediation for owned projects | Other projects' confidential detail or organization-wide administration. |
| Employee / Viewer | Ravi Shah | Personally assigned visible work and own request status | Review authorized records, request access and contact support | Restricted security detail, broad approval queues, administrative controls or other users' private support cases. Whether this persona may remediate is D03. |

A future read-only auditor persona may need evidence, history, scope and provenance without mutation controls. It is a **later-stage proposal**, not an approved Stage 1 role.

Existing specialist personas and permission definitions remain available through user administration. They are included in the visibility matrix below. Only the five accounts above are offered by the Northstar SSO review selector. The other specialist accounts exist in the seeded directory but are not directly selectable there.

## Permission model: identity, visibility and actions

There are three different fields. They must not be treated as interchangeable:

1. **Job/persona** (`job`): controls domain visibility. Executive, incident responder, vendor risk, AI governance and risk manager jobs also grant organization-wide project visibility. A job change therefore can change data access even without changing the organization role.
2. **Organization access role** (`orgRole`): Administrator, Executive, Security Analyst, Project Owner or Viewer. This supplies action capabilities. Administrator overrides domain visibility and sees all areas and projects.
3. **Project role**: Owner, Contributor or Viewer within a project. The primary `ownerId` is treated as Owner; additional members can also have Owner membership. Project membership defines visible projects for non-organization-wide users. Some operations additionally check project role; others currently do not.

**Do not implement the blanket formula “organization permissions ∩ project permissions” from the prototype’s explanatory copy.** That is not uniformly enforced in the current code. Application creation/declaration/mapping uses project write checks; ticket mutations and scan functions primarily check organization capabilities. See G02.

No separate Tenant Administrator, Security Administrator, Project Administrator, Support Agent or Super Administrator access role exists. “Platform administrator” is a job normally paired with the Administrator access role. A project Owner membership is not the same as the Project Owner organization role. Proposed separation of administrator duties needs an explicit product decision (D01).

### V01 — What each persona can see

The table assumes an active account and the normal organization role shown. “Project scope” applies to project-linked records; not every global collection is currently filtered this way (see gaps).

| Job/persona | Normal access role | Project scope | Findings | Raw evidence | Incidents/events | Vendor risk | AI governance | Financial risk / approved dashboard |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Platform administrator | Administrator | All | Yes | Yes | Yes | Yes | Yes | Yes |
| Executive | Executive | All | Business view | No | Yes | Yes | Yes | Yes |
| Security analyst | Security Analyst | Owned/member projects | Yes | Yes | Yes | No | No | No |
| Application owner | Project Owner | Owned/member projects | Yes | Yes | Yes | No | No | No |
| Employee | Viewer | Owned/member projects | No | No | No | No | No | No |
| Incident responder | Security Analyst | All | Yes | Yes | Yes | No | No | No |
| Vendor risk manager | Security Analyst | All | Yes | Yes | No | Yes | No | No |
| AI governance | Security Analyst | All | Yes | Yes | No | No | Yes | No |
| Risk manager | Security Analyst | All | Business view | No | No | Yes | Yes | Yes |

Employees can open their project summary, application inventory and asset mapping even though findings and evidence are excluded. They are **not** limited to a ticket-only portal. Their ticket list is further limited to tickets assigned to or reported by them, within visible project scope and allowed domains. Assignment does not itself grant project access. These distinctions need explicit product confirmation (D02).

### V02 — Required presentation of unavailable information

The UI must never convert missing visibility or missing assessment coverage into a healthy zero. This is a Stage 1 presentation requirement independent of the final authorization model:

| Data condition | Required presentation | Prohibited presentation |
| --- | --- | --- |
| User lacks permission to view the metric | **Restricted to your role** with a concise explanation or no metric at all | `0`, `No findings`, or any success treatment |
| Application has not been assessed or monitoring is incomplete | **Not assessed** / **Coverage incomplete** with the next action | `$0 risk`, `0 findings`, or a green/safe treatment |
| User has access and the measured result is genuinely zero | `0` plus measurement scope and last-updated context where material | Ambiguous zero without scope |
| Data is loading | Existing skeleton component preserving layout | Blank content or temporary zero |
| Data failed to load | Inline error with retry and preserved context | Empty state or zero |
| Search/filter has no results | `No results for these filters` and Reset filters | Product-level empty state suggesting there is no data |

`Protected` must not imply that an application is safe or remediated. Until D12 is resolved, use **Monitoring active** for connection/coverage state and show risk, findings and assessment freshness separately.

Administrators, executives and other non-employee personas see tickets within their domain/project visibility, not only their personally assigned tickets. Home’s “My open tasks and tickets” is a narrower assignee-only view. Vendor and AI tickets also require the corresponding domain visibility. Shared vendor records/tickets can span projects.

### N01 — Navigation and screen visibility

| Screen group | Administrator | Executive | Analyst / specialist | Project owner | Employee |
| --- | --- | --- | --- | --- | --- |
| Home, Projects, Notifications | Available | Available | Available | Available | Available, restricted records |
| Global Ticket Management route | Dashboard button + Home | Dashboard button + Home | Home | Home | Home only when an authorized ticket is visible; otherwise no entry |
| Dashboards | Available | Available | Risk manager only with the normal job combinations | Hidden/denied | Hidden/denied |
| User Management entry | Users, Roles & Permissions, Requests | Requests only | Requests only | Requests only | Requests only |
| Requests → Security Approvals | Available | Available | Hidden | Hidden | Hidden |
| Settings configuration, usage, SSO/security | Available | Denied | Denied | Denied | Denied |
| Settings integrations | Available | Denied | Denied | Denied | Denied |
| Personal preferences, Support, Knowledge Base, Help | Available | Available | Available | Available | Available |
| Project Summary / Asset Mapping / Tickets / Safe Applications tabs | Available in accessible project | Available in accessible project | Available in accessible project | Available in accessible project | Available in accessible project |

Menu presence is not permission to mutate a record. A missing domain or administrator capability is also checked by the corresponding route guards. Existing specialist modules remain accessible through authorized deep links/search; they are not new top-level menu items. Admin Preferences currently contains personal notification preferences, not delegated organization policy.

Home ordering and dashboard emphasis may vary by persona; route protection and record-level authorization must not depend on that presentation. A hidden menu item is not an authorization control.

### A01 — Actions by organization role

“Yes” means the role supplies the capability, subject to domain visibility, record scope and the function-specific constraints below. This is a capability inventory, not a claim that every screen consistently enforces all constraints.

| Action | Administrator | Executive | Security Analyst | Project Owner | Viewer |
| --- | --- | --- | --- | --- | --- |
| Manage users, invitations, jobs and organization roles | Yes | No | No | No | No |
| Configure integrations / workspace / identity policy | Yes | No | No | No | No |
| Create project | Yes | No | No | Yes | No |
| Create application / declare assets / edit mapping | Yes | No | No | Yes + Owner/Contributor project membership | No |
| Run tests/scans; pause/resume monitoring | Yes | No | Yes | Yes | No |
| Triage findings, investigate incidents, false-positive decisions | Yes | No | Yes + findings visibility | No | No |
| Create/update/reassign tickets; change due date; comment; verify | Yes | No | Yes | Yes | No |
| Approve/decline project access | Yes, except own request | No | No | Only where an Owner, except own request | No |
| Approve/decline organization role request | Yes, except own request | No | No | No | No |
| Approve high-impact agent actions / risk acceptance / AI reviews | Yes | Yes | No | No | No |
| Manage vendors and assessments | Yes | No | Only with vendor visibility | No | No |
| Manage AI records / submit governance reviews | Yes | No | Only with AI visibility | No | No |
| Edit risk models | Yes | No | Capability present; relevant UI restricted by domain | No | No |
| Submit own access request / support request | Yes | Yes | Yes | Yes | Yes |
| Save personal preferences | Yes | Yes | Yes | Yes | Yes |

**Assignment is not authorization:** assigning a ticket to a Viewer does not permit them to comment, start work, update progress or verify it. A Contributor project grant does not add `manage_tickets` or `onboard_applications` to their organization role. Likewise, an analyst granted Owner membership does not gain `decide_access_requests` or application-onboarding capability. Role and membership changes are distinct operations.

**Who administers whom:** Administrators manage organization roles/jobs and invite/deactivate users. A Project Owner with Owner membership can manage that project’s members, but cannot administer users organization-wide. A Project Owner with only Contributor membership can perform permitted application work but cannot approve membership requests there. An Executive approves high-impact business/security decisions, not access requests.

## Screen-by-screen narration

### S01 — Login · `/login`

**All personas:** “I see the product identity and one Sign in with SSO button.” There are no credentials, registration, password recovery, feature descriptions or marketing panels. The button opens a simulated identity-provider account selector. Reviewers choose Northstar for populated data or Acme for an empty workspace, then choose a persona. Pending sign-in is visible; failures show an inline message and allow retry. This selector is a prototype review device, not a proposed production identity provider.

**Stage 1 change:** retain the minimal layout and specify four recoverable states for handoff: sign-in pending, identity-provider unavailable with Retry, authenticated but unauthorized with support guidance, and expired session with return to the originally requested route. Do not add marketing content.

### S02 — Application shell · every authenticated screen

**All personas:** “The left navigation stays in place and I can identify my organization and current account.” Permissions control menu visibility. Requests are reached through User Management. Project tools are reached through Projects. The header has breadcrumbs, notifications and account context; global search is on Home. The sidebar collapses on desktop and opens from the menu button on mobile. Keyboard focus, dialog escape, skip-to-content and reduced-motion styles use the existing component library.

### S03 — Home · `/home`

**Administrator:** “I first see access decisions, configuration attention and capacity; I can then search or enter user administration.”

**Executive:** “I first see decisions awaiting me and material alerts; I can then open the approved business dashboard.” Access Requests and Security Approvals must be labelled as separate queues or combined under a correctly calculated **Decisions awaiting you** total.

**Analyst:** “I first see overdue, critical, unassigned, blocked and awaiting-verification work across my authorized scope, with a prominent route to global Ticket Management.” A zero personal assignment count must not imply that the operational queue is empty.

**Owner:** “I first see owned projects, project access decisions and blocked or overdue project work.”

**Employee:** “I see my visible assigned work and request status, with a direct route to request access or contact support.” Every work preview includes project, due date and action eligibility. If only part of the list is shown, the UI states the total and provides View all.

The central search applies the current domain/project filters. **Stage 1 change:** make the Home search field directly typeable, or place immediate keyboard focus in the opened search dialog, avoiding a dead click. These are presentation controls, not a complete security boundary (G02/G07). Recent projects prioritize recorded visits, with newly created projects as a fallback; recents are not yet per-user. Pending decision cards show requester, request type, project/scope and age. Quick actions depend on permissions. Empty sections explain the next action. Search remains available with Ctrl+K / Command+K.

### S04 — Dashboards · `/dashboard`

**Executive / authorized administrator:** “I see the approved business dashboard, with its established metrics, charts and drill-downs.” Its design and source component were preserved. The financial-risk capability continues to control access. Employees and analysts without that capability do not receive the executive dashboard menu item or its data.

**Stage 1 changes within the approved design:**

- Reconcile the headline and severity-breakdown critical totals or label their different scopes next to the figures.
- Replace unassessed `$0 risk` with **Not assessed** or pair it with explicit coverage status.
- Add visible reporting period, data freshness and metric scope where the existing cards use different windows.
- Place a compact decisions/actions strip near the top for eligible executive work; use existing cards and spacing rather than adding another analytical chart.
- Connect financial estimates to contributing risks, affected business services and next actions; disclose estimation assumptions in a details treatment.
- Keep technical identifiers in drill-downs; lead the main view with business service, consequence, accountable owner and required decision.
- Keep the Ticket Management button immediately left of Board Risk Report. It opens `/operations/tickets` in a new tab with the title **Ticket Management** and the existing SSO session.

### S05 — Projects · `/projects`

**Administrator:** “I can find all projects, review ownership and create a project.”

**Owner / analyst / employee:** “I see the projects I am permitted to access.”

Project cards show name, description, owner, applications and findings visible to the persona. **Stage 1 change:** show monitoring/assessment coverage separately from findings; apply V02 so incomplete coverage cannot look like a clean zero. Search, ownership filtering and sorting narrow the list. New Project opens the existing setup workflow for users with creation permission. Selecting a project opens its workspace. An empty workspace offers creation or access guidance according to permissions.

### S06 — Project Summary · `/projects/:id`

**Owner:** “I can confirm the project, membership, application status and outstanding work before choosing an operational tab.”

**Analyst:** “The project name stays visible while I move between tools.”

The summary retains application, finding, ticket and membership information. Administrators can manage members and onboard applications. Non-administrators need the relevant organization capability plus project membership; Owner membership alone is insufficient (A01/G10). A missing or unauthorized project displays an unavailable state with a return to Projects.

**Stage 1 changes:** keep one project header and one breadcrumb rather than repeating project identity. Apply V02 to findings and tickets. For example, a Viewer who cannot access findings sees **Restricted to your role**, not `0` or `No open findings`. Calculate My Tickets independently of visible findings. If activity exists but is outside the current scope/period, say **No recorded activity in this view** and identify the period.

### S07 — Asset Mapping · `/projects/:id/mapping`

**Owner / authorized contributor:** “I select an application from this project, inspect its asset relationships, change the map when permitted and save.” Read-only viewers receive the same project context without edit access. Save uses the existing success and error feedback. An empty project directs an authorized user to application setup.

**Stage 1 change:** retain the canvas, and provide an accessible relationship editor using source, relationship and target controls. Unconnected assets form an actionable list. Keyboard operation, focus order and screen-reader announcements are acceptance criteria; drag is not the only edit method.

### S08 — Project Ticket Management · `/projects/:id/tickets`

**Owner / analyst:** “I see ticket metrics, charts and a filterable list for this project only.” The global project selector is absent here. Selecting a ticket keeps the project workspace visible. Switching to global Ticket Management broadens the view only to projects the person is authorized to access.

**Stage 1 change:** replace the redundant single-project **By project** chart with **By application** or **By assignee**, using the existing chart component. Use the same status terminology and active-work defaults as S10.

### S09 — Safe Applications · `/projects/:id/applications`

**Owner:** “I can inspect this project’s application coverage, onboarding progress and run status.” Authorized users continue setup and run the existing simulated application operations. Opening an application preserves the project workspace tabs and exposes its findings, map, assets, runs and details. Existing application setup and verification flows are reused.

**Stage 1 change:** separate connection/monitoring status, assessment freshness and security outcome. Use **Monitoring active** instead of **Protected** until D12 defines the term; a monitored application may still have critical findings.

### S10 — Global Ticket Management · `/operations/tickets`

**Administrator / analyst:** “I can assess my workload across authorized projects before opening a record.”

Open, In Progress, Resolved and Overdue cards currently summarize the selected project scope. By Status and By Priority charts can narrow the list. By Project selects a project. The trend currently shows tickets created per week over the last eight weeks. Shared vendor tickets can belong to multiple projects, so project totals may overlap.

**Stage 1 changes:**

- Default operational personas to active work rather than all history. Keep completed history one explicit action away.
- Promote Overdue, Blocked and Awaiting verification as actionable counts/quick filters. Resolved history is secondary.
- Either apply project/status/priority filters to cards, charts and list consistently, or label two regions explicitly as **Portfolio overview** and **Filtered ticket list**, including denominators.
- Standardize one user-facing term for `Done`/`Resolved` while retaining any internal status mapping.
- Show created versus resolved over the same period so the user can determine whether backlog is increasing. If historical resolution data is unavailable, label the existing chart **Tickets created** and do not imply throughput.
- Default priority breakdowns to active tickets and state the denominator.
- Consolidate duplicated filters or label their separate scope. In the table, prioritize title, project, status, owner and due date; keep optional columns configurable.
- Provide a clear ticket-creation entry only after D11 confirms whether tickets must originate from findings or may be standalone.

### S11 — Ticket detail · `/operations/tickets/:id` or `/projects/:id/tickets/:ticketId`

**Authorized administrator:** “I assign an owner and target date, then monitor progress and evidence.”

**Analyst / owner with ticket permission:** “I start work, record progress and comments, request verification and submit evidence.”

**Employee / read-only persona:** “I can review tickets available to me without being offered administrative changes.”

The screen includes description, priority, status, assignee, due date, linked records, comments and history. Passing verification sets the ticket to Done; the finding resolves only when no other linked tickets remain open. Failure returns the ticket to In Progress and the finding to In Remediation. Read-only employees cannot comment or update progress, even on an assigned ticket. Existing mutation feedback and error handling remain in use.

**Stage 1 change:** display one state-appropriate primary action. Show Start work, Request verification and Submit verification only when permitted by the agreed lifecycle; explain unavailable actions and prerequisites. Do not allow the UI to imply that a 0%-progress Open ticket may be closed directly unless D04 explicitly approves that lifecycle.

### S12 — Users · `/admin/people`

**Administrator:** “I review people, account status, job, access role and project membership. I can invite or manage users where the existing controls allow it.” The user table and existing invitation and project-access dialogs are retained. This is the default administrative User Management destination. Non-administrators opening it directly receive an access restriction with a route to request access.

**Stage 1 change:** explain Job/persona, Organization role and Project membership as separate controls. Before confirmation, preview effective access changes in plain language, including scope and exclusions. Do not imply that a job title alone grants administrative access.

### S13 — Roles & Permissions · `/admin/roles`

**Administrator:** “I can compare the existing roles and capabilities before assigning access.” This screen documents the existing role model rather than creating a new authorization model. Job and access role remain separate, preventing a job title alone from granting administrative actions.

### S14 — Requests · `/admin/requests`

**Employee / analyst:** “I select New Request, specify the project or role and provide a business reason. My Requests shows the decision status.”

**Owner:** “Awaiting My Decision contains eligible project requests, excluding my own requests.”

**Administrator:** “I inspect the requester, current and requested access, business reason and decision impact, then approve or decline and record the note required by policy.”

Filters include awaiting decision, own requests, approved, declined and all visible requests. Authorized high-impact approvers also retain the Security Approvals tab. Legacy `/requests` links redirect to the subsection; Requests is not a global navigation item.

**Stage 1 changes:**

- Replace unexplained capability totals such as `0 → 3` with the actual before/after actions, project/organization scope, duration and explicit exclusions.
- A Contributor request must not promise ticket editing unless the effective role combination truly grants it; W01 and D03 govern this case.
- Make badges count the queue the user can actually open. Deep links select the relevant Access Requests or Security Approvals tab.
- Label Access Requests and Security Approvals as distinct workflows. Do not show `0 pending requests` beside an unlabeled approval alert representing a different queue.
- Align copy and validation for decision notes. Rejection requires a reason for recovery. Whether elevated approvals also require one is D05.

### S15 — Notifications · `/platform/notifications`

**All personas:** “I review notifications, filter them and open the associated record.” Filters cover All, Unread, Assignments, Approvals and Alerts. Opening a notification marks it read; Mark All Read is available. Notification Preferences links to personal settings. Header counts and Home alerts use the same current visibility rules. Recipient isolation and per-user read state are incomplete; do not treat this as a private notification inbox yet (G07).

**Stage 1 change:** every actionable notification identifies project/scope, responsible person, age and required action at list level. Visually distinguish information from items requiring a decision. Repeated alerts must be grouped or differentiated by affected record. The destination must preserve the user's authorization and show a clear unavailable state if access changed.

### S16 — Application Configuration · `/platform/settings/configuration`

**Administrator:** “I update the organization name and resolution targets by severity, then save.” Invalid or missing values disable saving; successful changes persist in the local prototype. Unauthorized personas cannot open the configuration controls.

### S17 — Usage & Limits · `/platform/settings/usage`

**Administrator:** “I can compare current users, projects and applications against illustrative workspace capacity.” Counts use current local records. The screen explicitly identifies capacity as illustrative. No billing, checkout, subscription management or new entitlement system was introduced.

**Stage 1 change:** define the numerator and denominator for each measure, especially Active users versus users consuming capacity. State the measurement period, refresh time and what happens at a limit. Do not add billing or subscription management without separate approval.

### S18 — Integrations · `/platform/settings/integrations`

**Authorized administrator:** “I open the existing integration catalog and inspect, configure or manage a source.” Existing connected-source and integration-detail screens remain available. All connections and data ingestion remain simulated. This entry is nested in Settings rather than the global sidebar.

### S19 — SSO & Security · `/platform/settings/security`

**Administrator:** “I choose the corporate identity provider and review session timeout, MFA and approval verification policy.” The existing policy controls persist locally and provide save feedback. Password authentication is not offered in the policy selector. These settings demonstrate the intended administration experience; no identity service is contacted.

**Stage 1 change:** customer-facing screens describe the control, effect and current status. Move implementation details about backend services, secret storage or engineering architecture to the developer handoff rather than showing them as customer settings content.

### S20 — Admin / My Preferences · `/platform/settings/preferences`

**All personas:** “I can identify my account, choose email-notification and digest preferences and save them.” Administrators see Admin Preferences; others see My Preferences. Confirmation is visible after saving. Values persist for the local account. Selecting a notification preference does not send email in Stage 1.

### S21 — Support · `/support`

**Customer user:** “I create a support request, describe the impact, attach project context and follow the conversation and status.” Existing support ticket creation, detail, reply and resolution states are retained. The All in Workspace filter currently exposes cases beyond the requester; support mutations lack a per-case ownership check. This is a planning gap, not an approved privacy policy (G06/D06). Support cases concern help from the product support team; remediation tickets belong in Ticket Management.

**Stage 1 change:** until D06 is decided, the employee/default customer view is **My support cases** only and does not expose another person's conversation or reply/resolve controls. If shared workspace support is approved, display case owner and the viewer's allowed actions explicitly. Access-and-permissions support categories should link to the formal access-request workflow where appropriate rather than creating an ambiguous parallel approval route.

### S22 — Knowledge Base · `/knowledge`

**All personas:** “I search operational guidance, choose a category and read a procedure with links to the next screen.” Existing guides and terminology remain available. Search-empty states provide a recovery action. Security knowledge records remain available to authorized technical personas.

**Stage 1 change:** write for trained enterprise users by default, with optional plain-language definitions for unavoidable terms. Procedures must match the actual workflow and role policy; remove statements that imply central approval where the implementation performs an immediate false-positive decision (G09).

### S23 — Help · `/help`

**All personas:** “I need a quick reminder of where to manage a project, work a ticket, request access or find guidance.” Help presents concise task instructions with direct links and keyboard guidance. It is separate from Support cases and the searchable Knowledge Base.

**Stage 1 change:** preserve distinct purposes: Support is for cases and service status; Knowledge Base is searchable reference material; Help is contextual routing and shortcuts. Add page-specific help links for complex screens rather than duplicating generic articles.

## Workflow narration across roles

Do not combine access approval, risk acceptance, AI governance, agent authorization and ticket verification into one generic “admin approval” flow. They use different capabilities, actors and state transitions.

### W01 — Project access request → approval → membership grant

**Screens:** S03 → S14 → S06. **Initiator:** any signed-in persona. **Approver:** Administrator, or Project Owner organization role with Owner membership in the requested project. Executives and analysts cannot approve project access under their normal roles.

| Step | Actor | Action / required information | Result and next owner |
| --- | --- | --- | --- |
| 1 | Requester | New Request → Project Access; select project, Viewer/Contributor/Owner, optional duration and business justification (UI minimum 20 characters). | Request becomes Pending. Project picker currently lists all organization project names, including projects outside the requester’s membership (D02). |
| 2 | Eligible project owner / administrator | Open Awaiting My Decision; review requester, requested role, reason and scope. | Requester is excluded from deciding their own request. No automatic delegation or escalation exists. |
| 3a | Eligible approver | Approve, optionally recording a note. | Request becomes Approved, with reviewer/time; membership is replaced with the requested project role. |
| 3b | Eligible approver | Decline, optionally recording a note. | Request becomes Declined; no membership changes. |
| 4 | Requester | Inspect My Requests, then open the project if granted. | Project visibility reflects membership. Job and organization capabilities remain unchanged. |
| 5 | Owner / administrator | Review/revoke membership from project/member controls. | Duration is stored on the request but does not automatically expire access (G03). |

An already-decided request cannot be decided again. There is no withdrawal/resubmission state; another request is a separate record. Approval does not create a remediation ticket. An Owner grant adds Owner membership; it does not transfer the primary project owner field.

**Example:** Ravi requests Contributor access to Core Banking. Hannah or an eligible project owner approves. Ravi gains membership but remains employee + Viewer and cannot edit tickets. The seed justification that Contributor access enables ticket editing conflicts with the current capabilities. Resolve D03 before deriving an implementation task from that example.

### W02 — Organization role request → administrator decision

**Screens:** S14/S12. **Initiator:** any signed-in persona. **Approver:** another Administrator only.

1. Requester selects Role Change, requested organization role and business justification.
2. Administrator reviews organization-wide impact. Executive high-impact approval does not authorize this decision; project owners also cannot decide it.
3. Approval updates `orgRole`; decline leaves it unchanged. Reviewer, time and optional note are recorded. Self-decision and repeat decisions are rejected.
4. Job/persona is not changed by approval. Administrator must review job separately if duties require different domain visibility.
5. User returns to the relevant workspace under the resulting permission combination.

**Exception:** the role-request mapping omits Executive, although the selector offers it. That request can become Approved without applying the role (G04). Request duration does not schedule role reversion. Direct role changes in Users are separate administrator actions with no request approval requirement.

### W03 — Ticket creation → assignment → execution → verification

**Screens:** S09 → finding detail → S11; workload views S03/S08/S10. **Operators:** Administrator, Security Analyst or Project Owner organization role. Intended record scope still applies; record-level write enforcement is incomplete (G02).

| Step | Actor | Action | Result / handoff |
| --- | --- | --- | --- |
| 1 | Authorized operator | Create a ticket from an available linked-record workflow, specifying title, priority, assignee and due date. | Linked ticket is created. Normal manual ticket creation needs no Executive approval. |
| 2 | Administrator, analyst or project owner with ticket capability | Assign/reassign and set due date. Assignment is not administrator-only. | Ticket and relevant finding ownership/dates update. Home shows the assignment only if the assignee can see the ticket. |
| 3 | Authorized operator | Start Work; record progress/comments; Mark Blocked or Unblock as needed. | Open → In Progress ↔ Blocked. Read-only assignee cannot perform this step. |
| 4 | Authorized operator | Request Verification from Open, In Progress or Blocked. | Ticket becomes Pending Verification; linked finding reflects pending verification. |
| 5 | Any authorized ticket operator | Submit Verification with method, evidence (UI minimum 20 characters) and pass/fail result. | Pass → Done / 100%; fail → In Progress with progress capped at 70%. |
| 6 | Owner / analyst / administrator | Review resulting ticket and finding states. | Finding resolves only after a passing verification and no other linked open tickets. Failure returns it to In Remediation. |
| 7 | Authorized viewer | Revisit project/global ticket dashboard. | Counts reflect local changes. Trend shows creation volume, not historical resolution throughput. |

Verification can currently be submitted before Pending Verification. Creator, assignee and verifier may be the same person. There is no separate Verifier role or mandatory independent sign-off (D04). Project-owner business validation is not an additional enforced transition. A Viewer assigned a ticket remains read-only, including comments.

Cancelled tickets do not count as active/overdue; a false-positive decision can cancel linked tickets. Do not infer a universal cancel/reopen control from status values. There is no automatic reassignment, escalation or real Jira sync.

### W04 — High-impact agent action → executive/admin authorization

**Screens:** existing agent workflow → S14 Security Approvals. **Initiator:** actor allowed to run the agent (`run_scans`). **Approver:** Administrator or Executive (`approve_high_impact`).

1. A gated simulated agent execution reaches Awaiting Approval; its approval record is Pending.
2. Administrator/Executive reviews the proposed action and affected records.
3. Approve sets execution to Approved and pending steps to Done; Reject sets execution to Rejected and skips those steps.
4. Remediation-orchestrator approval creates tickets for eligible findings without existing tickets. Rejection creates no tickets. A different existing agent can merge duplicate assets after approval.
5. Created tickets continue through W03. This is an agent-action approval, not an access request.

Repeat decisions are rejected once the approval is no longer Pending. Unlike access requests, self-approval is not prohibited by this function (G05/D04).

### W05 — Risk acceptance request → executive/admin decision

**Screens:** finding → Request Risk Acceptance → S14 Security Approvals. **Requester:** `triage_findings` holder, normally administrator/authorized analyst. **Approver:** Administrator or Executive.

1. Requester supplies justification (UI minimum 30 characters) and a future expiry date.
2. Acceptance becomes Pending; the finding is not resolved by submission.
3. Approve sets finding to Risk Accepted and acceptance to Approved. Reject retains the finding’s current status and marks acceptance Rejected.
4. Permitted viewers inspect the decision and history on the finding.

Risk Accepted does not mean fixed or verified. Expiry is recorded without an automatic expiry/reopening job. The decision function lacks the access-request flow’s strict Pending-only and no-self-decision guards (G05); do not assume all approval flows share them.

### W06 — AI governance submission → decision

**Screens:** existing AI governance list/detail, not a new top-level destination. **Submitter:** `manage_ai_governance` holder, normally administrator or AI-governance specialist; the normal risk-manager combination also includes this permission. **Approver:** Administrator or Executive.

Submitter creates the review with system, policy references and notes. Authorized approver records a decision and conditions. The review stores decision/time; supplying an AI approval value also updates the system’s approval/governance status. Naming a reviewer does not grant approval capability or enforce exclusive decision ownership. These reviews do not automatically appear in the central agent/risk-acceptance queue. Self-decision, stale-state and reviewer-identity rules require G05/D04.

### W07 — False-positive review: a separate analyst decision

**Screens:** finding detail and false-positive dialog. **Actor:** `triage_findings` holder, not necessarily Administrator or Executive.

The current submit function immediately records Confirmed False Positive, sets the finding to False Positive and cancels linked open tickets. It stores the selected reviewer identity and versioned history; it does not create a Pending item in Security Approvals. Reopen with a reason returns the finding to Triaged. Knowledge Base wording that all claims await central approval is inaccurate (G09). A mandatory second reviewer would be a policy change.

### W08 — Project/application setup and the administrator handoff

**Screens:** S05 → existing setup wizard → S06–S09.

1. Administrator or Project Owner organization role creates a project. Regular analysts cannot create projects.
2. Administrator, or Project Owner with Owner/Contributor membership, creates the application, declares assets and saves mapping.
3. **Connection handoff:** only Administrator has `manage_integrations` under normal role combinations. Ownership does not grant it. Administrator configures missing sources through Settings → Integrations; there is no connection-approval request workflow.
4. Actor with `run_scans` starts testing. Missing assets/already-running scans block starting. Failed checks retain a recoverable failure state.
5. A successful test permits the first full run. Active applications can run again. Monitoring and source access remain simulated.
6. Owner/analyst continues through the project workspace and ticket workflow.

**Membership:** Administrator, or Project Owner organization role with Owner membership, can add/change/remove members. Primary-owner removal is blocked until ownership is transferred, but a complete transfer workflow is not established here (D07). Project Summary sometimes exposes member controls based on membership alone before the service rejects the action (G10).

### W09 — User lifecycle, configuration and support

**User lifecycle (S12/S13):** Administrator creates a simulated invitation with job, role and projects. Simulated acceptance creates an active user; this is not a public sign-up flow. Administrator can revoke invitations, change another user’s role, change jobs and deactivate/reactivate accounts. Self-role-change and self-deactivation are blocked; demoting the last active administrator is blocked. Deactivation preserves ownership. Real SSO provisioning and token/session revocation are not implemented.

**Configuration (S16–S19):** Administrator changes configuration/integrations/identity policy; no second-administrator approval is required. Others are denied those controls and may save personal preferences (S20). Preferences do not send email.

**Support (S21):** Customer submits a case; a timer simulates acknowledgment and Triage. A reply while Waiting on You moves it to Investigating. Existing controls resolve/reopen cases. No authenticated Support Agent persona or real helpdesk assignment flow exists. All in Workspace currently exposes broad case visibility; who may read/reply/resolve needs D06.

## Stage 1 UI change backlog for development planning

This backlog translates the product review into implementation units. It reuses the existing component library and visual language. **Must** items are required for a reliable Stage 1 handoff. **Should** items are smaller improvements within Stage 1. Rows with a decision dependency may be designed as states, but their business behavior must not be implemented before that decision is resolved.

| ID | Priority | Screens | Required change and acceptance outcome | Effort | Impact | Dependency |
| --- | --- | --- | --- | --- | --- | --- |
| U01 | Must | S05, S06, S09, S04 | Implement V02: distinct Restricted, Not assessed/Coverage incomplete, genuine zero, loading and error states. No hidden or unassessed data appears as zero/safe. | Medium | Very high | D02, D12 refine copy, not the rule |
| U02 | Must | S03 | Build persona-prioritized Home ordering from shared components: administrator decisions/configuration; executive decisions/exposure; analyst operational queue; owner project queue; employee personal work/requests. | Medium | High | D03 for employee actions |
| U03 | Must | S03, S04, S10 | Keep global Ticket Management out of the left menu. Preserve the Dashboard new-tab button and give analyst/owner personas a prominent Home entry. | Small | High | None |
| U04 | Must | S10 | Default to active work; expose Overdue, Blocked and Awaiting verification; make filter scope and denominators explicit; standardize Done/Resolved copy. | Medium | High | None |
| U05 | Must | S11, W03 | Show one valid primary lifecycle action per state with prerequisites and permissions; align all counts and linked-finding outcomes with the lifecycle. | Medium | Very high | D04, D11 |
| U06 | Must | S12–S14, W01–W02 | Replace numeric capability deltas with human-readable effective access, scope, duration and exclusions; prevent request copy from promising capabilities the grant does not provide. | Medium | Very high | D03, D05 |
| U07 | Must | S21 | Restrict default users to their own support cases and permitted actions until a broader sharing policy is approved. | Medium | Very high | D06 |
| U08 | Must | All data screens | Add consistent skeleton, empty, filtered-empty, inline error/retry, success, access-denied and stale-decision states using existing components. Preserve input on failed submission. | Medium | High | None |
| U09 | Must | S02, S03, S04, S06, S10 | Fix responsive overflow at 390px-class widths. Cards and text wrap; deliberate tables/canvases may scroll inside labelled regions without causing page-wide overflow. | Medium | High | D10 for supported task depth |
| U10 | Must | S07 and all dialogs | Complete keyboard/focus review; add non-drag mapping controls; validate focus return, Escape, announcements and reduced motion. | Medium | High | None |
| U11 | Must | S04 | Correct metric scopes, reporting periods, freshness and unassessed financial states while retaining approved visual layouts and chart grammar. | Medium | High | D09 |
| U12 | Should | S03 | Make central search directly typeable or focus the dialog immediately; preserve Ctrl/Command+K and scope filtering. | Small | Medium | None |
| U13 | Should | S03, S14, S15 | Add requester/project/age/action context to decision and notification previews; make badges equal the queue the user opens. | Small–Medium | High | None |
| U14 | Should | S06 | Remove repeated project identity/breadcrumb content and clarify the activity period. | Small | Medium | None |
| U15 | Should | S08 | Replace single-project By Project chart with By application or By assignee using the existing chart. | Small | Medium | None |
| U16 | Should | S17 | Explain usage units, counting rules, period, refresh and limit consequence. | Small | Medium | None |
| U17 | Should | S19 | Move engineering architecture copy out of customer settings; retain control effect/status and prototype disclosure. | Small | Medium | None |
| U18 | Should | S22, S23 | Align Knowledge Base procedures with actual policy; distinguish contextual Help, searchable Knowledge Base and Support cases. | Small–Medium | Medium | D04 where approval wording is affected |
| U19 | Should | S01 | Add SSO pending, provider-error/retry, unauthorized-account and expired-session states without marketing content. | Small | Medium | None |
| U20 | Should | S10 | Pair created and resolved trends if valid history exists; otherwise explicitly label the current creation-only chart. | Small–Medium | Medium | Data availability |

### Shared interaction and content contract

All development plans should apply these rules rather than solving each screen differently:

1. **One clear primary action per state.** Secondary actions remain available only when they are valid and must not visually compete with the next required step.
2. **Scope is visible.** Counts, charts, badges, search results and exports state whether they represent the organization, authorized projects, one project, a filtered result or the current user.
3. **Role-based emphasis is not authorization.** Home ordering and hidden navigation improve relevance; services still enforce record/action access.
4. **No false assurance.** Apply V02 everywhere, including cards, table empty states, charts, reports and exports.
5. **Terminology is consistent.** Access Request, Security Approval, Support Case and Remediation Ticket are different objects. `Monitoring active` is a coverage state. `Risk accepted` is not fixed. Choose one customer-facing term for completed tickets.
6. **Every mutation closes the loop.** Show pending, success, recoverable error and already-decided/stale states. Success appears only after the effective state changes.
7. **Responsive behavior is intentional.** Content reflows; tables and maps use contained scrolling or alternate views. Controls remain reachable and touch targets retain their existing accessible sizing.

### Development sequencing

1. Resolve D02–D06, D09, D11 and D12 where they block product policy.
2. Implement U01 and the effective permission/scope contract before changing dashboard totals or persona Home pages.
3. Implement U02–U07 and U11 as the principal Stage 1 experience work.
4. Implement U08–U10 as cross-screen quality requirements, not final polish.
5. Complete U12–U20 and run the acceptance scenarios below across Hannah, Elena, Priya, Jonas and Ravi.

## Implementation gaps and decisions for the development plan

### Observed gaps — not completed safeguards

| ID | Finding and planning consequence | Evidence in `Frontend/src` |
| --- | --- | --- |
| G01 | All authorization is local; data remains in browser state. SSO/MFA/session configuration is illustrative, not production enforcement. | `stores/db.ts`, `services/platform.ts: login`, `layouts/AppShell.ts: RequireAuth` |
| G02 | Project write checks are inconsistent. Application functions use `ensureProjectWrite`; tickets and scans do not uniformly check target project membership/role. Plan operation-level authorization, not just hidden controls. | `services/platform.ts`, `services/api.ts`, `hooks/scope.ts` |
| G03 | Access duration does not expire membership or revert role. Risk-acceptance expiry lacks automatic enforcement. A displayed 90-day grant is not time-limited access. | `services/platform.ts: decideAccessRequest`, `types/index.ts: Project/AccessRequest`, `services/api.ts: decideRiskAcceptance` |
| G04 | Executive is missing from the role-request mapping. Approval can leave role unchanged. Job never changes automatically with a role request. | `modules/requests/index.tsx`, `services/platform.ts: decideAccessRequest` |
| G05 | No-self-decision and Pending-only checks differ across approval types. Agent checks Pending but not self; risk/AI lack equivalent lifecycle guards. Assigned reviewer is not a universal authorization check. | `services/api.ts: decideExecution/decideRiskAcceptance/decideGovernanceReview` |
| G06 | Support reads/mutations lack consistent case ownership checks. Broad workspace case access is not an approved privacy requirement. | `modules/support/index.tsx`, `services/platform.ts`, `services/visibility.ts` |
| G07 | Scoping is not universal across collections/store readers. Notifications use path/name heuristics and broad fallbacks. Read flags are shared, and Mark All Read updates all notifications. Recents are workspace state, not per-user state. | `services/visibility.ts`, `services/api.ts: markNotificationRead/recordRecent`, `layouts/GlobalSearch.tsx` |
| G08 | Employee assignment/Contributor membership does not grant ticket actions; employee can still see project/app/asset metadata. Seed request AR-204 implies otherwise. | `utils/permissions.ts`, `data/seed/projects.ts`, `modules/operations/index.tsx` |
| G09 | False-positive submission is immediate, not independent approval. Some Knowledge Base wording conflicts with it. | `services/api.ts: submitFalsePositiveReview`, `modules/support/index.tsx: GUIDES` |
| G10 | Home approval previews and Project Summary member controls use broader eligibility checks than the final service. A visible control/task can fail on permission. | `modules/enterprise/index.tsx`, `modules/applications/index.tsx`, `modules/requests/index.tsx` |
| G11 | Administrators may configure nonstandard job/role combinations. Domain gating covers only some action capabilities; e.g. risk-model edit capability is not conditioned on financial visibility. UI and operation authorization can diverge. | `utils/permissions.ts: can/ACTION_NEEDS_VIEW`, `modules/admin/index.tsx` |
| G12 | New Request closes after `useAction.run` catches an error, so submission recovery is incomplete. Deactivation copy claims session revocation without real tokens. Plan failure recovery and identity lifecycle explicitly. | `modules/requests/index.tsx`, `hooks/queries.ts`, `services/platform.ts: setUserStatus` |
| G13 | Restricted and unassessed data is rendered as healthy zero in important cases. Core Banking shows findings to its owner but `0`/No open findings to the employee; an unprotected Treasury application appears with `$0` risk. Implement V02 before treating summary metrics as decision-safe. | Reviewed S04/S06 UI; confirm source selectors during planning |
| G14 | Home changes records by persona but not enough of its priority. Analyst operational workload, executive approvals and administrator decisions may sit below empty personal sections or appear in differently named counts. | Reviewed S03 UI |
| G15 | Ticket overview cards/charts and the list do not communicate one filter scope. Completed history dominates the default dataset, while blocked and verification work are secondary. | Reviewed S10 UI |
| G16 | Access-request capability counts do not explain the effective grant, and seed copy can promise actions the resulting role combination does not allow. | Reviewed S14 UI; G08 |
| G17 | The reviewed employee can open a different user's support case and is shown reply/resolve controls. Treat this as unintended until D06 explicitly authorizes shared visibility and mutation. | Reviewed S21 UI; G06 |
| G18 | At a 390px viewport, sampled Home/project/dashboard content has internal overflow or clipping. Full accessibility conformance was not assessed; relationship mapping requires a non-drag interaction. | Reviewed responsive S03/S04/S06/S07 UI |

These are code-review findings, not production security-test results. Screen descriptions above express normal presentation; these gaps qualify any broader security guarantee.

### Decisions requiring product-owner confirmation

Recommendations below are proposals only. They do not authorize new roles, screens or features.

| ID | Decision | Recommended starting point |
| --- | --- | --- |
| D01 | One Administrator for identities, all data and security approvals, or separate duties? | Keep current role for Stage 1. Approve a permission model before adding separate admin roles. |
| D02 | Which project/app/asset fields may employees see? May requests list unauthorized project names? | Define discoverable metadata separately from access to operational data. |
| D03 | Is Employee a read-only observer or an assignee expected to remediate? | Retain Viewer unless a scoped “update my assigned ticket” permission is approved; do not grant Administrator just to complete work. |
| D04 | Which decisions need a different person: access, agent, risk, AI, false-positive, verification? | Keep access self-decision denial; decide each other flow explicitly before claiming independent approval. |
| D05 | Must grants/acceptances expire? Are decision notes mandatory? | If duration is offered, implement its expiry result. Require decline reasons if users need a recovery explanation. Neither is guaranteed now. |
| D06 | Who can read, reply to and resolve another person’s support case? | Default to requester and explicitly authorized administrators/support staff; define shared project access explicitly. |
| D07 | Ownership transfer, departing owners, backup approvers and admin absence? | Define the handoffs in existing project/user workflows before promising escalation or automatic reassignment. |
| D08 | Are arbitrary role/job combinations supported? How should specialist personas be reviewed? | Specify supported combinations and one policy for UI and operations; define reviewer access to specialist sessions. |
| D09 | What is the authoritative scope for executive metrics, especially different critical totals, time windows and financial estimates? | Define one metric dictionary: inclusion rules, period, freshness, coverage requirement and drill-down source. Unassessed systems never contribute a misleading `$0`. |
| D10 | Which tasks must be fully operable on a narrow/mobile viewport? | At minimum support review, search, alerts, approvals and ticket reading. Confirm whether dense configuration, tables and mapping require full mobile editing. |
| D11 | Must remediation tickets originate from a finding, or may users create standalone operational tickets? | Prefer finding-linked creation for security remediation. Add a generic New Ticket only if its types, ownership and reporting treatment are approved. |
| D12 | What does `Protected` mean: connected, monitoring active, assessed or remediated? | Use **Monitoring active** for the current connection/coverage state. Reserve security-outcome language for evidence-backed results. |

### Acceptance scenarios for development tickets

These are proposed criteria, not a claim the prototype passes every scenario.

- **AC01:** Contributor grant does not accidentally add organization capabilities. Any approved employee write permission is explicit and scoped.
- **AC02:** Analyst cannot read or mutate another project by changing URL/entity ID. Check tables, aggregates, search, related records and exports.
- **AC03:** Project Owner manages membership only with appropriate organization capability and Owner membership; cannot change global roles, integrations or SSO.
- **AC04:** Executive may approve high-impact decisions but cannot decide access requests, edit tickets or configure the organization.
- **AC05:** Access self/repeat decisions are rejected; every offered supported role is applied correctly. Rejection changes no access. Expiry/notes follow D05.
- **AC06:** Ticket assignment alone grants no mutation authority. If independent verification is approved, enforce it beyond button visibility.
- **AC07:** Passing one ticket does not resolve a finding with other linked open tickets. Failure returns it to remediation; risk acceptance is not presented as a verified fix.
- **AC08:** Evidence, financial, vendor and AI visibility follows V01 on all routes, linked views and exports; nonstandard combinations follow D08.
- **AC09:** Identity changes enforce self/last-admin safeguards. Owner departure and session invalidation follow the agreed lifecycle; copy matches actual effects.
- **AC10:** Support ownership, notification recipients/read state and recents follow approved user/project scope.
- **AC11:** Failed submission preserves input and explains retry. Stale approval shows an already-decided result. No successful grant message precedes the effective change.
- **AC12:** Project owner can perform permitted setup but cannot configure integrations; administrator handoff is explicit and does not invent an approval workflow.
- **AC13:** A user without finding visibility never sees a restricted count rendered as zero or `No findings`; an unassessed application never appears safe or `$0 risk` because coverage is absent.
- **AC14:** Hannah, Elena, Priya, Jonas and Ravi each land on role-relevant first actions described in S03. An empty personal queue does not hide a non-empty team/approval queue relevant to the persona.
- **AC15:** Global Ticket Management is absent from the left menu. The Dashboard button remains immediately left of Board Risk Report and opens the correctly titled global dashboard in a new tab; analyst/owner Home still provides access. Project Ticket Management is unchanged in scope.
- **AC16:** Applying a ticket filter has a visibly defined effect on every count/chart/list, or the screen explicitly separates overview scope from filtered-list scope. Completed history does not dominate the default operational queue.
- **AC17:** Access approval shows exact capabilities gained/lost, resource scope, duration and exclusions. It never claims that Contributor membership supplies an organization capability it does not grant.
- **AC18:** Default customer users cannot read, reply to or resolve another person's support case unless D06 explicitly approves and the authorization policy grants that action.
- **AC19:** At 390px, navigation and cards do not cause page-level horizontal overflow; long project names and metadata wrap or truncate with an accessible full-value treatment. Tables/maps use deliberate contained scrolling.
- **AC20:** Every principal data screen distinguishes initial loading, genuine empty, filtered empty, permission-restricted and load-error states; mutations provide pending, success and recoverable-error feedback.

### Source map

| Subject | Main references |
| --- | --- |
| Capabilities and job/project visibility | `Frontend/src/utils/permissions.ts` |
| Routes, menus and project context | `Frontend/src/app/router.tsx`, `Frontend/src/app/navigation.tsx`, `Frontend/src/modules/enterprise/index.tsx` |
| Read filtering | `Frontend/src/hooks/queries.ts`, `Frontend/src/hooks/scope.ts`, `Frontend/src/services/visibility.ts` |
| Access/user/member/support operations | `Frontend/src/services/platform.ts`, `Frontend/src/modules/requests/index.tsx`, `Frontend/src/modules/admin/index.tsx` |
| Ticket verification / security decisions | `Frontend/src/services/api.ts`, `Frontend/src/modules/operations/index.tsx` |
| Seed examples | `Frontend/src/data/seed/reference.ts`, `Frontend/src/data/seed/projects.ts` |

Development tickets should cite the applicable UI item U01–U20, screen S01–S23, workflow W01–W09, gap G01–G18, decision D01–D12 and acceptance scenario AC01–AC20. Resolve policy decisions before treating their recommendations as requirements.

**Review method:** Screen routes and relevant read/mutation functions were inspected. The actual `can()` implementation was evaluated for all nine default job/role combinations to cross-check V01/A01. The deployed prototype was also reviewed through the five selectable Northstar personas across the principal journeys and selected 390px layouts. Mutating approvals and ticket changes were not submitted, and this is not a production authorization or accessibility assessment. Only this Markdown file was changed during this update.

## Delivery and review

- Main application: run `npm run dev` from `Frontend`, then open port 5173.
- Shareable prototype: open `do-safe-screens.html` directly. Routes use `#/…` in the file version.
- Rebuild the shareable artifact after future edits with `npm run build:single` from `Frontend`.
- Stage 1 regression check: `npm run test:enterprise` with the dev server running.
- Review with Hannah, Priya, Jonas, Elena and Ravi to compare the intended personas. Use the account menu to sign out before selecting another SSO identity.
- No new billing or audit-log feature was added. Existing underlying modules remain in the codebase; the approved main navigation does not introduce additional enterprise destinations.
