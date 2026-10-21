import type { Database, OrgRole, User } from '@/types'

export type Capability =
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

export const ROLE_INFO: Record<OrgRole, { label: string; summary: string; caps: Capability[] }> = {
  admin: {
    label: 'Administrator',
    summary: 'Full control: users, integrations, settings, every project and all approvals.',
    caps: ['manage_users', 'manage_integrations', 'manage_settings', 'create_project', 'onboard_applications', 'run_scans', 'triage_findings', 'manage_tickets', 'approve_high_impact', 'decide_access_requests', 'manage_vendors', 'manage_ai_governance', 'edit_risk_models', 'view_all_projects'],
  },
  analyst: {
    label: 'Security Analyst',
    summary: 'Investigates and remediates across all projects. Cannot manage users, integrations or approve high-impact actions.',
    caps: ['run_scans', 'triage_findings', 'manage_tickets', 'manage_vendors', 'manage_ai_governance', 'edit_risk_models', 'view_all_projects'],
  },
  project_owner: {
    label: 'Project Owner',
    summary: 'Owns specific projects: onboards their applications, runs scans, manages tickets and approves access to those projects.',
    caps: ['create_project', 'onboard_applications', 'run_scans', 'manage_tickets', 'decide_access_requests'],
  },
  viewer: {
    label: 'Viewer',
    summary: 'Read-only access to the projects they are a member of. Can raise access and support requests.',
    caps: [],
  },
}

export const CAPABILITY_LABEL: Record<Capability, string> = {
  manage_users: 'Manage users, roles and invitations',
  manage_integrations: 'Configure integrations and data sources',
  manage_settings: 'Change workspace settings and agents',
  create_project: 'Create projects',
  onboard_applications: 'Onboard applications (declare, map, connect assets)',
  run_scans: 'Start test and full runs',
  triage_findings: 'Triage, validate and decide on findings and incidents',
  manage_tickets: 'Create and update remediation tickets',
  approve_high_impact: 'Approve agent actions, risk acceptance and AI governance decisions',
  decide_access_requests: 'Approve or decline access requests',
  manage_vendors: 'Manage vendors, assessments and evidence',
  manage_ai_governance: 'Manage AI systems and governance reviews',
  edit_risk_models: 'Edit prioritization weights, risk scenarios and controls',
  view_all_projects: 'See every project (others see only projects they belong to)',
}

export function can(user: User | undefined, cap: Capability) {
  return !!user && user.status === 'active' && ROLE_INFO[user.orgRole].caps.includes(cap)
}

/** Projects the user can see: all for admins/analysts, otherwise the ones they are a member of. */
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
