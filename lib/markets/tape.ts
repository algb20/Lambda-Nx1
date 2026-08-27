/**
 * The live price tape — real trades as they print, not a poll.
 *
 * ## The latency this exists to remove
 *
 * Every price on this platform refreshed every **120 seconds**, and that number
 * is ours, not the market's. A trade prints, and for up to two minutes the
 * product shows the price before it. On a surface that calls itself live that
 * is not a small thing: it is the difference between watching a market and
 * reading a report about one.
 *
 * Measured against the real venue: a socket to Coinbase opened in **223ms** and
 * delivered six ticks in **1.1 seconds**. Kraken opened in 1.3s. That is the
 * gap this closes.
 *
 * ## Why the browser holds the socket
 *
 * A serverless function cannot. Netlify's ceiling for a held connection is
 * measured at about thirty seconds in this codebase (see `lib/stream/broadcast`),
 * and a tape that dies every half-minute is worse than a poll because it
 * reconnects, resubscribes and re-races. The reader's own browser has no such
 * limit, so the socket belongs there — and it costs our server nothing at all.
 *
 * This does not put a vendor SDK in the app. The provider sits behind
 * `TapeProvider`, which is ours, and the components know only about `Tick`.
 * Swapping venue is a new object in `TAPE_PROVIDERS`, not an edit anywhere else
 * (charter rule #4).
 *
 * ## Passive, public, and within the rules
 *
 * These are the venues' own public market-data feeds, documented for anonymous
 * use, requiring no key and carrying no account. Reading one is the same act as
 * reading their public REST quote, which this engine already does — no target
 * host is touched, nothing is authenticated, nothing is written. Charter §3
 * holds.
 *
 * **Binance is deliberately absent.** Its API answers **451 — legally
 * restricted** from this deployment's egress, and a source that returns 451 is
 * not a source we may quietly retry from somewhere else.
 *
 * ## What a tick actually is, and what it is not
 *
 * A tick is **the last trade on that one venue**. It is not a global price, not
 * a volume-weighted index, and not the price anyone else got. Every surface
 * drawing this must name the venue, because "BTC $80,228" and "BTC $80,228 on
 * Coinbase" are different claims and only the second one is true.
 */

/** One trade, as the venue printed it. */
export interface Tick {
  /** Our symbol, uppercase and venue-independent: BTC, ETH, SOL. */
  symbol: string
  /** Last traded price, in USD. */
  price: number
  /** When *we* received it. Never the venue's clock — see the note below. */
  receivedAt: number
  /**
   * When the venue says it happened, if it said. Null when it did not.
   *
   * Kept separate from `receivedAt` for the same reason `publishedAt` is kept
   * separate from `retrievedAt` everywhere else in this engine: one is a claim
   * by the source and the other is a fact about us, and collapsing them makes
   * a lagging feed indistinguishable from a fast one.
   */
  tradedAt: number | null
}

export type TapeState = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'failed'

export interface TapeHandlers {
  onTick: (tick: Tick) => void
  onState: (state: TapeState, detail?: string) => void
}

export interface TapeProvider {
  key: string
  /** The venue, named on screen. A price without its venue is not a price. */
  label: string
  /** WebSocket origin — also what the Content-Security-Policy must allow. */
  url: string
  /** Turn our symbol into the venue's pair notation. */
  pair(symbol: string): string
  /** The subscribe frame, as a string, for these symbols. */
  subscribe(symbols: string[]): string
  /** Read one message. Returns nothing for frames that are not ticks. */
  read(raw: string): Tick[]
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : Number.NaN
  return Number.isFinite(n) ? n : null
}

const time = (v: unknown): number | null => {
  if (typeof v !== 'string') return null
  const t = Date.parse(v)
  return Number.isFinite(t) ? t : null
}

/**
 * Parse one frame, or nothing.
 *
 * `JSON.parse('null')` returns `null`, not a throw — so a `try/catch` alone
 * leaves the readers dereferencing null. A test caught exactly that, and it is
 * not a hypothetical: a socket delivers whatever the far end sends, including
 * whatever a proxy or a captive portal injects, and one TypeError inside an
 * `onmessage` handler takes the tape down for the rest of the session.
 */
function frame(raw: string): Record<string, unknown> | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  return parsed as Record<string, unknown>
}

/**
 * Coinbase Exchange — the primary.
 *
 * First because it answered fastest (223ms against Kraken's 1.3s), its ticker
 * frame is flat, and its pair notation is a plain `BTC-USD` that needs no
 * lookup table.
 */
export const coinbaseTape: TapeProvider = {
  key: 'coinbase',
  label: 'Coinbase',
  url: 'wss://ws-feed.exchange.coinbase.com',
  pair: (symbol) => `${symbol}-USD`,
  subscribe: (symbols) =>
    JSON.stringify({
      type: 'subscribe',
      product_ids: symbols.map((s) => `${s}-USD`),
      channels: ['ticker'],
    }),
  read: (raw) => {
    const m = frame(raw) as { type?: string; product_id?: string; price?: string; time?: string } | null
    if (!m || m.type !== 'ticker' || typeof m.product_id !== 'string') return []
    const price = num(m.price)
    if (price === null) return []
    return [
      {
        symbol: m.product_id.split('-')[0].toUpperCase(),
        price,
        receivedAt: Date.now(),
        tradedAt: time(m.time),
      },
    ]
  },
}

/**
 * Kraken — the fallback.
 *
 * A second venue rather than a retry of the first, because the failure this
 * guards against is "Coinbase is unreachable from where this reader is", and
 * reconnecting to the same host answers that with the same silence. Kraken
 * writes Bitcoin as `BTC/USD` on v2 (it was `XBT` on v1, which is the kind of
 * detail that makes a fallback fail on the day it is needed).
 */
export const krakenTape: TapeProvider = {
  key: 'kraken',
  label: 'Kraken',
  url: 'wss://ws.kraken.com/v2',
  pair: (symbol) => `${symbol}/USD`,
  subscribe: (symbols) =>
    JSON.stringify({
      method: 'subscribe',
      params: { channel: 'ticker', symbol: symbols.map((s) => `${s}/USD`) },
    }),
  read: (raw) => {
    const m = frame(raw) as {
      channel?: string
      data?: Array<{ symbol?: string; last?: number }>
    } | null
    if (!m || m.channel !== 'ticker' || !Array.isArray(m.data)) return []
    const out: Tick[] = []
    for (const row of m.data) {
      const price = num(row.last)
      if (price === null || typeof row.symbol !== 'string') continue
      out.push({
        symbol: row.symbol.split('/')[0].toUpperCase(),
        price,
        // Kraken's v2 ticker frame carries no per-trade timestamp, and a
        // missing time is recorded as missing rather than filled with now.
        receivedAt: Date.now(),
        tradedAt: null,
      })
    }
    return out
  },
}

/** In preference order. The first that connects is used. */
export const TAPE_PROVIDERS: TapeProvider[] = [coinbaseTape, krakenTape]

/** Every WebSocket origin the tape may open — the Content-Security-Policy list. */
export const TAPE_HOSTS: string[] = TAPE_PROVIDERS.map((p) => new URL(p.url).origin)

/**
 * The symbols the tape carries.
 *
 * A tape is not a board. Eight majors that both venues list, chosen so the
 * strip reads at a glance rather than scrolls — the full hundred assets already
 * have a home in the constellation and the board beneath it.
 */
export const TAPE_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'LINK', 'AVAX']

/**
 * How stale a tick may be before the strip stops calling itself live.
 *
 * Fifteen seconds. A quiet minor pair genuinely does not trade every second, so
 * this is not "the socket died" — it is "this price is older than it looks",
 * which is the thing a reader needs and would otherwise have to guess.
 */
export const STALE_TICK_MS = 15_000

/** Attempts against one provider before moving to the next. */
export const RETRIES_PER_PROVIDER = 2

/**
 * Backoff between attempts, in milliseconds, by attempt number.
 *
 * Fixed steps rather than a formula with jitter, because jitter needs a random
 * source and the charter forbids one. Every reader reconnecting on the same
 * schedule is acceptable here: these are two of the largest venues on earth and
 * our readership is not a thundering herd to them.
 */
export function backoffMs(attempt: number): number {
  const steps = [1_000, 3_000, 8_000, 20_000]
  return steps[Math.min(attempt, steps.length - 1)]
}
