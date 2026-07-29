/**
 * Financial / Sanctions / Corporate gateway. A Bitcoin address is checked on the
 * public ledger; anything else is screened as an entity/company against
 * sanctions/PEP and legal-entity registries. Findings are graded; a clean screen
 * is "no match found", not a clearance.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerFinanceGateway } from '../engine/sources'
import type { Evidence } from '../engine/types'

const BTC = /^(bc1[a-z0-9]{20,80}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/

export type FinanceType = 'wallet' | 'entity'

export function classifyFinance(value: string): FinanceType {
  return BTC.test(value.trim()) ? 'wallet' : 'entity'
}

export interface FinanceReport {
  subject: string
  type: FinanceType
  generatedAt: string
  findings: Evidence[]
  summary: { matches: number; sourcesOk: number; sourcesFailed: number }
}

export async function investigateFinance(input: string): Promise<FinanceReport> {
  registerFinanceGateway()
  const subject = input.trim()
  if (subject.length < 3) throw new Error('Enter a name/company or a Bitcoin address')
  const type = classifyFinance(subject)
  const generatedAt = new Date().toISOString()

  const r = await collect(
    { capability: type === 'wallet' ? 'wallet' : 'sanctions', value: subject },
    { registry, mode: 'all' },
  )
  return {
    subject,
    type,
    generatedAt,
    findings: r.evidence,
    summary: {
      matches: r.evidence.length,
      sourcesOk: r.results.filter((x) => x.ok).length,
      sourcesFailed: r.results.filter((x) => !x.ok).length,
    },
  }
}
