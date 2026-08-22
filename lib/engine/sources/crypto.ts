/**
 * The crypto & blockchain gateway — every listed asset, its whole record, and
 * what is being said about it.
 *
 * ## What was already here, and what was missing
 *
 * The platform could read four chains from their own nodes (`chains-multi.ts`),
 * Bitcoin's mempool (`chain.ts`), and the **top ten** coins by market
 * capitalisation (`markets-board.ts`). Set against the request — *every digital
 * currency and blockchain, with all its information and its most important
 * news* — three things were absent, and each was absent completely rather than
 * partially:
 *
 *  1. **The other 18,600 assets.** Ten of eighteen thousand is not coverage of
 *     a market, it is a leaderboard. Anyone asking about the asset they
 *     actually hold got nothing.
 *  2. **The record itself.** Price and 24-hour change are two facts about an
 *     asset. Supply against its cap, the distance from its all-time high, which
 *     chains it actually runs on, what it is classified as, when it launched —
 *     none of it existed anywhere in the product.
 *  3. **Every word ever written about any of it.** There was no crypto news at
 *     all. Not a thin feed: none.
 *
 * ## Counting honestly (§2a)
 *
 * This gateway is **two integrations**: CoinGecko's asset API, and the feed
 * list in `lib/engine/catalog/feeds/crypto.ts`. Through the first, **18,610
 * assets** are reachable — that is *reach*, in §2a's middle column, and it is
 * never to be quoted as a source count. Through the second, seven publishers,
 * of which four are the networks publishing about themselves.
 *
 * Independent origins is the smallest number and the only one that belongs in a
 * confidence score: CoinGecko is a single aggregator, so every price row here
 * is **one** origin no matter how many assets it covers. That is why a price is
 * graded B and a chain reading from the network's own node is graded A.
 *
 * ## §3, on a subject where it is easy to drift
 *
 * Everything here is read from documented public APIs and syndication feeds. No
 * wallet is profiled, no address is attributed to a person, and no holder is
 * identified — the charter forbids targeting private individuals, and "the
 * blockchain is public" is precisely the *availability is not permission*
 * argument §3 exists to refuse.
 */
import type { Evidence, Source, SourceContext, SourceInput } from '../types'
import { parseFeed } from '../feedxml'
import { byTopic } from '../catalog'
import type { CatalogSource } from '../catalog/types'
import { expectJson, SourceUnavailableError } from '../fetch-guard'
import { publicationTime } from '../observed'

// ── Shared shapes ────────────────────────────────────────────────────────────

interface CryptoPoint {
  group: string
  headline: string
  detail?: string
  value?: number
  unit?: string
  at?: string | null
  url?: string
  /** Higher sorts first inside its group. */
  weight?: number
  /**
   * Higher sorts the whole group nearer the top of the board.
   *
   * Without it the board orders groups by how many rows they hold, and that is
   * wrong here in a way a reader feels immediately: a search for one asset
   * returns seven rows about that asset and seventy headlines about crypto in
   * general, so the thing that was asked for lands seventh. Size is not
   * importance.
   */
  groupWeight?: number
}

/**
 * Where each kind of box sits on the board.
 *
 * The order is the order the question is answered in: what you asked for, then
 * what else it might have been, then what is being said — announcements from
 * the networks before reports about them.
 */
const GROUP_ORDER = {
  assetPrice: 100,
  assetSupply: 95,
  assetRecord: 90,
  assetIdentity: 85,
  assetLinks: 80,
  leaderboard: 100,
  alternatives: 50,
  subjectNews: 45,
  primaryNews: 30,
  pressNews: 20,
} as const

function point(
  sourceKey: string,
  p: CryptoPoint,
  admiralty: { source: 'A' | 'B'; info: 1 | 2 | 3 },
  confidence: 'confirmed' | 'probable' = 'probable',
): Evidence {
  return {
    claim: p.detail ? `${p.headline} — ${p.detail}` : p.headline,
    entity: { type: 'other', value: p.group },
    sourceKey,
    sourceUrl: p.url,
    retrievedAt: new Date().toISOString(),
    publishedAt: p.at ?? null,
    admiralty,
    confidence,
    data: { ...p },
  }
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

/** Money, at the precision the magnitude deserves rather than a fixed one. */
export function usd(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (abs >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  // Sub-dollar tokens are the majority of the list, and rounding one to two
  // decimals prints `$0.00` for an asset that has a real price.
  if (abs > 0) return `$${value.toPrecision(4)}`
  return '$0'
}

/** A count of coins — never money, so never a dollar sign. */
export function units(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function signed(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

// ── Choosing which of 18,610 assets the reader meant ─────────────────────────

export interface CoinCandidate {
  id: string
  symbol: string
  name: string
  marketCapRank?: number | null
}

/**
 * How well a candidate answers what was typed.
 *
 * CoinGecko's search returns results ordered by market capitalisation, not by
 * how well they match. Typing `pi` returns a euro money-market fund first,
 * because that fund is larger than Pi Network — which is a perfectly sensible
 * ordering of *coins* and a useless answer to a *question*.
 *
 * This is the same failure the exchange register had, where searching a venue
 * returned the largest desk that happened to contain the letters rather than
 * the exchange itself. The fix is the same and belongs in our code, not in the
 * provider's: rank the **kind** of match first, and only use size to break ties
 * between matches of equal kind.
 *
 * Deliberately, an exact symbol beats an exact name. Someone typing `ETH` means
 * the ticker; someone typing `Ethereum` means the name; and both land on the
 * same asset. Where they diverge — a token whose *name* is another token's
 * *symbol* — the ticker is the more specific statement of intent.
 */
export function coinRelevance(candidate: CoinCandidate, query: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  const symbol = candidate.symbol.toLowerCase()
  const name = candidate.name.toLowerCase()
  const id = candidate.id.toLowerCase()

  if (symbol === q) return 100
  if (name === q || id === q) return 90
  // `pi network` typed against the id `pi-network`.
  if (id.replace(/-/g, ' ') === q) return 90
  if (name.startsWith(`${q} `) || name.startsWith(`${q}-`)) return 70
  if (name.startsWith(q)) return 60
  if (symbol.startsWith(q)) return 50
  // A whole word inside the name — "network" in "Pi Network" — beats a match
  // that only happens to fall inside a longer word.
  if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(name)) return 40
  if (name.includes(q)) return 20
  return 0
}

/**
 * Rank matches, then let market capitalisation break ties.
 *
 * An unranked asset — CoinGecko leaves `market_cap_rank` null for assets it has
 * not ranked — sorts after every ranked one of the same match quality, rather
 * than being treated as rank zero and jumping to the front.
 */
export function rankCandidates(candidates: CoinCandidate[], query: string): CoinCandidate[] {
  return candidates
    .map((c) => ({ c, score: coinRelevance(c, query) }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.c.marketCapRank ?? Number.MAX_SAFE_INTEGER) - (b.c.marketCapRank ?? Number.MAX_SAFE_INTEGER),
    )
    .map((x) => x.c)
}

// ── CoinGecko shapes ─────────────────────────────────────────────────────────

interface CgSearchCoin {
  id?: string
  symbol?: string
  name?: string
  market_cap_rank?: number | null
}

interface CgMarketRow {
  id?: string
  symbol?: string
  name?: string
  current_price?: number
  market_cap?: number
  market_cap_rank?: number | null
  total_volume?: number
  circulating_supply?: number
  price_change_percentage_24h?: number
  price_change_percentage_7d_in_currency?: number
  last_updated?: string
}

interface CgCoin {
  id?: string
  symbol?: string
  name?: string
  market_cap_rank?: number | null
  genesis_date?: string | null
  hashing_algorithm?: string | null
  block_time_in_minutes?: number | null
  categories?: Array<string | null>
  asset_platform_id?: string | null
  platforms?: Record<string, string | null>
  last_updated?: string
  links?: {
    homepage?: string[]
    blockchain_site?: string[]
    repos_url?: { github?: string[] }
    whitepaper?: string
  }
  market_data?: {
    current_price?: Record<string, number>
    market_cap?: Record<string, number>
    fully_diluted_valuation?: Record<string, number>
    total_volume?: Record<string, number>
    circulating_supply?: number | null
    total_supply?: number | null
    max_supply?: number | null
    price_change_percentage_24h?: number | null
    price_change_percentage_7d?: number | null
    price_change_percentage_30d?: number | null
    price_change_percentage_1y?: number | null
    ath?: Record<string, number>
    ath_date?: Record<string, string>
    ath_change_percentage?: Record<string, number>
    atl?: Record<string, number>
    atl_date?: Record<string, string>
  }
}

const COINGECKO = 'https://api.coingecko.com/api/v3'

/** The public coin page, which is where a reader should be able to check us. */
function coinUrl(id: string): string {
  return `https://www.coingecko.com/en/coins/${id}`
}

// ── The asset record ─────────────────────────────────────────────────────────

/**
 * Rows describing one asset in full.
 *
 * Split into groups a reader reasons in rather than the order the API returns
 * them: what it costs, how much of it exists, what it has done, and what it
 * actually is. `weight` fixes the order inside each group, because these are
 * not news and sorting them by timestamp — the board's default — would shuffle
 * a supply table into meaninglessness.
 */
function assetRows(coin: CgCoin): CryptoPoint[] {
  const name = coin.name ?? coin.id ?? 'Asset'
  const symbol = (coin.symbol ?? '').toUpperCase()
  const label = symbol ? `${name} (${symbol})` : name
  const url = coin.id ? coinUrl(coin.id) : undefined
  const at = coin.last_updated ? publicationTime(coin.last_updated) : null
  const m = coin.market_data ?? {}
  const rows: CryptoPoint[] = []

  const g1 = `${label} — price & market`
  const w1 = GROUP_ORDER.assetPrice
  const price = num(m.current_price?.usd)
  if (price !== null) {
    const d24 = num(m.price_change_percentage_24h)
    rows.push({
      group: g1,
      groupWeight: w1,
      headline: 'Price',
      detail: d24 === null ? usd(price) : `${usd(price)} · ${signed(d24)} in 24h`,
      value: price,
      unit: 'USD',
      at,
      url,
      weight: 100,
    })
  }
  const cap = num(m.market_cap?.usd)
  if (cap !== null) {
    rows.push({
      group: g1,
      groupWeight: w1,
      headline: 'Market capitalisation',
      detail:
        coin.market_cap_rank != null ? `${usd(cap)} · ranked #${coin.market_cap_rank}` : usd(cap),
      value: cap,
      unit: 'USD',
      at,
      url,
      weight: 90,
    })
  }
  const fdv = num(m.fully_diluted_valuation?.usd)
  if (fdv !== null) {
    rows.push({
      group: g1,
      groupWeight: w1,
      headline: 'Fully diluted valuation',
      // What the asset would be worth if every coin that can exist did. The gap
      // against market capitalisation is the dilution still to come, and it is
      // the number a token's own marketing never leads with.
      detail: cap !== null && cap > 0 ? `${usd(fdv)} · ${(fdv / cap).toFixed(2)}× the market cap` : usd(fdv),
      value: fdv,
      unit: 'USD',
      at,
      url,
      weight: 80,
    })
  }
  const vol = num(m.total_volume?.usd)
  if (vol !== null) {
    rows.push({
      group: g1,
      groupWeight: w1,
      headline: 'Traded in 24 hours',
      detail: cap !== null && cap > 0 ? `${usd(vol)} · ${((vol / cap) * 100).toFixed(1)}% of market cap` : usd(vol),
      value: vol,
      unit: 'USD',
      at,
      url,
      weight: 70,
    })
  }
  for (const [headline, pct, weight] of [
    ['Change over 7 days', num(m.price_change_percentage_7d), 60],
    ['Change over 30 days', num(m.price_change_percentage_30d), 50],
    ['Change over a year', num(m.price_change_percentage_1y), 40],
  ] as const) {
    if (pct !== null) {
      rows.push({ group: g1,
      groupWeight: w1, headline, detail: signed(pct), value: pct, unit: '%', at, url, weight })
    }
  }

  const g2 = `${label} — supply`
  const w2 = GROUP_ORDER.assetSupply
  const circ = num(m.circulating_supply)
  const total = num(m.total_supply)
  const max = num(m.max_supply)
  if (circ !== null) {
    rows.push({
      group: g2,
      groupWeight: w2,
      headline: 'In circulation',
      detail:
        max !== null && max > 0
          ? `${units(circ)} ${symbol || 'coins'} · ${((circ / max) * 100).toFixed(1)}% of the maximum`
          : `${units(circ)} ${symbol || 'coins'}`,
      value: circ,
      unit: symbol || 'coins',
      at,
      url,
      weight: 100,
    })
  }
  if (total !== null) {
    rows.push({
      group: g2,
      groupWeight: w2,
      headline: 'Issued so far',
      detail: `${units(total)} ${symbol || 'coins'}`,
      value: total,
      unit: symbol || 'coins',
      at,
      url,
      weight: 90,
    })
  }
  rows.push(
    max !== null
      ? {
          group: g2,
      groupWeight: w2,
          headline: 'Maximum that can exist',
          detail: `${units(max)} ${symbol || 'coins'}`,
          value: max,
          unit: symbol || 'coins',
          at,
          url,
          weight: 80,
        }
      : {
          group: g2,
      groupWeight: w2,
          headline: 'Maximum that can exist',
          // An uncapped supply is a fact about the asset, not missing data, and
          // leaving the row out would let a reader assume a cap exists.
          detail: 'No cap published — this asset can be issued without a stated limit',
          at,
          url,
          weight: 80,
        },
  )

  const g3 = `${label} — record`
  const w3 = GROUP_ORDER.assetRecord
  const ath = num(m.ath?.usd)
  if (ath !== null) {
    const from = num(m.ath_change_percentage?.usd)
    const when = m.ath_date?.usd ? publicationTime(m.ath_date.usd) : null
    rows.push({
      group: g3,
      groupWeight: w3,
      headline: 'All-time high',
      detail: [usd(ath), when ? when.slice(0, 10) : null, from === null ? null : `now ${signed(from)} from it`]
        .filter(Boolean)
        .join(' · '),
      value: ath,
      unit: 'USD',
      at: when,
      url,
      weight: 100,
    })
  }
  const atl = num(m.atl?.usd)
  if (atl !== null) {
    const when = m.atl_date?.usd ? publicationTime(m.atl_date.usd) : null
    rows.push({
      group: g3,
      groupWeight: w3,
      headline: 'All-time low',
      detail: [usd(atl), when ? when.slice(0, 10) : null].filter(Boolean).join(' · '),
      value: atl,
      unit: 'USD',
      at: when,
      url,
      weight: 90,
    })
  }

  const g4 = `${label} — what it is`
  const w4 = GROUP_ORDER.assetIdentity
  if (coin.genesis_date) {
    rows.push({ group: g4,
      groupWeight: w4, headline: 'Launched', detail: coin.genesis_date, at, url, weight: 100 })
  }
  if (coin.hashing_algorithm) {
    rows.push({
      group: g4,
      groupWeight: w4,
      headline: 'Consensus algorithm',
      detail: coin.hashing_algorithm,
      at,
      url,
      weight: 90,
    })
  }
  const blockTime = num(coin.block_time_in_minutes)
  if (blockTime !== null && blockTime > 0) {
    rows.push({
      group: g4,
      groupWeight: w4,
      headline: 'Block time',
      detail: blockTime < 1 ? `${Math.round(blockTime * 60)} seconds` : `${blockTime} minutes`,
      value: blockTime,
      unit: 'minutes',
      at,
      url,
      weight: 80,
    })
  }
  /**
   * Which chains it actually runs on.
   *
   * This is the row that separates a coin from a token, and a reader who does
   * not know the difference is exactly the reader who needs to be told: a
   * native asset has its own chain, a token lives on someone else's and
   * inherits that chain's risks entirely. CoinGecko encodes it as `platforms`,
   * where a native asset carries the empty-string key.
   */
  const chains = Object.keys(coin.platforms ?? {}).filter((k) => k.trim().length > 0)
  if (chains.length > 0) {
    rows.push({
      group: g4,
      groupWeight: w4,
      headline: chains.length === 1 ? 'Runs on' : `Runs on ${chains.length} chains`,
      detail: chains.slice(0, 8).join(', ') + (chains.length > 8 ? `, and ${chains.length - 8} more` : ''),
      at,
      url,
      weight: 70,
    })
  } else {
    rows.push({
      group: g4,
      groupWeight: w4,
      headline: 'Runs on',
      detail: 'Its own chain — a native asset, not a token issued on another network',
      at,
      url,
      weight: 70,
    })
  }
  const categories = (coin.categories ?? []).filter((c): c is string => Boolean(c && c.trim()))
  if (categories.length > 0) {
    rows.push({
      group: g4,
      groupWeight: w4,
      headline: 'Classified as',
      detail: categories.slice(0, 8).join(' · '),
      at,
      url,
      weight: 60,
    })
  }

  const g5 = `${label} — check it yourself`
  const w5 = GROUP_ORDER.assetLinks
  const home = (coin.links?.homepage ?? []).filter((u) => u && u.trim())[0]
  if (home) rows.push({ group: g5,
      groupWeight: w5, headline: 'Official site', detail: home, at, url: home, weight: 100 })
  const explorer = (coin.links?.blockchain_site ?? []).filter((u) => u && u.trim())[0]
  if (explorer) {
    rows.push({ group: g5,
      groupWeight: w5, headline: 'Block explorer', detail: explorer, at, url: explorer, weight: 90 })
  }
  const repo = (coin.links?.repos_url?.github ?? []).filter((u) => u && u.trim())[0]
  if (repo) rows.push({ group: g5,
      groupWeight: w5, headline: 'Source code', detail: repo, at, url: repo, weight: 80 })
  if (coin.links?.whitepaper?.trim()) {
    rows.push({
      group: g5,
      groupWeight: w5,
      headline: 'Whitepaper',
      detail: coin.links.whitepaper,
      at,
      url: coin.links.whitepaper,
      weight: 70,
    })
  }

  return rows
}

/**
 * Any asset among the eighteen thousand, or the largest when nothing is asked.
 *
 * At most **two** requests per run, and that is a hard design constraint rather
 * than tidiness: CoinGecko's keyless tier allows a handful of calls a minute,
 * and a source that fans out across a coin list would be throttled into
 * returning nothing while still reporting itself healthy. That exact failure
 * has already cost this codebase a working source twice — the ECB yield curve
 * and the macro-economy indicators — so the budget is spent deliberately:
 * one search, one record.
 */
export const cryptoAssets: Source = {
  key: 'coingecko_asset',
  capability: 'crypto',
  passive: true,
  hosts: ['api.coingecko.com'],
  minIntervalMs: 2000,
  async run(input: SourceInput, ctx: SourceContext): Promise<Evidence[]> {
    const query = input.value.trim()

    if (!query) {
      /**
       * A failed request throws rather than returning nothing.
       *
       * `if (!res.ok) return []` is the shape that lets a rate-limited or
       * unreachable provider report itself as a healthy source with nothing to
       * say — and this provider throttles keyless callers, so it is not a
       * hypothetical. The board would then show "2 sources ok" while silently
       * missing half its answer, which is the failure `fetch-guard` exists to
       * make impossible.
       */
      const rows = await expectJson<CgMarketRow[] | null>(
        'coingecko_asset',
        await ctx.fetch(
          `${COINGECKO}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&page=1` +
            `&price_change_percentage=24h,7d`,
        ),
      )
      if (!Array.isArray(rows)) return []

      return rows.flatMap<Evidence>((r) => {
        const price = num(r.current_price)
        if (!r.id || !r.name || price === null) return []
        const d24 = num(r.price_change_percentage_24h)
        const d7 = num(r.price_change_percentage_7d_in_currency)
        const cap = num(r.market_cap)
        return [
          point(
            'coingecko_asset',
            {
              group: 'Largest by market capitalisation',
              groupWeight: GROUP_ORDER.leaderboard,
              headline: `#${r.market_cap_rank ?? '—'} ${r.name} (${(r.symbol ?? '').toUpperCase()})`,
              detail: [
                usd(price),
                d24 === null ? null : `${signed(d24)} 24h`,
                d7 === null ? null : `${signed(d7)} 7d`,
                cap === null ? null : `cap ${usd(cap)}`,
              ]
                .filter(Boolean)
                .join(' · '),
              value: cap ?? price,
              unit: 'USD',
              at: r.last_updated ? publicationTime(r.last_updated) : null,
              url: coinUrl(r.id),
              // Rank ascending, so the board's descending weight sort puts #1
              // first. Without this the list would come back in timestamp
              // order, which for a leaderboard is no order at all.
              weight: 1000 - (r.market_cap_rank ?? 999),
            },
            // An aggregator's reading of venue prices: reliable, and derived.
            { source: 'B', info: 2 },
          ),
        ]
      })
    }

    const search = await expectJson<{ coins?: CgSearchCoin[] } | null>(
      'coingecko_asset',
      await ctx.fetch(`${COINGECKO}/search?query=${encodeURIComponent(query)}`),
    )
    const candidates = (search?.coins ?? []).flatMap<CoinCandidate>((c) =>
      c.id && c.symbol && c.name
        ? [{ id: c.id, symbol: c.symbol, name: c.name, marketCapRank: c.market_cap_rank ?? null }]
        : [],
    )
    const best = rankCandidates(candidates, query)[0]
    if (!best) return []

    const coin = await expectJson<CgCoin | null>(
      'coingecko_asset',
      await ctx.fetch(
        `${COINGECKO}/coins/${encodeURIComponent(best.id)}` +
          `?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`,
      ),
    )
    if (!coin?.id) return []

    const rows = assetRows(coin).map((p) => point('coingecko_asset', p, { source: 'B', info: 2 }))

    /**
     * When the query matched something other than what was typed, say so.
     *
     * A reader who typed a ticker that does not exist and received a different
     * asset's full record, silently, has been misled by the interface rather
     * than by any single number in it.
     */
    const alternatives = rankCandidates(candidates, query).slice(1, 6)
    if (alternatives.length > 0) {
      rows.push(
        point(
          'coingecko_asset',
          {
            group: 'Other assets matching this search',
            groupWeight: GROUP_ORDER.alternatives,
            headline: `${alternatives.length} other match${alternatives.length === 1 ? '' : 'es'} for “${query}”`,
            detail: alternatives.map((c) => `${c.name} (${c.symbol.toUpperCase()})`).join(' · '),
            url: coinUrl(best.id),
          },
          { source: 'B', info: 3 },
        ),
      )
    }

    return rows
  },
}

// ── The news half ────────────────────────────────────────────────────────────

/**
 * Where a publisher sits, which decides which box its headlines land in.
 *
 * An announcement from the body that made the decision and an article about
 * that announcement are different evidence, and this is where that difference
 * becomes something the reader can see rather than something buried in an
 * Admiralty letter they never read.
 */
export function publisherTier(entry: CatalogSource): string {
  return entry.admiralty === 'A' || entry.admiralty === 'B'
    ? 'From the networks themselves'
    : 'Specialist press'
}

/**
 * The crypto feeds, read from the catalogue rather than re-listed here.
 *
 * One list, two consumers. The alternative — a URL list in this file and
 * catalogue records beside it — is two lists that agree today and disagree the
 * first time one of them is edited, which is how a source ends up quietly
 * disabled in one place and live in the other.
 */
export function cryptoFeeds(): CatalogSource[] {
  return byTopic('crypto')
}

const HOSTS = [...new Set(cryptoFeeds().map((f) => new URL(f.url).hostname.toLowerCase()))]

export const cryptoNews: Source = {
  key: 'crypto_news',
  capability: 'crypto',
  passive: true,
  hosts: HOSTS,
  // Deliberately low: this source fetches several feeds inside one run, and a
  // per-source interval is enforced against the *source*, not the feed. Set
  // high, it would refuse its own second fetch and silently return one
  // publisher's view of the world — the failure mode this codebase has now hit
  // three times.
  minIntervalMs: 200,
  async run(input: SourceInput, ctx: SourceContext): Promise<Evidence[]> {
    const query = input.value.trim().toLowerCase()
    const feeds = cryptoFeeds()

    const fetched = await Promise.allSettled(
      feeds.map(async (feed) => {
        const res = await ctx.fetch(feed.url, {
          headers: {
            'User-Agent': 'LambdaNX/1.0 (+https://github.com/algb20/Lambda-Nx1)',
            Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5',
          },
        })
        if (!res.ok) throw new Error(`${feed.key}: provider answered ${res.status}`)
        return { feed, entries: parseFeed(await res.text()) }
      }),
    )

    /**
     * One publisher failing is survivable; all of them failing is not "no news".
     *
     * Returning an empty list here would report a healthy source with nothing
     * to say, and a reader would take an empty box to mean the crypto world
     * was quiet. It never is.
     */
    if (feeds.length > 0 && fetched.every((r) => r.status === 'rejected')) {
      throw new SourceUnavailableError(
        'crypto_news',
        null,
        `all ${feeds.length} crypto publishers were unreachable`,
      )
    }

    const out: Evidence[] = []
    for (const result of fetched) {
      if (result.status !== 'fulfilled') continue
      const { feed, entries } = result.value
      // A cap per publisher, so one prolific outlet cannot crowd out the
      // networks' own announcements — which are rarer and matter more.
      for (const entry of entries.slice(0, 12)) {
        const text = `${entry.title} ${entry.summary ?? ''}`.toLowerCase()
        const matches = query.length > 0 && text.includes(query)
        out.push(
          point(
            feed.key,
            {
              // A subject match earns its own box at the top; everything else
              // sorts by whether it came from the network or from the press.
              group: matches ? `News mentioning “${input.value.trim()}”` : publisherTier(feed),
              groupWeight: matches
                ? GROUP_ORDER.subjectNews
                : feed.admiralty === 'A' || feed.admiralty === 'B'
                  ? GROUP_ORDER.primaryNews
                  : GROUP_ORDER.pressNews,
              headline: entry.title,
              detail: entry.summary
                ? `${feed.publisher} · ${entry.summary.slice(0, 220)}`
                : feed.publisher,
              at: entry.published ?? null,
              url: entry.link ?? feed.url,
            },
            {
              source: feed.admiralty === 'A' ? 'A' : 'B',
              // A primary announcement is graded 1; a report about one is 3.
              info: feed.admiralty === 'A' ? 1 : feed.admiralty === 'B' ? 2 : 3,
            },
            feed.admiralty === 'A' ? 'confirmed' : 'probable',
          ),
        )
      }
    }
    return out
  },
}

export const CRYPTO_GATEWAY_SOURCES: Source[] = [cryptoAssets, cryptoNews]
