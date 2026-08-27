/**
 * Seven gateways, seven authorities, one shape.
 *
 * ## Why these seven
 *
 * The platform could read hazards, news, markets, companies and housing, and
 * was blind to everything else a serious analyst reasons about. These are the
 * gaps, each filled by the body that *is* the record rather than by someone
 * reporting on it:
 *
 * | Gateway | Authority | Why it is the primary record |
 * |---|---|---|
 * | Courts | CourtListener / Free Law Project | The opinions themselves, as filed |
 * | Regulation | US Federal Register | The government's own daily journal |
 * | Officials | BIS central bank speeches | What central bankers actually said |
 * | Resources | IMF commodity series via FRED | The price series policy is set on |
 * | Power grid | Elexon (GB electricity settlement) | Metered generation, half-hourly |
 * | Space weather | NOAA SWPC | The agency that issues the alerts |
 * | Orbital | CelesTrak | Element sets, from the tracking network |
 *
 * ## Why one file and one shape
 *
 * Seven gateways written seven ways is seven places for the same bug. Every
 * source here emits the same `data` bag — `group`, `headline`, `detail`,
 * `value`, `unit`, `at`, `url` — so `lib/modules/board.ts` renders all of them
 * without knowing what any of them are about, and a new gateway is a source and
 * a catalogue row rather than a new stack.
 *
 * ## What they share besides shape
 *
 * Every one is keyless, passive, and reports the publisher's own time rather
 * than ours. Where a figure is published in arrears — which is most of them —
 * the period travels inside the headline, because a number without its period
 * is read as "now" and is usually not.
 */
import type { Evidence, Source, SourceContext } from '../types'
import { expectOk, SourceUnavailableError } from '../fetch-guard'
import { publicationTime } from '../observed'
import { parseFeed } from '../feedxml'
import { assessImpact, corroborationBySubject } from '../../analysis/impact'

export interface BoardPoint {
  group: string
  headline: string
  detail?: string
  value?: number
  unit?: string
  /** The publisher's own timestamp, never ours. */
  at?: string | null
  url?: string
  /** Higher sorts first inside its group. Used where an order exists. */
  weight?: number
}

/**
 * Every request from this file, made the same way.
 *
 * ## The failure this exists for, measured
 *
 * The courts board reported **`ok: 1, failed: 0` and zero rows**. CourtListener
 * was in fact answering:
 *
 * ```
 * 429 {"detail":"Request was throttled. Expected available in 5040 seconds."}
 * ```
 *
 * Ninety minutes of throttling, swallowed by `if (!res.ok) return []`, and
 * presented to the reader as a healthy source with nothing to say. That is what
 * `boardFetch` fixes: `expectOk` turns a refusal into a thrown error the
 * orchestrator records, so the board says one source failed instead of quietly
 * showing an empty page. The same trap cost the markets board two of its four
 * sections when Stooq began answering with a challenge page.
 *
 * ## Why there is no User-Agent here, having briefly had one
 *
 * The first version of this block set its own. That was wrong twice over, and
 * the correction is worth keeping because the reasoning was plausible.
 *
 * First, it was not needed: `Guardrail.createFetch` already puts `USER_AGENT`
 * on every request the engine makes, so nothing in this file was ever
 * anonymous. The throttle was a spent quota, not a refusal to identify — and
 * "we were anonymous" was a diagnosis reached by reasoning rather than by
 * reading the code that sends the header.
 *
 * Second, the string chosen — `LambdaNX/1.0 (+https://github.com/…)` — is the
 * exact form `guardrail.ts` records as **measured to be refused with a 403 by
 * the SEC's edge filter**, whichever way it is phrased. None of these nine
 * endpoints is the SEC, so nothing broke; a later board reading an SEC host
 * would have inherited a header this codebase already knew was harmful.
 *
 * The engine has one identity and one place that decides it. A source may
 * still override it for a provider that demands a specific string — but it
 * must be because that provider demanded it, and measured.
 */
const BOARD_HEADERS = {
  Accept: 'application/json, application/rss+xml, application/xml;q=0.9, */*;q=0.5',
}

async function boardFetch(ctx: SourceContext, sourceKey: string, url: string): Promise<Response> {
  return expectOk(sourceKey, await ctx.fetch(url, { headers: BOARD_HEADERS }))
}

/**
 * The same request, for a source that reads **many** endpoints.
 *
 * The distinction is not cosmetic and collapsing it would be a bug in one
 * direction or the other. A board reading one API has nothing to show when that
 * API refuses, and must say so — that is `boardFetch`. A board reading nine
 * press offices, eighteen FRED series or three CelesTrak groups loses one of
 * many, and killing the whole run for it would turn a partial answer into no
 * answer. So this one returns the response as it came and lets the caller skip.
 *
 * What it must never become is the swallowed failure it replaces: the caller
 * skips a *known* absence, and the board's own summary still counts what came
 * back against what was asked for.
 */
async function boardTry(ctx: SourceContext, url: string): Promise<Response> {
  return ctx.fetch(url, { headers: BOARD_HEADERS })
}

function boardEvidence(
  sourceKey: string,
  point: BoardPoint,
  admiralty: { source: 'A' | 'B'; info: 1 | 2 },
): Evidence {
  return {
    claim: point.detail ? `${point.headline} — ${point.detail}` : point.headline,
    entity: { type: 'other', value: point.group },
    sourceKey,
    sourceUrl: point.url,
    retrievedAt: new Date().toISOString(),
    publishedAt: point.at ?? null,
    admiralty,
    confidence: 'probable',
    data: { ...point },
  }
}

// ═══ Courts & litigation ════════════════════════════════════════════════════

interface ClResult {
  caseName?: string
  court?: string
  dateFiled?: string
  absolute_url?: string
  snippet?: string
  status?: string
}

/**
 * How a filing date is shown when the calendar disagrees with the court.
 *
 * The live board carried a case whose `dateFiled` was **2028-04-13** — nearly
 * two years out. The ranking was already safe: `publicationTime` refuses a date
 * beyond a two-hour skew, so `at` came back `null` and the row sorted by
 * receipt rather than climbing to the top of every board on a date that has not
 * happened. What was not safe was the *reading*: the row said `filed
 * 2028-04-13` in the same flat voice as every real date, so a person had no way
 * to tell a courthouse typo from a decision.
 *
 * Deleting the date would be the wrong repair. The court's index really does
 * state it, and suppressing a source's own field to make our page look tidy is
 * the opposite of this project's rule about honest numbers. So the date is
 * quoted, and what we could not verify about it is quoted with it. Three cases
 * are distinguishable and each says something different about the record:
 * ahead of now, before the epoch, and not a date at all.
 */
export function statedFilingDetail(stated: string | undefined, now = Date.now()): string | undefined {
  if (!stated) return undefined
  if (publicationTime(stated)) return `filed ${stated}`
  const ms = Date.parse(stated)
  if (Number.isNaN(ms)) return `filing date as the court states it: ${stated} — unreadable`
  if (ms > now) return `filing date as the court states it: ${stated} — not yet reached`
  return `filing date as the court states it: ${stated} — outside the plausible range`
}

/**
 * The court record, searchable.
 *
 * CourtListener is the Free Law Project's index of American case law — the
 * opinions as filed, not a commentary on them. A blank query returns the newest
 * opinions across every court, which is the honest default for a board: "what
 * has just been decided" rather than "what we think you should care about".
 */
export const courtsSource: Source = {
  key: 'courtlistener',
  capability: 'courts',
  passive: true,
  hosts: ['www.courtlistener.com'],
  minIntervalMs: 1500,
  async run(input, ctx) {
    const query = input.value.trim()
    const url =
      'https://www.courtlistener.com/api/rest/v4/search/?type=o&order_by=dateFiled%20desc&page_size=20' +
      (query ? `&q=${encodeURIComponent(query)}` : '')
    const body = (await boardFetch(ctx, 'courtlistener', url)
      .then((r) => r.json())
      .catch((err) => {
        // A parse failure is the provider's problem, not "no results".
        if (err instanceof Error && err.name === 'SourceUnavailableError') throw err
        return null
      })) as { results?: ClResult[] } | null
    if (!Array.isArray(body?.results)) return []

    return body.results.slice(0, 20).map((r) =>
      boardEvidence(
        'courtlistener',
        {
          group: r.court ?? 'Court not named',
          headline: r.caseName ?? 'Unnamed case',
          detail: statedFilingDetail(r.dateFiled),
          at: publicationTime(r.dateFiled),
          url: r.absolute_url ? `https://www.courtlistener.com${r.absolute_url}` : undefined,
        },
        // The opinion as the court published it, republished by a non-profit
        // index. Reliable source, and the information is the document itself.
        { source: 'A', info: 1 },
      ),
    )
  },
}

// ═══ Regulation & rulemaking ════════════════════════════════════════════════

interface FrDoc {
  title?: string
  type?: string
  publication_date?: string
  html_url?: string
  agencies?: Array<{ name?: string }>
  abstract?: string
}

/**
 * The Federal Register is the United States government's daily journal — every
 * proposed rule, final rule, notice and presidential document, on the day it
 * takes effect. There is no more primary record of what a government is
 * actually doing, and it is one of the few such records with a real API.
 */
export const regulationSource: Source = {
  key: 'federal_register',
  capability: 'regulation',
  passive: true,
  hosts: ['www.federalregister.gov'],
  minIntervalMs: 1200,
  async run(input, ctx) {
    const query = input.value.trim()
    const fields = ['title', 'type', 'publication_date', 'html_url', 'agencies', 'abstract']
      .map((f) => `fields[]=${f}`)
      .join('&')
    const url =
      `https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&${fields}` +
      (query ? `&conditions[term]=${encodeURIComponent(query)}` : '')
    const res = await boardFetch(ctx, 'federal_register', url)
    const body = (await res.json().catch(() => null)) as { results?: FrDoc[] } | null
    if (!Array.isArray(body?.results)) return []

    return body.results.map((d) =>
      boardEvidence(
        'federal_register',
        {
          // Grouped by document type, not by agency: "what kind of action is
          // this" is the first thing a reader needs, and a proposed rule and a
          // routine notice demand very different attention.
          group: d.type ?? 'Document',
          headline: d.title ?? 'Untitled',
          detail: [d.agencies?.[0]?.name, d.publication_date].filter(Boolean).join(' · ') || undefined,
          at: publicationTime(d.publication_date),
          url: d.html_url,
        },
        { source: 'A', info: 1 },
      ),
    )
  },
}

// ═══ Officials & their statements ═══════════════════════════════════════════

/**
 * What central bankers actually said, in their own words.
 *
 * The BIS collects the speeches of central bank governors and board members
 * worldwide and republishes them as they are delivered. This is the closest
 * thing that exists to a monitored feed of what the most consequential
 * unelected officials on earth are telling people — and it is the *speech*, not
 * a report of the speech, which is the whole difference.
 *
 * **What this gateway is not.** It watches people in their public office,
 * speaking publicly, on the record. It does not follow individuals, and there
 * is no mechanism here that could: the input is a search term over published
 * speeches, and the source is a single institutional feed. Charter §3 forbids
 * building profiles of private individuals, and "public figure" is not a licence
 * to ignore that — what makes this lawful is that a governor's policy speech is
 * a public act of office, not a fact about a person's life.
 */
export const officialsSource: Source = {
  key: 'bis_speeches',
  capability: 'officials',
  passive: true,
  hosts: ['www.bis.org'],
  minIntervalMs: 2000,
  async run(input, ctx) {
    const res = await boardFetch(ctx, 'bis_speeches', 'https://www.bis.org/doclist/cbspeeches.rss')
    const entries = parseFeed(await res.text().catch(() => ''))
    const query = input.value.trim().toLowerCase()
    const matched = query
      ? entries.filter((e) => `${e.title} ${e.summary ?? ''}`.toLowerCase().includes(query))
      : entries

    return matched.slice(0, 25).map((e) => {
      /**
       * The BIS titles a speech `Name: Subject`. Splitting on the first colon
       * groups a governor's speeches together, which is the axis a reader wants
       * — and falls back to the whole title rather than guessing when the
       * pattern does not hold.
       */
      const split = e.title.indexOf(':')
      const speaker = split > 0 && split < 60 ? e.title.slice(0, split).trim() : 'Central bank'
      const subject = split > 0 && split < 60 ? e.title.slice(split + 1).trim() : e.title

      return boardEvidence(
        'bis_speeches',
        {
          group: speaker,
          headline: subject,
          detail: e.summary?.slice(0, 180),
          at: e.published ?? null,
          url: e.link,
        },
        // The BIS republishing a speech its author delivered: the words are
        // first-hand, the channel is a reliable institution.
        { source: 'A', info: 1 },
      )
    })
  },
}

// ═══ Resources: metals, energy, agriculture ═════════════════════════════════

interface CommoditySeries {
  id: string
  name: string
  group: string
  unit: string
}

/**
 * The IMF's primary commodity price series, published through FRED.
 *
 * These are the prices that national budgets, mining investment and food
 * security policy are set against. Monthly, and stated as monthly — a copper
 * price presented without its month reads as a live quote and is not one.
 */
const COMMODITIES: CommoditySeries[] = [
  // Industrial metals — the ones an economy is built out of.
  { id: 'PCOPPUSDM', name: 'Copper', group: 'Industrial metals', unit: '$/tonne' },
  { id: 'PALUMUSDM', name: 'Aluminium', group: 'Industrial metals', unit: '$/tonne' },
  { id: 'PNICKUSDM', name: 'Nickel', group: 'Industrial metals', unit: '$/tonne' },
  { id: 'PZINCUSDM', name: 'Zinc', group: 'Industrial metals', unit: '$/tonne' },
  { id: 'PLEADUSDM', name: 'Lead', group: 'Industrial metals', unit: '$/tonne' },
  { id: 'PTINUSDM', name: 'Tin', group: 'Industrial metals', unit: '$/tonne' },
  { id: 'PIORECRUSDM', name: 'Iron ore', group: 'Industrial metals', unit: '$/tonne' },
  // Energy raw materials.
  { id: 'PURANUSDM', name: 'Uranium', group: 'Energy minerals', unit: '$/lb' },
  { id: 'PCOALAUUSDM', name: 'Coal (Australian)', group: 'Energy minerals', unit: '$/tonne' },
  { id: 'PNGASEUUSDM', name: 'Natural gas (Europe)', group: 'Energy minerals', unit: '$/MMBtu' },
  // Food. Included deliberately: the price of wheat is a security signal, and
  // separating "resources" from "the things people eat" is an artificial line.
  { id: 'PWHEAMTUSDM', name: 'Wheat', group: 'Agricultural', unit: '$/tonne' },
  { id: 'PMAIZMTUSDM', name: 'Maize', group: 'Agricultural', unit: '$/tonne' },
  { id: 'PSOYBUSDM', name: 'Soybeans', group: 'Agricultural', unit: '$/tonne' },
  { id: 'PSUGAISAUSDM', name: 'Sugar', group: 'Agricultural', unit: '¢/lb' },
  { id: 'PCOFFOTMUSDM', name: 'Coffee', group: 'Agricultural', unit: '¢/lb' },
  // The aggregate indices, so a reader can see whether one move is the whole
  // complex or just one metal.
  { id: 'PMETAINDEXM', name: 'All metals index', group: 'Indices (2016 = 100)', unit: 'index' },
  { id: 'PNRGINDEXM', name: 'All energy index', group: 'Indices (2016 = 100)', unit: 'index' },
  { id: 'PALLFNFINDEXM', name: 'All commodities index', group: 'Indices (2016 = 100)', unit: 'index' },
]

/** Two observations, so a move is arithmetic over the publisher's own numbers. */
function lastTwo(csv: string): Array<{ date: string; value: number }> {
  const rows: Array<{ date: string; value: number }> = []
  for (const line of csv.trim().split(/\r?\n/).slice(1)) {
    const [date, raw] = line.split(',')
    if (!date || !raw || raw.trim() === '.') continue
    const value = Number(raw)
    if (Number.isFinite(value)) rows.push({ date: date.trim(), value })
  }
  return rows.slice(-2)
}

export const resourcesSource: Source = {
  key: 'imf_commodities',
  capability: 'resources',
  passive: true,
  hosts: ['fred.stlouisfed.org'],
  // Eighteen series, one request each. At the interval slower providers use,
  // this source would blow the orchestrator's deadline and lose the gateway
  // entirely — which has happened before on this exact provider.
  minIntervalMs: 200,
  async run(_input, ctx) {
    const out: Evidence[] = []
    let refused = 0
    for (const s of COMMODITIES) {
      const res = await boardTry(
        ctx,
        `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(s.id)}`,
      )
      if (!res.ok) {
        refused++
        continue
      }
      const rows = lastTwo(await res.text().catch(() => ''))
      const latest = rows[rows.length - 1]
      if (!latest) continue
      const previous = rows.length > 1 ? rows[0] : null
      const change =
        previous && previous.value !== 0 ? ((latest.value - previous.value) / previous.value) * 100 : null

      out.push(
        boardEvidence(
          'imf_commodities',
          {
            group: s.group,
            headline: s.name,
            // The month is in the detail, always. A monthly average shown
            // without its month is read as today's price.
            detail: `${latest.value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${s.unit} · ${
              latest.date
            }${change === null ? '' : ` · ${change >= 0 ? '+' : ''}${change.toFixed(2)}% on the month`}`,
            value: latest.value,
            unit: s.unit,
            at: publicationTime(latest.date),
            url: `https://fred.stlouisfed.org/series/${s.id}`,
          },
          { source: 'A', info: 1 },
        ),
      )
    }
    /**
     * A skip is right; a sweep of silent skips is not. One item being
     * unreachable must not cost the others, but every one refusing and then
     * returning an empty list reports the source as healthy with nothing to
     * say — the fault that read as "13 sources OK, 0 failed, 0 movers".
     */
    if (out.length === 0 && refused > 0) {
      throw new SourceUnavailableError('imf_commodities', null, `all ${refused} requests refused`)
    }
    return out
  },
}

// ═══ Power grid ═════════════════════════════════════════════════════════════

interface ElexonPeriod {
  startTime?: string
  settlementPeriod?: number
  data?: Array<{ fuelType?: string; generation?: number }>
}

/** What a fuel code means. Elexon publishes codes; a reader needs names. */
const FUEL_NAMES: Record<string, string> = {
  BIOMASS: 'Biomass',
  CCGT: 'Gas (combined cycle)',
  COAL: 'Coal',
  NPSHYD: 'Hydro (run-of-river)',
  NUCLEAR: 'Nuclear',
  OCGT: 'Gas (open cycle)',
  OIL: 'Oil',
  OTHER: 'Other',
  PS: 'Pumped storage',
  WIND: 'Wind',
  INTFR: 'Interconnector — France',
  INTIRL: 'Interconnector — Ireland',
  INTNED: 'Interconnector — Netherlands',
  INTEW: 'Interconnector — East–West',
  INTNEM: 'Interconnector — Nemo (Belgium)',
  INTELEC: 'Interconnector — ElecLink',
  INTIFA2: 'Interconnector — IFA2',
  INTNSL: 'Interconnector — North Sea Link',
  INTVKL: 'Interconnector — Viking',
  INTGRNL: 'Interconnector — Greenlink',
}

/**
 * A national grid, metered, half-hourly.
 *
 * Elexon runs the settlement system for Great Britain's electricity market, so
 * this is not an estimate of what the grid is doing — it is the metered figure
 * the market is actually paid on. Very few countries publish this openly and
 * without a key; Britain is one, and it is a genuinely rare window into how an
 * industrial economy is powered from hour to hour.
 */
export const powerGridSource: Source = {
  key: 'elexon_grid',
  capability: 'power_grid',
  passive: true,
  hosts: ['data.elexon.co.uk'],
  minIntervalMs: 2000,
  async run(_input, ctx) {
    const res = await boardFetch(
      ctx,
      'elexon_grid',
      'https://data.elexon.co.uk/bmrs/api/v1/generation/outturn/summary?format=json',
    )
    const body = (await res.json().catch(() => null)) as ElexonPeriod[] | { data?: ElexonPeriod[] } | null
    const periods = Array.isArray(body) ? body : body?.data
    if (!Array.isArray(periods) || periods.length === 0) return []

    // The newest settlement period. Earlier ones are history, and a board that
    // showed all 47 of them would be a spreadsheet, not a picture.
    const latest = periods[periods.length - 1]
    const rows = (latest.data ?? []).filter((d) => d.fuelType && typeof d.generation === 'number')
    const total = rows.reduce((n, d) => n + (d.generation ?? 0), 0)
    if (total <= 0) return []

    return rows
      // Zero-output plant is a true fact and a useless row: on a summer night
      // half the fuel types read zero and would bury the ones carrying the grid.
      .filter((d) => (d.generation ?? 0) > 0)
      .map((d) => {
        const mw = d.generation ?? 0
        const share = (mw / total) * 100
        const code = d.fuelType ?? ''
        return boardEvidence(
          'elexon_grid',
          {
            group: code.startsWith('INT') ? 'Imported over interconnectors' : 'Generated in Britain',
            headline: FUEL_NAMES[code] ?? code,
            detail: `${mw.toLocaleString('en-US')} MW · ${share.toFixed(1)}% of the grid · settlement period ${
              latest.settlementPeriod ?? '—'
            }`,
            value: mw,
            unit: 'MW',
            at: publicationTime(latest.startTime),
            url: 'https://bmrs.elexon.co.uk/generation-by-fuel-type',
            weight: mw,
          },
          { source: 'A', info: 1 },
        )
      })
  },
}

// ═══ Space weather ══════════════════════════════════════════════════════════

interface SwpcScale {
  Scale?: string
  Text?: string
}
interface SwpcNow {
  DateStamp?: string
  TimeStamp?: string
  R?: SwpcScale
  S?: SwpcScale
  G?: SwpcScale
}

const SCALE_MEANING: Record<string, string> = {
  R: 'Radio blackouts — HF communication and navigation',
  S: 'Solar radiation storms — satellites, aviation over the poles, astronauts',
  G: 'Geomagnetic storms — power grids, pipelines, satellite orbits',
}

/**
 * NOAA's Space Weather Prediction Center is the agency that issues the actual
 * alerts airlines and grid operators act on. Included because it is a real
 * hazard class the platform had no coverage of at all, and because it is one of
 * the few genuinely global measurements — the same storm hits everybody.
 */
export const spaceWeatherSource: Source = {
  key: 'noaa_swpc',
  capability: 'space_weather',
  passive: true,
  hosts: ['services.swpc.noaa.gov'],
  minIntervalMs: 1500,
  async run(_input, ctx) {
    const out: Evidence[] = []

    const scalesRes = await boardTry(ctx, 'https://services.swpc.noaa.gov/products/noaa-scales.json')
    if (scalesRes.ok) {
      const body = (await scalesRes.json().catch(() => null)) as Record<string, SwpcNow> | null
      const now = body?.['0']
      if (now) {
        const at = publicationTime(`${now.DateStamp}T${now.TimeStamp}Z`)
        for (const key of ['R', 'S', 'G'] as const) {
          const scale = now[key]
          if (!scale) continue
          out.push(
            boardEvidence(
              'noaa_swpc',
              {
                group: 'Current conditions',
                headline: `${key}${scale.Scale ?? '0'} — ${scale.Text ?? 'none'}`,
                detail: SCALE_MEANING[key],
                value: Number(scale.Scale ?? 0),
                unit: 'NOAA scale',
                at,
                url: 'https://www.swpc.noaa.gov/noaa-scales-explanation',
                // A storm in progress sorts above a quiet band.
                weight: Number(scale.Scale ?? 0),
              },
              { source: 'A', info: 1 },
            ),
          )
        }
      }
    }

    /**
     * The planetary K index, as a short history rather than a single number.
     * One K value says nothing; the shape of the last few days is the signal an
     * operator reads, and it is the difference between "quiet" and "quiet after
     * a storm that may not be over".
     */
    const kpRes = await boardTry(
      ctx,
      'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
    )
    if (kpRes.ok) {
      const rows = (await kpRes.json().catch(() => null)) as Array<Record<string, unknown>> | null
      if (Array.isArray(rows)) {
        for (const row of rows.slice(-8).reverse()) {
          const kp = Number(row.Kp)
          const time = typeof row.time_tag === 'string' ? row.time_tag : null
          if (!Number.isFinite(kp) || !time) continue
          out.push(
            boardEvidence(
              'noaa_swpc',
              {
                group: 'Planetary K index',
                headline: `Kp ${kp.toFixed(2)}`,
                detail: `${time.slice(0, 16).replace('T', ' ')} UTC${kp >= 5 ? ' — storm level' : ''}`,
                value: kp,
                unit: 'Kp',
                // A bare date with no zone is read as local by `Date.parse`,
                // which would shift every reading by the host's offset.
                at: publicationTime(`${time}Z`),
                url: 'https://www.swpc.noaa.gov/products/planetary-k-index',
              },
              { source: 'A', info: 1 },
            ),
          )
        }
      }
    }

    return out
  },
}

// ═══ Orbital objects ════════════════════════════════════════════════════════

interface GpElement {
  OBJECT_NAME?: string
  OBJECT_ID?: string
  EPOCH?: string
  MEAN_MOTION?: number
  INCLINATION?: number
  ECCENTRICITY?: number
  NORAD_CAT_ID?: number
}

/**
 * What is overhead, from the element sets the tracking network publishes.
 *
 * CelesTrak republishes the general perturbations data for tracked objects.
 * Orbital period is derived from mean motion — revolutions per day — which is
 * arithmetic on the published number rather than an estimate, and it is the one
 * figure that makes an element set legible to somebody who is not an orbital
 * analyst.
 */
export const orbitalSource: Source = {
  key: 'celestrak',
  capability: 'orbital',
  passive: true,
  hosts: ['celestrak.org'],
  minIntervalMs: 2000,
  async run(input, ctx) {
    /**
     * Two groups, not the whole catalogue. `active` alone is 11,000 objects —
     * megabytes of element sets nobody scrolls. Crewed stations and the newest
     * launches are the two a reader actually asks about.
     */
    const groups: Array<{ key: string; label: string }> = [
      { key: 'stations', label: 'Crewed & space stations' },
      { key: 'last-30-days', label: 'Launched in the last 30 days' },
    ]
    const query = input.value.trim().toLowerCase()
    const out: Evidence[] = []

    let refused = 0
    for (const group of groups) {
      const res = await boardTry(
        ctx,
        `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group.key}&FORMAT=json`,
      )
      if (!res.ok) {
        refused++
        continue
      }
      const rows = (await res.json().catch(() => null)) as GpElement[] | null
      if (!Array.isArray(rows)) continue

      const matched = query
        ? rows.filter((r) => `${r.OBJECT_NAME ?? ''} ${r.OBJECT_ID ?? ''}`.toLowerCase().includes(query))
        : rows

      for (const r of matched.slice(0, 20)) {
        const motion = typeof r.MEAN_MOTION === 'number' ? r.MEAN_MOTION : null
        // Revolutions per day → minutes per revolution.
        const minutes = motion && motion > 0 ? 1440 / motion : null
        out.push(
          boardEvidence(
            'celestrak',
            {
              group: group.label,
              headline: r.OBJECT_NAME ?? `NORAD ${r.NORAD_CAT_ID ?? '?'}`,
              detail: [
                r.OBJECT_ID ? `int'l id ${r.OBJECT_ID}` : null,
                minutes ? `orbit ${minutes.toFixed(1)} min` : null,
                typeof r.INCLINATION === 'number' ? `inclination ${r.INCLINATION.toFixed(2)}°` : null,
              ]
                .filter(Boolean)
                .join(' · '),
              value: minutes ?? undefined,
              unit: minutes ? 'minutes per orbit' : undefined,
              at: publicationTime(r.EPOCH ? `${r.EPOCH}Z` : null),
              url: r.NORAD_CAT_ID
                ? `https://celestrak.org/satcat/table-satcat.php?CATNR=${r.NORAD_CAT_ID}`
                : 'https://celestrak.org/',
            },
            { source: 'A', info: 2 },
          ),
        )
      }
    }
    /**
     * A skip is right; a sweep of silent skips is not. One item being
     * unreachable must not cost the others, but every one refusing and then
     * returning an empty list reports the source as healthy with nothing to
     * say — the fault that read as "13 sources OK, 0 failed, 0 movers".
     */
    if (out.length === 0 && refused > 0) {
      throw new SourceUnavailableError('celestrak', null, `all ${refused} requests refused`)
    }
    return out
  },
}

// ═══ Statements that carry weight ═══════════════════════════════════════════

interface StatementFeed {
  key: string
  label: string
  url: string
  host: string
}

/**
 * The institutions whose words are themselves acts.
 *
 * A sanctions designation, a rate decision, a Security Council resolution — the
 * statement *is* the event. Reading a newspaper's account of one is reading a
 * summary; reading the press office is reading the thing. Every feed here was
 * fetched and parsed before being listed, and the ones that answered 403 or 404
 * were dropped rather than left in hopefully.
 */
const STATEMENT_FEEDS: StatementFeed[] = [
  { key: 'whitehouse', label: 'The White House', url: 'https://www.whitehouse.gov/news/feed/', host: 'www.whitehouse.gov' },
  { key: 'un_press', label: 'United Nations — press', url: 'https://press.un.org/en/rss.xml', host: 'press.un.org' },
  { key: 'un_news', label: 'United Nations — news', url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', host: 'news.un.org' },
  { key: 'ec_press', label: 'European Commission', url: 'https://ec.europa.eu/commission/presscorner/api/rss?language=en&pagesize=20', host: 'ec.europa.eu' },
  { key: 'ecb_press', label: 'European Central Bank', url: 'https://www.ecb.europa.eu/rss/press.html', host: 'www.ecb.europa.eu' },
  { key: 'fed_press', label: 'US Federal Reserve', url: 'https://www.federalreserve.gov/feeds/press_all.xml', host: 'www.federalreserve.gov' },
  { key: 'ukgov', label: 'UK government', url: 'https://www.gov.uk/search/news-and-communications.atom', host: 'www.gov.uk' },
  { key: 'iaea', label: 'IAEA', url: 'https://www.iaea.org/feeds/topnews', host: 'www.iaea.org' },
  { key: 'who_news', label: 'World Health Organization', url: 'https://www.who.int/rss-feeds/news-english.xml', host: 'www.who.int' },
]

/**
 * The statements board.
 *
 * Ranked by `assessImpact`, which scores four things a document *is* — who
 * issued it, what instrument it is, how many independent institutions are
 * addressing the same subject, and how old it is — and then says which factors
 * fired and what each contributed. The score orders the list; the reasons are
 * the product. An impact number nobody can check is a claim with the reasoning
 * removed.
 */
export const statementsSource: Source = {
  key: 'official_statements',
  capability: 'statements',
  passive: true,
  hosts: STATEMENT_FEEDS.map((f) => f.host),
  // Nine feeds, one request each, inside the orchestrator's deadline.
  minIntervalMs: 250,
  async run(input, ctx) {
    const query = input.value.trim().toLowerCase()

    interface Raw {
      sourceKey: string
      label: string
      headline: string
      detail: string
      at: string | null
      url?: string
    }
    const raw: Raw[] = []

    let refused = 0
    for (const feed of STATEMENT_FEEDS) {
      const res = await boardTry(ctx, feed.url)
      // One press office being unreachable must not cost the other eight —
      // but all of them refusing is the provider side going dark, not silence.
      if (!res.ok) {
        refused++
        continue
      }
      const entries = parseFeed(await res.text().catch(() => ''))
      for (const e of entries.slice(0, 15)) {
        raw.push({
          sourceKey: feed.key,
          label: feed.label,
          headline: e.title,
          detail: e.summary?.slice(0, 220) ?? '',
          at: e.published ?? null,
          url: e.link,
        })
      }
    }
    if (raw.length === 0) {
      /**
       * A skip is right; a silent sweep of skips is not.
       *
       * One item being unreachable must not cost the others. But if *every*
       * one refuses, returning an empty list reports the source as healthy with
       * nothing to say — the same fault one level up, and the one that showed
       * as "13 sources OK, 0 failed, 0 movers" on the deployed board.
       */
      if (refused === STATEMENT_FEEDS.length) {
        throw new SourceUnavailableError('statements', null, `all ${refused} feeds refused`)
      }
      return []
    }

    // Corroboration is computed across the whole sweep, not per feed: the
    // question is whether *other* institutions are addressing the same subject,
    // which cannot be answered inside one of them.
    const corroboration = corroborationBySubject(raw)

    const filtered = query
      ? raw.filter((r) => `${r.headline} ${r.detail}`.toLowerCase().includes(query))
      : raw

    return filtered.map((r) => {
      const impact = assessImpact({
        sourceKey: r.sourceKey,
        headline: r.headline,
        detail: r.detail,
        at: r.at,
        corroboratingBodies: corroboration.get(r.headline) ?? 1,
      })
      return boardEvidence(
        'official_statements',
        {
          group: r.label,
          headline: r.headline,
          // The analysis travels with the row, in words: the summary first, then
          // the factors that produced it, each with its own contribution.
          detail: `${impact.summary} · ${impact.factors
            .map((f) => `${f.label} ${f.weight >= 0 ? '+' : ''}${f.weight}`)
            .join(' · ')}`,
          value: impact.score,
          unit: 'impact',
          at: r.at,
          url: r.url,
          // Most consequential first, which is what a board of statements is
          // for. Chronological would put a workshop announcement above a
          // sanctions package for the sake of four minutes.
          weight: impact.score,
        },
        // A press office publishing its own institution's words: the source is
        // reliable and the information is first-hand.
        { source: 'A', info: 1 },
      )
    })
  },
}

export const BOARD_SOURCES: Source[] = [
  statementsSource,
  courtsSource,
  regulationSource,
  officialsSource,
  resourcesSource,
  powerGridSource,
  spaceWeatherSource,
  orbitalSource,
]
