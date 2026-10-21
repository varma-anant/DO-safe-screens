import {
  Home, LayoutDashboard, Inbox, ShieldCheck, Waypoints, Ticket, ListOrdered, Bell, Users, Plug, BookOpen, LifeBuoy, Settings,
  Radar, Server, Bug, Route, BadgeCheck, FileWarning, Zap, Siren, Hammer, Workflow, Building2, ClipboardList, FileSearch, Activity, FileSignature, Wrench, LogOut,
  Bot, Boxes, EyeOff, Settings2, ClipboardCheck, Scale, Calculator, Layers, DollarSign, Gauge, PiggyBank, FileText, Sparkles, Globe, Microscope, Cpu, LineChart, FolderKanban, AppWindow,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { Capability } from '@/utils/permissions'

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

/** Main sidebar — the enterprise workspace (mirrors the DO product family layout). */
export const MAIN_NAV: NavItem[] = [
  { label: 'Home', to: '/home', icon: <Home />, hint: 'Am I protected, is anything urgent, and what to do next' },
  { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard />, hint: 'Charts and trends for security specialists and leadership' },
  { label: 'Requests', to: '/requests', icon: <Inbox />, badge: 'requests', hint: 'Access requests and approvals waiting for a decision' },
  { label: 'SAFE applications', to: '/applications', icon: <ShieldCheck />, badge: 'applications', hint: 'Applications DO SAFE protects, and ones being set up' },
  { label: 'Asset mapping', to: '/mapping', icon: <Waypoints />, hint: 'How the parts of each application connect' },
  { label: 'Ticket management', to: '/operations/tickets', icon: <Ticket />, hint: 'Fix-it tasks, who owns them and when they’re due' },
  { label: 'Prioritization', to: '/exposures/prioritization', icon: <ListOrdered />, hint: 'Every problem in the order you should fix it' },
  { label: 'Notifications', to: '/platform/notifications', icon: <Bell />, badge: 'notifications', hint: 'Alerts and updates for you' },
  { label: 'User management', to: '/admin', icon: <Users />, cap: 'manage_users', hint: 'People, roles and who can see which projects' },
]

export const FOOTER_NAV: NavItem[] = [
  { label: 'Integrations', to: '/integrations', icon: <Plug />, cap: 'manage_integrations', hint: 'Security tools connected to DO SAFE' },
  { label: 'Knowledge base', to: '/knowledge', icon: <BookOpen />, hint: 'Step-by-step guides and a jargon-free glossary' },
  { label: 'Help & Support', to: '/support', icon: <LifeBuoy />, hint: 'Ask a person for help' },
  { label: 'Settings', to: '/platform/settings', icon: <Settings />, hint: 'Your profile, access and preferences' },
]

export interface NavGroup {
  label: string
  items: NavItem[]
}

/** Security workspace navigation shown inside a project (or across all projects). */
export const SECURITY_NAV: NavGroup[] = [
  { label: 'Project', items: [
    { label: 'Project overview', to: '/projects', icon: <FolderKanban /> },
    { label: 'Applications', to: '/applications', icon: <AppWindow /> },
    { label: 'Assets', to: '/exposures/assets', icon: <Server /> },
    { label: 'Risk analytics', to: '/analytics', icon: <LineChart /> },
  ] },
  { label: 'Exposure management', items: [
    { label: 'Exposure inventory', to: '/exposures', icon: <Radar />, end: true },
    { label: 'Vulnerabilities', to: '/exposures/vulnerabilities', icon: <Bug /> },
    { label: 'Attack paths', to: '/exposures/attack-paths', icon: <Route /> },
    { label: 'Validation', to: '/exposures/validation', icon: <ShieldCheck /> },
    { label: 'Prioritization', to: '/exposures/prioritization', icon: <ListOrdered />, hint: 'Every problem in the order you should fix it' },
  ] },
  { label: 'Security operations', items: [
    { label: 'Security findings', to: '/operations/findings', icon: <FileWarning /> },
    { label: 'Events', to: '/operations/events', icon: <Zap /> },
    { label: 'Incidents', to: '/operations/incidents', icon: <Siren /> },
    { label: 'Tickets', to: '/operations/tickets', icon: <Ticket /> },
    { label: 'Remediation center', to: '/operations/remediation', icon: <Hammer /> },
    { label: 'Verification', to: '/operations/verification', icon: <BadgeCheck /> },
    { label: 'Workflows', to: '/operations/workflows', icon: <Workflow /> },
  ] },
  { label: 'Third-party risk', items: [
    { label: 'Vendor overview', to: '/tprm', icon: <Building2 />, end: true },
    { label: 'Vendor inventory', to: '/tprm/vendors', icon: <Users /> },
    { label: 'Assessments', to: '/tprm/assessments', icon: <ClipboardList /> },
    { label: 'Due diligence', to: '/tprm/due-diligence', icon: <FileSearch /> },
    { label: 'Monitoring', to: '/tprm/monitoring', icon: <Activity /> },
    { label: 'Contracts', to: '/tprm/contracts', icon: <FileSignature /> },
    { label: 'Vendor remediation', to: '/tprm/remediation', icon: <Wrench /> },
    { label: 'Offboarding', to: '/tprm/offboarding', icon: <LogOut /> },
  ] },
  { label: 'AI security', items: [
    { label: 'AI overview', to: '/ai-security', icon: <Bot />, end: true },
    { label: 'AI inventory', to: '/ai-security/inventory', icon: <Boxes /> },
    { label: 'Shadow AI', to: '/ai-security/shadow-ai', icon: <EyeOff /> },
    { label: 'Configuration risks', to: '/ai-security/config-risks', icon: <Settings2 /> },
    { label: 'AI assessments', to: '/ai-security/assessments', icon: <ClipboardCheck /> },
    { label: 'Governance', to: '/ai-security/governance', icon: <Scale /> },
  ] },
  { label: 'Risk quantification', items: [
    { label: 'Risk overview', to: '/crq', icon: <Calculator />, end: true },
    { label: 'Risk scenarios', to: '/crq/scenarios', icon: <Layers /> },
    { label: 'Financial impact', to: '/crq/financial-impact', icon: <DollarSign /> },
    { label: 'Control effectiveness', to: '/crq/controls', icon: <Gauge /> },
    { label: 'Investment analysis', to: '/crq/investments', icon: <PiggyBank /> },
    { label: 'Risk report', to: '/crq/report', icon: <FileText /> },
  ] },
  { label: 'Intelligence', items: [
    { label: 'Intelligence assistant', to: '/intelligence', icon: <Sparkles />, end: true },
    { label: 'Threat intelligence', to: '/intelligence/threats', icon: <Globe /> },
    { label: 'Investigation assistant', to: '/intelligence/investigation', icon: <Microscope /> },
    { label: 'Agents', to: '/intelligence/agents', icon: <Cpu /> },
  ] },
]
