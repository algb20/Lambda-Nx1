/**
 * Module 1 — Domain / Infrastructure intelligence.
 *
 * Orchestrates the passive, keyless sources into a documented report: DNS,
 * registration (RDAP), subdomains (CT logs), hosting/tech, IP exposure and
 * archive history. Independent capabilities run in parallel, each with its own
 * fallback; resolved IPs are then checked for exposure. Every finding keeps its
 * source, timestamp, Admiralty rating and confidence grade.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { buildGraph, type Graph } from '../engine/analysis'
import { registerModuleOneSources } from '../engine/sources'
import type { Capability, Evidence, SourceResult } from '../engine/types'

export interface DomainReport {
  subject: string
  generatedAt: string
  sections: {
    dns: Evidence[]
    registration: Evidence[]
    subdomains: Evidence[]
    hosting: Evidence[]
    ipExposure: Evidence[]
    history: Evidence[]
  }
  graph: Graph
  sourcesUsed: Array<{ sourceKey: string; ok: boolean; error?: string }>
  summary: {
    subdomains: number
    resolvedIps: number
    entities: number
    sourcesOk: number
    sourcesFailed: number
  }
}

/** Strip scheme, path and port; lower-case. Accepts a URL or a bare domain. */
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)]
}

async function safeCollect(capability: Capability, value: string) {
  try {
    return await collect({ capability, value }, { registry, mode: 'first' })
  } catch {
    return { capability, value, evidence: [] as Evidence[], results: [] as SourceResult[] }
  }
}

export async function investigateDomain(input: string): Promise<DomainReport> {
  registerModuleOneSources()
  const subject = normalizeDomain(input)
  if (!subject || !subject.includes('.')) {
    throw new Error(`Invalid domain: "${input}"`)
  }
  const generatedAt = new Date().toISOString()

  const [dns, whois, subs, tech, history] = await Promise.all([
    safeCollect('dns', subject),
    safeCollect('whois', subject),
    safeCollect('subdomains', subject),
    safeCollect('tech', subject),
    safeCollect('archive', subject),
  ])

  // IP exposure: check every A/AAAA address discovered via DNS.
  const ips = unique(
    dns.evidence.filter((e) => e.entity?.type === 'ip').map((e) => e.entity!.value),
  )
  const ipEvidence: Evidence[] = []
  const ipResults: SourceResult[] = []
  for (const ip of ips) {
    const r = await safeCollect('ip_reputation', ip)
    ipEvidence.push(...r.evidence)
    ipResults.push(...r.results)
  }

  const allEvidence = [
    ...dns.evidence,
    ...whois.evidence,
    ...subs.evidence,
    ...tech.evidence,
    ...history.evidence,
    ...ipEvidence,
  ]
  const allResults = [
    ...dns.results,
    ...whois.results,
    ...subs.results,
    ...tech.results,
    ...history.results,
    ...ipResults,
  ]

  const graph = buildGraph({ type: 'domain', value: subject }, allEvidence)

  return {
    subject,
    generatedAt,
    sections: {
      dns: dns.evidence,
      registration: whois.evidence,
      subdomains: subs.evidence,
      hosting: tech.evidence,
      ipExposure: ipEvidence,
      history: history.evidence,
    },
    graph,
    sourcesUsed: allResults.map((r) => ({ sourceKey: r.sourceKey, ok: r.ok, error: r.error })),
    summary: {
      subdomains: subs.evidence.length,
      resolvedIps: ips.length,
      entities: graph.nodes.length,
      sourcesOk: allResults.filter((r) => r.ok).length,
      sourcesFailed: allResults.filter((r) => !r.ok).length,
    },
  }
}
