/**
 * Target Tracker — the radar-per-target. For any target (a stock, coin, company,
 * domain, wallet…) it separates:
 *
 *   • identity  — the STATIC facts (what it is): slow-changing profile.
 *   • timeline  — the LIVE stream (past → now): news, filings, partnerships,
 *                 agreements, decisions, price snapshots — each timestamped/sourced.
 *   • horizon   — PUBLISHED forward-looking points: scheduled events and stated
 *                 targets/guidance. We surface what others *published*; we never
 *                 fabricate a prediction.
 *   • signature — OUR analysis: correlate the events (across time + similar cases)
 *                 into a summary + what to watch. Sorts, never verifies.
 *
 * Static vs. live are separated on purpose: identity is cached and cheap; the
 * live stream is what the "always-open door" (SSE) pushes continuously.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerAllSources } from '../engine/sources'
import { classifySelector, type SelectorType } from './nexus'
import { getAiProvider } from '../ai'
import type { AiProvider } from '../ai/types'
import type { Capability, Evidence } from '../engine/types'

export type EventWhen = 'past' | 'now' | 'future'
export type EventKind = 'news' | 'filing' | 'partnership' | 'price' | 'event'

export interface TimelineEvent {
  at: string
  when: EventWhen
  kind: EventKind
  title: string
  sourceKey: string
  sourceUrl?: string
  confidence: Evidence['confidence']
}

export interface TargetSignature {
  summary: string
  correlations: string[]
  watch: string[]
  needsVerification: string[]
  configured: boolean
}

export interface TargetProfile {
  input: string
  type: SelectorType
  generatedAt: string
  identity: { static: Evidence[] }
  timeline: TimelineEvent[]
  horizon: TimelineEvent[]
  signature: TargetSignature
  speed: { elapsedMs: number }
}

const STATIC_CAPS = new Set<Capability>([
  'dns',
  'whois',
  'subdomains',
  'tech',
  'wallet',
  'securities',
  'ownership',
  'sanctions',
  'email_breach',
  'username_presence',
  'ip_reputation',
])

function planFor(type: SelectorType): Capability[] {
  switch (type) {
    case 'domain':
      return ['dns', 'whois', 'subdomains', 'tech', 'threat', 'archive', 'news']
    case 'ip':
      return ['ip_reputation', 'threat', 'news']
    case 'email':
      return ['email_breach']
    case 'wallet':
      return ['wallet', 'news']
    case 'hash':
      return ['threat']
    case 'entity':
      return ['securities', 'ownership', 'sanctions', 'procurement', 'market', 'news']
  }
}

const FUTURE_RE =
  /\b(will|shall|scheduled|upcoming|to report|is expected|are expected|forecast|outlook|guidance|target(?:s|ed)?\s+(?:price|of)|q[1-4]\s?20\d\d|by\s?20\d\d|next\s+(?:quarter|year|month)|plans?\s+to|set\s+to)\b/i
const PARTNERSHIP_RE = /\b(partnership|partner|agreement|deal|acquir|merger|acquisition|mou|collaborat|joint venture|alliance)\b/i

function kindOf(e: Evidence): EventKind {
  if (PARTNERSHIP_RE.test(e.claim)) return 'partnership'
  if (e.sourceKey === 'edgar') return 'filing'
  if (e.sourceKey === 'coingecko' || e.sourceKey.startsWith('stooq') || e.sourceKey === 'frankfurter') return 'price'
  if (e.sourceKey === 'gdelt' || e.sourceKey === 'wikipedia_itn') return 'news'
  return 'event'
}

function whenOf(e: Evidence, kind: EventKind): EventWhen {
  if (FUTURE_RE.test(e.claim)) return 'future'
  if (kind === 'price') return 'now'
  return 'past'
}

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
      (v) => !done && ((done = true), clearTimeout(timer), resolve(v)),
      () => !done && ((done = true), clearTimeout(timer), resolve(fallback)),
    )
  })
}

export interface TargetDeps {
  analyst?: AiProvider
}

export async function buildTargetProfile(input: string, deps: TargetDeps = {}): Promise<TargetProfile> {
  registerAllSources()
  const raw = input.trim()
  if (raw.length < 2) throw new Error('Enter a target: a stock, coin, company, domain or wallet')
  const { type, value } = classifySelector(raw)
  const started = Date.now()
  const generatedAt = new Date().toISOString()

  const empty = { evidence: [] as Evidence[], results: [] }
  const runs = await Promise.all(
    planFor(type).map((capability) =>
      withTimeout(
        collect({ capability, value }, { registry, mode: 'all' }).catch(() => empty),
        7000,
        empty,
      ).then((r) => ({ capability, evidence: r.evidence ?? [] })),
    ),
  )

  const staticFacts: Evidence[] = []
  const events: TimelineEvent[] = []
  for (const run of runs) {
    for (const e of run.evidence) {
      if (STATIC_CAPS.has(run.capability)) {
        staticFacts.push(e)
        continue
      }
      const kind = kindOf(e)
      events.push({
        at: e.retrievedAt,
        when: whenOf(e, kind),
        kind,
        title: e.claim,
        sourceKey: e.sourceKey,
        sourceUrl: e.sourceUrl,
        confidence: e.confidence,
      })
    }
  }

  const byTimeDesc = (a: TimelineEvent, b: TimelineEvent) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)
  const timeline = events.filter((e) => e.when !== 'future').sort(byTimeDesc).slice(0, 40)
  const horizon = events.filter((e) => e.when === 'future').sort(byTimeDesc).slice(0, 20)

  // Our signature: correlate everything into a graded read (sorts, never verifies).
  const analyst = deps.analyst ?? getAiProvider()
  const allEvidence = [...staticFacts, ...events.map((ev) => eventToEvidence(ev))]
  const verdict = await analyst
    .analyze({ subject: raw, gateway: `target:${type}`, findings: allEvidence })
    .catch(() => null)

  const signature: TargetSignature = verdict
    ? {
        summary: verdict.summary,
        correlations: verdict.keyPoints,
        watch: verdict.nextSteps,
        needsVerification: verdict.needsVerification,
        configured: verdict.configured,
      }
    : { summary: '', correlations: [], watch: [], needsVerification: [], configured: false }

  return {
    input: raw,
    type,
    generatedAt,
    identity: { static: staticFacts.slice(0, 40) },
    timeline,
    horizon,
    signature,
    speed: { elapsedMs: Date.now() - started },
  }
}

function eventToEvidence(ev: TimelineEvent): Evidence {
  return {
    claim: ev.title,
    sourceKey: ev.sourceKey,
    sourceUrl: ev.sourceUrl,
    retrievedAt: ev.at,
    confidence: ev.confidence,
  }
}
