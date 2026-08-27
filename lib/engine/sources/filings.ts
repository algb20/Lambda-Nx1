/**
 * Filings intelligence — what companies just told their regulator.
 *
 * ## The source
 *
 * `efts.sec.gov` is the SEC's full-text search index. It searches the **body**
 * of every filing — not titles, not metadata — and answers without a key. It
 * also returns, on every 8-K, the item codes saying which disclosure
 * obligations the filing was made under, plus the filer's CIK, tickers, SIC
 * code and business location.
 *
 * This is the capability the expensive terminals sell, available because the
 * SEC publishes it. The analysis in `lib/analysis/disclosure.ts` is what turns
 * the stream into something a reader can act on.
 *
 * ## Two questions, one source
 *
 * With a query it is **full-text search**: find every filing whose text
 * contains a phrase. Without one it is **the tape**: the most consequential
 * filings of the last few days, ranked by what they disclose rather than by
 * when they arrived.
 *
 * ## Politeness
 *
 * The SEC requires a declared User-Agent identifying the caller, and refuses
 * anonymous automated traffic. Ours names the product and a contact address,
 * which is the arrangement they ask for. A UA containing a bare URL is rejected
 * — measured, not guessed.
 */
import type { Evidence, Source } from '../types'
import { assessFiling } from '../../analysis/disclosure'

export interface FilingPoint {
  /** Accession number — the filing's unique identity at the SEC. */
  accession: string
  form: string
  /** The company as EDGAR names it, cleaned of the CIK suffix. */
  company: string
  cik: string | null
  tickers: string[]
  /** ISO date the filing was made. */
  filedAt: string
  /** 8-K item codes, empty for forms that do not carry them. */
  items: string[]
  /** 0–100 from the most consequential item. */
  weight: number
  /** What the leading item means, in words. */
  meaning: string
  /** The SEC's own page for this filing. */
  url: string
  /** Where the filer says it does business. */
  location: string | null
}

interface FtsHit {
  _id?: string
  _source?: {
    ciks?: string[]
    display_names?: string[]
    file_date?: string
    form?: string
    root_forms?: string[]
    items?: string[]
    adsh?: string
    biz_locations?: string[]
    file_type?: string
  }
}

/**
 * EDGAR renders a company as `APPLE INC  (AAPL)  (CIK 0000320193)`.
 *
 * Useful and unreadable at the width of a row, so the three facts are split
 * apart rather than shown as one string. The CIK is kept because it is the
 * join key into every other EDGAR surface, and the tickers because they are
 * what a reader recognises.
 */
export function parseDisplayName(raw: string): {
  company: string
  cik: string | null
  tickers: string[]
} {
  const cik = /\(CIK\s+(\d+)\)/i.exec(raw)?.[1] ?? null
  let rest = raw.replace(/\(CIK\s+\d+\)/i, '').trim()

  // The ticker group is the last parenthesised list before the CIK.
  const tickerMatch = /\(([A-Z0-9.\-,\s]+)\)\s*$/.exec(rest)
  const tickers = tickerMatch
    ? tickerMatch[1]
        .split(',')
        .map((t) => t.trim())
        .filter((t) => /^[A-Z0-9.\-]{1,8}$/.test(t))
    : []
  if (tickerMatch) rest = rest.slice(0, tickerMatch.index).trim()

  return { company: rest.replace(/\s{2,}/g, ' ').trim() || raw.trim(), cik, tickers }
}

/** The SEC's page for a filing, from its accession number. */
export function filingUrl(cik: string | null, accession: string): string {
  const clean = accession.replace(/-/g, '')
  if (!cik) return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&filenum=${accession}`
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${clean}/${accession}-index.htm`
}

/** Turn the search index's hits into filings, graded. */
export function readFilings(body: unknown): FilingPoint[] {
  const hits = (body as { hits?: { hits?: FtsHit[] } })?.hits?.hits
  if (!Array.isArray(hits)) return []

  const out: FilingPoint[] = []
  const seen = new Set<string>()

  for (const hit of hits) {
    const s = hit._source
    if (!s) continue

    // One filing can appear once per document inside it. The accession number
    // identifies the filing, so the second document is the same event.
    const accession = s.adsh ?? (hit._id ?? '').split(':')[0]
    if (!accession || seen.has(accession)) continue
    seen.add(accession)

    const { company, cik, tickers } = parseDisplayName(s.display_names?.[0] ?? '')
    if (!company) continue

    const items = Array.isArray(s.items) ? s.items : []
    const assessment = assessFiling(items)

    out.push({
      accession,
      form: s.form ?? s.root_forms?.[0] ?? 'filing',
      company,
      cik: cik ?? s.ciks?.[0] ?? null,
      tickers,
      filedAt: s.file_date ?? '',
      items,
      weight: assessment.weight,
      meaning: assessment.summary,
      url: filingUrl(cik ?? s.ciks?.[0] ?? null, accession),
      location: s.biz_locations?.[0] ?? null,
    })
  }

  // Most consequential first, then newest. Ranking by date alone is what buries
  // a restatement under ninety-two exhibit notices.
  out.sort((a, b) => b.weight - a.weight || b.filedAt.localeCompare(a.filedAt))
  return out
}

/** The last `days` as the two dates EDGAR's search wants. */
export function windowDates(days: number, now = new Date()): { start: string; end: string } {
  const end = new Date(now)
  const start = new Date(now.getTime() - days * 86_400_000)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { start: iso(start), end: iso(end) }
}

/**
 * How far back the tape looks when nobody asked for a date.
 *
 * Four days rather than one: filings cluster on business days, and a Monday
 * morning asking for "today" would show an empty market rather than Friday's
 * disclosures.
 */
export const TAPE_DAYS = 4

export const secFilingsSource: Source = {
  key: 'sec_full_text',
  capability: 'filings',
  passive: true,
  hosts: ['efts.sec.gov'],
  minIntervalMs: 1_200,
  async run(input, ctx) {
    const query = input.value.trim()
    const { start, end } = windowDates(TAPE_DAYS)

    const params = new URLSearchParams({
      // A bare `*` is rejected; an empty phrase returns the window unfiltered.
      q: query || '""',
      dateRange: 'custom',
      startdt: start,
      enddt: end,
    })
    // Without a query the tape is 8-K only — the form that carries item codes,
    // and therefore the only one this analysis can grade.
    if (!query) params.set('forms', '8-K')

    const res = await ctx.fetch(`https://efts.sec.gov/LATEST/search-index?${params}`, {
      // The SEC refuses anonymous automated traffic and asks callers to
      // identify themselves. The engine's `USER_AGENT` is exactly the accepted
      // form — a name and a contact address, no URL — so this inherits it
      // rather than keeping a second copy that an operator's `ENGINE_CONTACT`
      // could never reach.
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`SEC full-text search answered ${res.status}`)

    const filings = readFilings(await res.json())
    return filings.slice(0, 120).map((f) => filingEvidence(f, query))
  },
}

function filingEvidence(f: FilingPoint, query: string): Evidence {
  const who = f.tickers.length ? `${f.company} (${f.tickers.join(', ')})` : f.company
  return {
    claim: `${who} filed ${f.form} — ${f.meaning}`,
    entity: { type: 'company', value: f.company },
    sourceKey: 'sec_full_text',
    sourceUrl: f.url,
    retrievedAt: new Date().toISOString(),
    // The filing date is the company's own statement of when it filed, and it
    // is never the same as when we read it.
    publishedAt: f.filedAt ? `${f.filedAt}T00:00:00Z` : null,
    // A regulator's own index of a company's own filing: reliable source,
    // first-hand information.
    admiralty: { source: 'A', info: 1 },
    confidence: 'confirmed',
    data: { ...f, query } as unknown as Record<string, unknown>,
  }
}

export const FILING_SOURCES: Source[] = [secFilingsSource]
