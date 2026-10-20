import type { Asset, BusinessService, Finding, PrioritizationWeights, Severity } from '@/types'
import { computeRiskScore } from './risk'
import { isOpen } from './labels'

export interface ScoredFinding {
  f: Finding
  score: number
  asset?: Asset
  service?: BusinessService
}

export function scoreFindings(findings: Finding[], assets: Asset[], services: BusinessService[], weights: PrioritizationWeights): ScoredFinding[] {
  const am = new Map(assets.map((a) => [a.id, a]))
  const sm = new Map(services.map((s) => [s.id, s]))
  return findings.map((f) => {
    const asset = f.assetId ? am.get(f.assetId) : undefined
    const service = f.businessServiceId ? sm.get(f.businessServiceId) : undefined
    return { f, asset, service, score: computeRiskScore(f, weights, asset, service) }
  })
}

/** Closed timestamp used for trend reconstruction. */
export function closedAt(f: Finding): string | undefined {
  if (f.status === 'resolved') return f.resolvedAt
  if (f.status === 'false_positive') return f.fpReviews[f.fpReviews.length - 1]?.decidedAt
  if (f.status === 'risk_accepted') return f.riskAcceptance?.decidedAt
  return undefined
}

/** Reconstructs open-finding counts per week from detection and closure timestamps (derived, not hardcoded). */
export function openTrend(findings: Finding[], weeks = 13) {
  const now = Date.now()
  return Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * 86_400_000
    const row: Record<string, number | string> = { week: new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
    for (const sev of ['critical', 'high', 'medium', 'low'] as Severity[]) {
      row[sev] = findings.filter((f) => {
        if (f.severity !== sev) return false
        if (new Date(f.firstDetected).getTime() > end) return false
        const c = closedAt(f)
        return !c || new Date(c).getTime() > end
      }).length
    }
    row.discovered = findings.filter((f) => {
      const t = new Date(f.firstDetected).getTime()
      return t <= end && t > end - 7 * 86_400_000
    }).length
    row.closed = findings.filter((f) => {
      const c = closedAt(f)
      if (!c) return false
      const t = new Date(c).getTime()
      return t <= end && t > end - 7 * 86_400_000
    }).length
    return row
  })
}

export function mttrDays(findings: Finding[], severity?: Severity) {
  const res = findings.filter((f) => f.status === 'resolved' && f.resolvedAt && (!severity || f.severity === severity))
  if (!res.length) return 0
  return Math.round(res.reduce((s, f) => s + (new Date(f.resolvedAt!).getTime() - new Date(f.firstDetected).getTime()) / 86_400_000, 0) / res.length)
}

export function slaCompliance(findings: Finding[]) {
  const res = findings.filter((f) => f.status === 'resolved' && f.resolvedAt && f.targetDate)
  if (!res.length) return 1
  return res.filter((f) => f.resolvedAt! <= f.targetDate!).length / res.length
}

export const openOnly = (findings: Finding[]) => findings.filter((f) => isOpen(f.status))
