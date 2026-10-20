import type { Asset, AssetType, EvidenceItem, FindingDomain, Severity } from '@/types'

export interface TemplateCtx {
  asset?: Asset
  aiName?: string
  host: string
  ip: string
  date: string
  rid: string
}

type EvidenceTemplate = Omit<EvidenceItem, 'id' | 'collectedAt' | 'sourceIntegrationId'> & { fromSource?: 'primary' | 'secondary' }

export interface FindingTemplate {
  key: string
  title: string
  domain: FindingDomain
  category: string
  severity: Severity
  cveId?: string
  cweIds: string[]
  attackIds: string[]
  owaspIds: string[]
  assetTypes?: AssetType[]
  software?: { name: string; version: string }
  exploitMaturity: 'none' | 'poc' | 'functional' | 'weaponized'
  detectionMethod: string
  sources: string[]
  description: string
  businessImpact: string
  evidence: (c: TemplateCtx) => EvidenceTemplate[]
  missingEvidence: string[]
  rootCauses: { statement: string; likelihood: 'likely' | 'possible' | 'unlikely' }[]
  configIssues: string[]
  weaknesses: string[]
  recommended: string
  steps: string[]
  vendorFix?: string
  compensating: string[]
  verification: string[]
  similar: string[]
  confidence: number
  rationale: string
  /** Relative weight when distributing findings across matching assets. */
  frequency: number
}

const scan = (label: string, content: string, reliability: 'high' | 'medium' | 'low' = 'high'): EvidenceTemplate => ({ label, kind: 'scanner-output', content, provenance: 'observed', reliability })
const cfg = (label: string, content: string): EvidenceTemplate => ({ label, kind: 'config-snapshot', content, provenance: 'observed', reliability: 'high' })
const probe = (label: string, content: string): EvidenceTemplate => ({ label, kind: 'network-probe', content, provenance: 'observed', reliability: 'medium', fromSource: 'secondary' })
const manifest = (label: string, content: string): EvidenceTemplate => ({ label, kind: 'package-manifest', content, provenance: 'observed', reliability: 'high' })
const log = (label: string, content: string, reliability: 'high' | 'medium' | 'low' = 'medium'): EvidenceTemplate => ({ label, kind: 'log-excerpt', content, provenance: 'observed', reliability, fromSource: 'secondary' })
const api = (label: string, content: string): EvidenceTemplate => ({ label, kind: 'api-response', content, provenance: 'observed', reliability: 'high' })
const traffic = (label: string, content: string): EvidenceTemplate => ({ label, kind: 'traffic-sample', content, provenance: 'observed', reliability: 'medium' })

const SERVER: AssetType[] = ['server']
const WEB: AssetType[] = ['web-application', 'api-gateway', 'server']

export const FINDING_TEMPLATES: FindingTemplate[] = [
  {
    key: 'log4shell', title: 'Apache Log4j2 JNDI remote code execution (Log4Shell)', domain: 'vulnerability', category: 'Remote code execution', severity: 'critical', cveId: 'CVE-2021-44228', cweIds: ['CWE-917', 'CWE-502', 'CWE-20'], attackIds: ['T1190', 'T1059'], owaspIds: ['A06:2021'], assetTypes: ['server', 'container', 'web-application'], software: { name: 'log4j-core', version: '2.14.1' }, exploitMaturity: 'weaponized', detectionMethod: 'Authenticated package inventory + remote check', sources: ['INT-TEN', 'INT-QLY'],
    description: 'The asset runs a Java service that bundles log4j-core 2.14.1. Versions 2.0-beta9 through 2.15.0 perform JNDI lookups on attacker-controllable strings written to logs, allowing remote class loading and code execution.',
    businessImpact: 'Unauthenticated remote code execution on a service handling regulated data could allow an attacker to pivot into the service network, exfiltrate customer records, or disrupt processing.',
    evidence: (c) => [
      manifest('Package inventory (authenticated scan)', `host: ${c.host}\npath: /opt/app/lib/log4j-core-2.14.1.jar\nsha256: 3f1c…(truncated)\nloaded_by: java -jar /opt/app/service.jar (pid 2214)`),
      scan('Scanner plugin output', `[demo-scanner] Apache Log4j < 2.15.0 Remote Code Execution\nhost=${c.ip} port=8443 proto=tcp\nresult=VULNERABLE (version check)\nrecord=${c.rid}`),
      probe('Out-of-band callback check', `Injected canary header X-Api-Version: \${jndi:dns://canary-${c.rid.slice(-6)}.oob.do-safe.example}\nDNS callback received from ${c.ip} at ${c.date}\n(simulated benign DNS-only canary — no payload executed)`),
    ],
    missingEvidence: ['Confirmation that the vulnerable logger receives user-controlled input in production traffic', 'JVM system property log4j2.formatMsgNoLookups state at runtime'],
    rootCauses: [
      { statement: 'Transitive dependency pinned by an internal shared logging library that has not been rebuilt since 2021.', likelihood: 'likely' },
      { statement: 'Base container image cached in internal registry predates the dependency update policy.', likelihood: 'possible' },
      { statement: 'Asset excluded from SCA pipeline because it is deployed from a legacy Jenkins job.', likelihood: 'possible' },
    ],
    configIssues: ['Outbound LDAP/DNS egress from application tier is not restricted'], weaknesses: ['CWE-917 Expression Language Injection', 'CWE-1104 Use of Unmaintained Third Party Components'],
    recommended: 'Upgrade log4j-core to 2.17.1 or later (Java 8) and rebuild dependent artifacts; restrict outbound LDAP/RMI/DNS from the application tier.',
    steps: ['Identify all artifacts bundling log4j-core < 2.17.1 (SBOM query)', 'Bump dependency in shared logging library and publish', 'Rebuild and redeploy affected services', 'Block outbound LDAP (389/636) and RMI (1099) at egress', 'Rescan to confirm remediated version'],
    vendorFix: 'Apache Log4j 2.17.1 (Java 8), 2.12.4 (Java 7), 2.3.2 (Java 6)', compensating: ['Remove JndiLookup class from classpath (zip -q -d log4j-core-*.jar org/apache/logging/log4j/core/lookup/JndiLookup.class)', 'WAF rule blocking ${jndi: patterns (limited — easily obfuscated)', 'Egress filtering of LDAP/RMI'],
    verification: ['Authenticated rescan shows log4j-core ≥ 2.17.1', 'OOB canary check no longer produces a callback', 'SBOM for the deployed artifact attached to ticket'],
    similar: ['FND-0907 (2024): Log4j 2.14 on reporting server — resolved by rebuilding shared logging lib v3.2', 'Internal KB: "Rebuilding legacy Jenkins artifacts" runbook'], confidence: 0.97, rationale: 'CVE matched by exact package version from authenticated inventory; CWE and ATT&CK mappings taken from NVD record and exploitation pattern (public-facing service → T1190).', frequency: 3,
  },
  {
    key: 'panos', title: 'PAN-OS GlobalProtect command injection', domain: 'vulnerability', category: 'Command injection', severity: 'critical', cveId: 'CVE-2024-3400', cweIds: ['CWE-77', 'CWE-20'], attackIds: ['T1190', 'T1133'], owaspIds: [], assetTypes: ['network-device'], software: { name: 'PAN-OS', version: '11.1.2' }, exploitMaturity: 'weaponized', detectionMethod: 'Remote banner / version fingerprint', sources: ['INT-TEN', 'INT-ASM'],
    description: 'Internet-facing firewall running PAN-OS 11.1.2 with GlobalProtect gateway enabled. CVE-2024-3400 allows unauthenticated command injection with root privileges.',
    businessImpact: 'Compromise of the perimeter firewall would give an attacker a privileged foothold with visibility into and control over traffic to tier-1 services.',
    evidence: (c) => [scan('Version fingerprint', `host=${c.host} (${c.ip})\nservice=GlobalProtect portal :443\nreported_version=PAN-OS 11.1.2\nmatched=CVE-2024-3400 (affected: 11.1 < 11.1.2-h3)`), probe('External exposure check', `GET https://${c.host}/global-protect/login.esp → 200 OK\nExposed to internet since first observation`)],
    missingEvidence: ['Device telemetry (threat ID 95187 hits) — firewall logs not yet ingested', 'Integrity check output (Palo Alto recommended CLI)'],
    rootCauses: [{ statement: 'Hotfix 11.1.2-h3 not applied because the firewall change window was deferred for quarter-end freeze.', likelihood: 'likely' }, { statement: 'Device not enrolled in automated content/OS update policy.', likelihood: 'possible' }],
    configIssues: ['GlobalProtect portal exposed to all internet sources'], weaknesses: ['CWE-77 Command Injection'],
    recommended: 'Apply PAN-OS 11.1.2-h3 or later hotfix immediately and run the vendor integrity check to detect prior compromise.',
    steps: ['Schedule emergency change', 'Upgrade to fixed hotfix', 'Run vendor-recommended integrity / compromise check', 'Rotate device credentials and certificates if indicators found'],
    vendorFix: 'PAN-OS 10.2.9-h1, 11.0.4-h1, 11.1.2-h3 and later', compensating: ['Enable Threat Prevention signature (Threat ID 95187) with vulnerability protection profile on GlobalProtect interface'], verification: ['Version fingerprint shows fixed hotfix', 'Integrity check output attached'], similar: ['FND-0712: FortiOS SSL-VPN emergency patch completed in 36h using emergency CAB process'], confidence: 0.93, rationale: 'Version fingerprint matched to vendor advisory affected range; GlobalProtect exposure confirmed externally. ATT&CK T1190/T1133 reflect exploitation of an external remote service.', frequency: 1,
  },
  {
    key: 'moveit', title: 'Progress MOVEit Transfer SQL injection', domain: 'vulnerability', category: 'Injection', severity: 'critical', cveId: 'CVE-2023-34362', cweIds: ['CWE-89'], attackIds: ['T1190', 'T1505.003'], owaspIds: ['A03:2021'], assetTypes: ['web-application'], software: { name: 'MOVEit Transfer', version: '2023.0.0' }, exploitMaturity: 'weaponized', detectionMethod: 'Authenticated web application fingerprint', sources: ['INT-TEN'],
    description: 'Managed file transfer server running a MOVEit Transfer build prior to 2023.0.1, affected by an unauthenticated SQL injection exploited at scale in 2023.',
    businessImpact: 'The MFT server exchanges settlement files with partners. Exploitation could expose bulk customer and transaction files.',
    evidence: (c) => [scan('Application fingerprint', `host=${c.host}\nproduct=MOVEit Transfer\nbuild=15.0.0 (2023.0.0)\nfixed_in=15.0.1`), log('Web log review (IOC sweep)', `No requests to /human2.aspx observed in last 30 days of logs (${c.host})`, 'medium')],
    missingEvidence: ['Database audit logs for the MOVEit DB'], rootCauses: [{ statement: 'Appliance-style deployment managed by a vendor; patch responsibility unclear in contract.', likelihood: 'likely' }], configIssues: ['MFT web interface reachable from the internet without IP allow-listing'], weaknesses: ['CWE-89 SQL Injection'],
    recommended: 'Apply the vendor patch (2023.0.1 or later) and perform IOC sweep per vendor guidance.', steps: ['Disable HTTP/HTTPS access temporarily', 'Apply patch', 'Hunt for IOCs (web shells, unexpected admin accounts)', 'Restore access with IP allow-list'], vendorFix: 'MOVEit Transfer 2023.0.1 (15.0.1) or later', compensating: ['Restrict MFT web access to partner IP ranges'], verification: ['Fingerprint shows patched build', 'IOC sweep report attached'], similar: [], confidence: 0.95, rationale: 'Exact product build fingerprint; mapping per NVD (CWE-89). Web shell technique (T1505.003) observed in public exploitation campaigns.', frequency: 1,
  },
  {
    key: 'apache-traversal', title: 'Apache HTTP Server 2.4.49 path traversal', domain: 'vulnerability', category: 'Path traversal', severity: 'high', cveId: 'CVE-2021-41773', cweIds: ['CWE-22'], attackIds: ['T1190'], owaspIds: ['A01:2021'], assetTypes: WEB, software: { name: 'Apache httpd', version: '2.4.49' }, exploitMaturity: 'weaponized', detectionMethod: 'Banner grab + safe path normalization probe', sources: ['INT-TEN', 'INT-ASM'],
    description: 'Apache HTTP Server 2.4.49 detected. A path normalization flaw allows mapping URLs to files outside configured directories; with mod_cgi enabled it can lead to RCE.',
    businessImpact: 'Could disclose application configuration files including database connection strings.',
    evidence: (c) => [scan('Banner', `Server: Apache/2.4.49 (Unix)\nhost=${c.host}:443`), probe('Safe traversal probe', `GET /icons/.%2e/.%2e/.%2e/etc/hostname → 403 Forbidden\n("Require all denied" present for / — traversal blocked by config)`)],
    missingEvidence: ['Whether mod_cgi is enabled'], rootCauses: [{ statement: 'Server image built from an outdated golden AMI.', likelihood: 'likely' }], configIssues: [], weaknesses: ['CWE-22 Path Traversal'],
    recommended: 'Upgrade Apache HTTP Server to 2.4.51 or later (2.4.50 fix was incomplete).', steps: ['Update package', 'Restart service', 'Rescan'], vendorFix: 'Apache HTTP Server 2.4.51+', compensating: ['Ensure "Require all denied" on filesystem root', 'Disable mod_cgi if unused'], verification: ['Banner shows ≥ 2.4.51'], similar: ['FND-0655: same AMI issue resolved by golden-image rebuild'], confidence: 0.86, rationale: 'Version from banner (banners can be modified — medium reliability). Probe indicates configuration may block exploitation; validation recommended.', frequency: 3,
  },
  {
    key: 'spring4shell', title: 'Spring Framework RCE via data binding (Spring4Shell)', domain: 'vulnerability', category: 'Remote code execution', severity: 'critical', cveId: 'CVE-2022-22965', cweIds: ['CWE-94'], attackIds: ['T1190'], owaspIds: ['A06:2021'], assetTypes: ['container', 'web-application'], software: { name: 'spring-webmvc', version: '5.3.15' }, exploitMaturity: 'weaponized', detectionMethod: 'Container image SCA', sources: ['INT-WIZ', 'INT-GHB'],
    description: 'Container image includes spring-webmvc 5.3.15 running on JDK 11. The known exploit requires Tomcat WAR deployment; this service runs as an executable JAR, reducing exploitability.',
    businessImpact: 'If exploitable, would permit code execution in the payments API tier.',
    evidence: (c) => [manifest('Image SBOM excerpt', `image: registry.northstar.example/${c.host}:2026.08\nspring-webmvc 5.3.15\nspring-beans 5.3.15\nJDK: eclipse-temurin 11.0.20\npackaging: executable JAR (embedded Tomcat)`), scan('Dependency alert', `[demo-sca] spring-webmvc < 5.3.18 → CVE-2022-22965\nrecord=${c.rid}`)],
    missingEvidence: ['Runtime confirmation of deployment mode (JAR vs WAR)'], rootCauses: [{ statement: 'Spring Boot parent version not bumped in service POM.', likelihood: 'likely' }], configIssues: [], weaknesses: ['CWE-94 Code Injection'],
    recommended: 'Upgrade to Spring Framework 5.3.18+ (Spring Boot 2.6.6+).', steps: ['Bump spring-boot-starter-parent', 'Run integration tests', 'Redeploy'], vendorFix: 'Spring Framework 5.3.18 / 5.2.20', compensating: ['Set disallowedFields on WebDataBinder for class.*, Class.*, *.class.*'], verification: ['SCA no longer reports vulnerable version'], similar: [], confidence: 0.9, rationale: 'Exact package version from SBOM. Exploitability reduced by JAR packaging — reflected in validation status rather than severity.', frequency: 3,
  },
  {
    key: 'rapid-reset', title: 'HTTP/2 Rapid Reset denial of service exposure', domain: 'vulnerability', category: 'Denial of service', severity: 'high', cveId: 'CVE-2023-44487', cweIds: ['CWE-400'], attackIds: ['T1499'], owaspIds: [], assetTypes: ['api-gateway', 'web-application'], software: { name: 'nginx', version: '1.24.0' }, exploitMaturity: 'weaponized', detectionMethod: 'Version fingerprint + HTTP/2 negotiation', sources: ['INT-TEN', 'INT-ASM'],
    description: 'Edge service negotiates HTTP/2 and runs an nginx build without the Rapid Reset mitigation. Attackers can exhaust resources by rapidly opening and cancelling streams.',
    businessImpact: 'Availability impact on customer-facing channels; DDoS on a tier-1 service has direct revenue and regulatory reporting implications.',
    evidence: (c) => [probe('ALPN negotiation', `openssl s_client -alpn h2 -connect ${c.host}:443 → ALPN protocol: h2`), scan('Version', 'Server: nginx/1.24.0')],
    missingEvidence: ['CDN / DDoS provider rate-limit configuration'], rootCauses: [{ statement: 'Edge nodes not covered by monthly OS patching because they are managed by the network team.', likelihood: 'possible' }], configIssues: ['No per-connection stream reset limits configured'], weaknesses: ['CWE-400'],
    recommended: 'Upgrade to a patched nginx build (1.25.3+ includes mitigation) and tune keepalive_requests / http2_max_concurrent_streams.', steps: ['Upgrade nginx', 'Apply stream limits', 'Validate with load test'], vendorFix: 'nginx 1.25.3 / vendor-patched builds', compensating: ['Rely on upstream CDN DDoS protection', 'Lower http2_max_concurrent_streams'], verification: ['Version check', 'Synthetic test of stream-reset limits'], similar: [], confidence: 0.82, rationale: 'Mapped via version and HTTP/2 negotiation. CDN may mitigate — validation pending.', frequency: 2,
  },
  {
    key: 'regresshion', title: 'OpenSSH sshd signal handler race condition (regreSSHion)', domain: 'vulnerability', category: 'Remote code execution', severity: 'high', cveId: 'CVE-2024-6387', cweIds: ['CWE-364'], attackIds: ['T1210'], owaspIds: [], assetTypes: SERVER, software: { name: 'openssh-server', version: '9.6p1' }, exploitMaturity: 'poc', detectionMethod: 'Authenticated package inventory', sources: ['INT-QLY', 'INT-CRW'],
    description: 'OpenSSH 9.6p1 on glibc-based Linux. A race in the SIGALRM handler can allow unauthenticated RCE as root; exploitation requires many attempts (hours) and is harder on 64-bit systems.',
    businessImpact: 'Root compromise of an internal server; practical exploitation difficulty is high.',
    evidence: (c) => [manifest('Installed package', `${c.host}: openssh-server 1:9.6p1-3ubuntu13 (amd64)\nglibc 2.39`), log('sshd config excerpt', 'LoginGraceTime 120\nMaxStartups 10:30:100', 'high')],
    missingEvidence: ['Whether sshd is reachable from untrusted networks'], rootCauses: [{ statement: 'Unattended upgrades disabled on this host group.', likelihood: 'likely' }], configIssues: ['LoginGraceTime not set to 0 (mitigation available)'], weaknesses: ['CWE-364'],
    recommended: 'Upgrade OpenSSH to 9.8p1 or distribution-patched package.', steps: ['Apply distro security update', 'Restart sshd', 'Rescan'], vendorFix: 'OpenSSH 9.8p1 / distro backports', compensating: ['Set LoginGraceTime 0 (risk of connection exhaustion)', 'Restrict SSH to bastion network'], verification: ['Package version check'], similar: ['Batch patch via Ansible playbook ssh-hardening (2024)'], confidence: 0.92, rationale: 'Exact package version; CNA CVSS used. Not listed in CISA KEV in this snapshot.', frequency: 5,
  },
  {
    key: 'activemq', title: 'Apache ActiveMQ OpenWire deserialization RCE', domain: 'vulnerability', category: 'Insecure deserialization', severity: 'critical', cveId: 'CVE-2023-46604', cweIds: ['CWE-502'], attackIds: ['T1210', 'T1059'], owaspIds: ['A08:2021'], assetTypes: SERVER, software: { name: 'Apache ActiveMQ', version: '5.17.3' }, exploitMaturity: 'weaponized', detectionMethod: 'Service fingerprint on 61616/tcp', sources: ['INT-TEN'],
    description: 'Message broker running ActiveMQ 5.17.3 with OpenWire on 61616/tcp. Vulnerable to unauthenticated RCE via crafted serialized class types.',
    businessImpact: 'Broker carries fraud-scoring events; compromise allows code execution and tampering with event streams.',
    evidence: (c) => [scan('Service fingerprint', `${c.ip}:61616 ActiveMQ OpenWire\nProviderVersion=5.17.3`)], missingEvidence: ['Network reachability from user VLANs'], rootCauses: [{ statement: 'Broker deployed by a vendor integration project and not registered in CMDB until recently.', likelihood: 'likely' }], configIssues: ['OpenWire listener bound to 0.0.0.0'], weaknesses: ['CWE-502'],
    recommended: 'Upgrade ActiveMQ to 5.17.6 or later.', steps: ['Upgrade broker', 'Bind OpenWire to service network only', 'Rescan'], vendorFix: 'ActiveMQ 5.15.16 / 5.16.7 / 5.17.6 / 5.18.3', compensating: ['Restrict 61616/tcp to known producers/consumers'], verification: ['Fingerprint shows fixed version'], similar: [], confidence: 0.94, rationale: 'Version reported by OpenWire handshake.', frequency: 2,
  },
  {
    key: 'fortios', title: 'FortiOS SSL VPN out-of-bounds write', domain: 'vulnerability', category: 'Memory corruption', severity: 'critical', cveId: 'CVE-2024-21762', cweIds: ['CWE-787'], attackIds: ['T1190', 'T1133'], owaspIds: [], assetTypes: ['network-device'], software: { name: 'FortiOS', version: '7.2.5' }, exploitMaturity: 'weaponized', detectionMethod: 'Version fingerprint', sources: ['INT-ASM', 'INT-TEN'],
    description: 'Branch VPN concentrator running FortiOS 7.2.5 with SSL-VPN enabled.', businessImpact: 'Pre-auth RCE on remote-access gateway.',
    evidence: (c) => [scan('Fingerprint', `${c.host} FortiGate SSL-VPN /remote/login\nversion=7.2.5`)], missingEvidence: ['Device config backup'], rootCauses: [{ statement: 'Branch devices excluded from central firmware management.', likelihood: 'likely' }], configIssues: ['SSL-VPN enabled though ZTNA migration completed'], weaknesses: ['CWE-787'],
    recommended: 'Upgrade to FortiOS 7.2.7+ or disable SSL-VPN.', steps: ['Disable SSL-VPN (unused after ZTNA migration)', 'Upgrade firmware'], vendorFix: 'FortiOS 7.2.7 / 7.4.3 and later', compensating: ['Disable SSL-VPN web mode'], verification: ['Version check', 'Port 443 /remote/login no longer reachable'], similar: [], confidence: 0.9, rationale: 'Fingerprint matches advisory affected range.', frequency: 1,
  },
  {
    key: 'bluekeep', title: 'Windows RDP pre-auth RCE (BlueKeep) on legacy host', domain: 'vulnerability', category: 'Remote code execution', severity: 'critical', cveId: 'CVE-2019-0708', cweIds: ['CWE-416'], attackIds: ['T1210', 'T1021.001'], owaspIds: [], assetTypes: SERVER, software: { name: 'Windows Server', version: '2008 R2 SP1' }, exploitMaturity: 'weaponized', detectionMethod: 'Authenticated patch audit', sources: ['INT-QLY', 'INT-CRW'],
    description: 'Legacy Windows Server 2008 R2 host missing the May 2019 RDP security update.', businessImpact: 'Wormable RCE on an end-of-life server hosting a legacy reconciliation job.',
    evidence: (c) => [scan('Patch audit', `${c.host}: KB4499175 not installed\nTermService running, 3389/tcp listening`)], missingEvidence: [], rootCauses: [{ statement: 'End-of-life OS retained for legacy reconciliation application pending decommission.', likelihood: 'likely' }], configIssues: ['NLA disabled'], weaknesses: ['CWE-416', 'CWE-1104'],
    recommended: 'Apply KB4499175 and enable NLA; prioritize decommissioning the EOL host.', steps: ['Apply patch', 'Enable Network Level Authentication', 'Plan migration'], vendorFix: 'Microsoft security update KB4499175 (May 2019)', compensating: ['Enable NLA', 'Block 3389 except from jump hosts'], verification: ['Patch audit passes'], similar: [], confidence: 0.96, rationale: 'Authenticated patch audit.', frequency: 1,
  },
  {
    key: 'libwebp', title: 'libwebp heap buffer overflow in bundled Chromium', domain: 'vulnerability', category: 'Memory corruption', severity: 'high', cveId: 'CVE-2023-4863', cweIds: ['CWE-787'], attackIds: ['T1203'], owaspIds: ['A06:2021'], assetTypes: ['endpoint'], software: { name: 'Electron app (bundled libwebp)', version: '1.3.1' }, exploitMaturity: 'weaponized', detectionMethod: 'Endpoint software inventory', sources: ['INT-CRW'],
    description: 'Endpoint has a desktop application bundling libwebp < 1.3.2.', businessImpact: 'Client-side code execution via crafted image; endpoint compromise.', evidence: (c) => [scan('Software inventory', `${c.host}: legacy-chat-client 4.2 (libwebp 1.3.1)`)], missingEvidence: [], rootCauses: [{ statement: 'Unmanaged desktop application installed outside software catalog.', likelihood: 'likely' }], configIssues: [], weaknesses: ['CWE-787'],
    recommended: 'Update or remove the application.', steps: ['Push update via MDM', 'Remove if unsanctioned'], vendorFix: 'libwebp 1.3.2 / updated application build', compensating: ['EDR exploit protection'], verification: ['Inventory shows updated version'], similar: [], confidence: 0.88, rationale: 'Inventory version match.', frequency: 4,
  },
  {
    key: 'curl-socks', title: 'curl SOCKS5 heap buffer overflow', domain: 'vulnerability', category: 'Memory corruption', severity: 'high', cveId: 'CVE-2023-38545', cweIds: ['CWE-787'], attackIds: [], owaspIds: ['A06:2021'], assetTypes: ['container', 'server'], software: { name: 'curl', version: '8.1.2' }, exploitMaturity: 'poc', detectionMethod: 'Container image SCA', sources: ['INT-WIZ'],
    description: 'Image contains curl 8.1.2. Exploitation requires curl to use a SOCKS5 proxy with remote hostname resolution and an attacker-controlled long hostname.', businessImpact: 'Low practical exposure — the service does not use SOCKS5 proxies.', evidence: (c) => [manifest('Image SBOM', `${c.host}: curl 8.1.2-r0, libcurl 8.1.2-r0`)], missingEvidence: ['Evidence of SOCKS5 proxy usage'], rootCauses: [{ statement: 'Base image (alpine 3.18) not refreshed.', likelihood: 'likely' }], configIssues: [], weaknesses: ['CWE-787'],
    recommended: 'Rebuild image on a base with curl ≥ 8.4.0.', steps: ['Refresh base image', 'Rebuild'], vendorFix: 'curl 8.4.0', compensating: ['Not using SOCKS5 proxy (no exploit precondition)'], verification: ['SBOM shows ≥ 8.4.0'], similar: [], confidence: 0.9, rationale: 'Exact version match. No ATT&CK technique mapped — exploitation path is not specific to a documented technique for this context.', frequency: 5,
  },
  {
    key: 'text4shell', title: 'Apache Commons Text interpolation RCE (Text4Shell)', domain: 'vulnerability', category: 'Remote code execution', severity: 'critical', cveId: 'CVE-2022-42889', cweIds: ['CWE-94'], attackIds: ['T1190'], owaspIds: ['A06:2021'], assetTypes: ['container', 'web-application'], software: { name: 'commons-text', version: '1.9' }, exploitMaturity: 'functional', detectionMethod: 'Dependency scanning', sources: ['INT-GHB'],
    description: 'Service bundles commons-text 1.9. Exploitable only if untrusted input reaches StringSubstitutor with default lookups.', businessImpact: 'Potential RCE if code path reachable.', evidence: (c) => [manifest('Dependency graph', `${c.host}: com.example:report-svc → org.apache.commons:commons-text:1.9`)], missingEvidence: ['Code-path reachability of StringSubstitutor.createInterpolator()'], rootCauses: [{ statement: 'Transitive dependency via reporting library.', likelihood: 'likely' }], configIssues: [], weaknesses: ['CWE-94'],
    recommended: 'Upgrade commons-text to 1.10.0.', steps: ['Bump dependency', 'Redeploy'], vendorFix: 'commons-text 1.10.0', compensating: [], verification: ['SCA clean'], similar: [], confidence: 0.85, rationale: 'Version match; reachability unknown, lowering confidence of exploitability not of mapping.', frequency: 2,
  },
  {
    key: 'heartbleed', title: 'OpenSSL Heartbleed on legacy appliance', domain: 'vulnerability', category: 'Information disclosure', severity: 'high', cveId: 'CVE-2014-0160', cweIds: ['CWE-125'], attackIds: ['T1190'], owaspIds: ['A06:2021'], assetTypes: ['network-device'], software: { name: 'OpenSSL', version: '1.0.1e' }, exploitMaturity: 'weaponized', detectionMethod: 'Safe TLS heartbeat probe', sources: ['INT-TEN'],
    description: 'Out-of-band management interface on a legacy appliance responds to malformed TLS heartbeat requests.', businessImpact: 'Memory disclosure could leak admin credentials or private keys.', evidence: (c) => [probe('Heartbeat probe (safe, length-limited)', `${c.ip}:443 heartbeat response length 16384 > request 3 → VULNERABLE`)], missingEvidence: [], rootCauses: [{ statement: 'Vendor end-of-support appliance never updated.', likelihood: 'likely' }], configIssues: ['Management interface on general server VLAN'], weaknesses: ['CWE-125'],
    recommended: 'Replace or upgrade appliance; restrict management interface.', steps: ['Isolate management interface', 'Replace appliance', 'Rotate keys'], vendorFix: 'OpenSSL 1.0.1g+ / vendor firmware', compensating: ['Restrict management network access'], verification: ['Probe negative'], similar: [], confidence: 0.95, rationale: 'Active safe probe confirmation.', frequency: 1,
  },
  {
    key: 'citrix-bleed', title: 'NetScaler Gateway session token disclosure (Citrix Bleed)', domain: 'vulnerability', category: 'Information disclosure', severity: 'critical', cveId: 'CVE-2023-4966', cweIds: ['CWE-119'], attackIds: ['T1190', 'T1550.004'], owaspIds: [], assetTypes: ['network-device'], software: { name: 'NetScaler Gateway', version: '13.1-48.47' }, exploitMaturity: 'weaponized', detectionMethod: 'Version fingerprint', sources: ['INT-ASM'],
    description: 'NetScaler Gateway build prior to fixed release. Unauthenticated memory disclosure may leak session tokens allowing session hijacking that bypasses MFA.', businessImpact: 'Session hijacking of privileged remote-access users.', evidence: (c) => [scan('Fingerprint', `${c.host} NetScaler Gateway build 13.1-48.47`)], missingEvidence: ['Session logs for anomalous reuse'], rootCauses: [{ statement: 'Appliance managed by outsourced network provider; patch SLA not enforced.', likelihood: 'possible' }], configIssues: [], weaknesses: ['CWE-119'],
    recommended: 'Upgrade to fixed build and terminate all active sessions after patching.', steps: ['Upgrade', 'kill icaconnection -all; kill aaa session -all (vendor guidance)', 'Review session logs'], vendorFix: 'NetScaler 13.1-49.15 and later', compensating: [], verification: ['Build fingerprint fixed', 'All sessions reset'], similar: [], confidence: 0.9, rationale: 'NVD base 7.5; elevated to critical per CNA score 9.4, KEV listing and exposure.', frequency: 1,
  },
  {
    key: 'openssl-loop', title: 'OpenSSL BN_mod_sqrt infinite loop DoS', domain: 'vulnerability', category: 'Denial of service', severity: 'medium', cveId: 'CVE-2022-0778', cweIds: ['CWE-835'], attackIds: ['T1499'], owaspIds: ['A06:2021'], assetTypes: ['server', 'container'], software: { name: 'openssl', version: '1.1.1k' }, exploitMaturity: 'poc', detectionMethod: 'Package inventory', sources: ['INT-QLY', 'INT-WIZ'],
    description: 'OpenSSL 1.1.1k can be forced into an infinite loop when parsing crafted certificates.', businessImpact: 'Service availability impact.', evidence: (c) => [manifest('Package', `${c.host}: openssl 1.1.1k`)], missingEvidence: [], rootCauses: [{ statement: 'Base OS image not updated.', likelihood: 'likely' }], configIssues: [], weaknesses: ['CWE-835'],
    recommended: 'Upgrade OpenSSL to 1.1.1n+ or 3.0.2+.', steps: ['Patch OS packages'], vendorFix: 'OpenSSL 1.1.1n / 3.0.2', compensating: [], verification: ['Package check'], similar: [], confidence: 0.9, rationale: 'Version match.', frequency: 6,
  },
  {
    key: 'terrapin', title: 'SSH Terrapin prefix truncation', domain: 'vulnerability', category: 'Cryptographic weakness', severity: 'medium', cveId: 'CVE-2023-48795', cweIds: ['CWE-354'], attackIds: ['T1557'], owaspIds: ['A02:2021'], assetTypes: ['server', 'network-device'], exploitMaturity: 'poc', detectionMethod: 'SSH algorithm negotiation check', sources: ['INT-TEN'],
    description: 'SSH service supports chacha20-poly1305@openssh.com without strict key exchange, allowing a MITM attacker to truncate the handshake prefix.', businessImpact: 'Low — requires active MITM position.', evidence: (c) => [probe('Algorithm negotiation', `${c.ip}:22 ciphers: chacha20-poly1305@openssh.com\nkex-strict-s-v00@openssh.com: absent`)], missingEvidence: [], rootCauses: [{ statement: 'Default cipher configuration retained.', likelihood: 'likely' }], configIssues: ['Weak default SSH ciphers'], weaknesses: ['CWE-354'],
    recommended: 'Upgrade to OpenSSH 9.6+ or disable affected ciphers/MACs.', steps: ['Update sshd_config Ciphers / MACs', 'Upgrade OpenSSH'], vendorFix: 'OpenSSH 9.6', compensating: ['Disable chacha20-poly1305 and *-etm MACs'], verification: ['Rescan negotiation'], similar: [], confidence: 0.88, rationale: 'Protocol negotiation evidence.', frequency: 5,
  },
  {
    key: 'sweet32', title: '64-bit block cipher suites enabled (SWEET32)', domain: 'vulnerability', category: 'Cryptographic weakness', severity: 'low', cveId: 'CVE-2016-2183', cweIds: ['CWE-200', 'CWE-326'], attackIds: [], owaspIds: ['A02:2021'], assetTypes: ['web-application', 'server', 'api-gateway'], exploitMaturity: 'poc', detectionMethod: 'TLS cipher enumeration', sources: ['INT-TEN', 'INT-ASM'],
    description: 'Service offers TLS_RSA_WITH_3DES_EDE_CBC_SHA. Practical exploitation requires capturing very large volumes of traffic in a single session.', businessImpact: 'Minimal practical risk; compliance (PCI DSS) finding.', evidence: (c) => [probe('Cipher enumeration', `${c.host}:443 TLSv1.2 TLS_RSA_WITH_3DES_EDE_CBC_SHA (offered)`)], missingEvidence: [], rootCauses: [{ statement: 'Legacy client compatibility profile on load balancer.', likelihood: 'likely' }], configIssues: ['Legacy TLS profile'], weaknesses: ['CWE-326'],
    recommended: 'Remove 3DES cipher suites from TLS profile.', steps: ['Update TLS profile'], compensating: [], verification: ['Cipher scan clean'], similar: [], confidence: 0.83, rationale: 'NVD lists 7.5; DO SAFE contextual severity lowered to Low given exploit preconditions (documented override).', frequency: 5,
  },
  {
    key: 'f5-auth', title: 'F5 BIG-IP iControl REST authentication bypass', domain: 'vulnerability', category: 'Authentication bypass', severity: 'critical', cveId: 'CVE-2022-1388', cweIds: ['CWE-306'], attackIds: ['T1190'], owaspIds: ['A07:2021'], assetTypes: ['network-device'], exploitMaturity: 'weaponized', detectionMethod: 'Version fingerprint', sources: ['INT-TEN'],
    description: 'Load balancer management interface running BIG-IP 15.1.5.', businessImpact: 'Full control of load balancer fronting tier-1 services.', evidence: (c) => [scan('Fingerprint', `${c.host} BIG-IP 15.1.5 (management :443)`)], missingEvidence: ['Whether management interface is reachable beyond management VLAN'], rootCauses: [{ statement: 'Management interface exposed to server VLAN.', likelihood: 'possible' }], configIssues: [], weaknesses: ['CWE-306'],
    recommended: 'Upgrade to 15.1.5.1+ and restrict management access.', steps: ['Upgrade', 'Restrict self-IP port lockdown'], vendorFix: 'BIG-IP 15.1.5.1', compensating: ['Block iControl REST via self-IP lockdown'], verification: ['Version fingerprint'], similar: [], confidence: 0.92, rationale: 'Fingerprint match.', frequency: 1,
  },
  {
    key: 'papercut', title: 'PaperCut MF/NG authentication bypass', domain: 'vulnerability', category: 'Authentication bypass', severity: 'critical', cveId: 'CVE-2023-27350', cweIds: ['CWE-284'], attackIds: ['T1190', 'T1059'], owaspIds: ['A01:2021'], assetTypes: SERVER, exploitMaturity: 'weaponized', detectionMethod: 'Application fingerprint', sources: ['INT-TEN'],
    description: 'Print management server running a vulnerable PaperCut NG build.', businessImpact: 'SYSTEM-level code execution on corporate network server.', evidence: (c) => [scan('Fingerprint', `${c.host}:9191 PaperCut NG 22.0.4`)], missingEvidence: [], rootCauses: [{ statement: 'Workplace application not in patch management scope.', likelihood: 'likely' }], configIssues: [], weaknesses: ['CWE-284'],
    recommended: 'Upgrade to 22.0.9+.', steps: ['Upgrade', 'Review for IOCs'], vendorFix: 'PaperCut 20.1.7 / 21.2.11 / 22.0.9', compensating: ['Restrict 9191/9192 to admin hosts'], verification: ['Version check'], similar: [], confidence: 0.94, rationale: 'Fingerprint match.', frequency: 1,
  },
  {
    key: 'php-cgi', title: 'PHP-CGI argument injection on Windows', domain: 'vulnerability', category: 'Command injection', severity: 'critical', cveId: 'CVE-2024-4577', cweIds: ['CWE-78'], attackIds: ['T1190'], owaspIds: ['A03:2021'], assetTypes: ['web-application'], exploitMaturity: 'weaponized', detectionMethod: 'Banner + configuration check', sources: ['INT-TEN'],
    description: 'Legacy intranet site on Windows/Apache using PHP 8.1.27 in CGI mode.', businessImpact: 'RCE on intranet web server.', evidence: (c) => [scan('Banner', `${c.host}: X-Powered-By: PHP/8.1.27; Server: Apache/2.4.58 (Win64)`)], missingEvidence: ['Confirmation of CGI mode vs mod_php'], rootCauses: [{ statement: 'Legacy intranet stack maintained by business unit, not IT.', likelihood: 'likely' }], configIssues: [], weaknesses: ['CWE-78'],
    recommended: 'Upgrade PHP to 8.1.29+ or migrate off PHP-CGI.', steps: ['Upgrade PHP'], vendorFix: 'PHP 8.1.29 / 8.2.20 / 8.3.8', compensating: ['Rewrite rules blocking soft-hyphen argument patterns'], verification: ['Version check'], similar: [], confidence: 0.8, rationale: 'Banner-based; CGI mode not confirmed.', frequency: 1,
  },
  {
    key: 'teamcity', title: 'JetBrains TeamCity authentication bypass', domain: 'vulnerability', category: 'Authentication bypass', severity: 'critical', cveId: 'CVE-2024-27198', cweIds: ['CWE-288'], attackIds: ['T1190', 'T1195.002'], owaspIds: ['A07:2021'], assetTypes: SERVER, exploitMaturity: 'weaponized', detectionMethod: 'Application fingerprint', sources: ['INT-TEN'],
    description: 'CI server running TeamCity 2023.11.3.', businessImpact: 'Build pipeline compromise could inject malicious code into payment and banking releases (software supply chain).', evidence: (c) => [scan('Fingerprint', `${c.host}:8111 TeamCity 2023.11.3 (build 147512)`)], missingEvidence: [], rootCauses: [{ statement: 'Self-managed CI server not covered by vendor auto-update.', likelihood: 'likely' }], configIssues: ['CI server reachable from corporate VPN pool'], weaknesses: ['CWE-288'],
    recommended: 'Upgrade TeamCity to 2023.11.4+ and audit administrator accounts.', steps: ['Upgrade', 'Audit users and tokens', 'Rotate build secrets'], vendorFix: 'TeamCity 2023.11.4', compensating: ['Restrict access to engineering network'], verification: ['Version check', 'Admin audit attached'], similar: [], confidence: 0.94, rationale: 'Fingerprint match; T1195.002 reflects supply-chain consequence.', frequency: 1,
  },
  // ---------------- Misconfigurations & identity (no CVE)
  {
    key: 's3-public', title: 'Object storage bucket allows public read access', domain: 'misconfiguration', category: 'Cloud misconfiguration', severity: 'critical', cweIds: ['CWE-732', 'CWE-668'], attackIds: ['T1530'], owaspIds: ['A05:2021'], assetTypes: ['cloud-storage'], exploitMaturity: 'functional', detectionMethod: 'Cloud configuration analysis', sources: ['INT-WIZ', 'INT-ASM'],
    description: 'Bucket policy grants s3:GetObject to Principal "*" and Block Public Access is disabled at the bucket level.', businessImpact: 'Customer data exports in this bucket could be downloaded by anyone with the URL.',
    evidence: (c) => [cfg('Bucket policy', `{\n  "Effect": "Allow",\n  "Principal": "*",\n  "Action": "s3:GetObject",\n  "Resource": "arn:aws:s3:::${c.host}/*"\n}`), api('Block Public Access', 'BlockPublicAcls=false, IgnorePublicAcls=false, BlockPublicPolicy=false, RestrictPublicBuckets=false'), probe('Unauthenticated list attempt', `GET https://${c.host}.s3.amazonaws.com/ → 403 (listing denied)\nGET .../exports/sample-manifest.json → 200 (object readable)`)],
    missingEvidence: ['Object-level data classification scan', 'CloudTrail data events for anonymous GetObject'], rootCauses: [{ statement: 'Policy added to share a file with a marketing agency and never removed.', likelihood: 'likely' }, { statement: 'Account-level Block Public Access exception granted for legacy static site.', likelihood: 'possible' }], configIssues: ['Account-level Block Public Access exception'], weaknesses: ['CWE-732'],
    recommended: 'Remove the public principal from the bucket policy and enable Block Public Access; share via pre-signed URLs if needed.', steps: ['Remove public statement', 'Enable Block Public Access', 'Review CloudTrail data events for anonymous access', 'Classify bucket contents'], compensating: ['SCP preventing public bucket policies'], verification: ['Config re-evaluation passes', 'Anonymous GET returns 403'], similar: ['FND-0811: public marketing bucket — resolved with pre-signed URL workflow'], confidence: 0.98, rationale: 'Configuration directly observed. No CVE applies (customer misconfiguration). ATT&CK T1530 describes the exploitation technique.', frequency: 3,
  },
  {
    key: 'imdsv1', title: 'EC2 instance allows IMDSv1 (SSRF credential theft risk)', domain: 'misconfiguration', category: 'Cloud misconfiguration', severity: 'high', cweIds: ['CWE-918', 'CWE-1188'], attackIds: ['T1552.005'], owaspIds: ['A10:2021'], assetTypes: ['server'], exploitMaturity: 'functional', detectionMethod: 'Cloud configuration analysis', sources: ['INT-WIZ'],
    description: 'Instance metadata service v1 is enabled (HttpTokens=optional). An SSRF in hosted applications could retrieve IAM role credentials.', businessImpact: 'Role attached to this instance can read the customer data lake.', evidence: (c) => [api('Instance metadata options', `${c.host}: HttpTokens=optional, HttpPutResponseHopLimit=2, HttpEndpoint=enabled`)], missingEvidence: ['Whether any hosted app has SSRF'], rootCauses: [{ statement: 'Launch template created before IMDSv2 enforcement policy.', likelihood: 'likely' }], configIssues: ['Overly broad IAM role'], weaknesses: ['CWE-1188'],
    recommended: 'Require IMDSv2 (HttpTokens=required).', steps: ['Update launch template', 'Modify instance metadata options'], compensating: ['WAF SSRF rules'], verification: ['Config shows HttpTokens=required'], similar: [], confidence: 0.97, rationale: 'Configuration observed. No CVE — insecure default. T1552.005 is the associated credential access technique.', frequency: 5,
  },
  {
    key: 'mfa-gap', title: 'Privileged accounts without phishing-resistant MFA', domain: 'identity', category: 'Identity & access', severity: 'high', cweIds: ['CWE-308'], attackIds: ['T1078', 'T1621'], owaspIds: ['A07:2021'], assetTypes: ['identity-provider'], exploitMaturity: 'functional', detectionMethod: 'Identity posture analysis', sources: ['INT-OKT'],
    description: '14 administrator accounts are enrolled only in push-notification MFA, which is susceptible to MFA fatigue attacks.', businessImpact: 'Admin account takeover would expose the entire customer identity platform.', evidence: (c) => [api('Policy evaluation', `${c.host}: Admin authenticator policy allows Okta Verify Push without number matching\nadmins_without_fido2=14`), log('Auth log sample', 'Push MFA denied ×6 followed by approve within 4 min for admin user (user ID redacted)', 'medium')],
    missingEvidence: [], rootCauses: [{ statement: 'FIDO2 rollout paused for contractors.', likelihood: 'likely' }], configIssues: ['Number matching disabled'], weaknesses: ['CWE-308'],
    recommended: 'Require phishing-resistant authenticators (FIDO2/WebAuthn) for all admin roles; enable number matching.', steps: ['Enable number matching', 'Enforce FIDO2 for admin group', 'Review push-fatigue events'], compensating: ['Enable number matching'], verification: ['Policy evaluation shows 0 admins without FIDO2'], similar: [], confidence: 0.95, rationale: 'Identity posture finding — no CVE. ATT&CK T1621 (MFA request generation) and T1078 (valid accounts).', frequency: 2,
  },
  {
    key: 'stale-admin', title: 'Dormant privileged service account with active keys', domain: 'identity', category: 'Identity & access', severity: 'medium', cweIds: ['CWE-522'], attackIds: ['T1078', 'T1098'], owaspIds: [], assetTypes: ['identity-provider', 'kubernetes-cluster', 'database'], exploitMaturity: 'none', detectionMethod: 'Identity analytics', sources: ['INT-OKT', 'INT-WIZ'],
    description: 'Service account with admin privileges has not authenticated in 180+ days but retains active access keys.', businessImpact: 'Unused credentials increase blast radius if leaked.', evidence: (c) => [api('Account summary', `${c.host}: svc-legacy-etl last_used=196 days ago; keys=2 active; role=admin`)], missingEvidence: [], rootCauses: [{ statement: 'No automated deprovisioning for service accounts.', likelihood: 'likely' }], configIssues: [], weaknesses: ['CWE-522'],
    recommended: 'Disable keys and remove admin role.', steps: ['Disable keys', 'Remove role', 'Delete after 30 days'], compensating: [], verification: ['Keys inactive'], similar: [], confidence: 0.9, rationale: 'Observed account metadata; no CVE.', frequency: 5,
  },
  {
    key: 'secret-repo', title: 'Hard-coded cloud credentials committed to repository', domain: 'code', category: 'Secrets exposure', severity: 'critical', cweIds: ['CWE-798'], attackIds: ['T1552.001'], owaspIds: ['A07:2021'], assetTypes: ['code-repository'], exploitMaturity: 'functional', detectionMethod: 'Secret scanning', sources: ['INT-GHB'],
    description: 'An AWS access key pair was committed in a configuration file. The key remains active.', businessImpact: 'Key grants write access to a staging deployment bucket used to promote payment service builds.', evidence: (c) => [scan('Secret scanning alert', `repo=northstar-fin/${c.host}\nfile=deploy/config/staging.env (line 12)\nsecret_type=aws_access_key_id (AKIA…REDACTED)\nvalidity=active (provider check)`)], missingEvidence: ['CloudTrail activity for the key since commit'], rootCauses: [{ statement: 'Pre-commit secret hook not enforced on this repository.', likelihood: 'likely' }], configIssues: ['Long-lived IAM user keys instead of OIDC federation'], weaknesses: ['CWE-798'],
    recommended: 'Revoke the key immediately, review CloudTrail for misuse, and migrate the pipeline to OIDC federation.', steps: ['Revoke key', 'Review CloudTrail', 'Purge from history', 'Enforce push protection'], compensating: [], verification: ['Provider validity check shows revoked'], similar: [], confidence: 0.99, rationale: 'Provider-validated secret; no CVE (customer coding error).', frequency: 3,
  },
  {
    key: 'k8s-dashboard', title: 'Kubernetes API server publicly reachable with anonymous auth', domain: 'misconfiguration', category: 'Cloud misconfiguration', severity: 'high', cweIds: ['CWE-306'], attackIds: ['T1190'], owaspIds: ['A05:2021'], assetTypes: ['kubernetes-cluster'], exploitMaturity: 'functional', detectionMethod: 'External exposure + config analysis', sources: ['INT-WIZ', 'INT-ASM'],
    description: 'Cluster API endpoint is public and --anonymous-auth is enabled; anonymous users can query /version and discovery APIs.', businessImpact: 'Increases attack surface of the digital banking cluster.', evidence: (c) => [probe('Anonymous request', `GET https://${c.host}:6443/version → 200 {"gitVersion":"v1.27.9"}`), cfg('Cluster config', 'endpointPublicAccess=true, publicAccessCidrs=["0.0.0.0/0"]')], missingEvidence: ['RBAC bindings for system:anonymous'], rootCauses: [{ statement: 'Default managed-cluster endpoint settings retained.', likelihood: 'likely' }], configIssues: ['Public endpoint without CIDR restriction'], weaknesses: ['CWE-306'],
    recommended: 'Restrict API endpoint to private access or allow-listed CIDRs; disable anonymous auth.', steps: ['Set publicAccessCidrs', 'Disable anonymous auth'], compensating: [], verification: ['External probe fails'], similar: [], confidence: 0.93, rationale: 'Observed configuration.', frequency: 2,
  },
  {
    key: 'db-public', title: 'Database port exposed to the internet', domain: 'exposure', category: 'External exposure', severity: 'high', cweIds: ['CWE-668'], attackIds: ['T1190', 'T1110.003'], owaspIds: ['A05:2021'], assetTypes: ['database'], exploitMaturity: 'functional', detectionMethod: 'External attack surface scan', sources: ['INT-ASM', 'INT-WIZ'],
    description: 'PostgreSQL 5432/tcp reachable from the internet; security group allows 0.0.0.0/0.', businessImpact: 'Brute force or exploitation of database service holding customer profiles.', evidence: (c) => [probe('External port scan', `${c.ip}:5432 open (PostgreSQL 14.10)`), cfg('Security group', 'sg-…: inbound tcp/5432 from 0.0.0.0/0')], missingEvidence: [], rootCauses: [{ statement: 'Temporary rule for vendor migration never removed.', likelihood: 'likely' }], configIssues: ['Security group allows any source'], weaknesses: ['CWE-668'],
    recommended: 'Remove public ingress rule; use private connectivity.', steps: ['Remove 0.0.0.0/0 rule', 'Use PrivateLink/VPN for vendor'], compensating: ['Strong auth + pg_hba restrictions'], verification: ['External scan closed'], similar: [], confidence: 0.96, rationale: 'External probe + config.', frequency: 2,
  },
  {
    key: 'tls-expired', title: 'Expired TLS certificate on customer-facing endpoint', domain: 'exposure', category: 'Certificate hygiene', severity: 'medium', cweIds: ['CWE-295'], attackIds: [], owaspIds: ['A02:2021'], assetTypes: ['web-application', 'api-gateway'], exploitMaturity: 'none', detectionMethod: 'Certificate monitoring', sources: ['INT-ASM'],
    description: 'Certificate expired; clients may be trained to ignore warnings.', businessImpact: 'Customer trust and availability impact.', evidence: (c) => [probe('Certificate', `${c.host}: notAfter has passed; issuer=DigiCert (demo)`)], missingEvidence: [], rootCauses: [{ statement: 'Certificate not managed by ACME automation.', likelihood: 'likely' }], configIssues: [], weaknesses: ['CWE-295'],
    recommended: 'Renew certificate and onboard to automated certificate management.', steps: ['Renew', 'Automate'], compensating: [], verification: ['Certificate valid'], similar: [], confidence: 0.99, rationale: 'Observed certificate. No CVE or ATT&CK mapping applicable.', frequency: 3,
  },
  {
    key: 'logging-off', title: 'Audit logging disabled on production database', domain: 'misconfiguration', category: 'Logging & monitoring', severity: 'medium', cweIds: [], attackIds: [], owaspIds: ['A05:2021'], assetTypes: ['database'], exploitMaturity: 'none', detectionMethod: 'Cloud configuration analysis', sources: ['INT-WIZ'],
    description: 'Database audit logging (pgaudit) is not enabled.', businessImpact: 'Limits forensic capability and regulatory evidence.', evidence: (c) => [cfg('Parameter group', `${c.host}: shared_preload_libraries does not include pgaudit`)], missingEvidence: [], rootCauses: [{ statement: 'Parameter group template missing logging baseline.', likelihood: 'likely' }], configIssues: [], weaknesses: [],
    recommended: 'Enable pgaudit and forward logs to SIEM.', steps: ['Update parameter group', 'Reboot in window'], compensating: [], verification: ['Config check'], similar: [], confidence: 0.95, rationale: 'Configuration control gap. No CWE/CVE/ATT&CK mapping applicable — mapped to OWASP A05 only.', frequency: 4,
  },
  {
    key: 'saas-sharing', title: 'Collaboration workspace allows public link sharing', domain: 'misconfiguration', category: 'SaaS misconfiguration', severity: 'medium', cweIds: ['CWE-668'], attackIds: ['T1213'], owaspIds: [], assetTypes: ['saas-application'], exploitMaturity: 'none', detectionMethod: 'SaaS posture check', sources: ['INT-NSK'],
    description: 'Tenant setting permits "anyone with the link" sharing for internal documents.', businessImpact: '312 documents currently shared publicly, including 4 labelled Confidential.', evidence: (c) => [api('Tenant setting', `${c.host}: external_sharing=anyone; public_links=312; confidential_labelled=4`)], missingEvidence: [], rootCauses: [{ statement: 'Default tenant configuration.', likelihood: 'likely' }], configIssues: [], weaknesses: [],
    recommended: 'Restrict sharing to authenticated external users and expire public links.', steps: ['Change tenant setting', 'Expire existing links'], compensating: ['DLP policy on labelled documents'], verification: ['Setting check'], similar: [], confidence: 0.92, rationale: 'Tenant setting observed.', frequency: 2,
  },
]

// ---------------------------------------------------------------- AI security finding templates

export interface AIFindingTemplate {
  key: string
  title: string
  category: 'Shadow AI' | 'AI configuration' | 'AI access' | 'AI data exposure' | 'AI provider risk' | 'AI external exposure'
  severity: Severity
  cweIds: string[]
  owaspIds: string[]
  attackIds: string[]
  detectionMethod: string
  sources: string[]
  description: string
  businessImpact: string
  evidence: (c: TemplateCtx) => EvidenceTemplate[]
  missingEvidence: string[]
  rootCauses: { statement: string; likelihood: 'likely' | 'possible' | 'unlikely' }[]
  recommended: string
  steps: string[]
  compensating: string[]
  verification: string[]
  confidence: number
  rationale: string
}

export const AI_FINDING_TEMPLATES: Record<string, AIFindingTemplate> = {
  shadowUsage: {
    key: 'shadow-usage', title: 'Unsanctioned generative-AI application in use', category: 'Shadow AI', severity: 'high', cweIds: [], owaspIds: ['LLM02:2025'], attackIds: ['T1567'], detectionMethod: 'SSE traffic analysis + IdP app discovery', sources: ['INT-NSK', 'INT-OKT'],
    description: 'Employees are using a generative-AI service that has not been through AI governance review. Traffic analysis shows uploads of text and files.', businessImpact: 'Confidential data may be shared with a provider without a DPA, retention or training-use guarantees.',
    evidence: (c) => [traffic('SSE usage summary (30 days)', `app="${c.aiName}"\nusers=47 distinct\nupload_events=1,284 (text prompts) / 96 (file uploads)\ndlp_matches=11 (policy: Confidential label)\nsource=Netskope (simulated)`), api('IdP app discovery', `OAuth grant to "${c.aiName}" by 19 users (scopes: profile, email)\nNo admin consent recorded`)],
    missingEvidence: ['Content of uploaded files (DLP shows label matches only)', 'Provider data retention terms for consumer tier'], rootCauses: [{ statement: 'No sanctioned alternative offered for the team\'s use case (document summarization).', likelihood: 'likely' }, { statement: 'SSE policy set to "monitor" rather than "coach/block" for uncategorized AI apps.', likelihood: 'likely' }],
    recommended: 'Open a governance review; coach users toward the approved enterprise assistant; block file uploads to the unsanctioned app pending review.', steps: ['Open shadow AI governance review', 'Apply SSE coaching policy', 'Block file uploads', 'Notify affected users'], compensating: ['DLP block for Restricted/Confidential labels'], verification: ['SSE shows zero uploads for 14 days', 'Governance decision recorded'], confidence: 0.88,
    rationale: 'Usage directly observed in SSE and IdP logs. OWASP LLM02 (sensitive information disclosure) describes the risk; T1567 describes the data flow pattern (benign in intent). No CVE/CWE applies.',
  },
  browserExtension: {
    key: 'shadow-extension', title: 'AI browser extension with broad page-read permissions', category: 'Shadow AI', severity: 'medium', cweIds: ['CWE-200'], owaspIds: ['LLM02:2025'], attackIds: [], detectionMethod: 'Endpoint browser extension inventory', sources: ['INT-CRW'],
    description: 'An AI writing-assistant browser extension with "read and change all data on all websites" permission is installed on managed endpoints.', businessImpact: 'Extension can read content from internal web apps including the customer service console.',
    evidence: (c) => [scan('Extension inventory', `extension="${c.aiName}"\ninstalls=63 endpoints\npermissions=<all_urls>, storage, tabs\npublisher verification: unverified`)], missingEvidence: ['Network destinations contacted by the extension'], rootCauses: [{ statement: 'Browser extension allow-list not enforced via MDM.', likelihood: 'likely' }],
    recommended: 'Add to extension block-list unless approved; enforce allow-list policy.', steps: ['Block via browser policy', 'Notify users'], compensating: [], verification: ['Extension inventory shows 0 installs'], confidence: 0.84, rationale: 'Observed install inventory; risk inferred from permissions.',
  },
  ragAcl: {
    key: 'rag-acl', title: 'RAG index ignores source document permissions', category: 'AI data exposure', severity: 'critical', cweIds: ['CWE-284'], owaspIds: ['LLM08:2025', 'LLM02:2025'], attackIds: ['T1213'], detectionMethod: 'AI configuration assessment + retrieval test', sources: ['INT-WIZ'],
    description: 'The vector index is populated with a service account that can read all SharePoint sites; retrieval does not filter by the requesting user\'s permissions.', businessImpact: 'Any employee can retrieve snippets from HR and M&A documents through the assistant.',
    evidence: (c) => [cfg('Ingestion config', `${c.aiName}: connector=sharepoint, auth=app-only (Sites.Read.All)\nretrieval.filter_by_user_acl=false`), { label: 'Controlled retrieval test', kind: 'analyst-note', content: 'Test user in Engineering group retrieved 3 chunks from HR-restricted site via question about "compensation bands". Test performed in staging with synthetic documents.', provenance: 'human-reviewed', reliability: 'high' }],
    missingEvidence: ['Production query logs to determine whether restricted chunks were actually served'], rootCauses: [{ statement: 'Proof-of-concept ingestion design promoted to production without security review.', likelihood: 'likely' }],
    recommended: 'Enable document-level ACL filtering at retrieval time and re-index with permission metadata.', steps: ['Disable restricted sites from index', 'Implement ACL-aware retrieval', 'Re-index'], compensating: ['Remove HR/M&A sites from ingestion scope'], verification: ['Retrieval test passes for 5 personas'], confidence: 0.9, rationale: 'Configuration observed plus human-reviewed staging test. OWASP LLM08 (vector & embedding weaknesses).',
  },
  promptInjection: {
    key: 'prompt-injection', title: 'Customer-facing agent susceptible to indirect prompt injection', category: 'AI configuration', severity: 'high', cweIds: ['CWE-1427'], owaspIds: ['LLM01:2025', 'LLM06:2025'], attackIds: [], detectionMethod: 'AI red-team assessment (simulated)', sources: ['INT-ASM'],
    description: 'The support agent can call a "lookup_account" tool and processes content from customer-uploaded documents without isolation; a crafted document can steer tool calls.', businessImpact: 'Potential disclosure of another customer\'s account summary or unauthorized actions.',
    evidence: (c) => [{ label: 'Assessment transcript excerpt (simulated)', kind: 'analyst-note', content: `${c.aiName}: uploaded PDF containing hidden instruction caused the agent to call lookup_account with an ID not belonging to the session user. Tool layer rejected the call (authorization check) — impact limited to attempted call.`, provenance: 'simulated', reliability: 'medium' }],
    missingEvidence: ['Production guardrail telemetry'], rootCauses: [{ statement: 'Untrusted document content concatenated into the system context.', likelihood: 'likely' }],
    recommended: 'Isolate untrusted content, enforce tool-level authorization (already partially present), and add output filtering.', steps: ['Separate untrusted content channel', 'Add allow-listed tool parameters bound to session', 'Add injection classifier'], compensating: ['Tool-level session authorization (observed working)'], verification: ['Red-team regression suite passes'], confidence: 0.76, rationale: 'Based on a simulated assessment; requires human confirmation. CWE-1427 and OWASP LLM01 are the applicable references; no ATT&CK enterprise technique mapped.',
  },
  noLogging: {
    key: 'ai-logging', title: 'LLM prompt/response logging disabled', category: 'AI configuration', severity: 'medium', cweIds: [], owaspIds: [], attackIds: [], detectionMethod: 'AI configuration assessment', sources: ['INT-WIZ'],
    description: 'Prompt and response audit logging is disabled for the deployment.', businessImpact: 'No forensic trail for misuse investigations or regulatory inquiries.', evidence: (c) => [cfg('Deployment settings', `${c.aiName}: audit_logging=disabled; content_filter=default`)], missingEvidence: [], rootCauses: [{ statement: 'Logging disabled over cost concerns during pilot.', likelihood: 'likely' }],
    recommended: 'Enable audit logging with PII redaction and retention aligned to policy.', steps: ['Enable logging', 'Configure redaction'], compensating: [], verification: ['Config check'], confidence: 0.93, rationale: 'Configuration observed. No CVE/CWE/OWASP mapping — governance control gap.',
  },
  excessiveScope: {
    key: 'ai-scope', title: 'AI coding assistant granted org-wide repository write scope', category: 'AI access', severity: 'high', cweIds: ['CWE-732'], owaspIds: ['LLM06:2025'], attackIds: ['T1195.002'], detectionMethod: 'OAuth grant analysis', sources: ['INT-GHB', 'INT-OKT'],
    description: 'An AI agent integration holds write access to all repositories including payment service code.', businessImpact: 'A compromised or misbehaving agent could push changes to production-bound code.', evidence: (c) => [api('App installation', `${c.aiName}: repository_selection=all; permissions: contents=write, pull_requests=write, workflows=write`)], missingEvidence: [], rootCauses: [{ statement: 'Installed with default "all repositories" during trial.', likelihood: 'likely' }],
    recommended: 'Limit installation to selected repositories and remove workflows:write.', steps: ['Reduce scope', 'Require PR review for agent commits'], compensating: ['Branch protection requiring human review'], verification: ['Installation shows selected repos'], confidence: 0.94, rationale: 'Observed permissions. OWASP LLM06 (excessive agency).',
  },
  providerTraining: {
    key: 'ai-provider', title: 'AI provider contract does not exclude training on customer data', category: 'AI provider risk', severity: 'medium', cweIds: [], owaspIds: ['LLM03:2025'], attackIds: [], detectionMethod: 'Contract & evidence review', sources: ['INT-SSC'],
    description: 'The current terms permit the provider to use submitted content to improve models unless an opt-out is filed; no opt-out confirmation is on record.', businessImpact: 'Confidential data could be retained and used beyond the intended purpose.', evidence: () => [{ label: 'Contract clause review', kind: 'document', content: 'Section 7.2 "Service Improvement": provider may use Customer Content to improve services unless Customer opts out in writing. No opt-out letter in contract repository.', provenance: 'human-reviewed', reliability: 'high' }],
    missingEvidence: ['Provider confirmation of opt-out status'], rootCauses: [{ statement: 'Click-through procurement bypassed legal review.', likelihood: 'likely' }],
    recommended: 'File training opt-out and obtain written confirmation; add AI data-use clause to contract.', steps: ['Send opt-out', 'Amend contract'], compensating: ['Restrict data classification permitted'], verification: ['Opt-out confirmation attached'], confidence: 0.86, rationale: 'Human-reviewed contract evidence.',
  },
  exposedEndpoint: {
    key: 'ai-endpoint', title: 'Model inference endpoint exposed without authentication', category: 'AI external exposure', severity: 'critical', cweIds: ['CWE-306'], owaspIds: ['LLM10:2025'], attackIds: ['T1190'], detectionMethod: 'External attack surface scan', sources: ['INT-ASM'],
    description: 'A self-hosted model server answers inference requests on a public IP without authentication.', businessImpact: 'Unbounded consumption (cost), model extraction, and potential data exposure if the model was fine-tuned on internal data.', evidence: (c) => [probe('External probe', `POST http://${c.ip}:8000/v1/completions → 200 (no auth)\nmodel list: ["fraud-feature-explainer-ft"]`)], missingEvidence: ['Fine-tuning data lineage'], rootCauses: [{ statement: 'Data science sandbox launched with public IP.', likelihood: 'likely' }],
    recommended: 'Remove public exposure and require authentication via gateway.', steps: ['Remove public IP / security group rule', 'Front with authenticated gateway'], compensating: [], verification: ['External probe fails'], confidence: 0.95, rationale: 'Observed via external probe. OWASP LLM10 (unbounded consumption).',
  },
  piiPrompts: {
    key: 'ai-pii', title: 'Customer PII detected in prompts to third-party model', category: 'AI data exposure', severity: 'high', cweIds: ['CWE-200'], owaspIds: ['LLM02:2025'], attackIds: [], detectionMethod: 'DLP on AI gateway traffic', sources: ['INT-NSK'],
    description: 'DLP detected account numbers and SSN patterns in prompts sent to an external model API.', businessImpact: 'Regulated data (GLBA) transmitted to provider; potential notification obligations depending on contract.', evidence: (c) => [traffic('DLP matches (7 days)', `${c.aiName}: pattern=US_SSN matches=23; pattern=ACCOUNT_NUMBER matches=141\n(values redacted in DO SAFE)`)], missingEvidence: ['Provider retention settings for API'], rootCauses: [{ statement: 'Agent-assist feature sends full case notes without redaction.', likelihood: 'likely' }],
    recommended: 'Add redaction before prompts leave the network; confirm zero-retention API settings.', steps: ['Enable gateway redaction', 'Confirm provider retention'], compensating: ['Zero data retention addendum (if confirmed)'], verification: ['DLP matches drop to 0'], confidence: 0.89, rationale: 'DLP observation; OWASP LLM02.',
  },
  systemPrompt: {
    key: 'ai-sysprompt', title: 'System prompt contains internal API credentials', category: 'AI configuration', severity: 'high', cweIds: ['CWE-798'], owaspIds: ['LLM07:2025'], attackIds: ['T1552.001'], detectionMethod: 'Prompt configuration scan', sources: ['INT-GHB'],
    description: 'An API token is embedded in the system prompt template; prompt-leak techniques could reveal it.', businessImpact: 'Token grants read access to the order-status API.', evidence: (c) => [scan('Prompt template scan', `${c.aiName}: prompts/system.txt line 18 contains bearer token (redacted)`)], missingEvidence: [], rootCauses: [{ statement: 'Rapid prototyping pattern copied to production.', likelihood: 'likely' }],
    recommended: 'Remove credential from prompt; use tool-side authentication.', steps: ['Rotate token', 'Move auth to tool layer'], compensating: [], verification: ['Prompt scan clean; token revoked'], confidence: 0.96, rationale: 'Observed in template. OWASP LLM07, CWE-798.',
  },
  noContract: {
    key: 'ai-no-dpa', title: 'AI SaaS feature enabled without DPA coverage', category: 'AI provider risk', severity: 'medium', cweIds: [], owaspIds: ['LLM03:2025'], attackIds: [], detectionMethod: 'SaaS posture + contract repository check', sources: ['INT-NSK'],
    description: 'An AI feature was enabled inside an existing SaaS tool; the current DPA predates and does not cover sub-processing by the AI provider.', businessImpact: 'Data may be processed by an undisclosed fourth party.', evidence: (c) => [api('SaaS admin setting', `${c.aiName}: ai_features=enabled (by tenant admin)`), { label: 'Contract repository', kind: 'document', content: 'DPA v2022 lists 6 sub-processors; AI model provider not listed.', provenance: 'human-reviewed', reliability: 'high' }],
    missingEvidence: ['Updated sub-processor list from vendor'], rootCauses: [{ statement: 'Feature enabled by default in vendor release.', likelihood: 'possible' }],
    recommended: 'Request updated sub-processor list and DPA amendment, or disable feature.', steps: ['Request amendment', 'Disable pending review'], compensating: [], verification: ['Amended DPA attached'], confidence: 0.82, rationale: 'Configuration observed; contract gap human-reviewed.',
  },
}
