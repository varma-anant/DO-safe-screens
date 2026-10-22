# DO SAFE — Stage 1 screen and persona handoff

Stage 1 is a clickable enterprise frontend prototype. SSO, integrations, scans, approvals and ticket changes are simulated in the browser. There is no backend, identity-provider connection, email delivery or production security enforcement. Changes persist locally; different browsers and the standalone HTML have separate data.

## Navigation

Global: Home → Dashboards → Projects → Ticket Management → User Management → Notifications → Settings → Support → Knowledge Base → Help.

User Management: Users, Roles & Permissions, Requests. Non-administrators enter Requests and cannot open administrative user screens.

Settings: Application Configuration, Usage & Limits, Integrations, SSO & Security, Admin Preferences. Non-administrators see My Preferences; integrations are available only with the relevant permission.

Inside a selected project: Project Summary, Asset Mapping, Ticket Management, Safe Applications. These tabs sit in the content area, beneath the project name. They are not global sidebar entries. Global Ticket Management always covers all authorized projects, irrespective of the project previously opened.

## Personas used in the prototype

| Persona | Example account | Purpose and scope |
| --- | --- | --- |
| Platform administrator | Hannah Lee | Configure the workspace, manage identities and project access, review requests, assign and supervise work across projects. |
| Executive | Elena Marsh | Review the approved business dashboard and authorized enterprise information; no user administration or integration management. |
| Security analyst | Priya Raman | Investigate and work tickets within authorized projects; cannot administer organization settings or users. |
| Application / project owner | Jonas Weber | Manage owned projects and application setup; review eligible project access requests and manage project remediation. |
| Employee | Ravi Shah | Find assigned projects, view own reported or assigned tickets, submit access requests and contact support. Administrative sections are restricted. |

Existing specialist personas and permission definitions remain available through user administration. A job determines information visibility; the organization role and project membership determine actions. “Security administrator” in a workflow means an authorized administrator performing security responsibilities; this release does not introduce an additional role definition.

## Screen-by-screen narration

### S01 — Login · `/login`

**All personas:** “I see the product identity and one Sign in with SSO button.” There are no credentials, registration, password recovery, feature descriptions or marketing panels. The button opens a simulated identity-provider account selector. Reviewers choose Northstar for populated data or Acme for an empty workspace, then choose a persona. Pending sign-in is visible; failures show an inline message and allow retry. This selector is a prototype review device, not a proposed production identity provider.

### S02 — Application shell · every authenticated screen

**All personas:** “The left navigation stays in place and I can identify my organization and current account.” Permissions control menu visibility. Requests are reached through User Management. Project tools are reached through Projects. The header has breadcrumbs, notifications and account context; global search is on Home. The sidebar collapses on desktop and opens from the menu button on mobile. Keyboard focus, dialog escape, skip-to-content and reduced-motion styles use the existing component library.

### S03 — Home · `/home`

**Administrator:** “I can find a record, review pending access decisions and jump to user administration.”

**Analyst / owner:** “I can find a project and resume my assigned work without first interpreting a risk dashboard.”

**Employee:** “I see my own work and requests, with a direct route to request access or contact support.”

The central search opens the searchable record dialog. Results respect role and project visibility. Recent projects prioritize recorded project visits, with newly created projects as a fallback. My Open Tasks and Tickets contains unresolved assigned tickets. Pending Requests contains the user’s requests and eligible approval work. Alerts link to relevant records. Quick actions depend on permissions. Empty sections explain why there is no work and offer the appropriate next action. Search is also available with Ctrl+K / Command+K.

### S04 — Dashboards · `/dashboard`

**Executive / authorized administrator:** “I see the approved business dashboard, with its established metrics, charts and drill-downs.” Its design and source component were preserved. The financial-risk capability continues to control access. Employees and analysts without that capability do not receive the executive dashboard menu item or its data.

### S05 — Projects · `/projects`

**Administrator:** “I can find all projects, review ownership and create a project.”

**Owner / analyst / employee:** “I see the projects I am permitted to access.”

Project cards show name, description, owner, applications and findings visible to the persona. Search, ownership filtering and sorting narrow the list. New Project opens the existing setup workflow for users with creation permission. Selecting a project opens its workspace. An empty workspace offers creation or access guidance according to permissions.

### S06 — Project Summary · `/projects/:id`

**Owner:** “I can confirm the project, membership, application status and outstanding work before choosing an operational tab.”

**Analyst:** “The project name stays visible while I move between tools.”

The summary retains application, finding, ticket and membership information. Authorized owners and administrators can manage members and onboard applications. A missing or unauthorized project displays an unavailable state with a return to Projects.

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

The screen includes description, priority, status, assignee, due date, linked records, comments and history. Successful verification resolves the ticket and linked finding; failed verification preserves an unresolved workflow. Existing mutation feedback and error handling remain in use.

### S12 — Users · `/admin/people`

**Administrator:** “I review people, account status, job, access role and project membership. I can invite or manage users where the existing controls allow it.” The user table and existing invitation and project-access dialogs are retained. This is the default administrative User Management destination. Non-administrators opening it directly receive an access restriction with a route to request access.

### S13 — Roles & Permissions · `/admin/roles`

**Administrator:** “I can compare the existing roles and capabilities before assigning access.” This screen documents the existing role model rather than creating a new authorization model. Job and access role remain separate, preventing a job title alone from granting administrative actions.

### S14 — Requests · `/admin/requests`

**Employee / analyst:** “I select New Request, specify the project or role and provide a business reason. My Requests shows the decision status.”

**Owner:** “Awaiting My Decision contains eligible project requests, excluding my own requests.”

**Administrator:** “I inspect the requester, current and requested access, business reason and decision impact, then approve or decline with a reason.”

Filters include awaiting decision, own requests, approved, declined and all visible requests. Authorized high-impact approvers also retain the Security Approvals tab. Legacy `/requests` links redirect to the subsection; Requests is not a global navigation item.

### S15 — Notifications · `/platform/notifications`

**All personas:** “I see notifications relevant to information I can access, filter them and open the associated record.” Filters cover All, Unread, Assignments, Approvals and Alerts. Opening a notification marks it read; Mark All Read is available. Notification Preferences links to personal settings. Header counts and Home alerts use the same visibility rules.

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

**Customer user:** “I create a support request, describe the impact, attach project context and follow the conversation and status.” Existing support ticket creation, detail, reply and resolution states are retained. Support cases concern help from the product support team; remediation tickets belong in Ticket Management.

### S22 — Knowledge Base · `/knowledge`

**All personas:** “I search operational guidance, choose a category and read a procedure with links to the next screen.” Existing guides and terminology remain available. Search-empty states provide a recovery action. Security knowledge records remain available to authorized technical personas.

### S23 — Help · `/help`

**All personas:** “I need a quick reminder of where to manage a project, work a ticket, request access or find guidance.” Help presents concise task instructions with direct links and keyboard guidance. It is separate from Support cases and the searchable Knowledge Base.

## Workflow narration across roles

### W01 — Project access request → decision → assignment → completion

| Step | Actor | Screen | Action and visible result |
| --- | --- | --- | --- |
| 1 | Employee / analyst | Home → User Management → Requests | Submit requested project access and a business reason; request becomes Pending. |
| 2 | Project owner or platform administrator | Requests → Awaiting My Decision | Review the request, scope and reason. The requester cannot approve their own request. |
| 3 | Authorized approver | Request detail | Approve or decline with a reason. Eligible project owners approve project access; organization role changes require an administrator. |
| 4 | Platform administrator / project owner | Users or Project Summary | Review the resulting membership and project role. Approval of project access applies the grant in local prototype state. |
| 5 | Requester | My Requests → Projects | Review the final decision and open the project if access was granted. A declined request retains the reason. |

An access request does not automatically create a remediation ticket. Approval assigns access; operational ticket assignment is a separate action in W02.

### W02 — Security work request → approval where required → assignment → resolution

| Step | Actor | Screen | Action and visible result |
| --- | --- | --- | --- |
| 1 | Analyst | Project → Safe Applications → finding | Review the finding and create a remediation ticket using existing controls. |
| 2 | Authorized security administrator | User Management → Requests → Security Approvals | Review high-impact requests when the selected operation requires approval. Ordinary ticket work does not acquire an artificial approval step. |
| 3 | Administrator or owner with ticket permission | Ticket detail | Assign a responsible person and due date. The ticket appears in applicable project/global lists and the assignee’s Home workload. |
| 4 | Assigned analyst / authorized owner | Ticket detail | Start work, record progress and comments, and request verification. Blocked work stays visible as blocked. |
| 5 | Authorized verifier | Ticket detail → Submit Verification | Record method, evidence and pass/fail result. This may be an analyst or administrator with the existing ticket permission. |
| 6 | Owner / administrator | Project tickets or global Ticket Management | Confirm the resulting status. Successful verification resolves the ticket and linked finding; aggregate metrics reflect the local changes. |

Stage 1 does not add an enforced second-person verification rule or a new approval hierarchy. The writeup reflects the existing capability model.

### W03 — Project setup → ownership → application workspace

An administrator or authorized project owner selects New Project, supplies project information and continues the existing application setup workflow. The owner adds or reviews members from Project Summary. The application is declared, mapped, connected and tested using the existing simulated setup flow. Project workspace tabs provide the ongoing operational entry points. Failed tests retain a recoverable setup state rather than reporting completion.

### W04 — Configuration and preferences

An administrator opens Settings, reviews Usage & Limits and changes Configuration or SSO & Security when needed. Saving validates values and confirms success. Other personas use My Preferences; direct navigation to administrative settings shows an access restriction. Integrations use the existing permission check and simulated connection workflow.

## Delivery and review

- Main application: run `npm run dev` from `Frontend`, then open port 5173.
- Shareable prototype: open `do-safe-screens.html` directly. Routes use `#/…` in the file version.
- Rebuild the shareable artifact after future edits with `npm run build:single` from `Frontend`.
- Stage 1 regression check: `npm run test:enterprise` with the dev server running.
- Review with Hannah, Priya, Jonas, Elena and Ravi to compare the intended personas. Use the account menu to sign out before selecting another SSO identity.
- No new billing or audit-log feature was added. Existing underlying modules remain in the codebase; the approved main navigation does not introduce additional enterprise destinations.
