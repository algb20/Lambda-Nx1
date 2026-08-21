import { describe, expect, it } from 'vitest'
import {
  FLAT_THRESHOLD,
  STATUS_MEANING,
  UNKNOWN,
  ageLabel,
  concentrationVerdict,
  count,
  directionOf,
  networkStatus,
  percent,
  share,
  signedPercent,
  usd,
} from './market-format'

/**
 * The rule the whole module exists to enforce: never show a number we do not
 * have. A zero printed for "not reported" is a lie with a decimal point on it.
 */
describe('an absent value is never shown as a number', () => {
  it.each([usd, count, signedPercent, share])('%# returns a dash for null and undefined', (fn) => {
    expect(fn(null)).toBe(UNKNOWN)
    expect(fn(undefined)).toBe(UNKNOWN)
  })

  it.each([usd, count, signedPercent, share])('%# returns a dash for NaN and Infinity', (fn) => {
    expect(fn(Number.NaN)).toBe(UNKNOWN)
    expect(fn(Number.POSITIVE_INFINITY)).toBe(UNKNOWN)
  })

  it('does not confuse a real zero with a missing value', () => {
    // A chain reporting zero pending transactions is a fact, and must print.
    expect(count(0)).toBe('0')
    expect(signedPercent(0)).toBe('0.00%')
  })
})

describe('usd', () => {
  it('scales to a magnitude a person can hold in their head', () => {
    expect(usd(2_412_883_410_229)).toBe('$2.41T')
    expect(usd(64_120_000_000)).toBe('$64.12B')
    expect(usd(3_400_000)).toBe('$3.40M')
    expect(usd(12_400)).toBe('$12.4K')
  })

  it('keeps the decimals that are the information on a small price', () => {
    // A coin at $0.4213 is not "$0". This is the whole reason for the branch.
    expect(usd(0.4213)).toBe('$0.4213')
    expect(usd(0.000021)).toBe('$0.000021')
  })

  it('handles negatives without losing the sign', () => {
    expect(usd(-2_400_000_000)).toBe('$-2.40B')
  })
})

describe('directionOf', () => {
  it('calls a real move by its direction', () => {
    expect(directionOf(4.2)).toBe('up')
    expect(directionOf(-4.2)).toBe('down')
  })

  /**
   * Colouring a 0.004% change green tells a reader something happened when
   * nothing did. Below the threshold it is flat, and flat is neutral.
   */
  it('treats noise as flat rather than as a direction', () => {
    expect(directionOf(0.004)).toBe('flat')
    expect(directionOf(-0.004)).toBe('flat')
    expect(directionOf(FLAT_THRESHOLD / 2)).toBe('flat')
  })

  it('separates "did not move" from "we do not know"', () => {
    expect(directionOf(0)).toBe('flat')
    expect(directionOf(null)).toBe('unknown')
  })
})

describe('signedPercent', () => {
  it('always carries the sign, so a move reads as a direction', () => {
    expect(signedPercent(4.2)).toBe('+4.20%')
    expect(signedPercent(-4.2)).toBe('-4.20%')
  })
})

describe('networkStatus', () => {
  it.each([
    [0.05, 'quiet'],
    [0.35, 'normal'],
    [0.65, 'busy'],
    [0.95, 'congested'],
  ])('reads %s as %s', (congestion, expected) => {
    expect(networkStatus(congestion)).toBe(expected)
  })

  /**
   * The distinction that keeps this honest. Several chains publish nothing that
   * means congestion; reporting them as "quiet" would invent a measurement.
   */
  it('does not report an unmeasured chain as quiet', () => {
    expect(networkStatus(null)).toBe('unknown')
    expect(networkStatus(undefined)).toBe('unknown')
    expect(STATUS_MEANING.unknown).toMatch(/publishes no congestion measure/)
  })

  it('gives every status a meaning a reader can act on', () => {
    for (const status of ['quiet', 'normal', 'busy', 'congested', 'unknown'] as const) {
      expect(STATUS_MEANING[status].length).toBeGreaterThan(10)
    }
  })
})

describe('concentrationVerdict', () => {
  it('says what a concentration index means for the market', () => {
    expect(concentrationVerdict(0.039)).toBe('Spread across many venues')
    expect(concentrationVerdict(0.4)).toMatch(/Heavily concentrated/)
  })

  it('says nothing when it was not measured', () => {
    expect(concentrationVerdict(null)).toBe(UNKNOWN)
  })
})

describe('ageLabel — a price with no time on it is a rumour', () => {
  const now = Date.parse('2026-08-21T12:00:00Z')

  it.each([
    ['2026-08-21T11:59:30Z', 'just now'],
    ['2026-08-21T11:45:00Z', '15m ago'],
    ['2026-08-21T09:00:00Z', '3h ago'],
    ['2026-08-18T12:00:00Z', '3d ago'],
  ])('describes %s as %s', (iso, expected) => {
    expect(ageLabel(iso, now)).toBe(expected)
  })

  it('returns null rather than guessing at an absent or broken timestamp', () => {
    expect(ageLabel(null, now)).toBeNull()
    expect(ageLabel('not a date', now)).toBeNull()
  })

  it('never reports a future reading as negative age', () => {
    expect(ageLabel('2026-08-21T12:05:00Z', now)).toBe('just now')
  })
})

describe('percent and share are different units and must not be confused', () => {
  /**
   * The live absurdity. CoinGecko publishes Bitcoin dominance as `59.31` — a
   * percentage — and it was passed through `share`, which multiplies by 100.
   * The front of the markets page read **5931.1%**. A dominance above 100% does
   * not read as a rounding error; it tells the reader nothing on the page can
   * be trusted.
   */
  it('formats a value already in percent without multiplying it again', () => {
    expect(percent(59.31146415432394)).toBe('59.3%')
    expect(percent(11.027634815511679)).toBe('11.0%')
  })

  it('formats a 0–1 fraction by scaling it', () => {
    // Venue share genuinely is a fraction: 0.167 of all measured volume.
    expect(share(0.167)).toBe('16.7%')
  })

  /**
   * The guard that would have caught the original bug. Dominance is a share of
   * a whole and cannot exceed it; if a formatter ever produces a figure like
   * this again, this is the assertion that says so in plain terms.
   */
  it('never turns a real dominance figure into an impossible one', () => {
    const dominance = 59.31146415432394
    const shown = Number.parseFloat(percent(dominance))
    expect(shown).toBeLessThanOrEqual(100)
    expect(shown).toBeGreaterThan(0)
  })

  it('both still refuse to invent a number they do not have', () => {
    expect(percent(null)).toBe(UNKNOWN)
    expect(percent(Number.NaN)).toBe(UNKNOWN)
  })
})
