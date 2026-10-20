import type { Assessment, AssessmentAnswer, Criticality, EvidenceDoc, MonitoringAlert, QuestionnaireQuestion, Severity, Vendor, VendorLifecycle } from '@/types'
import type { Clock, Rng } from './rng'
import { pad } from './rng'

// Security questionnaire modelled on common industry questionnaire domains (SIG-style categories).
export const QUESTIONNAIRE: QuestionnaireQuestion[] = [
  { id: 'Q-GOV-1', section: 'Governance & Policy', text: 'Do you maintain a documented information security program approved by senior management and reviewed at least annually?', guidance: 'Provide the policy table of contents and last approval date.', weight: 3, expectsEvidence: true },
  { id: 'Q-GOV-2', section: 'Governance & Policy', text: 'Do you hold a current independent attestation (SOC 2 Type II or ISO/IEC 27001)?', guidance: 'Attach the report or certificate; bridge letter if period ended > 3 months ago.', weight: 4, expectsEvidence: true },
  { id: 'Q-GOV-3', section: 'Governance & Policy', text: 'Is there a named individual accountable for information security (e.g. CISO)?', guidance: '', weight: 1, expectsEvidence: false },
  { id: 'Q-ACC-1', section: 'Identity & Access', text: 'Is multi-factor authentication enforced for all remote and privileged access to systems processing Northstar data?', guidance: 'Phishing-resistant MFA preferred for administrators.', weight: 4, expectsEvidence: false },
  { id: 'Q-ACC-2', section: 'Identity & Access', text: 'Are user access reviews performed at least quarterly for systems containing customer data?', guidance: '', weight: 2, expectsEvidence: true },
  { id: 'Q-ACC-3', section: 'Identity & Access', text: 'Is access revoked within 24 hours of employee or contractor termination?', guidance: '', weight: 2, expectsEvidence: false },
  { id: 'Q-DAT-1', section: 'Data Protection', text: 'Is Northstar data encrypted at rest using AES-256 or equivalent, with keys managed in an HSM or KMS?', guidance: '', weight: 3, expectsEvidence: false },
  { id: 'Q-DAT-2', section: 'Data Protection', text: 'Is data encrypted in transit using TLS 1.2 or higher?', guidance: '', weight: 2, expectsEvidence: false },
  { id: 'Q-DAT-3', section: 'Data Protection', text: 'Is Northstar data logically segregated from other customers\' data?', guidance: '', weight: 3, expectsEvidence: false },
  { id: 'Q-DAT-4', section: 'Data Protection', text: 'Will Northstar data be deleted or returned within 30 days of contract termination, with certificate of destruction?', guidance: '', weight: 2, expectsEvidence: false },
  { id: 'Q-VUL-1', section: 'Vulnerability Management', text: 'Are critical vulnerabilities remediated within 15 days and high within 30 days?', guidance: 'Provide SLA metrics for the last two quarters.', weight: 3, expectsEvidence: true },
  { id: 'Q-VUL-2', section: 'Vulnerability Management', text: 'Is an independent penetration test performed at least annually, with findings tracked to closure?', guidance: 'Attach executive summary.', weight: 3, expectsEvidence: true },
  { id: 'Q-INC-1', section: 'Incident Response', text: 'Do you have a tested incident response plan, including notification to customers within 72 hours of a confirmed breach?', guidance: '', weight: 4, expectsEvidence: true },
  { id: 'Q-INC-2', section: 'Incident Response', text: 'Have you experienced a security incident affecting customer data in the last 24 months?', guidance: 'Answer "No" if none; "Yes"/"Partial" requires an explanation.', weight: 2, expectsEvidence: false },
  { id: 'Q-BCP-1', section: 'Business Continuity', text: 'Are business continuity and disaster recovery plans tested at least annually with documented RTO/RPO?', guidance: '', weight: 3, expectsEvidence: true },
  { id: 'Q-BCP-2', section: 'Business Continuity', text: 'Are backups immutable or logically air-gapped and tested for restoration?', guidance: '', weight: 2, expectsEvidence: false },
  { id: 'Q-TPM-1', section: 'Fourth-Party Management', text: 'Do you maintain an inventory of sub-processors with access to Northstar data and notify us of changes?', guidance: 'Attach sub-processor list.', weight: 3, expectsEvidence: true },
  { id: 'Q-TPM-2', section: 'Fourth-Party Management', text: 'Do you assess the security of your critical sub-processors at least annually?', guidance: '', weight: 2, expectsEvidence: false },
  { id: 'Q-AI-1', section: 'AI Usage', text: 'Do you use AI/ML models to process Northstar data? If yes, is customer data excluded from model training by default?', guidance: 'Describe models, providers and data flows.', weight: 3, expectsEvidence: false },
  { id: 'Q-AI-2', section: 'AI Usage', text: 'Do you maintain controls against prompt injection, data leakage and excessive agency for AI features?', guidance: 'Reference OWASP Top 10 for LLM Applications where relevant.', weight: 2, expectsEvidence: false },
]

interface VendorSeed {
  name: string
  category: string
  description: string
  tier: Criticality
  lifecycle: VendorLifecycle
  owner: string
  services: string[]
  data: string[]
  access: string[]
  rating: number
  ai?: boolean
  fourth: [string, string, boolean, Severity, number][]
}

const V: VendorSeed[] = [
  { name: 'Acme Cloud Services', category: 'Cloud infrastructure (IaaS)', description: 'Primary hosting provider for digital banking and customer data workloads.', tier: 'tier-1', lifecycle: 'remediation', owner: 'USR-003', services: ['SVC-DBK', 'SVC-CDP', 'SVC-PAY'], data: ['Customer PII', 'Account data', 'Transaction data'], access: ['Hosts production workloads'], rating: 712, fourth: [['Global Fiber Co', 'Network transit', false, 'low', 3], ['ColdVault Storage', 'Backup storage', true, 'medium', 2]] },
  { name: 'DataSync Inc', category: 'Data processor (ETL)', description: 'Managed ETL pipelines moving customer data into the CDP.', tier: 'tier-2', lifecycle: 'active', owner: 'USR-018', services: ['SVC-CDP'], data: ['Customer PII', 'Marketing preferences'], access: ['Read access to cdp-lake-raw'], rating: 801, fourth: [['Acme Cloud Services', 'Hosting', true, 'medium', 5]] },
  { name: 'Legacy Payment Co', category: 'Payment gateway', description: 'Secondary card gateway for legacy merchant contracts.', tier: 'tier-1', lifecycle: 'due_diligence', owner: 'USR-003', services: ['SVC-PAY'], data: ['Cardholder data (PAN, tokenized)', 'Transaction data'], access: ['Inbound API to prod-api-gw'], rating: 655, fourth: [['OldTown Data Centers', 'Colocation', true, 'high', 1]] },
  { name: 'Meridian Card Networks', category: 'Card processing', description: 'Primary card issuing and processing partner.', tier: 'tier-1', lifecycle: 'active', owner: 'USR-003', services: ['SVC-PAY', 'SVC-FRD'], data: ['Cardholder data', 'Transaction data'], access: ['Dedicated circuit to pay-hsm-gw'], rating: 842, fourth: [['SecureHSM Ltd', 'HSM hosting', true, 'low', 2]] },
  { name: 'Helix Identity Verification', category: 'KYC / identity verification', description: 'Document and biometric verification for account opening.', tier: 'tier-1', lifecycle: 'active', owner: 'USR-018', services: ['SVC-IDN', 'SVC-DBK'], data: ['Government ID images', 'Biometric templates', 'Customer PII'], access: ['API from idn-login-web'], rating: 768, fourth: [['FaceMatch Labs', 'Biometric matching', true, 'high', 1], ['Acme Cloud Services', 'Hosting', true, 'medium', 5]] },
  { name: 'Northwind Payroll', category: 'HR / payroll SaaS', description: 'Payroll processing for employees.', tier: 'tier-2', lifecycle: 'active', owner: 'USR-018', services: ['SVC-COL'], data: ['Employee PII', 'Bank account details'], access: ['SSO via Okta'], rating: 790, fourth: [['TaxFile Systems', 'Tax filing', true, 'medium', 1]] },
  { name: 'Brightline Contact Center', category: 'Business process outsourcing', description: 'Overflow contact center agents for customer support.', tier: 'tier-2', lifecycle: 'remediation', owner: 'USR-003', services: ['SVC-AIS', 'SVC-DBK'], data: ['Customer PII', 'Account data (view only)'], access: ['VDI access to contact-center-saas'], rating: 641, fourth: [['DeskCloud VDI', 'Virtual desktops', false, 'medium', 1]] },
  { name: 'Lumina AI', category: 'AI provider (LLM SaaS)', description: 'Provider of the enterprise LLM assistant (Northstar Assist).', tier: 'tier-2', lifecycle: 'active', owner: 'USR-004', services: ['SVC-COL'], data: ['Employee prompts', 'Internal documents (Confidential)'], access: ['SSO via Okta', 'SharePoint connector'], rating: 774, ai: true, fourth: [['Acme Cloud Services', 'GPU hosting', true, 'medium', 5]] },
  { name: 'Aurora Models Inc.', category: 'AI provider (model API)', description: 'Foundation model API used by RAG, agent-assist and OCR workloads.', tier: 'tier-2', lifecycle: 'active', owner: 'USR-004', services: ['SVC-AIS', 'SVC-COL'], data: ['Customer case notes', 'Document images'], access: ['API keys from ais-orchestrator'], rating: 735, ai: true, fourth: [['Stratus GPU Cloud', 'Inference hosting', true, 'medium', 2]] },
  { name: 'VectorForge', category: 'AI infrastructure (vector database)', description: 'Managed vector database for the internal RAG application.', tier: 'tier-3', lifecycle: 'due_diligence', owner: 'USR-004', services: ['SVC-COL'], data: ['Embeddings of internal documents'], access: ['Private endpoint'], rating: 702, ai: true, fourth: [] },
  { name: 'Cobalt Code AI', category: 'AI provider (coding assistant)', description: 'AI coding assistant licensed for 420 engineers.', tier: 'tier-3', lifecycle: 'active', owner: 'USR-004', services: ['SVC-PAY', 'SVC-DBK'], data: ['Source code snippets'], access: ['IDE plugin', 'GitHub App'], rating: 760, ai: true, fourth: [['Aurora Models Inc.', 'Model API', true, 'medium', 2]] },
  { name: 'Quarry Analytics', category: 'Marketing analytics SaaS', description: 'Campaign analytics and audience segmentation; recently added AI copy features.', tier: 'tier-3', lifecycle: 'active', owner: 'USR-018', services: ['SVC-CDP'], data: ['Pseudonymized customer segments'], access: ['SFTP drop from cdp-marketing-exports'], rating: 688, ai: true, fourth: [['Undisclosed AI sub-processor', 'Generative AI', true, 'high', 1]] },
  { name: 'Ironclad Backup Solutions', category: 'Backup & disaster recovery', description: 'Off-site immutable backup for core banking adapters and ledger.', tier: 'tier-1', lifecycle: 'active', owner: 'USR-003', services: ['SVC-PAY', 'SVC-DBK'], data: ['Encrypted backups (all classifications)'], access: ['Backup agent on prod servers'], rating: 815, fourth: [['ColdVault Storage', 'Tape vaulting', true, 'low', 2]] },
  { name: 'Summit Print & Mail', category: 'Statement printing', description: 'Prints and mails customer statements and notices.', tier: 'tier-2', lifecycle: 'active', owner: 'USR-018', services: ['SVC-DBK'], data: ['Customer PII', 'Account statements'], access: ['SFTP from dbk-statements-svc'], rating: 702, fourth: [['PostalLink', 'Mail logistics', false, 'low', 1]] },
  { name: 'Pinnacle Legal Services', category: 'Professional services (legal)', description: 'Outside counsel for litigation and regulatory matters.', tier: 'tier-3', lifecycle: 'active', owner: 'USR-018', services: ['SVC-COL'], data: ['Confidential legal documents'], access: ['Secure file share'], rating: 744, fourth: [] },
  { name: 'Tidewater Facilities', category: 'Facilities management', description: 'Building management and physical access systems at HQ.', tier: 'tier-4', lifecycle: 'active', owner: 'USR-018', services: ['SVC-COL'], data: ['Badge access logs'], access: ['Building management network (segmented)'], rating: 671, fourth: [] },
  { name: 'Keystone Fraud Intelligence', category: 'Fraud consortium data', description: 'Shared fraud signals and device reputation feed.', tier: 'tier-1', lifecycle: 'active', owner: 'USR-003', services: ['SVC-FRD'], data: ['Device fingerprints', 'Hashed account identifiers'], access: ['API from fraud-scoring-svc'], rating: 828, fourth: [['Acme Cloud Services', 'Hosting', true, 'medium', 5]] },
  { name: 'Orbit Messaging', category: 'SMS / OTP delivery', description: 'Delivers one-time passcodes and transaction alerts.', tier: 'tier-1', lifecycle: 'remediation', owner: 'USR-003', services: ['SVC-IDN', 'SVC-DBK'], data: ['Phone numbers', 'OTP codes'], access: ['API from idn-mfa-svc'], rating: 598, fourth: [['Carrier aggregator (multiple)', 'SMS routing', true, 'high', 1]] },
  { name: 'Granite Data Center Co', category: 'Colocation', description: 'Hosts on-prem clearing servers in Chicago.', tier: 'tier-2', lifecycle: 'active', owner: 'USR-018', services: ['SVC-PAY'], data: ['Physical custody of servers'], access: ['Physical access (escorted)'], rating: 780, fourth: [] },
  { name: 'Cascade HR Cloud', category: 'HRIS SaaS', description: 'Core HR system of record.', tier: 'tier-2', lifecycle: 'intake', owner: 'USR-018', services: ['SVC-COL'], data: ['Employee PII'], access: ['SSO + SCIM provisioning'], rating: 0, fourth: [] },
  { name: 'Sterling Document Cloud', category: 'E-signature SaaS', description: 'Electronic signatures for account opening and loan documents.', tier: 'tier-2', lifecycle: 'intake', owner: 'USR-003', services: ['SVC-DBK'], data: ['Customer PII', 'Signed agreements'], access: ['API from web-banking-prod'], rating: 0, fourth: [] },
  { name: 'Nimbus CDN', category: 'CDN & DDoS protection', description: 'Edge delivery and DDoS mitigation for customer-facing sites.', tier: 'tier-1', lifecycle: 'due_diligence', owner: 'USR-003', services: ['SVC-DBK', 'SVC-IDN'], data: ['TLS termination (traffic in transit)'], access: ['DNS delegation'], rating: 822, fourth: [] },
  { name: 'Beacon Marketing Agency', category: 'Marketing agency', description: 'Former campaign agency; contract ended.', tier: 'tier-3', lifecycle: 'offboarding', owner: 'USR-018', services: ['SVC-CDP'], data: ['Customer segments (pseudonymized)'], access: ['Shared bucket access', 'Collaboration guest accounts'], rating: 610, fourth: [] },
  { name: 'Redwood Consulting Group', category: 'Professional services (consulting)', description: 'Core banking modernization consultants (engagement completed).', tier: 'tier-3', lifecycle: 'offboarded', owner: 'USR-018', services: ['SVC-DBK'], data: ['Architecture documents'], access: ['None (revoked)'], rating: 735, fourth: [] },
]

const DOC_TYPES: EvidenceDoc['type'][] = ['SOC 2 Type II', 'ISO 27001 Certificate', 'Penetration Test Summary', 'SIG Lite Response', 'Data Processing Agreement', 'BCP/DR Plan', 'Insurance Certificate']

function tierScore(t: Criticality) {
  return { 'tier-1': 90, 'tier-2': 70, 'tier-3': 45, 'tier-4': 25 }[t]
}

export function generateVendors(rng: Rng, clock: Clock) {
  const vendors: Vendor[] = []
  const assessments: Assessment[] = []
  const alerts: MonitoringAlert[] = []
  let docSeq = 1
  let asmSeq = 1
  let alertSeq = 1

  V.forEach((s, i) => {
    const id = `VEN-${pad(i + 1, 3)}`
    const dataSensitivity = s.data.some((d) => /Cardholder|Biometric|Government ID|PII/.test(d)) ? 'High' : s.data.some((d) => /Confidential|Account/.test(d)) ? 'Medium' : 'Low'
    const inherent = Math.min(98, Math.round(tierScore(s.tier) * 0.6 + (dataSensitivity === 'High' ? 30 : dataSensitivity === 'Medium' ? 18 : 6) + (s.ai ? 6 : 0) + rng.int(-4, 4)))
    const preAssessment = ['intake', 'due_diligence'].includes(s.lifecycle)
    const residual = preAssessment ? inherent : Math.max(12, Math.round(inherent * (s.rating ? (1000 - s.rating) / 420 : 0.8) + rng.int(-5, 5)))
    const onboarded = clock.ago(rng.int(120, 1400))
    const contractEnd = s.lifecycle === 'offboarded' ? clock.ago(40) : s.lifecycle === 'offboarding' ? clock.ago(8) : clock.ahead(rng.int(20, 700))
    const docs: EvidenceDoc[] = preAssessment && s.lifecycle === 'intake'
      ? []
      : rng.pickN(DOC_TYPES, rng.int(3, 6)).map((type) => {
          const status: EvidenceDoc['status'] = rng.weighted([['analyzed', 4], ['accepted', 4], ['pending_review', 2], ['expired', 1]])
          return {
            id: `DOC-${pad(docSeq++)}`,
            name: `${s.name} — ${type}${type === 'SOC 2 Type II' ? ' (period ending ' + clock.ago(rng.int(60, 300)).slice(0, 7) + ')' : ''}.pdf`,
            type,
            uploadedAt: clock.ago(rng.int(5, 200)),
            expiresAt: status === 'expired' ? clock.ago(rng.int(2, 40)) : clock.ahead(rng.int(30, 330)),
            status,
            analysis: status === 'pending_review' ? undefined : {
              summary: type === 'SOC 2 Type II' ? `Unqualified opinion covering Security and Availability criteria. ${rng.chance(0.4) ? '2 exceptions noted in CC6.1 (access reviews) — management response provided.' : 'No exceptions noted.'}` : type === 'Penetration Test Summary' ? `${rng.int(0, 2)} high, ${rng.int(1, 6)} medium findings; vendor reports remediation of all highs.` : `${type} reviewed; content aligns with questionnaire responses.`,
              exceptions: type === 'SOC 2 Type II' && rng.chance(0.4) ? ['CC6.1 — Quarterly access review not completed for 1 of 4 quarters', 'CC7.2 — Alert triage SLA missed in sampled period'] : [],
              coverage: rng.int(62, 96),
              analyzedBy: 'Vendor Evidence Analyzer (simulated)',
              provenance: status === 'accepted' ? 'human-reviewed' : 'simulated',
            },
          }
        })
    const milestones = [
      { id: `${id}-M1`, title: 'Annual security review', dueDate: clock.ahead(rng.int(-20, 120)), type: 'Security review' as const, status: 'upcoming' as const },
      { id: `${id}-M2`, title: 'Contract renewal decision', dueDate: new Date(new Date(contractEnd).getTime() - 60 * 86_400_000).toISOString(), type: 'Renewal' as const, status: 'upcoming' as const },
      { id: `${id}-M3`, title: 'Updated cyber insurance certificate', dueDate: clock.ahead(rng.int(-10, 200)), type: 'Insurance' as const, status: 'upcoming' as const },
      { id: `${id}-M4`, title: 'Right-to-audit window', dueDate: clock.ahead(rng.int(30, 300)), type: 'Right to audit' as const, status: 'upcoming' as const },
    ].map((m) => ({ ...m, status: (new Date(m.dueDate) < clock.anchor ? (rng.chance(0.6) ? 'met' : 'missed') : new Date(m.dueDate).getTime() - clock.anchor.getTime() < 21 * 86_400_000 ? 'at_risk' : 'upcoming') as Vendor['contract']['milestones'][number]['status'] }))
    const v: Vendor = {
      id,
      name: s.name,
      category: s.category,
      description: s.description,
      website: `https://www.${s.name.toLowerCase().replace(/[^a-z]+/g, '')}.example`,
      tier: s.tier,
      lifecycle: s.lifecycle,
      relationshipOwnerId: s.owner,
      businessServiceIds: s.services,
      dataAccess: s.data,
      integrationAccess: s.access,
      inherentRisk: inherent,
      residualRisk: residual,
      securityRating: s.rating,
      ratingTrend: s.rating ? Array.from({ length: 12 }, (_, k) => Math.round(s.rating + (11 - k) * rng.int(-6, 8) * (s.lifecycle === 'remediation' ? -0.8 : 0.3))) .reverse() : [],
      onboardedAt: onboarded,
      nextReviewDate: clock.ahead(rng.int(-15, 300)),
      contract: {
        id: `CTR-${pad(i + 1, 3)}`,
        value: rng.pick([48_000, 120_000, 260_000, 540_000, 1_200_000, 2_400_000]) * (s.tier === 'tier-1' ? 2 : 1),
        start: onboarded,
        end: contractEnd,
        securityClauses: ['Breach notification within 72 hours', 'Annual SOC 2 Type II report', 'Right to audit (annual)', 'Data return/destruction within 30 days', ...(s.ai ? ['No training on customer data without consent'] : [])],
        milestones,
      },
      evidenceDocs: docs,
      fourthParties: s.fourth.map(([name, service, dataShared, riskLevel, concentration]) => ({ name, service, dataShared, riskLevel, concentration })),
      inherentRiskFactors: [
        { factor: 'Business criticality', value: s.tier.toUpperCase(), weight: 0.35 },
        { factor: 'Data sensitivity', value: dataSensitivity, weight: 0.3 },
        { factor: 'System / network access', value: s.access.join('; '), weight: 0.2 },
        { factor: 'AI processing of Northstar data', value: s.ai ? 'Yes' : 'No', weight: 0.15 },
      ],
      isAIProvider: s.ai,
      history: [
        { id: `${id}-H1`, at: onboarded, actorId: s.owner, type: 'status_change', summary: 'Vendor registered (intake)' },
        ...(preAssessment ? [] : [{ id: `${id}-H2`, at: new Date(new Date(onboarded).getTime() + 30 * 86_400_000).toISOString(), actorId: s.owner, type: 'status_change' as const, summary: 'Due diligence completed — vendor approved' }]),
      ],
    }
    if (s.lifecycle === 'offboarding' || s.lifecycle === 'offboarded') {
      const done = s.lifecycle === 'offboarded'
      v.offboarding = {
        startedAt: clock.ago(done ? 60 : 10),
        checklist: [
          'Revoke SSO / guest accounts',
          'Remove network and API access (keys, IP allow-lists)',
          'Confirm data return or certified destruction',
          'Retrieve physical assets / badges',
          'Close open remediation items or record residual risk',
          'Final invoice and contract closure',
          'Archive due-diligence record for audit',
        ].map((item, k) => ({ id: `${id}-OB${k + 1}`, item, done: done || k < 2, doneAt: done || k < 2 ? clock.ago(done ? 50 - k : 9 - k) : undefined })),
        residualRiskNote: done ? 'All obligations closed; no residual risk identified.' : undefined,
      }
    }
    vendors.push(v)

    // Assessments
    const mkAnswers = (quality: number, count = QUESTIONNAIRE.length): AssessmentAnswer[] =>
      QUESTIONNAIRE.filter((q) => s.ai || q.section !== 'AI Usage').slice(0, count).map((q) => ({
        questionId: q.id,
        answer: q.id === 'Q-INC-2' ? (rng.chance(0.15) ? 'yes' : 'no') : rng.weighted([['yes', quality], ['partial', 1.6], ['no', 1.1 - quality * 0.08], ['na', 0.2]]),
        comment: rng.chance(0.25) ? 'See attached evidence.' : undefined,
        evidenceDocId: q.expectsEvidence && docs.length ? rng.pick(docs).id : undefined,
      }))

    if (!['intake'].includes(s.lifecycle)) {
      const quality = s.rating > 780 ? 7 : s.rating > 700 ? 5 : 3
      if (s.lifecycle !== 'due_diligence') {
        const answers = mkAnswers(quality)
        assessments.push({ id: `ASM-${pad(asmSeq++)}`, vendorId: id, name: `${s.name} — ${s.ai ? 'AI provider assessment' : 'Annual reassessment'} ${new Date(clock.ago(rng.int(30, 200))).getFullYear()}`, type: s.ai ? 'AI provider assessment' : 'Annual reassessment', status: 'completed', createdById: s.owner, createdAt: clock.ago(rng.int(60, 220)), dueDate: clock.ago(rng.int(20, 50)), submittedAt: clock.ago(rng.int(25, 55)), completedAt: clock.ago(rng.int(10, 24)), answers, result: undefined })
      }
      if (['due_diligence', 'remediation'].includes(s.lifecycle) || rng.chance(0.25)) {
        const partial = s.lifecycle === 'due_diligence'
        assessments.push({ id: `ASM-${pad(asmSeq++)}`, vendorId: id, name: `${s.name} — ${partial ? 'Initial due diligence' : 'Targeted reassessment'}`, type: partial ? 'Initial due diligence' : 'Targeted (incident)', status: partial ? rng.pick(['in_progress', 'sent', 'submitted'] as const) : 'in_progress', createdById: s.owner, createdAt: clock.ago(rng.int(5, 25)), dueDate: clock.ahead(rng.int(-3, 21)), answers: mkAnswers(quality, rng.int(6, 14)) })
      }
    } else {
      assessments.push({ id: `ASM-${pad(asmSeq++)}`, vendorId: id, name: `${s.name} — Initial due diligence`, type: 'Initial due diligence', status: 'draft', createdById: s.owner, createdAt: clock.ago(2), dueDate: clock.ahead(21), answers: [] })
    }

    // Monitoring alerts
    const alertDefs: [MonitoringAlert['type'], Severity, string, string][] = []
    if (s.lifecycle === 'remediation') alertDefs.push(['Security rating drop', 'high', `Outside-in rating dropped ${rng.int(40, 90)} points in 30 days`, 'Rating drivers: exposed RDP service on vendor-owned IP range; outdated TLS on customer portal.'])
    if (s.name === 'Orbit Messaging') alertDefs.push(['Data breach report', 'critical', 'Public report of SMS routing compromise at carrier aggregator', 'Threat intelligence reports unauthorized access at a carrier aggregator used by Orbit Messaging; OTP interception risk. Vendor confirmation pending.'])
    if (s.name === 'Brightline Contact Center') alertDefs.push(['Leaked credentials', 'high', '14 employee credentials found in infostealer logs', 'Credentials associated with vendor domain appeared in a paste site; may include VDI accounts.'])
    if (docs.some((d) => d.status === 'expired')) alertDefs.push(['Certificate expiry', 'medium', 'Evidence document expired', 'One or more due-diligence artifacts are past their validity date.'])
    if (rng.chance(0.3)) alertDefs.push(['Exposed service', 'medium', 'New internet-exposed service detected on vendor asset', 'Port 3389 (RDP) observed on an IP range attributed to the vendor.'])
    if (s.fourth.some((f) => f[3] === 'high')) alertDefs.push(['Fourth-party incident', 'medium', `Risk signal at fourth party ${s.fourth.find((f) => f[3] === 'high')![0]}`, 'Fourth-party security rating below threshold; concentration risk noted.'])
    if (milestones.some((m) => m.status === 'missed')) alertDefs.push(['Contract obligation', 'medium', 'Contractual security milestone missed', `${milestones.find((m) => m.status === 'missed')!.title} not completed by due date.`])
    for (const [type, sev, title, detail] of alertDefs) {
      alerts.push({ id: `MON-${pad(alertSeq++)}`, vendorId: id, title, type, severity: sev, detectedAt: clock.ago(rng.int(0, 25), rng.int(0, 23)), source: type === 'Security rating drop' || type === 'Exposed service' ? 'SecurityScorecard (simulated)' : type === 'Contract obligation' || type === 'Certificate expiry' ? 'DO SAFE contract monitor' : 'Recorded Future (simulated)', status: rng.weighted([['open', 5], ['acknowledged', 2], ['resolved', 1]]), detail })
    }
  })

  return { vendors, assessments, alerts }
}

/** Illustrative scoring: weighted share of "yes" (1), "partial" (0.5); "na" excluded. */
export function scoreAssessment(answers: AssessmentAnswer[], includeAI: boolean) {
  const qs = QUESTIONNAIRE.filter((q) => includeAI || q.section !== 'AI Usage')
  const sections = [...new Set(qs.map((q) => q.section))]
  const sectionScores = sections.map((section) => {
    const items = qs.filter((q) => q.section === section)
    let got = 0
    let max = 0
    for (const q of items) {
      const a = answers.find((x) => x.questionId === q.id)
      if (!a || a.answer === 'na') continue
      const val = q.id === 'Q-INC-2' ? (a.answer === 'no' ? 1 : a.answer === 'partial' ? 0.5 : 0.3) : a.answer === 'yes' ? 1 : a.answer === 'partial' ? 0.5 : 0
      got += val * q.weight
      max += q.weight
    }
    return { section, score: max ? Math.round((got / max) * 100) : 0 }
  })
  const answered = sectionScores.filter((s) => s.score > 0 || answers.some((a) => qs.find((q) => q.id === a.questionId)?.section === s.section))
  const score = answered.length ? Math.round(answered.reduce((s, x) => s + x.score, 0) / answered.length) : 0
  const gaps = qs
    .map((q) => ({ q, a: answers.find((x) => x.questionId === q.id) }))
    .filter(({ q, a }) => a && q.id !== 'Q-INC-2' && (a.answer === 'no' || a.answer === 'partial'))
    .map(({ q, a }) => ({ questionId: q.id, severity: (a!.answer === 'no' ? (q.weight >= 4 ? 'critical' : q.weight >= 3 ? 'high' : 'medium') : q.weight >= 3 ? 'medium' : 'low') as Severity, summary: `${q.section}: ${a!.answer === 'no' ? 'Control not in place' : 'Control partially in place'} — ${q.text.replace(/\?$/, '')}` }))
  const rating: Severity = score >= 85 ? 'low' : score >= 70 ? 'medium' : score >= 50 ? 'high' : 'critical'
  return { score, rating, sectionScores, gaps }
}
