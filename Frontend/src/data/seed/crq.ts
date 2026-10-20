import type { Control, Finding, InvestmentOption, RiskScenario } from '@/types'
import type { Clock, Rng } from './rng'

export function generateControls(rng: Rng, clock: Clock): Control[] {
  const c = (id: string, name: string, category: Control['category'], description: string, effectiveness: number, coverage: number, annualCost: number, ownerId: string, evidence: string): Control => ({
    id, name, category, description, effectiveness, coverage, annualCost, ownerId, evidence,
    lastTested: clock.ago(rng.int(10, 160)),
    trend: Array.from({ length: 6 }, (_, i) => Math.min(0.98, Math.max(0.2, Number((effectiveness - (5 - i) * rng.float(-0.01, 0.03)).toFixed(2))))),
  })
  return [
    c('CTL-MFA', 'Multi-factor authentication', 'Protect', 'Phishing-resistant MFA for workforce and step-up MFA for customers.', 0.72, 0.86, 410_000, 'USR-010', 'IdP policy evaluation (Okta) · 14 admins without FIDO2'),
    c('CTL-EDR', 'Endpoint detection & response', 'Detect', 'EDR coverage on servers and endpoints with 24×7 managed response.', 0.81, 0.93, 690_000, 'USR-008', 'Sensor coverage report · quarterly purple-team test'),
    c('CTL-VM', 'Vulnerability management program', 'Identify', 'Continuous scanning, prioritization and SLA-driven remediation.', 0.58, 0.88, 520_000, 'USR-007', 'Derived from DO SAFE finding SLA performance'),
    c('CTL-SEG', 'Network segmentation', 'Protect', 'Segmentation between user, server, payment (CDE) and management zones.', 0.66, 0.7, 380_000, 'USR-017', 'Firewall rule review · CDE segmentation test (PCI)'),
    c('CTL-BKP', 'Immutable backup & recovery', 'Recover', 'Immutable, off-site backups with quarterly restore testing.', 0.84, 0.9, 450_000, 'USR-017', 'Restore test results (Ironclad Backup Solutions)'),
    c('CTL-DLP', 'Data loss prevention', 'Protect', 'DLP across email, SSE, endpoints and AI gateway.', 0.55, 0.64, 300_000, 'USR-004', 'SSE / DLP policy coverage report'),
    c('CTL-EML', 'Email security & phishing defense', 'Protect', 'Secure email gateway, DMARC enforcement and awareness training.', 0.74, 0.97, 260_000, 'USR-013', 'Phishing simulation click rate 3.1% (illustrative)'),
    c('CTL-DDOS', 'DDoS protection & WAF', 'Protect', 'Edge WAF and volumetric DDoS mitigation for customer channels.', 0.79, 0.82, 340_000, 'USR-011', 'CDN configuration review · annual DDoS test'),
    c('CTL-TPRM', 'Third-party risk program', 'Govern', 'Tiered vendor due diligence, monitoring and contract controls.', 0.61, 0.78, 280_000, 'USR-003', 'Derived from DO SAFE TPRM assessment coverage'),
    c('CTL-AIGOV', 'AI governance & guardrails', 'Govern', 'AI inventory, use-case approval, AI gateway guardrails and logging.', 0.42, 0.55, 220_000, 'USR-004', 'Derived from DO SAFE AI-SPM governance status'),
    c('CTL-SIEM', 'Security monitoring (SIEM/SOC)', 'Detect', 'Centralized logging, correlation and 24×7 SOC triage.', 0.68, 0.75, 820_000, 'USR-008', 'Detection coverage mapped to ATT&CK (illustrative)'),
    c('CTL-PAM', 'Privileged access management', 'Protect', 'Vaulted privileged credentials, session recording and JIT access.', 0.63, 0.68, 360_000, 'USR-010', 'PAM onboarding coverage report'),
    c('CTL-IR', 'Incident response readiness', 'Respond', 'IR plan, retainer and tabletop exercises.', 0.7, 1, 190_000, 'USR-008', 'Tabletop exercise report (2 per year)'),
  ]
}

export function generateScenarios(findings: Finding[]): RiskScenario[] {
  const pick = (svc: string, pred: (f: Finding) => boolean, n = 8) => findings.filter((f) => f.businessServiceId === svc && pred(f)).slice(0, n).map((f) => f.id)
  const rce = (f: Finding) => ['Remote code execution', 'Command injection', 'Insecure deserialization', 'Authentication bypass', 'Memory corruption', 'Injection'].includes(f.category)
  const exposure = (f: Finding) => ['Cloud misconfiguration', 'External exposure', 'Secrets exposure'].includes(f.category)
  const ident = (f: Finding) => f.domain === 'identity'
  const ai = (f: Finding) => f.domain === 'ai'
  const dos = (f: Finding) => f.category === 'Denial of service'

  return [
    {
      id: 'RSK-001', name: 'Ransomware disrupts payment processing', description: 'Criminal ransomware affiliate gains initial access via an internet-facing vulnerability and encrypts clearing and settlement systems.', threatActor: 'Financially motivated ransomware affiliate', threatType: 'Ransomware', businessServiceId: 'SVC-PAY', findingIds: pick('SVC-PAY', rce), vendorIds: ['VEN-013'], aiSystemIds: [],
      controls: [{ controlId: 'CTL-EDR', relevance: 0.6 }, { controlId: 'CTL-BKP', relevance: 0.45 }, { controlId: 'CTL-SEG', relevance: 0.4 }, { controlId: 'CTL-VM', relevance: 0.5 }],
      params: { baseAEP: 0.22, lossLow: 2_500_000, lossMostLikely: 8_500_000, lossHigh: 28_000_000, controlEffectiveness: {} },
      lossComponents: [{ component: 'Business interruption (lost transaction revenue)', share: 0.42 }, { component: 'Incident response & forensics', share: 0.12 }, { component: 'Recovery & restoration', share: 0.16 }, { component: 'Regulatory & legal', share: 0.18 }, { component: 'Customer remediation & reputation', share: 0.12 }],
      assumptions: ['Payment processing outage of 18–72 hours (RTO 2h not achieved under ransomware conditions)', 'Base AEP derived from illustrative industry frequency for mid-size financial institutions — not an actuarial rate', 'Ransom payment excluded (policy: no payment)', 'Loss magnitudes are illustrative ranges agreed with Finance for demo purposes', 'Each open high/critical linked finding increases event probability by 4% (capped at +60%)'],
      savedSimulations: [],
    },
    {
      id: 'RSK-002', name: 'Customer data breach via cloud misconfiguration', description: 'Exposure of customer profile data through misconfigured cloud storage or exposed databases.', threatActor: 'Opportunistic external actor', threatType: 'Data breach', businessServiceId: 'SVC-CDP', findingIds: pick('SVC-CDP', (f) => exposure(f) || f.domain === 'misconfiguration'), vendorIds: ['VEN-002', 'VEN-001'], aiSystemIds: [],
      controls: [{ controlId: 'CTL-DLP', relevance: 0.4 }, { controlId: 'CTL-VM', relevance: 0.5 }, { controlId: 'CTL-SIEM', relevance: 0.35 }],
      params: { baseAEP: 0.18, lossLow: 1_800_000, lossMostLikely: 5_200_000, lossHigh: 19_000_000, controlEffectiveness: {} },
      lossComponents: [{ component: 'Notification & credit monitoring', share: 0.24 }, { component: 'Regulatory fines (GLBA / state AG)', share: 0.26 }, { component: 'Litigation', share: 0.22 }, { component: 'Forensics & response', share: 0.1 }, { component: 'Customer churn', share: 0.18 }],
      assumptions: ['Up to ~400k customer records affected (illustrative)', 'Per-record cost assumptions are illustrative', 'Cyber insurance recovery excluded from gross loss'], savedSimulations: [],
    },
    {
      id: 'RSK-003', name: 'Account takeover fraud via identity compromise', description: 'MFA fatigue or session hijacking enables takeover of customer or admin accounts leading to fraudulent transfers.', threatActor: 'Organized fraud ring', threatType: 'Fraud via account takeover', businessServiceId: 'SVC-IDN', findingIds: [...pick('SVC-IDN', (f) => ident(f) || rce(f) || f.category === 'Information disclosure')], vendorIds: ['VEN-018', 'VEN-005'], aiSystemIds: [],
      controls: [{ controlId: 'CTL-MFA', relevance: 0.7 }, { controlId: 'CTL-PAM', relevance: 0.35 }, { controlId: 'CTL-SIEM', relevance: 0.3 }],
      params: { baseAEP: 0.35, lossLow: 600_000, lossMostLikely: 2_400_000, lossHigh: 9_500_000, controlEffectiveness: {} },
      lossComponents: [{ component: 'Direct fraud losses', share: 0.48 }, { component: 'Customer reimbursement (Reg E)', share: 0.2 }, { component: 'Investigation', share: 0.12 }, { component: 'Reputation', share: 0.2 }],
      assumptions: ['Orbit Messaging (SMS OTP) compromise increases likelihood while unresolved', 'Losses net of fraud recovery'], savedSimulations: [],
    },
    {
      id: 'RSK-004', name: 'Digital banking outage from DDoS / exploitation', description: 'Availability attack against customer-facing digital banking channels.', threatActor: 'Hacktivist / DDoS-for-hire', threatType: 'Service outage (DDoS)', businessServiceId: 'SVC-DBK', findingIds: pick('SVC-DBK', (f) => dos(f) || rce(f) || f.category === 'Cloud misconfiguration'), vendorIds: ['VEN-022'], aiSystemIds: [],
      controls: [{ controlId: 'CTL-DDOS', relevance: 0.75 }, { controlId: 'CTL-IR', relevance: 0.3 }],
      params: { baseAEP: 0.45, lossLow: 300_000, lossMostLikely: 1_100_000, lossHigh: 4_800_000, controlEffectiveness: {} },
      lossComponents: [{ component: 'Lost fee revenue', share: 0.35 }, { component: 'Call center surge', share: 0.15 }, { component: 'Regulatory reporting', share: 0.15 }, { component: 'Reputation', share: 0.35 }],
      assumptions: ['Outage duration 4–24 hours', 'CDN DDoS protection (Nimbus CDN) still under due diligence'], savedSimulations: [],
    },
    {
      id: 'RSK-005', name: 'Third-party compromise exposes cardholder data', description: 'A payment gateway or processor is breached, exposing Northstar cardholder data.', threatActor: 'Supply-chain focused criminal group', threatType: 'Third-party compromise', businessServiceId: 'SVC-PAY', findingIds: pick('SVC-PAY', (f) => f.category === 'Injection' || f.templateKey === 'moveit', 3), vendorIds: ['VEN-003', 'VEN-004'], aiSystemIds: [],
      controls: [{ controlId: 'CTL-TPRM', relevance: 0.6 }, { controlId: 'CTL-SEG', relevance: 0.2 }],
      params: { baseAEP: 0.12, lossLow: 1_500_000, lossMostLikely: 6_000_000, lossHigh: 22_000_000, controlEffectiveness: {} },
      lossComponents: [{ component: 'Card reissuance & fraud', share: 0.34 }, { component: 'PCI assessments & fines', share: 0.22 }, { component: 'Legal', share: 0.2 }, { component: 'Reputation', share: 0.24 }],
      assumptions: ['Contractual indemnity recovery not modelled', 'Legacy Payment Co due diligence incomplete'], savedSimulations: [],
    },
    {
      id: 'RSK-006', name: 'Sensitive data leakage through AI systems', description: 'Confidential or regulated data exposed via shadow AI, misconfigured RAG, or prompt injection against customer-facing agents.', threatActor: 'Insider error / external prompt injection', threatType: 'AI data leakage', businessServiceId: 'SVC-AIS', findingIds: findings.filter(ai).filter((f) => !['resolved', 'false_positive'].includes(f.status)).slice(0, 10).map((f) => f.id), vendorIds: ['VEN-008', 'VEN-009', 'VEN-012'], aiSystemIds: ['AIS-002', 'AIS-003', 'AIS-006', 'AIS-011', 'AIS-016'],
      controls: [{ controlId: 'CTL-AIGOV', relevance: 0.7 }, { controlId: 'CTL-DLP', relevance: 0.5 }],
      params: { baseAEP: 0.3, lossLow: 250_000, lossMostLikely: 1_600_000, lossHigh: 7_500_000, controlEffectiveness: {} },
      lossComponents: [{ component: 'Regulatory (GLBA, privacy)', share: 0.32 }, { component: 'Investigation & legal', share: 0.25 }, { component: 'Contractual / customer remediation', share: 0.18 }, { component: 'Reputation', share: 0.25 }],
      assumptions: ['AI-related loss data is sparse; ranges are expert-elicited illustrative estimates', 'Includes both internal (RAG) and customer-facing exposure paths'], savedSimulations: [],
    },
    {
      id: 'RSK-007', name: 'Fraud model tampering or poisoning', description: 'Compromise of fraud scoring pipeline (e.g. message broker RCE) allows manipulation of scores or features.', threatActor: 'Organized fraud ring with technical capability', threatType: 'Fraud via account takeover', businessServiceId: 'SVC-FRD', findingIds: pick('SVC-FRD', (f) => rce(f) || f.domain === 'ai' || exposure(f)), vendorIds: ['VEN-017'], aiSystemIds: ['AIS-005', 'AIS-008'],
      controls: [{ controlId: 'CTL-SEG', relevance: 0.45 }, { controlId: 'CTL-SIEM', relevance: 0.4 }, { controlId: 'CTL-AIGOV', relevance: 0.3 }],
      params: { baseAEP: 0.08, lossLow: 1_000_000, lossMostLikely: 4_500_000, lossHigh: 16_000_000, controlEffectiveness: {} },
      lossComponents: [{ component: 'Undetected fraud losses', share: 0.6 }, { component: 'Model rebuild & validation', share: 0.15 }, { component: 'Regulatory (model risk)', share: 0.25 }],
      assumptions: ['Detection within 7–30 days', 'Fraud loss uplift relative to baseline'], savedSimulations: [],
    },
    {
      id: 'RSK-008', name: 'Business email compromise in collaboration suite', description: 'Credential phishing leads to mailbox takeover and fraudulent payment instructions.', threatActor: 'BEC group', threatType: 'Business email compromise', businessServiceId: 'SVC-COL', findingIds: pick('SVC-COL', (f) => f.domain === 'misconfiguration' || f.domain === 'identity' || rce(f)), vendorIds: [], aiSystemIds: ['AIS-007'],
      controls: [{ controlId: 'CTL-EML', relevance: 0.7 }, { controlId: 'CTL-MFA', relevance: 0.5 }],
      params: { baseAEP: 0.4, lossLow: 150_000, lossMostLikely: 750_000, lossHigh: 3_200_000, controlEffectiveness: {} },
      lossComponents: [{ component: 'Fraudulent wire losses', share: 0.65 }, { component: 'Investigation', share: 0.15 }, { component: 'Legal', share: 0.2 }],
      assumptions: ['Wire recall success not modelled'], savedSimulations: [],
    },
    {
      id: 'RSK-009', name: 'CI/CD supply-chain compromise', description: 'Compromise of the build server or leaked deployment credentials leads to malicious code in payment or banking releases.', threatActor: 'State-aligned or criminal supply-chain actor', threatType: 'Third-party compromise', businessServiceId: 'SVC-DBK', findingIds: findings.filter((f) => ['teamcity', 'secret-repo'].includes(f.templateKey) || (f.domain === 'ai' && f.templateKey === 'ai-scope')).map((f) => f.id), vendorIds: ['VEN-011'], aiSystemIds: ['AIS-004', 'AIS-015'],
      controls: [{ controlId: 'CTL-PAM', relevance: 0.4 }, { controlId: 'CTL-VM', relevance: 0.4 }, { controlId: 'CTL-SIEM', relevance: 0.25 }],
      params: { baseAEP: 0.06, lossLow: 2_000_000, lossMostLikely: 7_000_000, lossHigh: 30_000_000, controlEffectiveness: {} },
      lossComponents: [{ component: 'Incident response & rebuild', share: 0.3 }, { component: 'Customer impact', share: 0.3 }, { component: 'Regulatory', share: 0.2 }, { component: 'Reputation', share: 0.2 }],
      assumptions: ['Low frequency / high impact tail scenario'], savedSimulations: [],
    },
  ]
}

export const INVESTMENTS: InvestmentOption[] = [
  { id: 'INV-001', name: 'Phishing-resistant MFA for all privileged & remote access', description: 'Roll out FIDO2 security keys / passkeys to admins, contractors and remote workforce; enable number matching.', controlId: 'CTL-MFA', oneTimeCost: 180_000, annualCost: 60_000, effectivenessUplift: 0.16, scenarioIds: ['RSK-003', 'RSK-008', 'RSK-001'] },
  { id: 'INV-002', name: 'Accelerated patching for internet-facing assets', description: 'Automated patch pipelines and emergency change process for KEV-listed vulnerabilities on external assets.', controlId: 'CTL-VM', oneTimeCost: 250_000, annualCost: 140_000, effectivenessUplift: 0.2, scenarioIds: ['RSK-001', 'RSK-002', 'RSK-004', 'RSK-009'] },
  { id: 'INV-003', name: 'AI gateway with DLP and guardrails', description: 'Route all sanctioned AI traffic through a gateway with redaction, logging and prompt-injection detection; block unsanctioned AI.', controlId: 'CTL-AIGOV', oneTimeCost: 210_000, annualCost: 95_000, effectivenessUplift: 0.25, scenarioIds: ['RSK-006', 'RSK-007'] },
  { id: 'INV-004', name: 'CDE micro-segmentation', description: 'Identity-based micro-segmentation around payment and fraud workloads.', controlId: 'CTL-SEG', oneTimeCost: 420_000, annualCost: 110_000, effectivenessUplift: 0.14, scenarioIds: ['RSK-001', 'RSK-007', 'RSK-005'] },
  { id: 'INV-005', name: 'Continuous third-party monitoring expansion', description: 'Extend continuous monitoring and automated due diligence to all tier-1/2 vendors and key fourth parties.', controlId: 'CTL-TPRM', oneTimeCost: 90_000, annualCost: 120_000, effectivenessUplift: 0.15, scenarioIds: ['RSK-005', 'RSK-003', 'RSK-002'] },
  { id: 'INV-006', name: 'Privileged access management expansion', description: 'Onboard remaining privileged accounts, CI/CD secrets and break-glass accounts to PAM with JIT.', controlId: 'CTL-PAM', oneTimeCost: 160_000, annualCost: 70_000, effectivenessUplift: 0.18, scenarioIds: ['RSK-009', 'RSK-003', 'RSK-001'] },
]
