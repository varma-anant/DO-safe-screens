import type { Database, JobRole, OrgRole, User } from '@/types'

/**
 * Two independent dimensions decide what someone gets:
 *  - Access role (OrgRole): which ACTIONS they may take and whether they see every project.
 *  - Job (JobRole): which AREAS they need to see and which experience (home, navigation, detail level) fits their work.
 * Administrators see every area: they manage roles, so they could always grant themselves access — hiding data
 * from them would add friction without adding security.
 */

export type ActionCap =
  | 'manage_users'
  | 'manage_integrations'
  | 'manage_settings'
  | 'create_project'
  | 'onboard_applications'
  | 'run_scans'
  | 'triage_findings'
  | 'manage_tickets'
  | 'approve_high_impact'
  | 'decide_access_requests'
  | 'manage_vendors'
  | 'manage_ai_governance'
  | 'edit_risk_models'
  | 'view_all_projects'

export type ViewCap = 'view_findings' | 'view_evidence' | 'view_incidents' | 'view_vendor_risk' | 'view_ai_governance' | 'view_financial_risk'

export type Capability = ActionCap | ViewCap

export const VIEW_CAPS: ViewCap[] = ['view_findings', 'view_evidence', 'view_incidents', 'view_vendor_risk', 'view_ai_governance', 'view_financial_risk']
const isView = (c: Capability): c is ViewCap => (VIEW_CAPS as string[]).includes(c)

export const ROLE_INFO: Record<OrgRole, { label: string; summary: string; caps: ActionCap[] }> = {
  admin: {
    label: 'Administrator',
    summary: 'Runs the platform: users, integrations, settings and every project. Sees every area.',
    caps: ['manage_users', 'manage_integrations', 'manage_settings', 'create_project', 'onboard_applications', 'run_scans', 'triage_findings', 'manage_tickets', 'approve_high_impact', 'decide_access_requests', 'manage_vendors', 'manage_ai_governance', 'edit_risk_models', 'view_all_projects'],
  },
  executive: {
    label: 'Executive',
    summary: 'Sees the whole organization and approves high-impact decisions. Cannot configure the platform or change records.',
    caps: ['approve_high_impact', 'view_all_projects'],
  },
  analyst: {
    label: 'Security Analyst',
    summary: 'Investigates and fixes problems in the projects they work on (or across the organization when their job needs it).',
    caps: ['run_scans', 'triage_findings', 'manage_tickets', 'manage_vendors', 'manage_ai_governance', 'edit_risk_models'],
  },
  project_owner: {
    label: 'Project Owner',
    summary: 'Owns specific projects: protects their applications, runs checks, manages fix tasks and approves access to those projects.',
    caps: ['create_project', 'onboard_applications', 'run_scans', 'manage_tickets', 'decide_access_requests'],
  },
  viewer: {
    label: 'Viewer',
    summary: 'Read-only access to the projects they belong to. Can raise access and support requests.',
    caps: [],
  },
}

export interface JobInfo {
  label: string
  summary: string
  /** Areas this job needs to see. */
  views: ViewCap[]
  /** The job's work spans the whole organization (e.g. vendor or AI governance), so it sees every project. */
  orgWide?: boolean
  /** Main-navigation item keys, in order (null = the full workspace navigation). */
  nav: string[] | null
  /** Security-workspace groups shown first; the rest the person may open sit under "More tools". */
  focus: string[]
  /** Recommended access role when assigning this job. */
  defaultRole: OrgRole
}

export const JOB_INFO: Record<JobRole, JobInfo> = {
  executive: { label: 'Executive', summary: 'Are we protected, where is the business exposed, is risk improving, what needs my decision.', views: ['view_findings', 'view_incidents', 'view_vendor_risk', 'view_ai_governance', 'view_financial_risk'], orgWide: true, nav: ['home', 'dashboard', 'applications', 'requests', 'prioritization', 'notifications'], focus: ['Risk quantification', 'Project'], defaultRole: 'executive' },
  platform_admin: { label: 'Platform administrator', summary: 'Tool connections, data health, onboarding, people and access.', views: [], nav: null, focus: ['Project'], defaultRole: 'admin' },
  security_analyst: { label: 'Security analyst', summary: 'A queue of problems to triage, validate, fix and verify.', views: ['view_findings', 'view_evidence', 'view_incidents'], nav: ['home', 'prioritization', 'tickets', 'applications', 'mapping', 'requests', 'notifications'], focus: ['Exposure management', 'Security operations', 'Project', 'Intelligence'], defaultRole: 'analyst' },
  incident_responder: { label: 'Incident responder', summary: 'Active incidents, suspicious events and containment.', views: ['view_findings', 'view_evidence', 'view_incidents'], orgWide: true, nav: ['home', 'incidents', 'tickets', 'applications', 'requests', 'notifications'], focus: ['Security operations', 'Exposure management', 'Intelligence'], defaultRole: 'analyst' },
  project_owner: { label: 'Application owner', summary: 'How protected my applications are and what I need to fix.', views: ['view_findings', 'view_evidence', 'view_incidents'], nav: ['home', 'applications', 'tickets', 'mapping', 'requests', 'notifications'], focus: ['Project', 'Exposure management', 'Security operations'], defaultRole: 'project_owner' },
  vendor_risk: { label: 'Vendor risk manager', summary: 'Supplier assessments, evidence, risky vendors and contracts.', views: ['view_findings', 'view_evidence', 'view_vendor_risk'], orgWide: true, nav: ['home', 'vendors', 'requests', 'applications', 'notifications'], focus: ['Third-party risk', 'Intelligence'], defaultRole: 'analyst' },
  ai_governance: { label: 'AI governance', summary: 'Unapproved AI, governance reviews and AI-specific problems.', views: ['view_findings', 'view_evidence', 'view_ai_governance'], orgWide: true, nav: ['home', 'ai', 'requests', 'applications', 'notifications'], focus: ['AI security', 'Intelligence'], defaultRole: 'analyst' },
  risk_manager: { label: 'Risk manager', summary: 'Loss scenarios, control effectiveness and where to invest.', views: ['view_findings', 'view_vendor_risk', 'view_ai_governance', 'view_financial_risk'], orgWide: true, nav: ['home', 'risk', 'dashboard', 'requests', 'applications', 'notifications'], focus: ['Risk quantification', 'Project'], defaultRole: 'analyst' },
  employee: { label: 'Employee', summary: 'Only the security tasks assigned to me.', views: [], nav: ['home', 'requests', 'notifications'], focus: [], defaultRole: 'viewer' },
}

export const CAPABILITY_LABEL: Record<Capability, string> = {
  manage_users: 'Manage users, roles and invitations',
  manage_integrations: 'Configure integrations and data sources',
  manage_settings: 'Change workspace settings and agents',
  create_project: 'Create projects',
  onboard_applications: 'Protect applications (list, map and connect their parts)',
  run_scans: 'Start test runs and protection checks',
  triage_findings: 'Triage, validate and decide on problems and incidents',
  manage_tickets: 'Create and update fix tasks',
  approve_high_impact: 'Approve agent actions, risk acceptance and AI governance decisions',
  decide_access_requests: 'Approve or decline access requests',
  manage_vendors: 'Manage vendors, assessments and evidence',
  manage_ai_governance: 'Manage AI systems and governance reviews',
  edit_risk_models: 'Edit prioritization weights, risk scenarios and controls',
  view_all_projects: 'See every project (others see only projects they belong to)',
  view_findings: 'See security problems and exposures',
  view_evidence: 'See raw technical evidence and root-cause analysis',
  view_incidents: 'See incidents and security events',
  view_vendor_risk: 'See vendor (third-party) risk',
  view_ai_governance: 'See AI systems and AI governance',
  view_financial_risk: 'See financial risk estimates',
}

/** Area names used in "why can't I see this?" explanations. */
export const VIEW_AREA: Record<ViewCap, string> = {
  view_findings: 'Security problems',
  view_evidence: 'Technical evidence',
  view_incidents: 'Incidents & events',
  view_vendor_risk: 'Vendor risk',
  view_ai_governance: 'AI security',
  view_financial_risk: 'Financial risk',
}

/** Managing a domain also requires being allowed to see it. */
const ACTION_NEEDS_VIEW: Partial<Record<ActionCap, ViewCap>> = {
  triage_findings: 'view_findings',
  manage_vendors: 'view_vendor_risk',
  manage_ai_governance: 'view_ai_governance',
}

export const jobOf = (user: User | undefined): JobRole => user?.job ?? 'employee'

export function can(user: User | undefined, cap: Capability): boolean {
  if (!user || user.status !== 'active') return false
  if (isView(cap)) return user.orgRole === 'admin' || JOB_INFO[jobOf(user)].views.includes(cap)
  if (cap === 'view_all_projects' && JOB_INFO[jobOf(user)].orgWide) return true
  if (!ROLE_INFO[user.orgRole].caps.includes(cap)) return false
  const needs = ACTION_NEEDS_VIEW[cap]
  return needs ? can(user, needs) : true
}

/** Plain explanation of why a person can or cannot do/see something. */
export function explain(user: User | undefined, cap: Capability): string {
  if (!user) return 'You are not signed in.'
  if (user.status !== 'active') return 'This account is not active, so all access is off.'
  const role = ROLE_INFO[user.orgRole].label
  const job = JOB_INFO[jobOf(user)].label
  if (isView(cap)) {
    if (user.orgRole === 'admin') return `Administrators can see every area.`
    return can(user, cap) ? `Your job (${job}) includes ${VIEW_AREA[cap].toLowerCase()}.` : `${VIEW_AREA[cap]} isn’t part of your job (${job}). Ask an administrator if you need it.`
  }
  if (cap === 'view_all_projects') return can(user, cap) ? (ROLE_INFO[user.orgRole].caps.includes(cap) ? `Your access role (${role}) covers every project.` : `Your job (${job}) spans the whole organization.`) : 'You see only the projects you’ve been added to.'
  if (!ROLE_INFO[user.orgRole].caps.includes(cap)) return `Your access role (${role}) doesn’t allow this.`
  const needs = ACTION_NEEDS_VIEW[cap]
  if (needs && !can(user, needs)) return `${VIEW_AREA[needs]} isn’t part of your job (${job}).`
  return `Allowed by your access role (${role}).`
}

/** Projects the user can see: all for org-wide roles/jobs, otherwise the ones they are a member of. */
export function visibleProjectIds(db: Pick<Database, 'projects' | 'users'>, userId: string) {
  const u = db.users.find((x) => x.id === userId)
  if (!u) return []
  if (can(u, 'view_all_projects')) return db.projects.map((p) => p.id)
  return db.projects.filter((p) => p.ownerId === u.id || p.members.some((m) => m.userId === u.id)).map((p) => p.id)
}

export function projectRoleOf(db: Pick<Database, 'projects'>, projectId: string, userId: string) {
  const p = db.projects.find((x) => x.id === projectId)
  if (!p) return undefined
  if (p.ownerId === userId) return 'owner' as const
  return p.members.find((m) => m.userId === userId)?.role
}
