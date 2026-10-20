import type { AISystem, Asset, BusinessService, Control, Finding, PrioritizationWeights, RiskScenario, ScenarioParams, Severity, Vendor } from '@/types'
import { CRITICALITY, isOpen, SEVERITY_RANK } from './labels'
import { createRng } from '@/data/seed/rng'

// ------------------------------------------------------------------ Dynamic prioritization
// Illustrative, documented model. Each factor is normalized to 0–1 and weighted; weights sum is normalized.

export interface RiskFactors {
  cvss: number
  epss: number
  kev: number
  exploit: number
  internet: number
  assetCriticality: number
  serviceCriticality: number
  compensating: number
}

const SEVERITY_BASE: Record<Severity, number> = { critical: 9.5, high: 7.5, medium: 5, low: 2.5, informational: 0.5 }

export function riskFactors(f: Finding, asset?: Asset, service?: BusinessService): RiskFactors {
  const exploit = { none: 0, poc: 0.4, functional: 0.75, weaponized: 1 }[f.exploitMaturity]
  return {
    cvss: (f.cvss?.score ?? SEVERITY_BASE[f.severity]) / 10,
    epss: f.epss?.score ?? (f.domain === 'ai' ? 0.25 : f.severity === 'critical' ? 0.3 : 0.1),
    kev: f.kev ? 1 : 0,
    exploit,
    internet: asset?.internetExposed || f.tags.includes('internet-facing') ? 1 : f.domain === 'ai' && f.category === 'Shadow AI' ? 0.6 : 0,
    assetCriticality: asset ? CRITICALITY[asset.criticality].weight : 0.6,
    serviceCriticality: service ? CRITICALITY[service.criticality].weight : 0.5,
    compensating: Math.min(1, f.compensatingControlsInPlace * 0.6 + (f.validation.status === 'not_exploitable' ? 0.6 : 0)),
  }
}

export function computeRiskScore(f: Finding, weights: PrioritizationWeights, asset?: Asset, service?: BusinessService) {
  const x = riskFactors(f, asset, service)
  const positive = weights.cvss + weights.epss + weights.kev + weights.exploit + weights.internet + weights.assetCriticality + weights.serviceCriticality || 1
  const raw = (x.cvss * weights.cvss + x.epss * weights.epss + x.kev * weights.kev + x.exploit * weights.exploit + x.internet * weights.internet + x.assetCriticality * weights.assetCriticality + x.serviceCriticality * weights.serviceCriticality) / positive
  const reduced = raw * (1 - x.compensating * (weights.compensating / 100) * 2.5)
  return Math.round(Math.max(1, Math.min(100, reduced * 100)))
}

export function riskBand(score: number): Severity {
  return score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low'
}

// ------------------------------------------------------------------ CRQ (illustrative)

export const CRQ_MODEL = {
  name: 'Illustrative expected-loss model (DO SAFE demo)',
  formula: 'ALE = AEP_effective × Loss per event (most likely)',
  aep: 'AEP_effective = base AEP × exposure factor × Π (1 − control effectiveness × relevance)',
  exposure: 'Exposure factor = 1 + 0.04 × (open high/critical findings linked to the scenario), capped at 1.60',
  caveat: 'Simplified illustration for decision support demos. Not an actuarial, FAIR-certified or validated enterprise financial model.',
}

export function exposureFactor(s: RiskScenario, findings: Finding[]) {
  const open = s.findingIds.map((id) => findings.find((f) => f.id === id)).filter((f) => f && isOpen(f.status) && SEVERITY_RANK[f.severity] >= 3).length
  return { factor: Math.min(1.6, 1 + 0.04 * open), openHighCritical: open }
}

export function controlMultiplier(s: RiskScenario, params: ScenarioParams) {
  return s.controls.reduce((m, c) => m * (1 - (params.controlEffectiveness[c.controlId] ?? 0) * c.relevance), 1)
}

export function computeScenario(s: RiskScenario, findings: Finding[], params: ScenarioParams = s.params) {
  const exp = exposureFactor(s, findings)
  const ctl = controlMultiplier(s, params)
  const aep = Math.min(0.99, params.baseAEP * exp.factor * ctl)
  return {
    aep,
    exposure: exp,
    controlMultiplier: ctl,
    ale: aep * params.lossMostLikely,
    aleLow: aep * params.lossLow,
    aleHigh: aep * params.lossHigh,
    // ALE if every linked high/critical finding were remediated (exposure factor → 1)
    aleRemediated: Math.min(0.99, params.baseAEP * ctl) * params.lossMostLikely,
  }
}

/** Seeded triangular-distribution simulation for a loss exceedance curve. */
export function lossExceedance(s: RiskScenario, findings: Finding[], params: ScenarioParams = s.params, iterations = 4000) {
  const rng = createRng(7 + s.id.charCodeAt(s.id.length - 1))
  const { aep } = computeScenario(s, findings, params)
  const tri = () => {
    const { lossLow: a, lossMostLikely: c, lossHigh: b } = params
    const u = rng.next()
    const fc = (c - a) / (b - a)
    return u < fc ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c))
  }
  const losses: number[] = []
  for (let i = 0; i < iterations; i++) losses.push(rng.next() < aep ? tri() : 0)
  losses.sort((x, y) => y - x)
  const thresholds = Array.from({ length: 12 }, (_, i) => (params.lossHigh * (i + 1)) / 12)
  return [{ loss: 0, probability: aep }, ...thresholds.map((t) => ({ loss: t, probability: losses.filter((l) => l >= t).length / iterations }))]
}

export function totalALE(scenarios: RiskScenario[], findings: Finding[]) {
  return scenarios.reduce((sum, s) => sum + computeScenario(s, findings).ale, 0)
}

// ------------------------------------------------------------------ Vendors, AI, posture

export function vendorRiskBand(score: number): Severity {
  return score >= 75 ? 'critical' : score >= 55 ? 'high' : score >= 35 ? 'medium' : 'low'
}

export function aiRiskScore(ai: AISystem, findings: Finding[]) {
  const open = findings.filter((f) => f.aiSystemId === ai.id && isOpen(f.status))
  const sev = open.reduce((s, f) => s + ({ critical: 22, high: 14, medium: 8, low: 3, informational: 1 }[f.severity]), 0)
  const approval = { approved: 0, under_review: 12, unsanctioned: 28, prohibited: ai.users > 0 ? 30 : 4 }[ai.approval]
  const signals = ai.signals.filter((s) => s.status === 'risk').length * 6 + ai.signals.filter((s) => s.status === 'warning').length * 2
  const data = ai.dataClassification === 'Restricted' ? 10 : ai.dataClassification === 'Confidential' ? 6 : 2
  return Math.min(100, Math.round(sev + approval + signals + data))
}

export function postureScore(findings: Finding[]) {
  const open = findings.filter((f) => isOpen(f.status))
  const penalty = open.reduce((s, f) => s + ({ critical: 1.6, high: 0.7, medium: 0.22, low: 0.05, informational: 0 }[f.severity]) * (f.kev ? 1.5 : 1), 0)
  return Math.max(0, Math.min(100, Math.round(100 - penalty * 0.45)))
}

export function isOverdue(f: Finding) {
  return isOpen(f.status) && !!f.targetDate && new Date(f.targetDate).getTime() < Date.now()
}

export function controlStrength(c: Control) {
  return Math.round(c.effectiveness * c.coverage * 100)
}

export function vendorOpenAlerts(v: Vendor, alerts: { vendorId: string; status: string }[]) {
  return alerts.filter((a) => a.vendorId === v.id && a.status !== 'resolved').length
}
