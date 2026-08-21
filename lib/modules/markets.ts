/**
 * Markets & Economy gateway. Answers "what is the public, current state of this
 * asset / company / currency?" from public data — crypto markets (CoinGecko),
 * company filings (SEC EDGAR) and ECB reference FX (Frankfurter).
 *
 * We report the market as it *is*, with source and timestamp. We do NOT predict
 * it — foresight in Lambda means tracking and grading *published* forecasts
 * (see docs/FORESIGHT.md), never fabricating our own.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerMarketsGateway } from '../engine/sources'
import type { Capability, Evidence } from '../engine/types'

const FX_PAIR = /^([a-z]{3})\s*[\/\- ]\s*([a-z]{3})$/i

export type MarketKind = 'fx' | 'asset'

export function classifyMarket(value: string): MarketKind {
  return FX_PAIR.test(value.trim()) ? 'fx' : 'asset'
}

export interface MarketsReport {
  subject: string
  kind: MarketKind
  generatedAt: string
  findings: Evidence[]
  summary: { matches: number; sourcesOk: number; sourcesFailed: number }
}

/**
 * Put the answer first.
 *
 * There was no ordering here at all: findings came out in whatever order the
 * sources happened to return, and the result was measurably wrong. Searching
 * **"Germany"** on the live gateway produced, in this order:
 *
 *   1. an E.ON filing from **2002**
 *   2. an Allianz filing from **2002**
 *   3. a Greek shipping company that mentions Germany
 *   …
 *   6. Germany's GDP — $5.05T, for the current year
 *
 * Searching "Saudi Arabia" led with two American ETF prospectuses. The data was
 * right and the reader would never reach it, which for them is the same thing
 * as not having it.
 *
 * Two rules, in this order:
 *
 * **What the subject *is* beats what merely mentions it.** A country's own
 * economic figures answer "Germany"; a filing that contains the word Germany is
 * a mention. Full-text matches are the widest net in the gateway and must not
 * outrank a direct measurement of the thing asked about.
 *
 * **Recent beats ancient.** A 2002 filing is not evidence about a company now.
 * It is not deleted — someone researching 2002 is entitled to find it — it
 * simply stops being the first thing anyone sees.
 */
export function rankFindings(findings: Evidence[], subject: string): Evidence[] {
  const q = subject.trim().toLowerCase()
  const now = Date.now()

  const score = (e: Evidence): number => {
    let n = 0
    // A direct measurement of the subject, rather than a document mentioning it.
    if (e.data && typeof e.data === 'object' && 'indicator' in e.data) n += 100
    // The entity the evidence is about *is* the thing asked for.
    if (typeof e.entity?.value === 'string' && e.entity.value.toLowerCase() === q) n += 60
    // Freshness, in whole years, capped so a 2002 filing and a 1998 one are
    // both simply old rather than competing over which is older.
    const t = Date.parse(e.retrievedAt ?? '')
    const stamp = typeof e.data === 'object' && e.data && 'filedAt' in e.data
      ? Date.parse(String((e.data as { filedAt?: unknown }).filedAt ?? ''))
      : t
    if (Number.isFinite(stamp)) {
      const years = (now - stamp) / (365 * 24 * 3_600_000)
      n += Math.max(0, 20 - Math.min(20, Math.floor(years)))
    }
    return n
  }

  // A stable sort: two findings of equal score keep the order their sources
  // produced them in, so the ranking never reshuffles identical evidence.
  return findings
    .map((e, i) => ({ e, i, s: score(e) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((r) => r.e)
}

export async function investigateMarkets(input: string): Promise<MarketsReport> {
  registerMarketsGateway()
  const subject = input.trim()
  if (subject.length < 2) throw new Error('Enter an asset, company, ticker or a currency pair (e.g. USD/EUR)')
  const kind = classifyMarket(subject)
  const generatedAt = new Date().toISOString()

  // FX is one capability; anything else is screened across crypto + securities +
  // macro-economy at once (the economy source self-filters to countries).
  const capabilities: Capability[] = kind === 'fx' ? ['fx'] : ['market', 'securities', 'economy']

  const runs = await Promise.all(
    capabilities.map((capability) => collect({ capability, value: subject }, { registry, mode: 'all' })),
  )

  const findings = rankFindings(runs.flatMap((r) => r.evidence), subject)
  const results = runs.flatMap((r) => r.results)
  return {
    subject,
    kind,
    generatedAt,
    findings,
    summary: {
      matches: findings.length,
      sourcesOk: results.filter((x) => x.ok).length,
      sourcesFailed: results.filter((x) => !x.ok).length,
    },
  }
}
