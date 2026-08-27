/**
 * Companies — sources, from the regulator rather than from an aggregator.
 *
 * ## Why the SEC and not a data vendor
 *
 * Every "company data" product resells the same filings behind a subscription.
 * The filings themselves are public, machine-readable, keyless, and — because
 * they are what the company is legally answerable for — better evidence than
 * anybody's summary of them. A number in a 10-Q is a number an executive signed;
 * a number on a data vendor's dashboard is that number after a pipeline nobody
 * outside the vendor can inspect.
 *
 * So this reads EDGAR directly:
 *
 *  - **`company_tickers.json`** — every ticker the SEC recognises, mapped to a
 *    CIK. This is the resolver: "Apple" and "AAPL" both have to reach 320193.
 *  - **`submissions/CIK…json`** — identity and the filing history: legal name,
 *    former names, industry (SIC), exchanges, state, and the last filings with
 *    their dates.
 *  - **`companyfacts/CIK…json`** — every XBRL fact the company has ever
 *    reported, which is where revenue, assets, income and equity come from.
 *  - **`frames/us-gaap/Assets/USD/CY…`** — the same fact for *every* filer in
 *    one period, which is what makes an honest ranking possible: six thousand
 *    companies, each reporting its own balance sheet, sorted.
 *
 * ## The tag problem, which is the whole difficulty
 *
 * XBRL has no single tag for "revenue". A company reporting under the current
 * standard uses `RevenueFromContractWithCustomerExcludingAssessedTax`; older
 * filings use `Revenues`; financial institutions use `InterestAndDividendIncomeOperating`.
 * Reading only `Revenues` gives Apple its **2018** figure and calls it current,
 * which is exactly the kind of confidently-wrong number this platform exists not
 * to publish. Each concept therefore names its candidate tags in preference
 * order, and the most recently *reported* one wins — not the first that exists.
 *
 * ## Scope
 *
 * US-listed and US-registered filers. That is a real limit and is stated in the
 * gateway's own copy rather than implied: a German Mittelstand company files
 * nowhere near the SEC and will not be found here. GLEIF and the ownership
 * gateway already cover legal-entity identity worldwide; this covers what a
 * company has told a regulator about its own finances.
 */
import type { Evidence, Source } from '../types'
import { expectOk } from '../fetch-guard'

export type CompanyFactKind = 'identity' | 'financial' | 'filing' | 'ranking'

const SEC_HOSTS = ['www.sec.gov', 'data.sec.gov']

function companyEvidence(input: {
  kind: CompanyFactKind
  claim: string
  cik: string
  name: string
  sourceUrl: string
  publishedAt?: string | null
  data?: Record<string, unknown>
}): Evidence {
  return {
    claim: input.claim,
    entity: { type: 'company', value: input.name },
    sourceKey: 'sec_edgar',
    sourceUrl: input.sourceUrl,
    retrievedAt: new Date().toISOString(),
    publishedAt: input.publishedAt ?? null,
    // The regulator publishing what the company itself filed, under signature.
    // There is no better grade available for a corporate financial fact.
    admiralty: { source: 'A', info: 1 },
    confidence: 'confirmed',
    data: { kind: input.kind, cik: input.cik, name: input.name, ...input.data },
  }
}

/** `320193` → `CIK0000320193`, the padded form every EDGAR path wants. */
export function padCik(cik: string | number): string {
  return `CIK${String(cik).replace(/\D/g, '').padStart(10, '0')}`
}

interface TickerRow {
  cik_str?: number
  ticker?: string
  title?: string
}

/**
 * Resolve what a person typed to a filer.
 *
 * Four passes, most specific first, because "Apple" must not match "Apple
 * Hospitality REIT" when Apple Inc exists, and "AAPL" must not fall through to a
 * substring match on a company with "aapl" inside a longer word.
 */
export function resolveFiler(
  rows: TickerRow[],
  query: string,
): { cik: string; ticker: string; title: string } | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const usable = rows.filter((r) => r.cik_str && r.ticker && r.title)

  const exactTicker = usable.find((r) => r.ticker!.toLowerCase() === q)
  const exactName = usable.find((r) => r.title!.toLowerCase() === q)
  // "apple inc" typed as "apple" — the legal suffix is noise a person omits.
  const nameNoSuffix = usable.find(
    (r) => stripSuffix(r.title!.toLowerCase()) === stripSuffix(q),
  )
  const startsWith = usable.find((r) => r.title!.toLowerCase().startsWith(q))
  const contains = usable.find((r) => r.title!.toLowerCase().includes(q))

  const hit = exactTicker ?? exactName ?? nameNoSuffix ?? startsWith ?? contains
  return hit ? { cik: String(hit.cik_str), ticker: hit.ticker!, title: hit.title! } : null
}

function stripSuffix(name: string): string {
  return name
    .replace(/[.,]/g, ' ')
    .replace(/\b(inc|incorporated|corp|corporation|co|company|plc|ltd|limited|llc|lp|sa|nv|ag)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── The concepts we read, and the tags each may hide behind ─────────────────

interface Concept {
  label: string
  /** Preference order. The most recently *reported* match wins, not the first. */
  tags: string[]
  unit: string
}

const CONCEPTS: Concept[] = [
  {
    label: 'Revenue',
    tags: [
      'RevenueFromContractWithCustomerExcludingAssessedTax',
      'RevenueFromContractWithCustomerIncludingAssessedTax',
      'Revenues',
      'SalesRevenueNet',
      // Banks and insurers report neither of the above.
      'InterestAndDividendIncomeOperating',
    ],
    unit: 'USD',
  },
  { label: 'Total assets', tags: ['Assets'], unit: 'USD' },
  { label: 'Total liabilities', tags: ['Liabilities'], unit: 'USD' },
  {
    label: 'Net income',
    tags: ['NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic'],
    unit: 'USD',
  },
  {
    label: 'Shareholders’ equity',
    tags: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
    unit: 'USD',
  },
  { label: 'Cash & equivalents', tags: ['CashAndCashEquivalentsAtCarryingValue'], unit: 'USD' },
  {
    label: 'Research & development',
    tags: ['ResearchAndDevelopmentExpense'],
    unit: 'USD',
  },
]

interface XbrlFact {
  val?: number
  end?: string
  fy?: number
  fp?: string
  form?: string
  filed?: string
}

interface CompanyFacts {
  entityName?: string
  facts?: Record<string, Record<string, { units?: Record<string, XbrlFact[]> }>>
}

/**
 * The most recent value for a concept, and which tag it came from.
 *
 * "Most recent" is by the period the fact *describes* (`end`), not by when it
 * was filed: a company restating an old quarter files it today, and taking the
 * newest filing would report a two-year-old figure as current.
 */
export function latestFact(
  facts: CompanyFacts,
  concept: Concept,
): { value: number; end: string; form: string; tag: string; filed: string | null } | null {
  let best: { value: number; end: string; form: string; tag: string; filed: string | null; rank: number } | null = null

  for (const [rank, tag] of concept.tags.entries()) {
    const entry = facts.facts?.['us-gaap']?.[tag] ?? facts.facts?.['ifrs-full']?.[tag]
    const points = entry?.units?.[concept.unit]
    if (!Array.isArray(points)) continue
    for (const p of points) {
      if (typeof p.val !== 'number' || !p.end) continue
      /**
       * Every candidate tag is considered, and the newest period wins — with
       * preference order breaking a tie only when two tags describe the *same*
       * period.
       *
       * Stopping at the first tag that yielded anything was the obvious
       * implementation and it was wrong in a way that looked right: NVIDIA
       * stopped using `RevenueFromContractWithCustomerExcludingAssessedTax`
       * after their FY2022 10-K, so a preference-first read returned their
       * **2022** revenue next to a 2026 balance sheet, with nothing on the card
       * to suggest the two were four years apart. Companies change tags as
       * standards change; the reader wants the newest number the company
       * actually reported, whichever tag it is filed under — which is why the
       * tag travels with the figure.
       */
      if (!best || p.end > best.end || (p.end === best.end && rank < best.rank)) {
        best = { value: p.val, end: p.end, form: p.form ?? 'unknown', tag, filed: p.filed ?? null, rank }
      }
    }
  }
  return best ? { value: best.value, end: best.end, form: best.form, tag: best.tag, filed: best.filed } : null
}

// ── The company profile ─────────────────────────────────────────────────────

interface Submissions {
  name?: string
  cik?: string
  sic?: string
  sicDescription?: string
  exchanges?: string[]
  tickers?: string[]
  stateOfIncorporation?: string
  entityType?: string
  formerNames?: Array<{ name?: string; from?: string; to?: string }>
  addresses?: { business?: { city?: string; stateOrCountry?: string } }
  filings?: { recent?: { form?: string[]; filingDate?: string[]; primaryDocDescription?: string[]; accessionNumber?: string[] } }
}

/** Filings that say something an analyst acts on, rather than routine plumbing. */
const NOTABLE_FORMS = new Set(['10-K', '10-Q', '8-K', '20-F', '40-F', 'S-1', 'DEF 14A', 'SC 13D', 'SC 13G', '6-K'])

export const secCompanyProfile: Source = {
  key: 'sec_edgar',
  capability: 'company',
  passive: true,
  hosts: SEC_HOSTS,
  // The SEC publishes a rate guideline of ten requests a second; this source
  // makes three or four per run and is deliberately far under it.
  minIntervalMs: 400,
  async run(input, ctx) {
    const query = input.value.trim()
    if (!query) return []

    const tickersRes = await ctx.fetch('https://www.sec.gov/files/company_tickers.json')
    expectOk('sec_edgar', tickersRes)
    const tickerBody = (await tickersRes.json().catch(() => null)) as Record<string, TickerRow> | null
    if (!tickerBody) return []

    const filer = resolveFiler(Object.values(tickerBody), query)
    if (!filer) return []

    const padded = padCik(filer.cik)
    const out: Evidence[] = []

    // ── Identity ─────────────────────────────────────────────────────────────
    const subRes = await ctx.fetch(`https://data.sec.gov/submissions/${padded}.json`)
    const sub = subRes.ok ? ((await subRes.json().catch(() => null)) as Submissions | null) : null
    const name = sub?.name ?? filer.title
    const profileUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${padded}&type=&dateb=&owner=include&count=40`

    if (sub) {
      const where = [sub.addresses?.business?.city, sub.addresses?.business?.stateOrCountry]
        .filter(Boolean)
        .join(', ')
      out.push(
        companyEvidence({
          kind: 'identity',
          claim: `${name} — ${sub.sicDescription ?? 'industry not stated'} (SIC ${sub.sic ?? '—'}), ${
            sub.exchanges?.length ? `listed on ${sub.exchanges.join(', ')}` : 'not listed on a US exchange'
          }${where ? `, based in ${where}` : ''}`,
          cik: filer.cik,
          name,
          sourceUrl: profileUrl,
          data: {
            ticker: filer.ticker,
            tickers: sub.tickers ?? [filer.ticker],
            sic: sub.sic ?? null,
            industry: sub.sicDescription ?? null,
            exchanges: sub.exchanges ?? [],
            state: sub.stateOfIncorporation ?? null,
            entityType: sub.entityType ?? null,
            city: sub.addresses?.business?.city ?? null,
          },
        }),
      )

      /**
       * Former names are an intelligence fact, not trivia: a company that
       * changed its name is a company whose earlier record is filed under
       * something else, and an analyst who does not know that will conclude it
       * has no history.
       */
      for (const former of (sub.formerNames ?? []).slice(0, 5)) {
        if (!former.name) continue
        out.push(
          companyEvidence({
            kind: 'identity',
            claim: `${name} formerly filed as “${former.name}”${former.to ? ` until ${former.to.slice(0, 10)}` : ''}`,
            cik: filer.cik,
            name,
            sourceUrl: profileUrl,
            publishedAt: former.to ?? null,
            data: { formerName: former.name, until: former.to ?? null },
          }),
        )
      }

      // ── Recent filings ─────────────────────────────────────────────────────
      const recent = sub.filings?.recent
      if (recent?.form && recent.filingDate) {
        let shown = 0
        for (let i = 0; i < recent.form.length && shown < 8; i++) {
          const form = recent.form[i]
          if (!NOTABLE_FORMS.has(form)) continue
          const filed = recent.filingDate[i]
          const accession = recent.accessionNumber?.[i]?.replace(/-/g, '')
          out.push(
            companyEvidence({
              kind: 'filing',
              claim: `${form} filed ${filed}${
                recent.primaryDocDescription?.[i] ? ` — ${recent.primaryDocDescription[i]}` : ''
              }`,
              cik: filer.cik,
              name,
              sourceUrl: accession
                ? `https://www.sec.gov/Archives/edgar/data/${Number(filer.cik)}/${accession}/`
                : profileUrl,
              publishedAt: filed ?? null,
              data: { form, filedAt: filed ?? null },
            }),
          )
          shown++
        }
      }
    }

    // ── Financials ───────────────────────────────────────────────────────────
    const factsRes = await ctx.fetch(`https://data.sec.gov/api/xbrl/companyfacts/${padded}.json`)
    if (factsRes.ok) {
      const facts = (await factsRes.json().catch(() => null)) as CompanyFacts | null
      if (facts) {
        for (const concept of CONCEPTS) {
          const found = latestFact(facts, concept)
          if (!found) continue
          out.push(
            companyEvidence({
              kind: 'financial',
              // The period and the form are in the claim, because a financial
              // figure without them invites the reader to assume it is current
              // and annual, and it is frequently neither.
              claim: `${concept.label}: ${formatUsd(found.value)} — as reported in ${found.form}, period ending ${found.end}`,
              cik: filer.cik,
              name,
              sourceUrl: `https://data.sec.gov/api/xbrl/companyconcept/${padded}/us-gaap/${found.tag}.json`,
              publishedAt: found.filed ?? found.end,
              data: {
                label: concept.label,
                value: found.value,
                unit: concept.unit,
                periodEnd: found.end,
                form: found.form,
                // Which tag it came from, so a reader can tell a bank's interest
                // income from a manufacturer's product revenue.
                xbrlTag: found.tag,
              },
            }),
          )
        }
      }
    }

    return out
  },
}

// ── The ranking ─────────────────────────────────────────────────────────────

interface FrameBody {
  data?: Array<{ cik?: number; entityName?: string; val?: number; end?: string }>
}

/**
 * The most recent completed quarter, as EDGAR names instant frames.
 *
 * `CY2025Q4I` — the `I` marks an instant (a balance-sheet date) rather than a
 * duration. Two quarters back rather than one: a frame is only populated once
 * enough filers have reported into it, and asking for the current quarter
 * reliably returns nothing at all.
 */
export function recentInstantFrames(now: Date, count = 3): string[] {
  const frames: string[] = []
  const quarter = Math.floor(now.getUTCMonth() / 3) + 1
  let year = now.getUTCFullYear()
  let q = quarter - 1 // the quarter that has closed
  for (let i = 0; i < count; i++) {
    if (q < 1) {
      q += 4
      year -= 1
    }
    frames.push(`CY${year}Q${q}I`)
    q -= 1
  }
  return frames
}

export const secLargestFilers: Source = {
  key: 'sec_edgar_ranking',
  capability: 'company_ranking',
  passive: true,
  hosts: ['data.sec.gov'],
  minIntervalMs: 400,
  async run(_input, ctx) {
    /**
     * Walk back through recent quarters until one is populated. A fixed frame
     * would be empty for the first weeks of every quarter and correct for the
     * rest — a bug that appears and disappears on a calendar.
     */
    for (const frame of recentInstantFrames(new Date())) {
      const res = await ctx.fetch(
        `https://data.sec.gov/api/xbrl/frames/us-gaap/Assets/USD/${frame}.json`,
      )
      /**
       * EXHAUSTION-IS-EMPTY: this walks back through recent quarters until one
       * is populated. A 404 on a quarter the SEC has not compiled yet is the
       * expected answer, not a refusal, so exhausting the candidates means "no
       * quarter is published" rather than "the provider would not serve us".
       */
      if (!res.ok) continue
      const body = (await res.json().catch(() => null)) as FrameBody | null
      const rows = (body?.data ?? []).filter((r) => typeof r.val === 'number' && r.entityName)
      if (rows.length === 0) continue

      return rows
        .sort((a, b) => (b.val ?? 0) - (a.val ?? 0))
        .slice(0, 25)
        .map((r, index) =>
          companyEvidence({
            kind: 'ranking',
            claim: `#${index + 1} by total assets: ${r.entityName} — ${formatUsd(r.val ?? 0)} as at ${r.end ?? frame}`,
            cik: String(r.cik ?? ''),
            name: r.entityName ?? 'unknown',
            sourceUrl: `https://data.sec.gov/api/xbrl/frames/us-gaap/Assets/USD/${frame}.json`,
            publishedAt: r.end ?? null,
            data: {
              rank: index + 1,
              value: r.val ?? 0,
              metric: 'Total assets',
              unit: 'USD',
              periodEnd: r.end ?? null,
              frame,
            },
          }),
        )
    }
    return []
  },
}

/** `4424900000000` → `$4.42T`. Full precision travels in `data.value`. */
export function formatUsd(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`
}

export const COMPANY_SOURCES: Source[] = [secCompanyProfile, secLargestFilers]
