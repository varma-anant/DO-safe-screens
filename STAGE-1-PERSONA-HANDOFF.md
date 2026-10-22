# DO SAFE — Stage 1 screen and persona handoff

Stage 1 is a clickable enterprise frontend prototype. SSO, integrations, scans, approvals and ticket changes are simulated in the browser. There is no backend, identity-provider connection, email delivery or production security enforcement. Changes persist locally; different browsers and the standalone HTML have separate data.

**Revision: 22 October 2026 — permission and workflow review.** This document describes the current implementation, including its limitations. The matrices below are the source for interpreting screen narratives. They describe the normal seeded persona/role combinations, not every possible combination an administrator can configure. Items marked **Decision required** or **Implementation gap** are not approved product policy. A development plan must reference and resolve those items rather than silently treating prototype behavior as the production contract.

This review changes documentation only. It does not change application permissions, screens or the previously generated HTML.

## Navigation

Global: Home → Dashboards → Projects → Ticket Management → User Management → Notifications → Settings → Support → Knowledge Base → Help.

User Management: Users, Roles & Permissions, Requests. Non-administrators enter Requests and cannot open administrative user screens.

Settings: Application Configuration, Usage & Limits, Integrations, SSO & Security, Admin Preferences. Non-administrators see My Preferences; integrations are available only with the relevant permission.

Inside a selected project: Project Summary, Asset Mapping, Ticket Management, Safe Applications. These tabs sit in the content area, beneath the project name. They are not global sidebar entries. Global Ticket Management always covers all authorized projects, irrespective of the project previously opened.

## Personas used in the prototype

| Persona | Example account | Purpose and scope |
| --- | --- | --- |
| Platform administrator | Hannah Lee | Configure the workspace, manage identities and project access, review requests, assign and supervise work across projects. |
| Executive | Elena Marsh | Review organization-wide business information and approve high-impact risk/agent/AI decisions; cannot administer users or integrations, approve access requests, or edit tickets. |
| Security analyst | Priya Raman | Investigate and work tickets within authorized projects; cannot administer organization settings or users. |
| Application / project owner | Jonas Weber | Manage owned projects and application setup; review eligible project access requests and manage project remediation. |
| Employee | Ravi Shah | Find assigned projects, view own reported or assigned tickets, submit access requests and contact support. Administrative sections are restricted. |

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

Administrators, executives and other non-employee personas see tickets within their domain/project visibility, not only their personally assigned tickets. Home’s “My open tasks and tickets” is a narrower assignee-only view. Vendor and AI tickets also require the corresponding domain visibility. Shared vendor records/tickets can span projects.

### N01 — Navigation and screen visibility

| Screen group | Administrator | Executive | Analyst / specialist | Project owner | Employee |
| --- | --- | --- | --- | --- | --- |
| Home, Projects, Ticket Management, Notifications | Available | Available | Available | Available | Available, restricted records |
| Dashboards | Available | Available | Risk manager only with the normal job combinations | Hidden/denied | Hidden/denied |
| User Management entry | Users, Roles & Permissions, Requests | Requests only | Requests only | Requests only | Requests only |
| Requests → Security Approvals | Available | Available | Hidden | Hidden | Hidden |
| Settings configuration, usage, SSO/security | Available | Denied | Denied | Denied | Denied |
| Settings integrations | Available | Denied | Denied | Denied | Denied |
| Personal preferences, Support, Knowledge Base, Help | Available | Available | Available | Available | Available |
| Project Summary / Asset Mapping / Tickets / Safe Applications tabs | Available in accessible project | Available in accessible project | Available in accessible project | Available in accessible project | Available in accessible project |

Menu presence is not permission to mutate a record. A missing domain or administrator capability is also checked by the corresponding route guards. Existing specialist modules remain accessible through authorized deep links/search; they are not new top-level menu items. Admin Preferences currently contains personal notification preferences, not delegated organization policy.

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

### S02 — Application shell · every authenticated screen

**All personas:** “The left navigation stays in place and I can identify my organization and current account.” Permissions control menu visibility. Requests are reached through User Management. Project tools are reached through Projects. The header has breadcrumbs, notifications and account context; global search is on Home. The sidebar collapses on desktop and opens from the menu button on mobile. Keyboard focus, dialog escape, skip-to-content and reduced-motion styles use the existing component library.

### S03 — Home · `/home`

**Administrator:** “I can find a record, review pending access decisions and jump to user administration.”

**Analyst / owner:** “I can find a project and resume my assigned work without first interpreting a risk dashboard.”

**Employee:** “I see my own work and requests, with a direct route to request access or contact support.”

The central search opens the searchable record dialog and applies the current domain/project filters. These are presentation controls, not a complete security boundary (G02/G07). Recent projects prioritize recorded visits, with newly created projects as a fallback; recents are not yet per-user. My Open Tasks and Tickets contains unresolved assigned tickets. Pending Requests previews own requests and potential approval work; final eligibility is checked in Requests and is not perfectly matched by the preview (G10). Alerts link to records using current notification visibility rules (G07). Quick actions depend on permissions. Empty sections explain the next action. Search is also available with Ctrl+K / Command+K.

### S04 — Dashboards · `/dashboard`

**Executive / authorized administrator:** “I see the approved business dashboard, with its established metrics, charts and drill-downs.” Its design and source component were preserved. The financial-risk capability continues to control access. Employees and analysts without that capability do not receive the executive dashboard menu item or its data.

### S05 — Projects · `/projects`

**Administrator:** “I can find all projects, review ownership and create a project.”

**Owner / analyst / employee:** “I see the projects I am permitted to access.”

Project cards show name, description, owner, applications and findings visible to the persona. Search, ownership filtering and sorting narrow the list. New Project opens the existing setup workflow for users with creation permission. Selecting a project opens its workspace. An empty workspace offers creation or access guidance according to permissions.

### S06 — Project Summary · `/projects/:id`

**Owner:** “I can confirm the project, membership, application status and outstanding work before choosing an operational tab.”

**Analyst:** “The project name stays visible while I move between tools.”

The summary retains application, finding, ticket and membership information. Administrators can manage members and onboard applications. Non-administrators need the relevant organization capability plus project membership; Owner membership alone is insufficient (A01/G10). A missing or unauthorized project displays an unavailable state with a return to Projects.

### S07 — Asset Mapping · `/projects/:id/mapping`

**Owner / authorized contributor:** “I select an application from this project, inspect its asset relationships, change the map when permitted and save.” Read-only viewers receive the same project context without edit access. Save uses the existing success and error feedback. An empty project directs an authorized user to application setup.

### S08 — Project Ticket Management · `/projects/:id/tickets`

**Owner / analyst:** “I see ticket metrics, charts and a filterable list for this project only.” The global project selector is absent here. Selecting a ticket keeps the project workspace visible. Switching to global Ticket Management broadens the view only to projects the person is authorized to access.

### S09 — Safe Applications · `/projects/:id/applications`

**Owner:** “I can inspect this project’s application coverage, onboarding progress and run status.” Authorized users continue setup and run the existing simulated application operations. Opening an application preserves the project workspace tabs and exposes its findings, map, assets, runs and details. Existing application setup and verification flows are reused.

### S10 — Global Ticket Management · `/operations/tickets`

**Administrator / analyst:** “I can assess my workload across authorized projects before opening a record.”

Open, In Progress, Resolved and Overdue cards summarize the selected project scope. By Status and By Priority charts can narrow the list. By Project selects a project. The trend shows tickets created per week over the last eight weeks; it does not invent historical status snapshots. Shared vendor tickets can belong to multiple projects, so project totals may overlap.

Project, status and priority controls filter the list. Reset Filters clears these controls. The list is initially ordered by most recently updated, supports its existing search, facets, sorting and export, and includes a Critical view. Cards and charts provide scope-wide context while the list shows status/priority matches. Overdue is an overlapping measure, not an additional lifecycle status.

### S11 — Ticket detail · `/operations/tickets/:id` or `/projects/:id/tickets/:ticketId`

**Authorized administrator:** “I assign an owner and target date, then monitor progress and evidence.”

**Analyst / owner with ticket permission:** “I start work, record progress and comments, request verification and submit evidence.”

**Employee / read-only persona:** “I can review tickets available to me without being offered administrative changes.”

The screen includes description, priority, status, assignee, due date, linked records, comments and history. Passing verification sets the ticket to Done; the finding resolves only when no other linked tickets remain open. Failure returns the ticket to In Progress and the finding to In Remediation. Read-only employees cannot comment or update progress, even on an assigned ticket. Existing mutation feedback and error handling remain in use.

### S12 — Users · `/admin/people`

**Administrator:** “I review people, account status, job, access role and project membership. I can invite or manage users where the existing controls allow it.” The user table and existing invitation and project-access dialogs are retained. This is the default administrative User Management destination. Non-administrators opening it directly receive an access restriction with a route to request access.

### S13 — Roles & Permissions · `/admin/roles`

**Administrator:** “I can compare the existing roles and capabilities before assigning access.” This screen documents the existing role model rather than creating a new authorization model. Job and access role remain separate, preventing a job title alone from granting administrative actions.

### S14 — Requests · `/admin/requests`

**Employee / analyst:** “I select New Request, specify the project or role and provide a business reason. My Requests shows the decision status.”

**Owner:** “Awaiting My Decision contains eligible project requests, excluding my own requests.”

**Administrator:** “I inspect the requester, current and requested access, business reason and decision impact, then approve or decline and optionally record a decision note.” The prototype does not require a decision note.

Filters include awaiting decision, own requests, approved, declined and all visible requests. Authorized high-impact approvers also retain the Security Approvals tab. Legacy `/requests` links redirect to the subsection; Requests is not a global navigation item.

### S15 — Notifications · `/platform/notifications`

**All personas:** “I review notifications, filter them and open the associated record.” Filters cover All, Unread, Assignments, Approvals and Alerts. Opening a notification marks it read; Mark All Read is available. Notification Preferences links to personal settings. Header counts and Home alerts use the same current visibility rules. Recipient isolation and per-user read state are incomplete; do not treat this as a private notification inbox yet (G07).

### S16 — Application Configuration · `/platform/settings/configuration`

**Administrator:** “I update the organization name and resolution targets by severity, then save.” Invalid or missing values disable saving; successful changes persist in the local prototype. Unauthorized personas cannot open the configuration controls.

### S17 — Usage & Limits · `/platform/settings/usage`

**Administrator:** “I can compare current users, projects and applications against illustrative workspace capacity.” Counts use current local records. The screen explicitly identifies capacity as illustrative. No billing, checkout, subscription management or new entitlement system was introduced.

### S18 — Integrations · `/platform/settings/integrations`

**Authorized administrator:** “I open the existing integration catalog and inspect, configure or manage a source.” Existing connected-source and integration-detail screens remain available. All connections and data ingestion remain simulated. This entry is nested in Settings rather than the global sidebar.

### S19 — SSO & Security · `/platform/settings/security`

**Administrator:** “I choose the corporate identity provider and review session timeout, MFA and approval verification policy.” The existing policy controls persist locally and provide save feedback. Password authentication is not offered in the policy selector. These settings demonstrate the intended administration experience; no identity service is contacted.

### S20 — Admin / My Preferences · `/platform/settings/preferences`

**All personas:** “I can identify my account, choose email-notification and digest preferences and save them.” Administrators see Admin Preferences; others see My Preferences. Confirmation is visible after saving. Values persist for the local account. Selecting a notification preference does not send email in Stage 1.

### S21 — Support · `/support`

**Customer user:** “I create a support request, describe the impact, attach project context and follow the conversation and status.” Existing support ticket creation, detail, reply and resolution states are retained. The All in Workspace filter currently exposes cases beyond the requester; support mutations lack a per-case ownership check. This is a planning gap, not an approved privacy policy (G06/D06). Support cases concern help from the product support team; remediation tickets belong in Ticket Management.

### S22 — Knowledge Base · `/knowledge`

**All personas:** “I search operational guidance, choose a category and read a procedure with links to the next screen.” Existing guides and terminology remain available. Search-empty states provide a recovery action. Security knowledge records remain available to authorized technical personas.

### S23 — Help · `/help`

**All personas:** “I need a quick reminder of where to manage a project, work a ticket, request access or find guidance.” Help presents concise task instructions with direct links and keyboard guidance. It is separate from Support cases and the searchable Knowledge Base.

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

### Source map

| Subject | Main references |
| --- | --- |
| Capabilities and job/project visibility | `Frontend/src/utils/permissions.ts` |
| Routes, menus and project context | `Frontend/src/app/router.tsx`, `Frontend/src/app/navigation.tsx`, `Frontend/src/modules/enterprise/index.tsx` |
| Read filtering | `Frontend/src/hooks/queries.ts`, `Frontend/src/hooks/scope.ts`, `Frontend/src/services/visibility.ts` |
| Access/user/member/support operations | `Frontend/src/services/platform.ts`, `Frontend/src/modules/requests/index.tsx`, `Frontend/src/modules/admin/index.tsx` |
| Ticket verification / security decisions | `Frontend/src/services/api.ts`, `Frontend/src/modules/operations/index.tsx` |
| Seed examples | `Frontend/src/data/seed/reference.ts`, `Frontend/src/data/seed/projects.ts` |

Development tickets should cite the applicable screen S01–S23, workflow W01–W09, gap G01–G12 and decision D01–D08. Resolve policy decisions before treating their recommendations as requirements.

**Review method:** Screen routes and relevant read/mutation functions were inspected. The actual `can()` implementation was evaluated for all nine default job/role combinations to cross-check V01/A01. This was a documentation and permission-code review, not a rerun of every browser workflow or a production authorization assessment. Only this Markdown file was changed during the review.

## Delivery and review

- Main application: run `npm run dev` from `Frontend`, then open port 5173.
- Shareable prototype: open `do-safe-screens.html` directly. Routes use `#/…` in the file version.
- Rebuild the shareable artifact after future edits with `npm run build:single` from `Frontend`.
- Stage 1 regression check: `npm run test:enterprise` with the dev server running.
- Review with Hannah, Priya, Jonas, Elena and Ravi to compare the intended personas. Use the account menu to sign out before selecting another SSO identity.
- No new billing or audit-log feature was added. Existing underlying modules remain in the codebase; the approved main navigation does not introduce additional enterprise destinations.
