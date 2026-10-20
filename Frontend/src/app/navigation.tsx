import {
  LayoutDashboard, LineChart, Briefcase, Radar, Server, Bug, Route, ListOrdered, ShieldCheck, Building2, Users, ClipboardList, FileSearch, Activity, FileSignature, Wrench, LogOut,
  Calculator, Layers, DollarSign, Gauge, PiggyBank, FileText, Bot, Boxes, EyeOff, Settings2, ClipboardCheck, Scale, Sparkles, BookOpen, Globe, Microscope, Cpu, FileWarning, Zap,
  Siren, Ticket, Hammer, BadgeCheck, CheckCheck, Workflow, Store, Plug, GitMerge, MonitorDot, ScrollText, Bell, Settings,
} from 'lucide-react'
import type { ReactNode } from 'react'

export interface NavItem {
  label: string
  to: string
  icon: ReactNode
  end?: boolean
}
export interface NavGroup {
  label: string
  module: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  { label: 'Overview', module: '', items: [
    { label: 'Executive Dashboard', to: '/dashboard', icon: <LayoutDashboard /> },
    { label: 'Risk Analytics', to: '/analytics', icon: <LineChart /> },
    { label: 'Business Services', to: '/services', icon: <Briefcase /> },
  ] },
  { label: 'Exposure Management', module: 'CTEM', items: [
    { label: 'Exposure Inventory', to: '/exposures', icon: <Radar />, end: true },
    { label: 'Assets', to: '/exposures/assets', icon: <Server /> },
    { label: 'Vulnerabilities', to: '/exposures/vulnerabilities', icon: <Bug /> },
    { label: 'Attack Paths', to: '/exposures/attack-paths', icon: <Route /> },
    { label: 'Prioritization', to: '/exposures/prioritization', icon: <ListOrdered /> },
    { label: 'Validation', to: '/exposures/validation', icon: <ShieldCheck /> },
  ] },
  { label: 'Third-Party Risk', module: 'TPRM', items: [
    { label: 'Vendor Overview', to: '/tprm', icon: <Building2 />, end: true },
    { label: 'Vendor Inventory', to: '/tprm/vendors', icon: <Users /> },
    { label: 'Assessments', to: '/tprm/assessments', icon: <ClipboardList /> },
    { label: 'Due Diligence', to: '/tprm/due-diligence', icon: <FileSearch /> },
    { label: 'Continuous Monitoring', to: '/tprm/monitoring', icon: <Activity /> },
    { label: 'Contracts', to: '/tprm/contracts', icon: <FileSignature /> },
    { label: 'Remediation', to: '/tprm/remediation', icon: <Wrench /> },
    { label: 'Offboarding', to: '/tprm/offboarding', icon: <LogOut /> },
  ] },
  { label: 'Risk Quantification', module: 'CRQ', items: [
    { label: 'Risk Overview', to: '/crq', icon: <Calculator />, end: true },
    { label: 'Risk Scenarios', to: '/crq/scenarios', icon: <Layers /> },
    { label: 'Financial Impact', to: '/crq/financial-impact', icon: <DollarSign /> },
    { label: 'Control Effectiveness', to: '/crq/controls', icon: <Gauge /> },
    { label: 'Investment Analysis', to: '/crq/investments', icon: <PiggyBank /> },
    { label: 'Risk Report', to: '/crq/report', icon: <FileText /> },
  ] },
  { label: 'AI Security', module: 'AI-SPM', items: [
    { label: 'AI Security Overview', to: '/ai-security', icon: <Bot />, end: true },
    { label: 'AI Inventory', to: '/ai-security/inventory', icon: <Boxes /> },
    { label: 'Shadow AI', to: '/ai-security/shadow-ai', icon: <EyeOff /> },
    { label: 'Configuration Risks', to: '/ai-security/config-risks', icon: <Settings2 /> },
    { label: 'AI Risk Assessments', to: '/ai-security/assessments', icon: <ClipboardCheck /> },
    { label: 'Governance', to: '/ai-security/governance', icon: <Scale /> },
  ] },
  { label: 'Security Intelligence', module: '', items: [
    { label: 'Intelligence Assistant', to: '/intelligence', icon: <Sparkles />, end: true },
    { label: 'Knowledge Library', to: '/intelligence/library', icon: <BookOpen /> },
    { label: 'Threat Intelligence', to: '/intelligence/threats', icon: <Globe /> },
    { label: 'Investigation Assistant', to: '/intelligence/investigation', icon: <Microscope /> },
    { label: 'Specialized Agents', to: '/intelligence/agents', icon: <Cpu /> },
  ] },
  { label: 'Security Operations', module: '', items: [
    { label: 'Security Findings', to: '/operations/findings', icon: <FileWarning /> },
    { label: 'Events', to: '/operations/events', icon: <Zap /> },
    { label: 'Incidents', to: '/operations/incidents', icon: <Siren /> },
    { label: 'Tickets', to: '/operations/tickets', icon: <Ticket /> },
    { label: 'Remediation Center', to: '/operations/remediation', icon: <Hammer /> },
    { label: 'Verification', to: '/operations/verification', icon: <BadgeCheck /> },
    { label: 'Approvals', to: '/operations/approvals', icon: <CheckCheck /> },
    { label: 'Workflow Center', to: '/operations/workflows', icon: <Workflow /> },
  ] },
  { label: 'Integrations', module: '', items: [
    { label: 'Integration Marketplace', to: '/integrations', icon: <Store />, end: true },
    { label: 'Connected Sources', to: '/integrations/connected', icon: <Plug /> },
    { label: 'Data Pipelines', to: '/integrations/pipelines', icon: <GitMerge /> },
    { label: 'Ingestion Monitoring', to: '/integrations/monitoring', icon: <MonitorDot /> },
  ] },
  { label: 'Platform', module: '', items: [
    { label: 'Audit Logs', to: '/platform/audit', icon: <ScrollText /> },
    { label: 'Notifications', to: '/platform/notifications', icon: <Bell /> },
    { label: 'Settings', to: '/platform/settings', icon: <Settings /> },
  ] },
]
