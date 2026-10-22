import {
  Home, LayoutDashboard, Inbox, ShieldCheck, Waypoints, Ticket, ListOrdered, Bell, Users, BookOpen, LifeBuoy, Settings,
  Radar, Server, Bug, Route, BadgeCheck, FileWarning, Zap, Siren, Hammer, Workflow, Building2, ClipboardList, FileSearch, Activity, FileSignature, Wrench, LogOut,
  Bot, Boxes, EyeOff, Settings2, ClipboardCheck, Scale, Calculator, Layers, DollarSign, Gauge, PiggyBank, FileText, Sparkles, Globe, Microscope, Cpu, LineChart, FolderKanban, AppWindow,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { User } from '@/types'
import { can, JOB_INFO, jobOf, type Capability } from '@/utils/permissions'

export interface NavItem {
  label: string
  to: string
  icon: ReactNode
  end?: boolean
  cap?: Capability
  badge?: 'requests' | 'notifications' | 'applications'
  /** Plain-language description shown on hover. */
  hint?: string
}

/** Every main-sidebar destination. Which ones a person sees, and in what order, depends on their job. */
export const NAV_ITEMS: Record<string, NavItem> = {
  projects: { label: "Projects", to: "/projects", icon: <FolderKanban />, hint: "Project workspaces and membership" },
  home: { label: 'Home', to: '/home', icon: <Home />, hint: 'Am I protected, is anything urgent, and what to do next' },
  dashboard: { label: 'Dashboards', to: '/dashboard', icon: <LayoutDashboard />, cap: 'view_financial_risk', hint: 'Business exposure, trends and money at risk' },
  requests: { label: 'Requests', to: '/requests', icon: <Inbox />, badge: 'requests', hint: 'Access requests and approvals waiting for a decision' },
  applications: { label: 'SAFE applications', to: '/applications', icon: <ShieldCheck />, badge: 'applications', hint: 'Applications DO SAFE protects, and ones being set up' },
  mapping: { label: 'Asset mapping', to: '/mapping', icon: <Waypoints />, hint: 'How the parts of each application connect' },
  tickets: { label: 'Ticket Management', to: '/operations/tickets', icon: <Ticket />, hint: 'Fix-it tasks, who owns them and when they’re due' },
  prioritization: { label: 'Prioritization', to: '/exposures/prioritization', icon: <ListOrdered />, cap: 'view_findings', hint: 'Every problem in the order you should fix it' },
  incidents: { label: 'Incidents', to: '/operations/incidents', icon: <Siren />, cap: 'view_incidents', hint: 'Active incidents and what’s affected' },
  vendors: { label: 'Vendor risk', to: '/tprm', icon: <Building2 />, cap: 'view_vendor_risk', hint: 'Suppliers, assessments and contracts' },
  ai: { label: 'AI security', to: '/ai-security', icon: <Bot />, cap: 'view_ai_governance', hint: 'AI systems, unapproved AI and governance reviews' },
  risk: { label: 'Business risk', to: '/crq', icon: <Calculator />, cap: 'view_financial_risk', hint: 'Loss scenarios, controls and investments' },
  notifications: { label: 'Notifications', to: '/platform/notifications', icon: <Bell />, badge: 'notifications', hint: 'Alerts and updates for you' },
  users: { label: 'User Management', to: '/admin', icon: <Users />, hint: 'People, roles and who can see which projects' },
}

/** The full workspace navigation (platform administrators — mirrors the DO product family layout). */
export const FULL_NAV = ['home', 'dashboard', 'projects', 'tickets', 'users', 'notifications']

/** @deprecated kept for consumers that want the full list */
export const MAIN_NAV: NavItem[] = FULL_NAV.map((k) => NAV_ITEMS[k])

export const FOOTER_NAV: NavItem[] = [
  { label: 'Settings', to: '/platform/settings', icon: <Settings /> },
  { label: 'Support', to: '/support', icon: <LifeBuoy /> },
  { label: 'Knowledge Base', to: '/knowledge', icon: <BookOpen /> },
  { label: 'Help', to: '/help', icon: <BookOpen /> },
]

export interface NavGroup {
  label: string
  items: NavItem[]
  /** Area the whole group belongs to. */
  cap?: Capability
}

/** Security workspace navigation shown inside a project (or across all projects). */
export const SECURITY_NAV: NavGroup[] = [
  { label: 'Project', items: [
    { label: 'Project overview', to: '/projects', icon: <FolderKanban /> },
    { label: 'Applications', to: '/applications', icon: <AppWindow /> },
    { label: 'Assets', to: '/exposures/assets', icon: <Server />, cap: 'view_findings' },
    { label: 'Risk analytics', to: '/analytics', icon: <LineChart />, cap: 'view_findings' },
  ] },
  { label: 'Exposure management', cap: 'view_findings', items: [
    { label: 'Exposure inventory', to: '/exposures', icon: <Radar />, end: true },
    { label: 'Vulnerabilities', to: '/exposures/vulnerabilities', icon: <Bug /> },
    { label: 'Attack paths', to: '/exposures/attack-paths', icon: <Route /> },
    { label: 'Validation', to: '/exposures/validation', icon: <ShieldCheck /> },
    { label: 'Prioritization', to: '/exposures/prioritization', icon: <ListOrdered />, hint: 'Every problem in the order you should fix it' },
  ] },
  { label: 'Security operations', items: [
    { label: 'Security findings', to: '/operations/findings', icon: <FileWarning />, cap: 'view_findings' },
    { label: 'Events', to: '/operations/events', icon: <Zap />, cap: 'view_incidents' },
    { label: 'Incidents', to: '/operations/incidents', icon: <Siren />, cap: 'view_incidents' },
    { label: 'Tickets', to: '/operations/tickets', icon: <Ticket /> },
    { label: 'Remediation center', to: '/operations/remediation', icon: <Hammer />, cap: 'view_findings' },
    { label: 'Verification', to: '/operations/verification', icon: <BadgeCheck />, cap: 'view_findings' },
    { label: 'Workflows', to: '/operations/workflows', icon: <Workflow />, cap: 'view_findings' },
  ] },
  { label: 'Third-party risk', cap: 'view_vendor_risk', items: [
    { label: 'Vendor overview', to: '/tprm', icon: <Building2 />, end: true },
    { label: 'Vendor inventory', to: '/tprm/vendors', icon: <Users /> },
    { label: 'Assessments', to: '/tprm/assessments', icon: <ClipboardList /> },
    { label: 'Due diligence', to: '/tprm/due-diligence', icon: <FileSearch /> },
    { label: 'Monitoring', to: '/tprm/monitoring', icon: <Activity /> },
    { label: 'Contracts', to: '/tprm/contracts', icon: <FileSignature /> },
    { label: 'Vendor remediation', to: '/tprm/remediation', icon: <Wrench /> },
    { label: 'Offboarding', to: '/tprm/offboarding', icon: <LogOut /> },
  ] },
  { label: 'AI security', cap: 'view_ai_governance', items: [
    { label: 'AI overview', to: '/ai-security', icon: <Bot />, end: true },
    { label: 'AI inventory', to: '/ai-security/inventory', icon: <Boxes /> },
    { label: 'Shadow AI', to: '/ai-security/shadow-ai', icon: <EyeOff /> },
    { label: 'Configuration risks', to: '/ai-security/config-risks', icon: <Settings2 /> },
    { label: 'AI assessments', to: '/ai-security/assessments', icon: <ClipboardCheck /> },
    { label: 'Governance', to: '/ai-security/governance', icon: <Scale /> },
  ] },
  { label: 'Risk quantification', cap: 'view_financial_risk', items: [
    { label: 'Risk overview', to: '/crq', icon: <Calculator />, end: true },
    { label: 'Risk scenarios', to: '/crq/scenarios', icon: <Layers /> },
    { label: 'Financial impact', to: '/crq/financial-impact', icon: <DollarSign /> },
    { label: 'Control effectiveness', to: '/crq/controls', icon: <Gauge /> },
    { label: 'Investment analysis', to: '/crq/investments', icon: <PiggyBank /> },
    { label: 'Risk report', to: '/crq/report', icon: <FileText /> },
  ] },
  { label: 'Intelligence', cap: 'view_findings', items: [
    { label: 'Intelligence assistant', to: '/intelligence', icon: <Sparkles />, end: true },
    { label: 'Threat intelligence', to: '/intelligence/threats', icon: <Globe /> },
    { label: 'Investigation assistant', to: '/intelligence/investigation', icon: <Microscope /> },
    { label: 'Agents', to: '/intelligence/agents', icon: <Cpu /> },
  ] },
]

/** Main navigation for a person: their job's destinations, filtered to what they may open. */
export function mainNavFor(user: User | undefined): NavItem[] {
  return FULL_NAV.map((k) => NAV_ITEMS[k]).filter((i) => !i.cap || can(user, i.cap))
}

/** Security-workspace groups for a person: job-focused groups first, other permitted groups under "More tools". */
export function securityNavFor(user: User | undefined): { focus: NavGroup[]; more: NavGroup[] } {
  const allowed = SECURITY_NAV.filter((g) => !g.cap || can(user, g.cap))
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.cap || can(user, i.cap)) }))
    .filter((g) => g.items.length)
  const job = JOB_INFO[jobOf(user)]
  if (job.nav === null) return { focus: allowed, more: [] }
  const focus = job.focus.map((l) => allowed.find((g) => g.label === l)).filter((g): g is NavGroup => !!g)
  return { focus, more: allowed.filter((g) => !focus.includes(g)) }
}
