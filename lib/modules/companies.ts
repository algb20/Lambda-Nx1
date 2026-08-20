/**
 * Companies — the module.
 *
 * Two questions, one gateway, because they are the same question at two scales:
 *
 *  - **"Tell me about this company."** Identity, industry, listings, the last
 *    filings, and the figures it reported to its regulator — each with the
 *    period it describes and the form it came from.
 *  - **"Who is biggest?"** A ranking built from every filer's own balance
 *    sheet in one period, which is a real ordering rather than an editorial one.
 *
 * Asking with no subject gives the ranking; asking with a name gives the
 * profile. That is one field doing both jobs, and it is deliberate — a gateway
 * that demanded you first decide which mode you wanted would be asking the user
 * to do the routing.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerCompanies } from '../engine/sources'
import type { Evidence } from '../engine/types'
import type { CompanyFactKind } from '../engine/sources/companies'

export interface CompanyFinancial {
  label: string
  value: number
  unit: string
  periodEnd: string
  form: string
  xbrlTag: string
  sourceUrl?: string
}

export interface CompanyFiling {
  form: string
  filedAt: string | null
  claim: string
  sourceUrl?: string
}

export interface CompanyRank {
  rank: number
  name: string
  cik: string
  value: number
  metric: string
  periodEnd: string | null
}

export interface CompanyProfile {
  name: string
  cik: string
  ticker: string | null
  tickers: string[]
  industry: string | null
  sic: string | null
  exchanges: string[]
  state: string | null
  city: string | null
  entityType: string | null
  formerNames: Array<{ name: string; until: string | null }>
  sourceUrl?: string
}

export interface CompanyReport {
  generatedAt: string
  subject: string
  /** Null when nothing resolved — a company we could not find is not an error. */
  profile: CompanyProfile | null
  financials: CompanyFinancial[]
  filings: CompanyFiling[]
  /** Populated when no subject was given: the largest filers by total assets. */
  ranking: CompanyRank[]
  findings: Evidence[]
  summary: {
    facts: number
    sourcesOk: number
    sourcesFailed: number
    /** What a reader must know before believing an absence. */
    scope: string
  }
}

const SCOPE =
  'US-registered filers only. A company that does not file with the SEC will not be found here — that is a limit of the source, not evidence the company does not exist.'

interface FactData {
  kind?: CompanyFactKind
  cik?: string
  name?: string
  ticker?: string
  tickers?: string[]
  sic?: string | null
  industry?: string | null
  exchanges?: string[]
  state?: string | null
  city?: string | null
  entityType?: string | null
  formerName?: string
  until?: string | null
  label?: string
  value?: number
  unit?: string
  periodEnd?: string | null
  form?: string
  xbrlTag?: string
  filedAt?: string | null
  rank?: number
  metric?: string
}

export async function companyReport(subject: string): Promise<CompanyReport> {
  registerCompanies()
  const generatedAt = new Date().toISOString()
  const query = subject.trim()

  // No subject means "show me the field", which is a different capability and a
  // different source — not the profile source called with an empty string.
  const r = query
    ? await collect({ capability: 'company', value: query }, { registry, mode: 'all' })
    : await collect({ capability: 'company_ranking', value: '' }, { registry, mode: 'all' })

  let profile: CompanyProfile | null = null
  const financials: CompanyFinancial[] = []
  const filings: CompanyFiling[] = []
  const ranking: CompanyRank[] = []
  const formerNames: Array<{ name: string; until: string | null }> = []

  for (const e of r.evidence) {
    const d = (e.data ?? {}) as FactData
    switch (d.kind) {
      case 'identity':
        if (d.formerName) {
          formerNames.push({ name: d.formerName, until: d.until ?? null })
        } else if (!profile && d.name && d.cik) {
          profile = {
            name: d.name,
            cik: d.cik,
            ticker: d.ticker ?? null,
            tickers: d.tickers ?? [],
            industry: d.industry ?? null,
            sic: d.sic ?? null,
            exchanges: d.exchanges ?? [],
            state: d.state ?? null,
            city: d.city ?? null,
            entityType: d.entityType ?? null,
            formerNames: [],
            sourceUrl: e.sourceUrl,
          }
        }
        break
      case 'financial':
        if (d.label && typeof d.value === 'number' && d.periodEnd) {
          financials.push({
            label: d.label,
            value: d.value,
            unit: d.unit ?? 'USD',
            periodEnd: d.periodEnd,
            form: d.form ?? 'unknown',
            xbrlTag: d.xbrlTag ?? '',
            sourceUrl: e.sourceUrl,
          })
        }
        break
      case 'filing':
        if (d.form) {
          filings.push({ form: d.form, filedAt: d.filedAt ?? null, claim: e.claim, sourceUrl: e.sourceUrl })
        }
        break
      case 'ranking':
        if (typeof d.rank === 'number' && d.name && typeof d.value === 'number') {
          ranking.push({
            rank: d.rank,
            name: d.name,
            cik: d.cik ?? '',
            value: d.value,
            metric: d.metric ?? 'Total assets',
            periodEnd: d.periodEnd ?? null,
          })
        }
        break
    }
  }

  if (profile) profile.formerNames = formerNames

  return {
    generatedAt,
    subject: query,
    profile,
    // Balance-sheet scale first, then flow, then the rest — the order an analyst
    // reads a company in, not the order XBRL happens to store the tags.
    financials: financials.sort((a, b) => FINANCIAL_ORDER.indexOf(a.label) - FINANCIAL_ORDER.indexOf(b.label)),
    filings: filings.sort((a, b) => (b.filedAt ?? '').localeCompare(a.filedAt ?? '')),
    ranking: ranking.sort((a, b) => a.rank - b.rank),
    findings: r.evidence,
    summary: {
      facts: r.evidence.length,
      sourcesOk: r.results.filter((s) => s.ok).length,
      sourcesFailed: r.results.filter((s) => !s.ok).length,
      scope: SCOPE,
    },
  }
}

const FINANCIAL_ORDER = [
  'Revenue',
  'Net income',
  'Total assets',
  'Total liabilities',
  'Shareholders’ equity',
  'Cash & equivalents',
  'Research & development',
]
