/**
 * Turning market numbers into something a person can read at a glance.
 *
 * Kept out of the component on purpose. Every rule here — where a number is
 * rounded, when a change counts as a move, what congestion means in words — is
 * a judgement that can be wrong, and a judgement buried in JSX cannot be tested
 * or argued with. The panel renders; this decides.
 *
 * ## The rule the whole file obeys
 *
 * **Never show a number we do not have.** Each formatter takes `null` and
 * returns a dash, because the alternative — printing `0` for "not reported" —
 * is the difference between "this chain has no pending transactions" and "this
 * chain does not publish a mempool". A zero that means "unknown" is a lie with
 * a decimal point on it, and it is exactly the kind of thing that made the
 * board unreadable before.
 */

/** What we print when a publisher did not report a value. */
export const UNKNOWN = '—'

/**
 * Money, at the magnitude a reader can hold in their head.
 *
 * Market capitalisations run to twelve digits and nobody reads twelve digits.
 * `$2.41T` is the number; `$2,412,883,410,229` is a receipt.
 */
export function usd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return UNKNOWN
  const abs = Math.abs(value)
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`
  // Below a thousand, the decimals are the information — a coin at $0.4213 is
  // not "$0". Four places, then trailing zeros trimmed.
  if (abs >= 1) return `$${value.toFixed(2)}`
  return `$${Number(value.toFixed(6))}`
}

/** A plain count: 913,441 rather than 913441. */
export function count(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return UNKNOWN
  return Math.round(value).toLocaleString('en-US')
}

/** A percentage that always carries its sign, so a move reads as a direction. */
export function signedPercent(value: number | null | undefined, places = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return UNKNOWN
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(places)}%`
}

/**
 * A value that is **already a percentage**, shown as one.
 *
 * Separate from `share` because conflating the two produced a real, visible
 * absurdity: CoinGecko publishes Bitcoin dominance as `59.31` — a percentage —
 * and passing it through `share`, which multiplies by 100, put **5931.1%** on
 * the front of the markets page. A dominance above 100% is not a rounding
 * error, it is a number that tells the reader nothing on this page can be
 * trusted.
 *
 * Two functions with two names is the fix. A unit is part of a value, and the
 * type system cannot tell 0.59 from 59 — so the distinction has to live in the
 * name of the thing that formats it.
 */
export function percent(value: number | null | undefined, places = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return UNKNOWN
  return `${value.toFixed(places)}%`
}

/** A share expressed as a **fraction, 0–1**, shown as a percentage. */
export function share(value: number | null | undefined, places = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return UNKNOWN
  return `${(value * 100).toFixed(places)}%`
}

export type Direction = 'up' | 'down' | 'flat' | 'unknown'

/**
 * Which way a number moved — and, deliberately, when it did not really move.
 *
 * A change of 0.004% is noise, and colouring it green tells a reader something
 * happened when nothing did. Below the threshold it is flat, and flat is drawn
 * in the neutral colour.
 */
export const FLAT_THRESHOLD = 0.05

export function directionOf(change: number | null | undefined): Direction {
  if (change === null || change === undefined || !Number.isFinite(change)) return 'unknown'
  if (Math.abs(change) < FLAT_THRESHOLD) return 'flat'
  return change > 0 ? 'up' : 'down'
}

export type NetworkStatus = 'quiet' | 'normal' | 'busy' | 'congested' | 'unknown'

/**
 * Congestion, in words.
 *
 * The chain radar produces a 0–1 figure, which is precise and means nothing to
 * most readers. These bands say what the number is *for*: whether a transaction
 * sent now will settle promptly and cheaply.
 *
 * `unknown` is a real state and is kept separate from `quiet`. Several chains
 * publish nothing that means congestion, and reporting them as quiet would be
 * inventing a measurement — the same failure as printing 0 for "not reported".
 */
export function networkStatus(congestion: number | null | undefined): NetworkStatus {
  if (congestion === null || congestion === undefined || !Number.isFinite(congestion)) return 'unknown'
  if (congestion < 0.2) return 'quiet'
  if (congestion < 0.5) return 'normal'
  if (congestion < 0.8) return 'busy'
  return 'congested'
}

/** What each status means for someone about to transact. */
export const STATUS_MEANING: Record<NetworkStatus, string> = {
  quiet: 'Cheap and fast right now',
  normal: 'Ordinary conditions',
  busy: 'Fees are elevated',
  congested: 'Expensive; expect delays',
  unknown: 'This chain publishes no congestion measure',
}

/**
 * How concentrated trading is across venues, in words.
 *
 * A Herfindahl index over exchange volume shares. It matters because a market
 * whose volume sits in one venue is a market with one point of failure — and a
 * price that one venue can move.
 */
export function concentrationVerdict(index: number | null | undefined): string {
  if (index === null || index === undefined || !Number.isFinite(index)) return UNKNOWN
  if (index < 0.1) return 'Spread across many venues'
  if (index < 0.18) return 'Moderately concentrated'
  if (index < 0.25) return 'Concentrated'
  return 'Heavily concentrated in few venues'
}

/**
 * Age of a reading, in words — because "when" is half of what a price means.
 *
 * A price with no time on it is a rumour. Returns null for an unparseable or
 * absent timestamp rather than guessing, so the caller shows nothing instead of
 * something false.
 */
export function ageLabel(iso: string | null | undefined, now: number = Date.now()): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const seconds = Math.max(0, Math.round((now - t) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}
