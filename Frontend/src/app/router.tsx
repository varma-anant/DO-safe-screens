import { createBrowserRouter, createHashRouter, Navigate, useLocation, useParams, useRouteError, Link } from 'react-router'
import { AppShell } from '@/layouts/AppShell'
import { SecurityLayout } from '@/layouts/SecurityLayout'
import { Button } from '@/components/ui/button'
import { AppLoading } from '@/components/common/layout'
import { RequireCap } from '@/components/common/RequireCap'

function RouteError({ forceNotFound }: { forceNotFound?: boolean }) {
  const err = useRouteError() as (Error & { status?: number }) | undefined
  const notFound = forceNotFound || err?.status === 404
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="text-4xl font-semibold text-violet-700">{notFound ? '404' : 'Error'}</div>
      <p className="mt-2 text-sm text-muted">{notFound ? 'This screen does not exist in the DO SAFE prototype.' : err?.message ?? 'Unexpected error'}</p>
      <Button asChild className="mt-5" variant="secondary">
        <Link to="/home">Back to Home</Link>
      </Button>
    </div>
  )
}

function RequestsRedirect() {
  return <Navigate to={`/admin/requests${useLocation().search}`} replace />
}

function ServiceRedirect() {
  return <Navigate to={`/applications/${useParams().id}`} replace />
}

type Loader = () => Promise<object>
const page = (load: Loader, name: string) => ({ lazy: async () => ({ Component: (await load() as Record<string, React.ComponentType>)[name] }) })

const dash = () => import('@/modules/dashboard')
const ctem = () => import('@/modules/ctem')
const finding = () => import('@/modules/findings')
const ops = () => import('@/modules/operations')
const tprm = () => import('@/modules/tprm')
const crq = () => import('@/modules/crq')
const ai = () => import('@/modules/ai')
const intel = () => import('@/modules/intelligence')
const integ = () => import('@/modules/integrations')
const platform = () => import('@/modules/platform')
const auth = () => import('@/modules/auth')
const home = () => import('@/modules/enterprise')
const apps = () => import('@/modules/applications')
const onboarding = () => import('@/modules/onboarding')
const requests = () => import('@/modules/requests')
const admin = () => import('@/modules/admin')
const support = () => import('@/modules/support')

// A standalone single-HTML build is opened from file:// and therefore cannot rely on
// a web server to resolve paths such as /applications/123. Hash routing preserves the
// exact same route tree and behavior while making every screen portable in one file.
const createAppRouter = window.location.protocol === 'file:' ? createHashRouter : createBrowserRouter

export const router = createAppRouter([
  { path: '/login', ...page(auth, 'LoginPage'), errorElement: <RouteError />, hydrateFallbackElement: <AppLoading /> },
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <AppLoading />,
    children: [
      { errorElement: <RouteError />, children: [
        { index: true, element: <Navigate to="/home" replace /> },
        { path: 'home', ...page(home, 'HomePage') },
        { element: <RequireCap cap="view_financial_risk" area="The executive dashboard" />, children: [{ path: 'dashboard', ...page(dash, 'ExecutiveDashboard') }] },
        { path: 'requests', element: <RequestsRedirect /> },
        { path: 'help', ...page(home, 'HelpPage') },
        { path: 'applications', ...page(apps, 'ApplicationsPage') },
        { path: 'applications/:id', ...page(apps, 'ApplicationDetail') },
        { path: 'mapping', ...page(apps, 'MappingPage') },
        { path: 'projects', ...page(apps, 'ProjectsPage') },
        { path: 'projects/:id', ...page(home, 'ProjectWorkspace'), children: [
          { index: true, ...page(apps, 'ProjectDetail') },
          { path: 'mapping', ...page(apps, 'MappingPage') },
          { path: 'applications', ...page(apps, 'ApplicationsPage') },
          { path: 'applications/:appId', ...page(apps, 'ApplicationDetail') },
          { path: 'tickets/:ticketId', ...page(ops, 'TicketDetail') },
          { path: 'tickets', ...page(ops, 'TicketsPage') },
        ] },
        { path: 'onboarding', ...page(onboarding, 'OnboardingPage') },
        { path: 'services', element: <Navigate to="/applications" replace /> },
        { path: 'services/:id', element: <ServiceRedirect /> },
        { path: 'support', ...page(support, 'SupportPage') },
        { path: 'knowledge', ...page(support, 'KnowledgePage') },
        {
          path: 'admin',
          ...page(admin, 'AdminLayout'),
          children: [
            { index: true, element: <Navigate to="people" replace /> },
            { path: 'requests', ...page(requests, 'RequestsPage') },
            { path: 'people', ...page(admin, 'PeoplePage') },
            { path: 'invitations', ...page(admin, 'InvitationsPage') },
            { path: 'roles', ...page(admin, 'RolesPage') },
            { path: 'project-access', ...page(admin, 'ProjectAccessPage') },
            { path: 'inspector', ...page(admin, 'InspectorPage') },
            { path: 'audit', ...page(admin, 'AdminAuditPage') },
            { path: 'identity', ...page(admin, 'IdentityPage') },
          ],
        },

        { element: <SecurityLayout />, children: [
        { element: <RequireCap cap="view_findings" area="Security problems" />, children: [
        { path: 'analytics', ...page(dash, 'RiskAnalytics') },
        { path: 'exposures', ...page(ctem, 'ExposureInventory') },
        { path: 'exposures/assets', ...page(ctem, 'AssetsPage') },
        { path: 'exposures/assets/:id', ...page(ctem, 'AssetDetail') },
        { path: 'exposures/vulnerabilities', ...page(ctem, 'VulnerabilitiesPage') },
        { path: 'exposures/vulnerabilities/:id', ...page(finding, 'FindingDetailPage') },
        { path: 'exposures/attack-paths', ...page(ctem, 'AttackPathsPage') },
        { path: 'exposures/attack-paths/:id', ...page(ctem, 'AttackPathDetail') },
        { path: 'exposures/prioritization', ...page(ctem, 'PrioritizationPage') },
        { path: 'exposures/validation', ...page(ctem, 'ValidationPage') },
        ] },

        { element: <RequireCap cap="view_findings" area="Security problems" />, children: [
        { path: 'operations/findings', ...page(ops, 'FindingsPage') },
        { path: 'operations/findings/:id', ...page(finding, 'FindingDetailPage') },
        { path: 'operations/remediation', ...page(ops, 'RemediationCenter') },
        { path: 'operations/verification', ...page(ops, 'VerificationPage') },
        { path: 'operations/workflows', ...page(ops, 'WorkflowCenter') },
        ] },
        { element: <RequireCap cap="view_incidents" area="Incidents & events" />, children: [
        { path: 'operations/events', ...page(ops, 'EventsPage') },
        { path: 'operations/incidents', ...page(ops, 'IncidentsPage') },
        { path: 'operations/incidents/:id', ...page(ops, 'IncidentDetail') },
        ] },

        { path: 'operations/approvals', ...page(ops, 'ApprovalsPage') },

        { element: <RequireCap cap="view_vendor_risk" area="Vendor risk" />, children: [
        { path: 'tprm', ...page(tprm, 'VendorOverview') },
        { path: 'tprm/vendors', ...page(tprm, 'VendorInventory') },
        { path: 'tprm/vendors/:id', ...page(tprm, 'VendorDetail') },
        { path: 'tprm/assessments', ...page(tprm, 'AssessmentsPage') },
        { path: 'tprm/assessments/:id', ...page(tprm, 'AssessmentDetail') },
        { path: 'tprm/due-diligence', ...page(tprm, 'DueDiligencePage') },
        { path: 'tprm/monitoring', ...page(tprm, 'MonitoringPage') },
        { path: 'tprm/contracts', ...page(tprm, 'ContractsPage') },
        { path: 'tprm/remediation', ...page(tprm, 'VendorRemediationPage') },
        { path: 'tprm/offboarding', ...page(tprm, 'OffboardingPage') },
        ] },

        { element: <RequireCap cap="view_financial_risk" area="Financial risk" />, children: [
        { path: 'crq', ...page(crq, 'RiskOverview') },
        { path: 'crq/scenarios', ...page(crq, 'ScenariosPage') },
        { path: 'crq/scenarios/:id', ...page(crq, 'ScenarioDetail') },
        { path: 'crq/financial-impact', ...page(crq, 'FinancialImpact') },
        { path: 'crq/controls', ...page(crq, 'ControlsPage') },
        { path: 'crq/investments', ...page(crq, 'InvestmentsPage') },
        { path: 'crq/report', ...page(crq, 'RiskReport') },
        ] },

        { element: <RequireCap cap="view_ai_governance" area="AI security" />, children: [
        { path: 'ai-security', ...page(ai, 'AIOverview') },
        { path: 'ai-security/inventory', ...page(ai, 'AIInventory') },
        { path: 'ai-security/systems/:id', ...page(ai, 'AISystemDetail') },
        { path: 'ai-security/shadow-ai', ...page(ai, 'ShadowAIPage') },
        { path: 'ai-security/config-risks', ...page(ai, 'ConfigRisksPage') },
        { path: 'ai-security/assessments', ...page(ai, 'AIAssessmentsPage') },
        { path: 'ai-security/governance', ...page(ai, 'GovernancePage') },
        { path: 'ai-security/governance/:id', ...page(ai, 'GovernanceDetail') },
        { path: 'ai-security/findings/:id', ...page(finding, 'FindingDetailPage') },
        ] },

        { element: <RequireCap cap="view_findings" area="Security intelligence" />, children: [
        { path: 'intelligence', ...page(intel, 'AssistantPage') },
        { path: 'intelligence/library', ...page(intel, 'LibraryPage') },
        { path: 'intelligence/library/:id', ...page(intel, 'KnowledgeDetail') },
        { path: 'intelligence/threats', ...page(intel, 'ThreatIntelPage') },
        { path: 'intelligence/investigation', ...page(intel, 'InvestigationPage') },
        { path: 'intelligence/agents', ...page(intel, 'AgentsPage') },
        { path: 'intelligence/agents/:id', ...page(intel, 'AgentDetail') },
        ] },

        ] },

        { element: <RequireCap cap="manage_integrations" area="Integrations" />, children: [
        { path: 'integrations', ...page(integ, 'MarketplacePage') },
        { path: 'integrations/connected', ...page(integ, 'ConnectedPage') },
        { path: 'integrations/pipelines', ...page(integ, 'PipelinesPage') },
        { path: 'integrations/monitoring', ...page(integ, 'IngestionMonitoringPage') },
        { path: 'integrations/:id', ...page(integ, 'IntegrationDetail') },

        ] },

        { path: 'operations/tickets', ...page(ops, 'TicketsPage') },
        { path: 'operations/tickets/:id', ...page(ops, 'TicketDetail') },
        { path: 'platform/audit', ...page(platform, 'AuditPage') },
        { path: 'platform/notifications', ...page(platform, 'NotificationsPage') },
        { path: 'platform/settings', ...page(home, 'EnterpriseSettings') },
        { path: 'platform/settings/:section', ...page(home, 'EnterpriseSettings') },
        { path: '*', element: <RouteError forceNotFound /> },
      ] },
    ],
  },
])
