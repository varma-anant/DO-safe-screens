// Plain-language copy shared across the product so a non-specialist never meets unexplained jargon.
// Technical terms stay available (tooltips, advanced views) but are never the only explanation.
import type { BusinessService, Severity } from '@/types'

export interface GlossaryEntry {
  term: string
  plain: string
  /** One or two sentences, no jargon. */
  meaning: string
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  application: { term: 'Application', plain: 'Application', meaning: 'Something your organization runs that people use — a website, a customer portal, an internal tool, an AI assistant.' },
  safe: { term: 'SAFE application', plain: 'Protected application', meaning: 'An application DO SAFE is actively watching: its parts are listed, its tools are connected and it is checked every day.' },
  project: { term: 'Project', plain: 'Project', meaning: 'A folder for related applications, for example "Customer Portal" or "Finance systems". Only people you add can see it.' },
  asset: { term: 'Asset', plain: 'Part', meaning: 'One building block of an application — a website, a database, a server, a code repository. DO SAFE checks each part.' },
  map: { term: 'Asset map', plain: 'How the parts connect', meaning: 'A picture of which parts talk to each other. It shows how far a problem in one part could spread.' },
  source: { term: 'Source / integration', plain: 'Tool', meaning: 'A security product you already use (for example a cloud or code scanner). DO SAFE reads its results with read-only access.' },
  coverage: { term: 'Coverage', plain: 'Checked parts', meaning: 'How many of an application\'s parts have at least one connected tool checking them.' },
  test: { term: 'Test run', plain: 'Test run', meaning: 'A quick, safe check that DO SAFE can reach every part and that each tool\'s access works. It changes nothing and reports no problems yet.' },
  full: { term: 'Full run', plain: 'Turn on protection', meaning: 'The first complete check of every part. After it, DO SAFE keeps checking automatically every day.' },
  finding: { term: 'Finding', plain: 'Problem', meaning: 'A security problem DO SAFE found, with an explanation of why it matters and step-by-step instructions to fix it.' },
  severity: { term: 'Severity', plain: 'How urgent', meaning: 'How bad a problem is if someone takes advantage of it: urgent, high, medium or low.' },
  risk: { term: 'Risk score', plain: 'Priority', meaning: 'A 0–100 number combining how bad a problem is, how easy it is to exploit and how important the affected application is. Higher means fix sooner.' },
  ticket: { term: 'Ticket', plain: 'Task', meaning: 'A to-do assigned to a person with a due date, created to fix a problem.' },
  remediation: { term: 'Remediation', plain: 'Fixing', meaning: 'The work of fixing a problem — patching, changing a setting or removing access.' },
  kev: { term: 'KEV', plain: 'Being exploited', meaning: 'On the US government\'s list of weaknesses attackers are actively using right now. Fix these first.' },
  cve: { term: 'CVE', plain: 'Known weakness ID', meaning: 'A public ID for a known software weakness, like CVE-2021-44228. Useful when talking to your IT team or vendor.' },
  epss: { term: 'EPSS', plain: 'Chance of attack', meaning: 'An estimate of how likely attackers are to try this weakness in the next 30 days.' },
  ale: { term: 'ALE', plain: 'Expected yearly loss', meaning: 'A rough estimate of how much money a type of incident could cost per year, on average. Illustrative in this demo.' },
  attackPath: { term: 'Attack path', plain: 'Route an attacker could take', meaning: 'A chain of small problems that, combined, could let an attacker reach something valuable.' },
  internet: { term: 'Internet-facing', plain: 'Visible on the internet', meaning: 'Anyone on the internet can reach this part, so problems on it are more urgent.' },
  readOnly: { term: 'Read-only access', plain: 'Look, don\'t touch', meaning: 'DO SAFE can read results and settings, but cannot change, delete or create anything in your systems.' },
}

export type GlossaryKey = keyof typeof GLOSSARY

// ---------------------------------------------------------------- Application types

export const APP_TYPE_PLAIN: Record<BusinessService['appType'], { title: string; example: string }> = {
  'Web application': { title: 'Our website or customer portal', example: 'e.g. online store, booking site, customer login area' },
  'API service': { title: 'Systems that connect to partners', example: 'e.g. payment links, partner data feeds, mobile app back end' },
  'Cloud workload': { title: 'Our cloud servers', example: 'e.g. apps running on AWS, Azure or Google Cloud' },
  'Data platform': { title: 'Our databases and data', example: 'e.g. customer database, reporting, data warehouse' },
  'SaaS workspace': { title: 'Our everyday work tools', example: 'e.g. email, chat, shared files, CRM' },
  'AI application': { title: 'Our AI assistant or chatbot', example: 'e.g. support chatbot, internal AI helper' },
  'Internal platform': { title: 'An internal company system', example: 'e.g. HR, finance or operations platform' },
}

// ---------------------------------------------------------------- Asset (part) types

export const ASSET_PLAIN: Record<string, { label: string; explain: string }> = {
  'web-application': { label: 'Website', explain: 'The pages people open in a browser' },
  'api-gateway': { label: 'Connection point (API)', explain: 'Where other systems and apps connect in' },
  container: { label: 'App service', explain: 'The program that does the actual work behind the website' },
  'kubernetes-cluster': { label: 'Server cluster', explain: 'A group of cloud machines that runs the app services' },
  server: { label: 'Server', explain: 'A computer that runs part of the application' },
  database: { label: 'Database', explain: 'Where the application stores its records' },
  'cloud-storage': { label: 'File storage', explain: 'Cloud folders holding files, images or exports' },
  'code-repository': { label: 'Source code', explain: 'Where your developers keep the application\'s code' },
  'identity-provider': { label: 'Sign-in system', explain: 'Controls who can log in and what they can open' },
  'saas-application': { label: 'Online work tool', explain: 'A subscription service such as email, chat or CRM' },
  'serverless-function': { label: 'Small cloud job', explain: 'A short task that runs in the cloud when needed' },
  endpoint: { label: 'Laptop or desktop', explain: 'A computer people use day to day' },
  'network-device': { label: 'Network device', explain: 'Routers, firewalls and gateways that move traffic' },
}

export const assetLabel = (type: string) => ASSET_PLAIN[type]?.label ?? type

// ---------------------------------------------------------------- Tools (integrations) and what access they need

export interface ToolAccess {
  /** What the tool does, in one plain sentence. */
  does: string
  reads: string[]
  never: string[]
  approver: string
  minutes: number
}

export const TOOL_ACCESS: Record<string, ToolAccess> = {
  'INT-WIZ': { does: 'Checks your cloud setup for risky settings, like storage left open to the internet.', reads: ['A list of your cloud resources and how they are configured', 'Security alerts Wiz has already raised', 'Which resources can be reached from the internet'], never: ['The contents of your files or databases', 'Passwords, keys or secret values', 'Anything outside the selected cloud accounts'], approver: 'Your cloud administrator', minutes: 3 },
  'INT-TEN': { does: 'Looks for outdated or weak software on your servers and websites.', reads: ['Scan results and the software versions found', 'The list of machines Tenable scans'], never: ['Files, emails or customer records', 'The ability to install or remove software'], approver: 'Your IT or security team', minutes: 2 },
  'INT-QLY': { does: 'Looks for outdated software on servers and computers.', reads: ['Detected weaknesses and software versions', 'The list of machines Qualys monitors'], never: ['Files, emails or customer records', 'The ability to change machines'], approver: 'Your IT or security team', minutes: 2 },
  'INT-CRW': { does: 'Watches servers and computers for suspicious activity.', reads: ['Security alerts and the machines they relate to', 'A list of protected machines'], never: ['Personal files or browsing history', 'The ability to isolate or change machines'], approver: 'Your IT or security team', minutes: 2 },
  'INT-GHB': { does: 'Checks your code for leaked passwords and unsafe components.', reads: ['Security alerts on your repositories', 'Which open-source components your code uses'], never: ['Write access to code — it cannot change or push code', 'Private repositories you don\'t select'], approver: 'Your engineering lead', minutes: 2 },
  'INT-OKT': { does: 'Checks sign-in safety: who has admin rights and whether two-step login is on.', reads: ['Sign-in policies and admin roles', 'Unusual sign-in alerts'], never: ['Anyone\'s password', 'The ability to add, remove or change users'], approver: 'Your identity administrator', minutes: 3 },
  'INT-NSK': { does: 'Shows which online tools and AI services your staff use.', reads: ['Which online services are used, and how often', 'Data-loss alerts'], never: ['The content of messages or files', 'The ability to block services'], approver: 'Your network or security team', minutes: 3 },
  'INT-ASM': { does: 'Looks at your organization from the outside, the way an attacker would.', reads: ['Publicly visible websites and their certificates', 'Open doors (ports) visible from the internet'], never: ['Anything behind your firewall', 'Any login or password'], approver: 'No approval needed — built in', minutes: 1 },
}

// ---------------------------------------------------------------- Severity in words

export const SEVERITY_PLAIN: Record<Severity, { label: string; when: string }> = {
  critical: { label: 'Urgent', when: 'Fix today' },
  high: { label: 'High', when: 'Fix this week' },
  medium: { label: 'Medium', when: 'Fix this month' },
  low: { label: 'Low', when: 'When convenient' },
  informational: { label: 'For information', when: 'No action needed' },
}

// ---------------------------------------------------------------- What a problem means, in one line

const CATEGORY_PLAIN: Record<string, string> = {
  'Remote code execution': 'Outdated software that could let an attacker take control of it',
  'Memory corruption': 'Outdated software an attacker could crash or take over',
  'Authentication bypass': 'A weakness that could let someone skip the login',
  'Command injection': 'A weakness that could let an attacker run their own commands',
  Injection: 'A weakness that could let an attacker read or change stored data',
  'Insecure deserialization': 'A weakness that could let an attacker run their own code',
  'Path traversal': 'A weakness that could let someone read files they shouldn’t',
  'Information disclosure': 'Private information could leak out',
  'Denial of service': 'Someone could knock this offline',
  'Cryptographic weakness': 'Weak encryption that could be broken',
  'Cloud misconfiguration': 'A risky cloud setting — for example something left open to the internet',
  'SaaS misconfiguration': 'A risky setting in an online work tool',
  'Secrets exposure': 'A password or key is visible in your code',
  'Identity & access': 'An account has more access than it should',
  'Logging & monitoring': 'Activity isn’t being recorded, so an attack could go unnoticed',
  'External exposure': 'Something is reachable from the internet that shouldn’t be',
  'Certificate hygiene': 'A security certificate is expired or weak',
  'Shadow AI': 'Staff are using an AI tool the company hasn’t approved',
  'AI configuration': 'A risky setting in an AI tool',
  'AI provider risk': 'An AI supplier doesn’t meet your security requirements',
  'AI data exposure': 'An AI tool could reveal private data',
  'AI external exposure': 'An AI tool is reachable from the internet',
  'AI access': 'An AI tool has more access than it needs',
}

/** One plain-language sentence describing what kind of problem a finding is. */
export const findingPlain = (f: { category: string; domain: string }) =>
  CATEGORY_PLAIN[f.category] ?? (f.domain === 'misconfiguration' ? 'A risky setting' : f.domain === 'identity' ? 'An access problem' : 'A security weakness')
