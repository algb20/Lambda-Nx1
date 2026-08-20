/**
 * Filings intelligence — the module.
 *
 * Groups what the SEC's full-text index returned by how much it signals, and
 * computes the one figure that makes a day of filings readable: **how many of
 * them disclose anything at all.**
 *
 * On a measured window, 92 of 100 filings carried item 9.01 — an administrative
 * note that documents are attached. A product that shows a reader those ninety-
 * two and buries the one restatement among them has not saved anyone any work.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerFilings } from '../engine/sources'
import type { Evidence } from '../engine/types'
import type { FilingPoint } from '../engine/sources/filings'
import { standoutCodes } from '../analysis/disclosure'

export interface FilingBand {
  key: 'serious' | 'substantive' | 'routine' | 'administrative'
  title: string
  note: string
  filings: FilingPoint[]
}

export interface FilingsReport {
  generatedAt: string
  query: string
  bands: FilingBand[]
  /** Consequential item codes seen in this window, with how often. */
  standouts: Array<{ code: string; label: string; means: string; count: number }>
  findings: Evidence[]
  summary: {
    filings: number
    companies: number
    /** How many disclosed something beyond the administrative. */
    signalling: number
    sourcesOk: number
    sourcesFailed: number
  }
  limits: string[]
}

const BANDS: Array<{ key: FilingBand['key']; title: string; note: string; min: number }> = [
  {
    key: 'serious',
    title: 'Serious disclosures',
    note: 'Bankruptcy, delisting, restatement, accelerated debt, material impairment, a cybersecurity incident or a change of control. Rare by construction.',
    min: 80,
  },
  {
    key: 'substantive',
    title: 'Substantive',
    note: 'Auditor changes, restructuring costs, executive departures, completed acquisitions — real events that are not, by themselves, distress.',
    min: 55,
  },
  {
    key: 'routine',
    title: 'Routine',
    note: 'Earnings, new agreements, equity issuance, governance changes. The ordinary business of a listed company.',
    min: 25,
  },
  {
    key: 'administrative',
    title: 'Administrative',
    note: 'Exhibit lists, Regulation FD notices and other events. Present for completeness; nothing here signals a change in condition.',
    min: 0,
  },
]

export async function filingsReport(query: string): Promise<FilingsReport> {
  registerFilings()
  const generatedAt = new Date().toISOString()

  const r = await collect({ capability: 'filings', value: query }, { registry, mode: 'all' })

  const filings: FilingPoint[] = []
  for (const e of r.evidence) {
    const point = e.data as unknown as FilingPoint | undefined
    if (point?.accession) filings.push(point)
  }

  const bands: FilingBand[] = BANDS.map((b, i) => {
    const upper = i === 0 ? 101 : BANDS[i - 1].min
    return { ...b, filings: filings.filter((f) => f.weight >= b.min && f.weight < upper) }
  }).filter((b) => b.filings.length > 0)

  const companies = new Set(filings.map((f) => f.company)).size
  const signalling = filings.filter((f) => f.weight > 0).length

  return {
    generatedAt,
    query,
    bands,
    standouts: standoutCodes(filings).map((s) => ({
      code: s.item.code,
      label: s.item.label,
      means: s.item.means,
      count: s.count,
    })),
    findings: r.evidence,
    summary: {
      filings: filings.length,
      companies,
      signalling,
      sourcesOk: r.results.filter((s) => s.ok).length,
      sourcesFailed: r.results.filter((s) => !s.ok).length,
    },
    limits: limitsFor(filings.length, signalling, query),
  }
}

function limitsFor(filings: number, signalling: number, query: string): string[] {
  const limits = [
    'US filers only. A company that does not file with the SEC is absent here, and its absence says nothing about the company.',
    'A filing is a company’s own statement to its regulator. This grades what *kind* of statement it is; it is never investment advice, a prediction, or a claim that a company is in trouble.',
  ]
  if (filings === 0) {
    limits.push(
      query
        ? `Nothing in the last few days’ filings contains “${query}”. That is a statement about this window, not about the world.`
        : 'No filings came back for this window. Filings cluster on business days.',
    )
    return limits
  }
  if (signalling < filings) {
    limits.push(
      `${filings - signalling} of ${filings} carry only administrative item codes. They are shown, ranked last, rather than hidden — but they signal nothing about the filer.`,
    )
  }
  limits.push(
    'Item codes describe the obligation a filing was made under, not its contents. A 5.02 covers a planned retirement and an abrupt resignation identically; open the filing to tell them apart.',
  )
  return limits
}
