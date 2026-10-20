import type { Asset, AssetType, Criticality, Environment } from '@/types'
import type { Clock, Rng } from './rng'
import { pad } from './rng'

interface Blueprint {
  name: string
  type: AssetType
  env: Environment
  internet?: boolean
  cloud?: Asset['cloud']
  os?: string
  criticality?: Criticality
}

// Per-service asset blueprints. Hostnames are fictional.
const BLUEPRINTS: Record<string, { owners: string[]; items: Blueprint[] }> = {
  'SVC-PAY': {
    owners: ['USR-009', 'USR-017'],
    items: [
      { name: 'prod-api-gw-01', type: 'api-gateway', env: 'production', internet: true, cloud: 'AWS', criticality: 'tier-1' },
      { name: 'prod-api-gw-02', type: 'api-gateway', env: 'production', internet: true, cloud: 'AWS', criticality: 'tier-1' },
      { name: 'pay-auth-svc', type: 'container', env: 'production', cloud: 'AWS', criticality: 'tier-1' },
      { name: 'pay-settlement-svc', type: 'container', env: 'production', cloud: 'AWS', criticality: 'tier-1' },
      { name: 'pay-clearing-01', type: 'server', env: 'production', cloud: 'On-prem', os: 'RHEL 8.8', criticality: 'tier-1' },
      { name: 'pay-clearing-02', type: 'server', env: 'production', cloud: 'On-prem', os: 'RHEL 8.8', criticality: 'tier-1' },
      { name: 'pay-ledger-db', type: 'database', env: 'production', cloud: 'AWS', criticality: 'tier-1' },
      { name: 'pay-hsm-gw', type: 'network-device', env: 'production', cloud: 'On-prem', criticality: 'tier-1' },
      { name: 'mft-partner-01', type: 'web-application', env: 'production', internet: true, cloud: 'On-prem', os: 'Windows Server 2019', criticality: 'tier-1' },
      { name: 'pay-mq-broker-01', type: 'server', env: 'production', cloud: 'On-prem', os: 'Ubuntu 22.04', criticality: 'tier-1' },
      { name: 'pay-batch-legacy', type: 'server', env: 'production', cloud: 'On-prem', os: 'Windows Server 2008 R2', criticality: 'tier-2' },
      { name: 'pay-settlement-exports', type: 'cloud-storage', env: 'production', cloud: 'AWS', criticality: 'tier-1' },
      { name: 'payments-platform', type: 'code-repository', env: 'development', criticality: 'tier-1' },
      { name: 'stg-pay-auth-svc', type: 'container', env: 'staging', cloud: 'AWS', criticality: 'tier-3' },
      { name: 'pay-edge-lb-01', type: 'network-device', env: 'production', internet: true, cloud: 'On-prem', criticality: 'tier-1' },
      { name: 'pay-fx-rates-fn', type: 'serverless-function', env: 'production', cloud: 'AWS', criticality: 'tier-2' },
      { name: 'pay-recon-01', type: 'server', env: 'production', cloud: 'AWS', os: 'Amazon Linux 2023', criticality: 'tier-2' },
    ],
  },
  'SVC-IDN': {
    owners: ['USR-010'],
    items: [
      { name: 'okta-prod', type: 'identity-provider', env: 'production', internet: true, criticality: 'tier-1' },
      { name: 'ciam-prod', type: 'identity-provider', env: 'production', internet: true, criticality: 'tier-1' },
      { name: 'ad-dc-01', type: 'identity-provider', env: 'corporate', cloud: 'On-prem', os: 'Windows Server 2022', criticality: 'tier-1' },
      { name: 'idn-session-svc', type: 'container', env: 'production', cloud: 'AWS', criticality: 'tier-1' },
      { name: 'idn-mfa-svc', type: 'container', env: 'production', cloud: 'AWS', criticality: 'tier-1' },
      { name: 'idn-login-web', type: 'web-application', env: 'production', internet: true, cloud: 'AWS', criticality: 'tier-1' },
      { name: 'idn-user-db', type: 'database', env: 'production', cloud: 'AWS', criticality: 'tier-1' },
      { name: 'idn-k8s-prod', type: 'kubernetes-cluster', env: 'production', cloud: 'AWS', criticality: 'tier-1' },
      { name: 'identity-services', type: 'code-repository', env: 'development', criticality: 'tier-2' },
      { name: 'vpn-gw-hq', type: 'network-device', env: 'corporate', internet: true, cloud: 'On-prem', criticality: 'tier-1' },
      { name: 'vpn-gw-branch-07', type: 'network-device', env: 'corporate', internet: true, cloud: 'On-prem', criticality: 'tier-2' },
      { name: 'citrix-gw-01', type: 'network-device', env: 'corporate', internet: true, cloud: 'On-prem', criticality: 'tier-1' },
      { name: 'idn-bastion-01', type: 'server', env: 'production', cloud: 'AWS', os: 'Ubuntu 24.04', criticality: 'tier-2' },
      { name: 'stg-idn-login-web', type: 'web-application', env: 'staging', internet: true, cloud: 'AWS', criticality: 'tier-3' },
    ],
  },
  'SVC-DBK': {
    owners: ['USR-011', 'USR-017'],
    items: [
      { name: 'web-banking-prod', type: 'web-application', env: 'production', internet: true, cloud: 'AWS', criticality: 'tier-1' },
      { name: 'mobile-api-prod', type: 'api-gateway', env: 'production', internet: true, cloud: 'AWS', criticality: 'tier-1' },
      { name: 'dbk-k8s-prod', type: 'kubernetes-cluster', env: 'production', cloud: 'AWS', internet: true, criticality: 'tier-1' },
      { name: 'dbk-accounts-svc', type: 'container', env: 'production', cloud: 'AWS', criticality: 'tier-1' },
      { name: 'dbk-transfers-svc', type: 'container', env: 'production', cloud: 'AWS', criticality: 'tier-1' },
      { name: 'dbk-statements-svc', type: 'container', env: 'production', cloud: 'AWS', criticality: 'tier-2' },
      { name: 'dbk-notifications-svc', type: 'container', env: 'production', cloud: 'AWS', criticality: 'tier-2' },
      { name: 'dbk-core-adapter-01', type: 'server', env: 'production', cloud: 'On-prem', os: 'RHEL 9.2', criticality: 'tier-1' },
      { name: 'dbk-core-adapter-02', type: 'server', env: 'production', cloud: 'On-prem', os: 'RHEL 9.2', criticality: 'tier-1' },
      { name: 'dbk-session-cache', type: 'database', env: 'production', cloud: 'AWS', criticality: 'tier-2' },
      { name: 'dbk-cdn-edge', type: 'api-gateway', env: 'production', internet: true, cloud: 'AWS', criticality: 'tier-1' },
      { name: 'digital-banking-web', type: 'code-repository', env: 'development', criticality: 'tier-2' },
      { name: 'dbk-static-assets', type: 'cloud-storage', env: 'production', cloud: 'AWS', criticality: 'tier-3' },
      { name: 'dbk-reporting-01', type: 'server', env: 'production', cloud: 'AWS', os: 'Amazon Linux 2', criticality: 'tier-2' },
      { name: 'stg-web-banking', type: 'web-application', env: 'staging', internet: true, cloud: 'AWS', criticality: 'tier-3' },
      { name: 'dev-dbk-k8s', type: 'kubernetes-cluster', env: 'development', cloud: 'AWS', criticality: 'tier-4' },
    ],
  },
  'SVC-CDP': {
    owners: ['USR-012'],
    items: [
      { name: 's3-customer-data', type: 'cloud-storage', env: 'production', cloud: 'AWS', criticality: 'tier-1' },
      { name: 'cdp-lake-raw', type: 'cloud-storage', env: 'production', cloud: 'AWS', criticality: 'tier-2' },
      { name: 'cdp-marketing-exports', type: 'cloud-storage', env: 'production', cloud: 'AWS', criticality: 'tier-2' },
      { name: 'cdp-warehouse', type: 'database', env: 'production', cloud: 'AWS', criticality: 'tier-1' },
      { name: 'cdp-profile-db', type: 'database', env: 'production', cloud: 'AWS', internet: true, criticality: 'tier-1' },
      { name: 'cdp-etl-01', type: 'server', env: 'production', cloud: 'AWS', os: 'Amazon Linux 2', criticality: 'tier-2' },
      { name: 'cdp-etl-02', type: 'server', env: 'production', cloud: 'AWS', os: 'Amazon Linux 2', criticality: 'tier-2' },
      { name: 'cdp-airflow', type: 'container', env: 'production', cloud: 'AWS', criticality: 'tier-2' },
      { name: 'cdp-api', type: 'api-gateway', env: 'production', internet: true, cloud: 'AWS', criticality: 'tier-2' },
      { name: 'cdp-reporting-svc', type: 'container', env: 'production', cloud: 'AWS', criticality: 'tier-3' },
      { name: 'data-platform', type: 'code-repository', env: 'development', criticality: 'tier-2' },
      { name: 'cdp-k8s-prod', type: 'kubernetes-cluster', env: 'production', cloud: 'AWS', criticality: 'tier-2' },
      { name: 'cdp-notebook-01', type: 'server', env: 'development', cloud: 'AWS', os: 'Ubuntu 22.04', criticality: 'tier-3' },
      { name: 'cdp-segment-fn', type: 'serverless-function', env: 'production', cloud: 'AWS', criticality: 'tier-3' },
    ],
  },
  'SVC-COL': {
    owners: ['USR-013'],
    items: [
      { name: 'm365-tenant', type: 'saas-application', env: 'corporate', internet: true, criticality: 'tier-2' },
      { name: 'slack-workspace', type: 'saas-application', env: 'corporate', internet: true, criticality: 'tier-3' },
      { name: 'intranet-web', type: 'web-application', env: 'corporate', cloud: 'On-prem', os: 'Windows Server 2016', criticality: 'tier-3' },
      { name: 'print-mgmt-01', type: 'server', env: 'corporate', cloud: 'On-prem', os: 'Windows Server 2019', criticality: 'tier-3' },
      { name: 'file-server-01', type: 'server', env: 'corporate', cloud: 'On-prem', os: 'Windows Server 2019', criticality: 'tier-3' },
      { name: 'ci-teamcity-01', type: 'server', env: 'corporate', cloud: 'On-prem', os: 'Ubuntu 20.04', criticality: 'tier-2' },
      { name: 'wks-fin-0142', type: 'endpoint', env: 'corporate', os: 'Windows 11 23H2', criticality: 'tier-4' },
      { name: 'wks-eng-0388', type: 'endpoint', env: 'corporate', os: 'macOS 14.6', criticality: 'tier-4' },
      { name: 'wks-cs-0921', type: 'endpoint', env: 'corporate', os: 'Windows 11 23H2', criticality: 'tier-4' },
      { name: 'wks-exec-0007', type: 'endpoint', env: 'corporate', os: 'macOS 15.0', criticality: 'tier-3' },
      { name: 'wks-hr-0213', type: 'endpoint', env: 'corporate', os: 'Windows 11 23H2', criticality: 'tier-4' },
      { name: 'wks-mkt-0550', type: 'endpoint', env: 'corporate', os: 'macOS 14.6', criticality: 'tier-4' },
      { name: 'core-sw-hq-01', type: 'network-device', env: 'corporate', cloud: 'On-prem', criticality: 'tier-2' },
      { name: 'oob-mgmt-appliance', type: 'network-device', env: 'corporate', cloud: 'On-prem', criticality: 'tier-3' },
      { name: 'workplace-scripts', type: 'code-repository', env: 'development', criticality: 'tier-4' },
      { name: 'wiki-confluence', type: 'saas-application', env: 'corporate', internet: true, criticality: 'tier-3' },
    ],
  },
  'SVC-FRD': {
    owners: ['USR-014'],
    items: [
      { name: 'fraud-scoring-svc', type: 'container', env: 'production', cloud: 'AWS', criticality: 'tier-1' },
      { name: 'fraud-features-db', type: 'database', env: 'production', cloud: 'AWS', criticality: 'tier-1' },
      { name: 'fraud-case-mgmt', type: 'web-application', env: 'production', cloud: 'AWS', criticality: 'tier-1' },
      { name: 'fraud-stream-01', type: 'server', env: 'production', cloud: 'AWS', os: 'Ubuntu 22.04', criticality: 'tier-1' },
      { name: 'fraud-stream-02', type: 'server', env: 'production', cloud: 'AWS', os: 'Ubuntu 22.04', criticality: 'tier-1' },
      { name: 'fraud-ml-train-01', type: 'server', env: 'production', cloud: 'AWS', os: 'Ubuntu 22.04', internet: true, criticality: 'tier-2' },
      { name: 'fraud-models', type: 'code-repository', env: 'development', criticality: 'tier-2' },
      { name: 'fraud-k8s-prod', type: 'kubernetes-cluster', env: 'production', cloud: 'AWS', criticality: 'tier-1' },
      { name: 'fraud-archive', type: 'cloud-storage', env: 'production', cloud: 'AWS', criticality: 'tier-2' },
      { name: 'fraud-rules-api', type: 'api-gateway', env: 'production', cloud: 'AWS', criticality: 'tier-1' },
      { name: 'fraud-mq-01', type: 'server', env: 'production', cloud: 'AWS', os: 'Ubuntu 22.04', criticality: 'tier-1' },
      { name: 'fraud-sandbox-ds', type: 'server', env: 'development', cloud: 'AWS', os: 'Ubuntu 22.04', internet: true, criticality: 'tier-3' },
    ],
  },
  'SVC-AIS': {
    owners: ['USR-015'],
    items: [
      { name: 'ais-chat-web', type: 'web-application', env: 'production', internet: true, cloud: 'Azure', criticality: 'tier-2' },
      { name: 'ais-orchestrator', type: 'container', env: 'production', cloud: 'Azure', criticality: 'tier-2' },
      { name: 'ais-rag-index', type: 'database', env: 'production', cloud: 'Azure', criticality: 'tier-2' },
      { name: 'ais-tools-api', type: 'api-gateway', env: 'production', cloud: 'Azure', criticality: 'tier-2' },
      { name: 'ais-transcripts', type: 'cloud-storage', env: 'production', cloud: 'Azure', criticality: 'tier-2' },
      { name: 'ais-k8s-prod', type: 'kubernetes-cluster', env: 'production', cloud: 'Azure', criticality: 'tier-2' },
      { name: 'ai-support-agent', type: 'code-repository', env: 'development', criticality: 'tier-3' },
      { name: 'ais-eval-runner', type: 'server', env: 'staging', cloud: 'Azure', os: 'Ubuntu 22.04', criticality: 'tier-3' },
      { name: 'ais-agent-assist-fn', type: 'serverless-function', env: 'production', cloud: 'Azure', criticality: 'tier-3' },
      { name: 'contact-center-saas', type: 'saas-application', env: 'production', internet: true, criticality: 'tier-2' },
    ],
  },
}

const SOFTWARE: Partial<Record<AssetType, { name: string; version: string }[]>> = {
  server: [{ name: 'openssh-server', version: '9.6p1' }, { name: 'openssl', version: '3.0.13' }],
  container: [{ name: 'eclipse-temurin', version: '17.0.10' }, { name: 'alpine', version: '3.18.4' }],
  'web-application': [{ name: 'nginx', version: '1.24.0' }],
  'api-gateway': [{ name: 'nginx', version: '1.24.0' }],
  database: [{ name: 'PostgreSQL', version: '14.10' }],
  'kubernetes-cluster': [{ name: 'Kubernetes', version: '1.27.9' }],
  endpoint: [{ name: 'CrowdStrike Falcon sensor', version: '7.10' }],
}

const regionFor = (cloud?: Asset['cloud']) => (cloud === 'AWS' ? 'us-east-1' : cloud === 'Azure' ? 'eastus2' : cloud === 'GCP' ? 'us-central1' : cloud === 'On-prem' ? 'DC-Chicago' : undefined)

export function generateAssets(rng: Rng, clock: Clock): Asset[] {
  const assets: Asset[] = []
  let n = 1
  let octet = 10
  for (const [serviceId, bp] of Object.entries(BLUEPRINTS)) {
    for (const item of bp.items) {
      const internet = !!item.internet
      const sources = new Set<string>()
      if (['server', 'endpoint'].includes(item.type)) sources.add(rng.pick(['INT-TEN', 'INT-QLY'])).add('INT-CRW')
      if (item.cloud === 'AWS' || item.cloud === 'Azure') sources.add('INT-WIZ')
      if (item.type === 'code-repository') sources.add('INT-GHB')
      if (item.type === 'identity-provider') sources.add('INT-OKT')
      if (item.type === 'saas-application') sources.add('INT-NSK')
      if (item.type === 'network-device' || item.type === 'web-application') sources.add('INT-TEN')
      if (internet) sources.add('INT-ASM')
      if (sources.size === 0) sources.add('INT-TEN')
      octet += 1
      const firstSeenDays = rng.int(40, 900)
      assets.push({
        id: `AST-${pad(n++)}`,
        name: item.name,
        type: item.type,
        environment: item.env,
        businessServiceId: serviceId,
        ownerId: rng.pick(bp.owners),
        ipAddress: item.type === 'code-repository' || item.type === 'saas-application' ? undefined : internet ? `203.0.113.${octet % 250}` : `10.${20 + Object.keys(BLUEPRINTS).indexOf(serviceId)}.${rng.int(1, 40)}.${octet % 250}`,
        fqdn: internet ? `${item.name}.northstar.example` : item.type === 'code-repository' ? `github.example/northstar-fin/${item.name}` : `${item.name}.int.northstar.example`,
        os: item.os,
        cloud: item.cloud,
        region: regionFor(item.cloud),
        internetExposed: internet,
        criticality: item.criticality ?? 'tier-3',
        sourceIntegrationIds: [...sources],
        tags: [item.env, serviceId.replace('SVC-', '').toLowerCase(), ...(internet ? ['internet-facing'] : [])],
        firstSeen: clock.ago(firstSeenDays),
        lastSeen: clock.ago(0, rng.int(0, 20)),
        software: [...(SOFTWARE[item.type] ?? [])],
      })
    }
  }

  // Shadow / duplicate records discovered by different sources — used by Asset Reconciliation.
  const dupes: [string, string, string][] = [
    ['pay-clearing-01', 'PAYCLR01.corp.northstar.example', 'INT-QLY'],
    ['web-banking-prod', 'web-banking-prod-alb', 'INT-WIZ'],
    ['cdp-etl-01', 'ip-10-23-4-17.ec2.internal', 'INT-WIZ'],
    ['okta-prod', 'northstar.okta.example', 'INT-ASM'],
    ['fraud-stream-01', 'FRAUD-STREAM-01', 'INT-CRW'],
    ['wks-fin-0142', 'WKS-FIN-0142.corp', 'INT-TEN'],
    ['ci-teamcity-01', 'teamcity.int.northstar.example', 'INT-ASM'],
  ]
  for (const [original, alias, src] of dupes) {
    const orig = assets.find((a) => a.name === original)!
    assets.push({
      ...orig,
      id: `AST-${pad(n++)}`,
      name: alias,
      fqdn: alias.includes('.') ? alias : `${alias.toLowerCase()}.corp.northstar.example`,
      sourceIntegrationIds: [src],
      possibleDuplicateOfId: orig.id,
      tags: [...orig.tags, 'reconciliation-candidate'],
      firstSeen: clock.ago(rng.int(3, 30)),
      software: [...orig.software],
    })
  }
  return assets
}
