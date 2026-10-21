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
}

/** Main sidebar — the enterprise workspace (mirrors the DO product family layout). */
export const MAIN_NAV: NavItem[] = [
  { label: 'Home', to: '/home', icon: <Home /> },
  { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard /> },
  { label: 'Requests', to: '/requests', icon: <Inbox />, badge: 'requests' },
  { label: 'SAFE applications', to: '/applications', icon: <ShieldCheck />, badge: 'applications' },
  { label: 'Asset mapping', to: '/mapping', icon: <Waypoints /> },
  { label: 'Ticket management', to: '/operations/tickets', icon: <Ticket /> },
  { label: 'Prioritization', to: '/exposures/prioritization', icon: <ListOrdered /> },
  { label: 'Notifications', to: '/platform/notifications', icon: <Bell />, badge: 'notifications' },
  { label: 'User management', to: '/admin', icon: <Users />, cap: 'manage_users' },
]

export const FOOTER_NAV: NavItem[] = [
  { label: 'Integrations', to: '/integrations', icon: <Plug />, cap: 'manage_integrations' },
  { label: 'Knowledge base', to: '/knowledge', icon: <BookOpen /> },
  { label: 'Help & Support', to: '/support', icon: <LifeBuoy /> },
  { label: 'Settings', to: '/platform/settings', icon: <Settings /> },
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
    { label: 'Prioritization', to: '/exposures/prioritization', icon: <ListOrdered /> },
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
