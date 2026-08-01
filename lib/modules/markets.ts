/**
 * Markets & Economy gateway. Answers "what is the public, current state of this
 * asset / company / currency?" from public data — crypto markets (CoinGecko),
 * company filings (SEC EDGAR) and ECB reference FX (Frankfurter).
 *
 * We report the market as it *is*, with source and timestamp. We do NOT predict
 * it — foresight in Lambda NX means tracking and grading *published* forecasts
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

  const findings = runs.flatMap((r) => r.evidence)
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
