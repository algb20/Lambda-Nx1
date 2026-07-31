/**
 * Trust Lens — our own, visible measure of how *trustworthy and unbiased* a body
 * of evidence is. This operationalizes the platform's anti-bias rule into numbers
 * a user (or an institution) can see and audit:
 *
 *   • independentSources  — how many distinct sources back this
 *   • reliableSources     — of those, how many are Admiralty A/B
 *   • sourceCountries     — geographic spread (a bias signal)
 *   • corroboratedTopics  — claims independently backed by ≥2 sources
 *   • corroboration       — single / weak / corroborated / strong
 *   • neutrality          — 0–100, from source & country diversity
 *   • confidence          — reuses the analysis-core grade
 *
 * Plus a deterministic **seal**: a content fingerprint over the findings, so a
 * dossier is citable and tamper-evident (digital provenance). Pure + testable.
 */
import { createHash } from 'node:crypto'
import { gradeConfidence } from './analysis'
import type { Confidence, Evidence } from './types'

export type Corroboration = 'single' | 'weak' | 'corroborated' | 'strong'

export interface TrustScore {
  evidenceCount: number
  independentSources: number
  reliableSources: number
  sourceCountries: string[]
  corroboratedTopics: number
  corroboration: Corroboration
  neutrality: number
  confidence: Confidence
}

const RELIABLE = new Set(['A', 'B'])

function countryOf(e: Evidence): string | null {
  const c = (e.data as { country?: string; sourcecountry?: string } | undefined)?.country
  return c && c.trim() ? c.trim() : null
}

/** Group key for "the same topic" — entity if present, else the claim text. */
function topicKey(e: Evidence): string {
  return e.entity ? `${e.entity.type}:${e.entity.value}` : e.claim.toLowerCase().slice(0, 80)
}

function neutralityScore(distinctSources: number, distinctCountries: number): number {
  const base =
    distinctSources <= 0 ? 0 : distinctSources === 1 ? 20 : distinctSources === 2 ? 50 : distinctSources === 3 ? 70 : 85
  const bonus = Math.min(15, Math.max(0, distinctCountries - 1) * 5)
  return Math.min(100, base + bonus)
}

export function assessTrust(evidence: Evidence[]): TrustScore {
  const sources = new Set(evidence.map((e) => e.sourceKey))
  const reliable = new Set(
    evidence.filter((e) => e.admiralty && RELIABLE.has(e.admiralty.source)).map((e) => e.sourceKey),
  )
  const countries = [...new Set(evidence.map(countryOf).filter((c): c is string => Boolean(c)))]

  // Topics independently corroborated by ≥2 distinct sources.
  const byTopic = new Map<string, Set<string>>()
  for (const e of evidence) {
    const k = topicKey(e)
    const set = byTopic.get(k) ?? new Set<string>()
    set.add(e.sourceKey)
    byTopic.set(k, set)
  }
  const corroboratedTopics = [...byTopic.values()].filter((s) => s.size >= 2).length

  const distinctSources = sources.size
  let corroboration: Corroboration
  if (distinctSources <= 1) corroboration = 'single'
  else if (reliable.size >= 2) corroboration = 'strong'
  else if (distinctSources >= 3) corroboration = 'corroborated'
  else corroboration = 'weak'

  return {
    evidenceCount: evidence.length,
    independentSources: distinctSources,
    reliableSources: reliable.size,
    sourceCountries: countries,
    corroboratedTopics,
    corroboration,
    neutrality: neutralityScore(distinctSources, countries.length),
    confidence: gradeConfidence(evidence),
  }
}

/**
 * Deterministic content seal over a set of findings — same findings ⇒ same seal,
 * so a dossier can be cited and any change is detectable. Order-independent.
 */
export function sealFindings(evidence: Evidence[]): string {
  const canonical = evidence
    .map((e) => `${e.sourceKey}|${e.claim}|${e.entity ? `${e.entity.type}:${e.entity.value}` : ''}`)
    .sort()
    .join('\n')
  const hash = createHash('sha256').update(canonical).digest('hex')
  return `lnx1-${hash.slice(0, 16)}`
}
