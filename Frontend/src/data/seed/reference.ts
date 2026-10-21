import type { BusinessService, Integration, User } from '@/types'

export type ServiceSeed = Pick<BusinessService, 'id' | 'name' | 'description' | 'criticality' | 'ownerId' | 'revenueDependency' | 'dataClassification' | 'regulatoryScope' | 'rtoHours'>

// Fictional people at the fictional "Northstar Financial Services". Email domain is a reserved example domain.
export const USERS: User[] = [
  { id: 'USR-001', name: 'Elena Marsh', role: 'CISO', team: 'Office of the CISO', email: 'elena.marsh@northstar.example', initials: 'EM' , orgRole: 'admin', status: 'active', mfaEnabled: true },
  { id: 'USR-002', name: 'Priya Raman', role: 'Security Analyst', team: 'Vulnerability Management', email: 'priya.raman@northstar.example', initials: 'PR' , orgRole: 'analyst', status: 'active', mfaEnabled: true, demoLogin: true },
  { id: 'USR-003', name: 'Marcus Chen', role: 'TPRM Manager', team: 'Third-Party Risk', email: 'marcus.chen@northstar.example', initials: 'MC' , orgRole: 'analyst', status: 'active', mfaEnabled: true },
  { id: 'USR-004', name: 'Sofia Alvarez', role: 'AI Security Analyst', team: 'AI Governance', email: 'sofia.alvarez@northstar.example', initials: 'SA' , orgRole: 'analyst', status: 'active', mfaEnabled: true },
  { id: 'USR-005', name: 'David Okafor', role: 'Risk Manager', team: 'Enterprise Risk', email: 'david.okafor@northstar.example', initials: 'DO' , orgRole: 'analyst', status: 'active', mfaEnabled: true },
  { id: 'USR-006', name: 'Hannah Lee', role: 'Platform Administrator', team: 'Security Engineering', email: 'hannah.lee@northstar.example', initials: 'HL' , orgRole: 'admin', status: 'active', mfaEnabled: true, demoLogin: true },
  { id: 'USR-007', name: 'Tomás Ribeiro', role: 'Vulnerability Manager', team: 'Vulnerability Management', email: 'tomas.ribeiro@northstar.example', initials: 'TR' , orgRole: 'analyst', status: 'active', mfaEnabled: true },
  { id: 'USR-008', name: 'Aisha Bello', role: 'Incident Responder', team: 'Security Operations Center', email: 'aisha.bello@northstar.example', initials: 'AB' , orgRole: 'analyst', status: 'active', mfaEnabled: true },
  { id: 'USR-009', name: 'Jonas Weber', role: 'Engineering Owner', team: 'Payments Platform', email: 'jonas.weber@northstar.example', initials: 'JW' , orgRole: 'project_owner', status: 'active', mfaEnabled: true, demoLogin: true },
  { id: 'USR-010', name: 'Mei Tanaka', role: 'Engineering Owner', team: 'Identity Engineering', email: 'mei.tanaka@northstar.example', initials: 'MT' , orgRole: 'project_owner', status: 'active', mfaEnabled: true },
  { id: 'USR-011', name: 'Ravi Shah', role: 'Engineering Owner', team: 'Digital Channels', email: 'ravi.shah@northstar.example', initials: 'RS' , orgRole: 'viewer', status: 'active', mfaEnabled: true, demoLogin: true },
  { id: 'USR-012', name: 'Grace Kim', role: 'Engineering Owner', team: 'Data Platform', email: 'grace.kim@northstar.example', initials: 'GK' , orgRole: 'project_owner', status: 'active', mfaEnabled: true },
  { id: 'USR-013', name: 'Oliver Grant', role: 'Engineering Owner', team: 'Workplace Technology', email: 'oliver.grant@northstar.example', initials: 'OG' , orgRole: 'project_owner', status: 'active', mfaEnabled: true },
  { id: 'USR-014', name: 'Leila Haddad', role: 'Engineering Owner', team: 'Fraud Analytics', email: 'leila.haddad@northstar.example', initials: 'LH' , orgRole: 'project_owner', status: 'active', mfaEnabled: true },
  { id: 'USR-015', name: 'Noah Fischer', role: 'Engineering Owner', team: 'Customer Experience AI', email: 'noah.fischer@northstar.example', initials: 'NF' , orgRole: 'project_owner', status: 'active', mfaEnabled: true },
  { id: 'USR-016', name: 'Isabel Moreno', role: 'Incident Responder', team: 'Security Operations Center', email: 'isabel.moreno@northstar.example', initials: 'IM' , orgRole: 'analyst', status: 'active', mfaEnabled: true },
  { id: 'USR-017', name: 'Kwame Asante', role: 'Engineering Owner', team: 'Cloud Infrastructure', email: 'kwame.asante@northstar.example', initials: 'KA' , orgRole: 'project_owner', status: 'active', mfaEnabled: true },
  { id: 'USR-018', name: 'Sarah Novak', role: 'TPRM Manager', team: 'Third-Party Risk', email: 'sarah.novak@northstar.example', initials: 'SN' , orgRole: 'analyst', status: 'active', mfaEnabled: true },
]

USERS.push({ id: 'USR-019', name: 'Peter Lindqvist', role: 'Engineering Owner', team: 'Contractor (engagement ended)', email: 'peter.lindqvist@northstar.example', initials: 'PL', orgRole: 'viewer', status: 'deactivated', mfaEnabled: false })

export const SYSTEM_ACTOR = 'SYSTEM'

export const SERVICES: ServiceSeed[] = [
  {
    id: 'SVC-PAY',
    name: 'Payment Processing',
    description: 'Card authorization, clearing and settlement for retail and commercial customers.',
    criticality: 'tier-1',
    ownerId: 'USR-009',
    revenueDependency: '~38% of transaction revenue (illustrative)',
    dataClassification: 'Restricted',
    regulatoryScope: ['PCI DSS v4.0', 'SOX', 'GLBA'],
    rtoHours: 2,
  },
  {
    id: 'SVC-IDN',
    name: 'Customer Identity',
    description: 'Authentication, MFA, and session management for all customer-facing channels.',
    criticality: 'tier-1',
    ownerId: 'USR-010',
    revenueDependency: 'Gatekeeper for all digital revenue',
    dataClassification: 'Restricted',
    regulatoryScope: ['GLBA', 'FFIEC Authentication Guidance'],
    rtoHours: 1,
  },
  {
    id: 'SVC-DBK',
    name: 'Digital Banking',
    description: 'Web and mobile banking for 2.1M retail customers (fictional).',
    criticality: 'tier-1',
    ownerId: 'USR-011',
    revenueDependency: '~27% of fee revenue (illustrative)',
    dataClassification: 'Restricted',
    regulatoryScope: ['GLBA', 'PCI DSS v4.0', 'ADA / WCAG'],
    rtoHours: 4,
  },
  {
    id: 'SVC-CDP',
    name: 'Customer Data Platform',
    description: 'Unified customer profiles, analytics and marketing data pipelines.',
    criticality: 'tier-2',
    ownerId: 'USR-012',
    revenueDependency: 'Supports cross-sell and retention programs',
    dataClassification: 'Confidential',
    regulatoryScope: ['GLBA', 'CCPA/CPRA', 'GDPR'],
    rtoHours: 24,
  },
  {
    id: 'SVC-COL',
    name: 'Internal Collaboration',
    description: 'Email, chat, document management and intranet for 6,400 employees (fictional).',
    criticality: 'tier-3',
    ownerId: 'USR-013',
    revenueDependency: 'Indirect — workforce productivity',
    dataClassification: 'Internal',
    regulatoryScope: ['SEC 17a-4 (records retention)'],
    rtoHours: 12,
  },
  {
    id: 'SVC-FRD',
    name: 'Fraud Detection',
    description: 'Real-time transaction scoring and case management for fraud operations.',
    criticality: 'tier-1',
    ownerId: 'USR-014',
    revenueDependency: 'Protects ~$40M annual fraud losses avoided (illustrative)',
    dataClassification: 'Restricted',
    regulatoryScope: ['BSA/AML', 'GLBA', 'Model Risk (SR 11-7)'],
    rtoHours: 2,
  },
  {
    id: 'SVC-AIS',
    name: 'AI Customer Support',
    description: 'LLM-powered virtual agent and agent-assist for the contact center.',
    criticality: 'tier-2',
    ownerId: 'USR-015',
    revenueDependency: 'Handles ~45% of inbound support contacts (illustrative)',
    dataClassification: 'Confidential',
    regulatoryScope: ['GLBA', 'UDAAP', 'EU AI Act (limited-risk transparency)'],
    rtoHours: 8,
  },
  {
    id: 'SVC-TRS',
    name: 'Treasury Portal',
    description: 'New corporate treasury portal for commercial clients — currently being onboarded to DO SAFE.',
    criticality: 'tier-2',
    ownerId: 'USR-009',
    revenueDependency: 'Launching next quarter (commercial banking)',
    dataClassification: 'Confidential',
    regulatoryScope: ['GLBA', 'SOX'],
    rtoHours: 8,
  },
]

const hist = (base: number, n = 14) => Array.from({ length: n }, (_, i) => Math.max(0, Math.round(base * (0.75 + ((i * 37) % 11) / 20))))

// Connector names refer to real product categories / vendors only as *targets* of simulated connectors.
// No real API connection is made by this prototype. Trademarks belong to their respective owners.
export const INTEGRATIONS: Integration[] = [
  { id: 'INT-TEN', name: 'Tenable Vulnerability Management', vendor: 'Tenable', category: 'Vulnerability scanner', description: 'Network and host vulnerability scan results, plugin output and asset metadata.', capabilities: ['Vulnerability import', 'Asset import', 'Plugin evidence', 'Scan scheduling metadata'], dataTypes: ['Findings', 'Assets', 'Evidence'], status: 'connected', config: { endpoint: 'https://cloud.tenable.example/api', authMethod: 'API key pair (demo placeholder)', scope: 'All production & corporate networks', syncInterval: 'Every 6 hours' }, lastSyncAt: '', recordsIngested: 0, health: 98, syncHistory: hist(140) },
  { id: 'INT-QLY', name: 'Qualys VMDR', vendor: 'Qualys', category: 'Vulnerability scanner', description: 'Agent-based vulnerability detections for servers and endpoints.', capabilities: ['Vulnerability import', 'Asset import', 'Patch intelligence'], dataTypes: ['Findings', 'Assets'], status: 'connected', config: { endpoint: 'https://qualysapi.example/api/2.0', authMethod: 'Service account (demo placeholder)', scope: 'Data center servers', syncInterval: 'Every 12 hours' }, lastSyncAt: '', recordsIngested: 0, health: 91, syncHistory: hist(90) },
  { id: 'INT-WIZ', name: 'Wiz Cloud Security', vendor: 'Wiz', category: 'Cloud security', description: 'Cloud misconfigurations, toxic combinations and cloud asset inventory.', capabilities: ['Cloud misconfiguration import', 'Cloud asset inventory', 'Attack path context', 'Container image vulnerabilities'], dataTypes: ['Findings', 'Assets', 'Attack paths'], status: 'connected', config: { endpoint: 'https://api.wiz.example/graphql', authMethod: 'OAuth client credentials (demo placeholder)', scope: 'AWS org + Azure tenant', syncInterval: 'Hourly' }, lastSyncAt: '', recordsIngested: 0, health: 99, syncHistory: hist(210) },
  { id: 'INT-CRW', name: 'CrowdStrike Falcon', vendor: 'CrowdStrike', category: 'Endpoint (EDR)', description: 'Endpoint detections, host inventory and Spotlight vulnerability data.', capabilities: ['Detection events', 'Host inventory', 'Vulnerability import'], dataTypes: ['Events', 'Assets', 'Findings'], status: 'connected', config: { endpoint: 'https://api.crowdstrike.example', authMethod: 'OAuth2 API client (demo placeholder)', scope: 'All managed endpoints', syncInterval: 'Every 15 minutes' }, lastSyncAt: '', recordsIngested: 0, health: 96, syncHistory: hist(320) },
  { id: 'INT-OKT', name: 'Okta Workforce Identity', vendor: 'Okta', category: 'Identity', description: 'Identity posture, MFA policy, admin roles and authentication anomalies.', capabilities: ['Identity posture checks', 'Auth event import', 'App inventory (SaaS & AI discovery)'], dataTypes: ['Findings', 'Events', 'AI usage signals'], status: 'connected', config: { endpoint: 'https://northstar.okta.example', authMethod: 'Scoped API token (demo placeholder)', scope: 'Workforce tenant', syncInterval: 'Every 30 minutes' }, lastSyncAt: '', recordsIngested: 0, health: 94, syncHistory: hist(75) },
  { id: 'INT-NSK', name: 'Netskope SSE', vendor: 'Netskope', category: 'SSE / CASB', description: 'SaaS and generative-AI application usage, DLP events and shadow IT discovery.', capabilities: ['Shadow AI discovery', 'DLP events', 'App risk scoring'], dataTypes: ['AI usage signals', 'Events', 'Findings'], status: 'connected', config: { endpoint: 'https://northstar.goskope.example/api/v2', authMethod: 'REST API token (demo placeholder)', scope: 'All egress traffic via SSE', syncInterval: 'Hourly' }, lastSyncAt: '', recordsIngested: 0, health: 88, syncHistory: hist(60) },
  { id: 'INT-GHB', name: 'GitHub Advanced Security', vendor: 'GitHub', category: 'Code security', description: 'Code scanning, secret scanning and dependency (SCA) alerts.', capabilities: ['Code scanning alerts', 'Secret scanning alerts', 'Dependency alerts', 'Repository inventory'], dataTypes: ['Findings', 'Assets'], status: 'connected', config: { endpoint: 'https://api.github.example', authMethod: 'GitHub App (demo placeholder)', scope: 'northstar-fin organization', syncInterval: 'Hourly' }, lastSyncAt: '', recordsIngested: 0, health: 97, syncHistory: hist(55) },
  { id: 'INT-ASM', name: 'External Attack Surface Monitor', vendor: 'DO SAFE (built-in, simulated)', category: 'Attack surface', description: 'Outside-in discovery of internet-facing hosts, certificates and exposed services.', capabilities: ['Internet exposure discovery', 'Certificate monitoring', 'Shadow asset discovery'], dataTypes: ['Assets', 'Findings'], status: 'connected', config: { endpoint: 'internal://asm', authMethod: 'Built-in', scope: 'northstar.example and 14 registered domains (fictional)', syncInterval: 'Daily' }, lastSyncAt: '', recordsIngested: 0, health: 100, syncHistory: hist(35) },
  { id: 'INT-SPL', name: 'Splunk Enterprise Security', vendor: 'Splunk', category: 'SIEM / Logging', description: 'Notable events and correlation search results.', capabilities: ['Notable event import', 'Log evidence lookup'], dataTypes: ['Events', 'Evidence'], status: 'error', config: { endpoint: 'https://splunk.northstar.example:8089', authMethod: 'HEC token (demo placeholder)', scope: 'ES notable index', syncInterval: 'Every 5 minutes' }, lastSyncAt: '', recordsIngested: 0, health: 42, syncHistory: hist(110) },
  { id: 'INT-JRA', name: 'Jira Software', vendor: 'Atlassian', category: 'Ticketing / ITSM', description: 'Bi-directional remediation ticket sync.', capabilities: ['Create issues', 'Status sync', 'Comment sync'], dataTypes: ['Tickets'], status: 'connected', config: { endpoint: 'https://northstar.atlassian.example', authMethod: 'OAuth 2.0 (demo placeholder)', scope: 'Projects: SEC, PAY, IDN, DBK', syncInterval: 'Real-time (webhook, simulated)' }, lastSyncAt: '', recordsIngested: 0, health: 99, syncHistory: hist(25) },
  { id: 'INT-SNW', name: 'ServiceNow ITSM', vendor: 'ServiceNow', category: 'Ticketing / ITSM', description: 'Incident and change request synchronization.', capabilities: ['Create incidents', 'Change requests', 'CMDB lookup'], dataTypes: ['Tickets', 'Incidents', 'Assets'], status: 'available', recordsIngested: 0, health: 0, syncHistory: [] },
  { id: 'INT-MSD', name: 'Microsoft Defender for Cloud', vendor: 'Microsoft', category: 'Cloud security', description: 'Azure security recommendations and secure score controls.', capabilities: ['Recommendation import', 'Secure score', 'Azure asset inventory'], dataTypes: ['Findings', 'Assets'], status: 'available', recordsIngested: 0, health: 0, syncHistory: [] },
  { id: 'INT-PRS', name: 'Prisma Cloud', vendor: 'Palo Alto Networks', category: 'Cloud security', description: 'CSPM alerts and workload vulnerabilities.', capabilities: ['CSPM alerts', 'Workload vulnerabilities'], dataTypes: ['Findings', 'Assets'], status: 'available', recordsIngested: 0, health: 0, syncHistory: [] },
  { id: 'INT-RF', name: 'Recorded Future', vendor: 'Recorded Future', category: 'Threat intelligence', description: 'Vulnerability intelligence, exploitation chatter and threat actor context.', capabilities: ['CVE risk enrichment', 'Threat actor context', 'Leaked credential alerts'], dataTypes: ['Threat intel'], status: 'connected', config: { endpoint: 'https://api.recordedfuture.example', authMethod: 'API token (demo placeholder)', scope: 'Vulnerability & brand intelligence', syncInterval: 'Every 4 hours' }, lastSyncAt: '', recordsIngested: 0, health: 95, syncHistory: hist(40) },
  { id: 'INT-KEV', name: 'CISA KEV Catalog', vendor: 'CISA (public feed)', category: 'Threat intelligence', description: 'Known Exploited Vulnerabilities catalog enrichment.', capabilities: ['KEV flagging', 'Due-date context'], dataTypes: ['Threat intel'], status: 'connected', config: { endpoint: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', authMethod: 'Public feed', scope: 'Full catalog', syncInterval: 'Daily' }, lastSyncAt: '', recordsIngested: 0, health: 100, syncHistory: hist(5) },
  { id: 'INT-NVD', name: 'NVD / EPSS Enrichment', vendor: 'NIST / FIRST (public feeds)', category: 'Threat intelligence', description: 'CVE descriptions, CVSS vectors, CWE assignments and EPSS probabilities.', capabilities: ['CVE metadata', 'CVSS', 'CWE mapping', 'EPSS scores'], dataTypes: ['Threat intel', 'Knowledge'], status: 'connected', config: { endpoint: 'https://services.nvd.nist.gov/rest/json/cves/2.0', authMethod: 'Public API', scope: 'CVE records referenced by findings', syncInterval: 'Daily' }, lastSyncAt: '', recordsIngested: 0, health: 100, syncHistory: hist(12) },
  { id: 'INT-SSC', name: 'SecurityScorecard', vendor: 'SecurityScorecard', category: 'Vendor risk intelligence', description: 'Outside-in vendor security ratings and issue signals.', capabilities: ['Vendor ratings', 'Rating change alerts', 'Issue evidence'], dataTypes: ['Vendor signals'], status: 'connected', config: { endpoint: 'https://api.securityscorecard.example', authMethod: 'API token (demo placeholder)', scope: 'Portfolio: Northstar vendors', syncInterval: 'Daily' }, lastSyncAt: '', recordsIngested: 0, health: 93, syncHistory: hist(22) },
  { id: 'INT-ARC', name: 'Archer GRC', vendor: 'Archer', category: 'GRC', description: 'Control library, policy exceptions and risk register sync.', capabilities: ['Control import', 'Risk register sync', 'Exception sync'], dataTypes: ['Controls', 'Risks'], status: 'available', recordsIngested: 0, health: 0, syncHistory: [] },
  { id: 'INT-SLK', name: 'Slack', vendor: 'Salesforce', category: 'Collaboration', description: 'Notifications and approval requests to security channels.', capabilities: ['Notifications', 'Interactive approvals'], dataTypes: ['Notifications'], status: 'available', recordsIngested: 0, health: 0, syncHistory: [] },
  { id: 'INT-AWS', name: 'AWS Security Hub', vendor: 'Amazon Web Services', category: 'Cloud security', description: 'Aggregated AWS findings (GuardDuty, Inspector, Config).', capabilities: ['Finding import', 'Inspector vulnerabilities', 'GuardDuty detections'], dataTypes: ['Findings', 'Events', 'Assets'], status: 'disabled', config: { endpoint: 'arn:aws:securityhub:us-east-1 (demo)', authMethod: 'Cross-account IAM role (demo placeholder)', scope: 'Org delegated admin', syncInterval: 'Hourly' }, lastSyncAt: '', recordsIngested: 0, health: 0, syncHistory: hist(80) },
]
