/**
 * Nexus — unified, full-spectrum investigation. The flagship: one query fans out
 * across every relevant gateway *in parallel*, fuses the evidence into a single
 * graded dossier with a pivot graph, and reports how fast each part answered.
 *
 * Speed is a first-class feature here:
 *  - parallel fan-out (total time ≈ the slowest single gateway, not their sum),
 *  - a per-task timeout so one slow provider can't stall the dossier,
 *  - a short-TTL cache so repeat lookups are instant,
 *  - per-section latency reported honestly.
 *
 * Still passive, still graded, still auditable — this only *orchestrates* the
 * gateways we already built; it invents no facts.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { buildGraph, dedupeEvidence, type Graph } from '../engine/analysis'
import { assessTrust, sealFindings, type TrustScore } from '../engine/trust'
import { registerAllSources } from '../engine/sources'
import type { Capability, EntityType, Evidence, SourceResult } from '../engine/types'

export type SelectorType = 'domain' | 'ip' | 'email' | 'wallet' | 'hash' | 'entity'

export interface NexusSection {
  gateway: string
  capability: Capability
  findings: Evidence[]
  ms: number
  ok: boolean
}

export interface NexusReport {
  input: string
  selectorType: SelectorType
  generatedAt: string
  sections: NexusSection[]
  findings: Evidence[]
  graph: Graph
  trust: TrustScore
  seal: string
  speed: { elapsedMs: number; capabilitiesRun: number; cacheHit: boolean; fastestMs: number | null }
  summary: { findings: number; entities: number; sourcesOk: number; sourcesFailed: number }
}

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const BTC = /^(bc1[a-z0-9]{20,80}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/
const HASH = /^([a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64})$/i

function hostOf(s: string): string {
  try {
    return new URL(s.includes('://') ? s : `http://${s}`).hostname
  } catch {
    return s
  }
}

/** Classify a free-form selector so we know which gateways to light up. */
export function classifySelector(raw: string): { type: SelectorType; value: string } {
  const s = raw.trim()
  if (/^[a-z]+:\/\//i.test(s)) return { type: 'domain', value: hostOf(s) }
  if (IPV4.test(s)) return { type: 'ip', value: s }
  if (EMAIL.test(s)) return { type: 'email', value: s.toLowerCase() }
  if (BTC.test(s)) return { type: 'wallet', value: s }
  if (HASH.test(s)) return { type: 'hash', value: s.toLowerCase() }
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(s) && !s.includes(' ')) return { type: 'domain', value: s.toLowerCase() }
  return { type: 'entity', value: s }
}

const ROOT_ENTITY: Record<SelectorType, EntityType> = {
  domain: 'domain',
  ip: 'ip',
  email: 'email',
  wallet: 'wallet',
  hash: 'other',
  entity: 'company',
}

interface Task {
  gateway: string
  capability: Capability
  value: string
}

/** Which gateways to run for each selector type (the fan-out plan). */
function planFor(type: SelectorType, value: string): Task[] {
  const t = (gateway: string, capability: Capability, v: string = value): Task => ({ gateway, capability, value: v })
  switch (type) {
    case 'domain':
      return [
        t('Domain', 'dns'),
        t('Domain', 'subdomains'),
        t('Domain', 'whois'),
        t('Domain', 'tech'),
        t('Domain', 'archive'),
        t('Threat', 'threat'),
        t('News', 'news'),
      ]
    case 'ip':
      return [t('IP', 'ip_reputation'), t('Threat', 'threat')]
    case 'email':
      return [t('Email', 'email_breach')]
    case 'wallet':
      return [t('Finance', 'wallet')]
    case 'hash':
      return [t('Threat', 'threat')]
    case 'entity':
      return [
        t('Sanctions', 'sanctions'),
        t('Securities', 'securities'),
        t('Ownership', 'ownership'),
        t('Procurement', 'procurement'),
        t('Identity', 'username_presence'),
        t('News', 'news'),
      ]
  }
}

const TASK_TIMEOUT_MS = 7000
const CACHE_TTL_MS = 30_000
const cache = new Map<string, { at: number; report: NexusReport }>()

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let done = false
    const timer = setTimeout(() => {
      if (!done) {
        done = true
        resolve(fallback)
      }
    }, ms)
    p.then(
      (v) => {
        if (!done) {
          done = true
          clearTimeout(timer)
          resolve(v)
        }
      },
      () => {
        if (!done) {
          done = true
          clearTimeout(timer)
          resolve(fallback)
        }
      },
    )
  })
}

export async function investigateNexus(input: string): Promise<NexusReport> {
  registerAllSources()
  const raw = input.trim()
  if (raw.length < 2) throw new Error('Enter anything: a domain, IP, email, company, wallet or hash')
  const { type, value } = classifySelector(raw)

  const cacheKey = `${type}:${value}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { ...cached.report, speed: { ...cached.report.speed, cacheHit: true, elapsedMs: 0 } }
  }

  const generatedAt = new Date().toISOString()
  const started = Date.now()
  const plan = planFor(type, value)

  const empty = { evidence: [] as Evidence[], results: [] as SourceResult[] }
  const sections: NexusSection[] = await Promise.all(
    plan.map(async (task) => {
      const start = Date.now()
      const r = await withTimeout(
        collect({ capability: task.capability, value: task.value }, { registry, mode: 'all' }).catch(() => empty),
        TASK_TIMEOUT_MS,
        empty,
      )
      const results = r.results ?? []
      return {
        gateway: task.gateway,
        capability: task.capability,
        findings: r.evidence ?? [],
        ms: Date.now() - start,
        ok: results.some((x) => x.ok),
      }
    }),
  )

  const merged = dedupeEvidence(sections.flatMap((s) => s.findings))
  const graph = buildGraph({ type: ROOT_ENTITY[type], value }, merged)
  const answered = sections.filter((s) => s.findings.length > 0).map((s) => s.ms)

  const allResults = sections // per-source ok/fail is summarized from section flags
  const report: NexusReport = {
    input: raw,
    selectorType: type,
    generatedAt,
    sections,
    findings: merged,
    graph,
    trust: assessTrust(merged),
    seal: sealFindings(merged),
    speed: {
      elapsedMs: Date.now() - started,
      capabilitiesRun: plan.length,
      cacheHit: false,
      fastestMs: answered.length ? Math.min(...answered) : null,
    },
    summary: {
      findings: merged.length,
      entities: graph.nodes.length,
      sourcesOk: allResults.filter((s) => s.ok).length,
      sourcesFailed: allResults.filter((s) => !s.ok).length,
    },
  }

  cache.set(cacheKey, { at: Date.now(), report })
  return report
}
