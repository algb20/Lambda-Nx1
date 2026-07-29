/**
 * Threat Intelligence gateway — classify an indicator and check it against the
 * CTI sources over the engine. Findings are graded; a clean result means "no
 * known threat", never a guarantee of safety.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerThreatGateway } from '../engine/sources'
import type { Evidence } from '../engine/types'

export type IndicatorType = 'ip' | 'domain' | 'url' | 'hash' | 'unknown'

export function classifyIndicator(value: string): IndicatorType {
  const s = value.trim()
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(s)) return 'ip'
  if (/^https?:\/\//i.test(s)) return 'url'
  if (/^[a-f0-9]{32}$|^[a-f0-9]{40}$|^[a-f0-9]{64}$/i.test(s)) return 'hash'
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)) return 'domain'
  return 'unknown'
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export interface ThreatReport {
  indicator: string
  type: IndicatorType
  generatedAt: string
  flagged: boolean
  findings: Evidence[]
  summary: { hits: number; sourcesOk: number; sourcesFailed: number }
}

export async function investigateThreat(input: string): Promise<ThreatReport> {
  registerThreatGateway()
  const indicator = input.trim()
  const type = classifyIndicator(indicator)
  if (type === 'unknown') {
    throw new Error('Enter an IP address, domain, URL, or file hash')
  }
  const generatedAt = new Date().toISOString()
  const value = type === 'url' ? hostOf(indicator) : indicator

  const r = await collect({ capability: 'threat', value }, { registry, mode: 'all' })
  return {
    indicator,
    type,
    generatedAt,
    flagged: r.evidence.length > 0,
    findings: r.evidence,
    summary: {
      hits: r.evidence.length,
      sourcesOk: r.results.filter((x) => x.ok).length,
      sourcesFailed: r.results.filter((x) => !x.ok).length,
    },
  }
}
