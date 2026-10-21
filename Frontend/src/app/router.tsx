import { createBrowserRouter, Navigate, useParams, useRouteError, Link } from 'react-router'
import { AppShell } from '@/layouts/AppShell'
import { SecurityLayout } from '@/layouts/SecurityLayout'
import { Button } from '@/components/ui/button'
import { AppLoading } from '@/components/common/layout'

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
const home = () => import('@/modules/home')
const apps = () => import('@/modules/applications')
const onboarding = () => import('@/modules/onboarding')
const requests = () => import('@/modules/requests')
const admin = () => import('@/modules/admin')
const support = () => import('@/modules/support')

export const router = createBrowserRouter([
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
        { path: 'dashboard', ...page(dash, 'ExecutiveDashboard') },
        { path: 'requests', ...page(requests, 'RequestsPage') },
        { path: 'applications', ...page(apps, 'ApplicationsPage') },
        { path: 'applications/:id', ...page(apps, 'ApplicationDetail') },
        { path: 'mapping', ...page(apps, 'MappingPage') },
        { path: 'projects', ...page(apps, 'ProjectsPage') },
        { path: 'projects/:id', ...page(apps, 'ProjectDetail') },
        { path: 'onboarding', ...page(onboarding, 'OnboardingPage') },
        { path: 'services', element: <Navigate to="/applications" replace /> },
        { path: 'services/:id', element: <ServiceRedirect /> },
        { path: 'support', ...page(support, 'SupportPage') },
        { path: 'knowledge', ...page(support, 'KnowledgePage') },
        {
          path: 'admin',
          ...page(admin, 'AdminLayout'),
          children: [
            { index: true, ...page(admin, 'AdminOverview') },
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

        { path: 'operations/findings', ...page(ops, 'FindingsPage') },
        { path: 'operations/findings/:id', ...page(finding, 'FindingDetailPage') },
        { path: 'operations/events', ...page(ops, 'EventsPage') },
        { path: 'operations/incidents', ...page(ops, 'IncidentsPage') },
        { path: 'operations/incidents/:id', ...page(ops, 'IncidentDetail') },
        { path: 'operations/tickets', ...page(ops, 'TicketsPage') },
        { path: 'operations/tickets/:id', ...page(ops, 'TicketDetail') },
        { path: 'operations/remediation', ...page(ops, 'RemediationCenter') },
        { path: 'operations/verification', ...page(ops, 'VerificationPage') },
        { path: 'operations/approvals', ...page(ops, 'ApprovalsPage') },
        { path: 'operations/workflows', ...page(ops, 'WorkflowCenter') },

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

        { path: 'crq', ...page(crq, 'RiskOverview') },
        { path: 'crq/scenarios', ...page(crq, 'ScenariosPage') },
        { path: 'crq/scenarios/:id', ...page(crq, 'ScenarioDetail') },
        { path: 'crq/financial-impact', ...page(crq, 'FinancialImpact') },
        { path: 'crq/controls', ...page(crq, 'ControlsPage') },
        { path: 'crq/investments', ...page(crq, 'InvestmentsPage') },
        { path: 'crq/report', ...page(crq, 'RiskReport') },

        { path: 'ai-security', ...page(ai, 'AIOverview') },
        { path: 'ai-security/inventory', ...page(ai, 'AIInventory') },
        { path: 'ai-security/systems/:id', ...page(ai, 'AISystemDetail') },
        { path: 'ai-security/shadow-ai', ...page(ai, 'ShadowAIPage') },
        { path: 'ai-security/config-risks', ...page(ai, 'ConfigRisksPage') },
        { path: 'ai-security/assessments', ...page(ai, 'AIAssessmentsPage') },
        { path: 'ai-security/governance', ...page(ai, 'GovernancePage') },
        { path: 'ai-security/governance/:id', ...page(ai, 'GovernanceDetail') },
        { path: 'ai-security/findings/:id', ...page(finding, 'FindingDetailPage') },

        { path: 'intelligence', ...page(intel, 'AssistantPage') },
        { path: 'intelligence/library', ...page(intel, 'LibraryPage') },
        { path: 'intelligence/library/:id', ...page(intel, 'KnowledgeDetail') },
        { path: 'intelligence/threats', ...page(intel, 'ThreatIntelPage') },
        { path: 'intelligence/investigation', ...page(intel, 'InvestigationPage') },
        { path: 'intelligence/agents', ...page(intel, 'AgentsPage') },
        { path: 'intelligence/agents/:id', ...page(intel, 'AgentDetail') },

        ] },

        { path: 'integrations', ...page(integ, 'MarketplacePage') },
        { path: 'integrations/connected', ...page(integ, 'ConnectedPage') },
        { path: 'integrations/pipelines', ...page(integ, 'PipelinesPage') },
        { path: 'integrations/monitoring', ...page(integ, 'IngestionMonitoringPage') },
        { path: 'integrations/:id', ...page(integ, 'IntegrationDetail') },

        { path: 'platform/audit', ...page(platform, 'AuditPage') },
        { path: 'platform/notifications', ...page(platform, 'NotificationsPage') },
        { path: 'platform/settings', ...page(platform, 'SettingsPage') },
        { path: '*', element: <RouteError forceNotFound /> },
      ] },
    ],
  },
])
