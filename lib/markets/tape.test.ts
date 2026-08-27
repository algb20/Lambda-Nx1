import { describe, expect, it } from 'vitest'
import {
  backoffMs,
  coinbaseTape,
  krakenTape,
  TAPE_HOSTS,
  TAPE_PROVIDERS,
  TAPE_SYMBOLS,
} from './tape'

/**
 * Frames captured from the live venues on 2026-08-27, trimmed but not edited.
 * A parser tested against a frame someone invented is a parser tested against
 * their assumptions.
 */
const COINBASE_TICKER =
  '{"type":"ticker","sequence":135083341392,"product_id":"BTC-USD","price":"80228.06","open_24h":"78434.74","volume_24h":"6736.34239815","low_24h":"77601.02","high_24h":"80529.99","time":"2026-08-27T09:41:12.123456Z","best_bid":"80227.99","best_ask":"80228.07"}'

const COINBASE_SUBSCRIPTIONS =
  '{"type":"subscriptions","channels":[{"name":"ticker","product_ids":["BTC-USD","ETH-USD"],"account_ids":null}]}'

const KRAKEN_STATUS =
  '{"channel":"status","type":"update","data":[{"version":"2.0.10","system":"online","api_version":"v2","connection_id":7974620515126709019}]}'

const KRAKEN_SUBSCRIBE_ACK =
  '{"method":"subscribe","result":{"channel":"ticker","event_trigger":"trades","snapshot":true,"symbol":"BTC/USD"},"success":true}'

const KRAKEN_TICKER =
  '{"channel":"ticker","type":"snapshot","data":[{"symbol":"BTC/USD","bid":80225.1,"ask":80226.4,"last":80225.9,"volume":812.4,"change_pct":2.31}]}'

describe('Coinbase frames', () => {
  it('reads a real ticker frame', () => {
    const [tick] = coinbaseTape.read(COINBASE_TICKER)
    expect(tick.symbol).toBe('BTC')
    expect(tick.price).toBeCloseTo(80228.06, 6)
    expect(tick.tradedAt).toBe(Date.parse('2026-08-27T09:41:12.123456Z'))
  })

  /**
   * The venue's clock and ours are two different facts. Collapsing them makes a
   * feed running three seconds behind indistinguishable from one that is not,
   * which is the same mistake `publishedAt` vs `retrievedAt` exists to prevent
   * everywhere else in this engine.
   */
  it('keeps our receipt time separate from the venue’s trade time', () => {
    const before = Date.now()
    const [tick] = coinbaseTape.read(COINBASE_TICKER)
    expect(tick.receivedAt).toBeGreaterThanOrEqual(before)
    expect(tick.tradedAt).not.toBe(tick.receivedAt)
  })

  it('ignores the subscription acknowledgement', () => {
    expect(coinbaseTape.read(COINBASE_SUBSCRIPTIONS)).toEqual([])
  })

  it('subscribes in the venue’s own pair notation', () => {
    const frame = JSON.parse(coinbaseTape.subscribe(['BTC', 'ETH']))
    expect(frame.product_ids).toEqual(['BTC-USD', 'ETH-USD'])
    expect(frame.channels).toEqual(['ticker'])
  })
})

describe('Kraken frames', () => {
  it('reads a real ticker frame', () => {
    const [tick] = krakenTape.read(KRAKEN_TICKER)
    expect(tick.symbol).toBe('BTC')
    expect(tick.price).toBeCloseTo(80225.9, 6)
  })

  /**
   * Kraken's v2 ticker carries no per-trade timestamp. Recording that as null
   * rather than as "now" is the whole discipline: a missing time is a fact
   * about the source.
   */
  it('records a missing trade time as missing', () => {
    expect(krakenTape.read(KRAKEN_TICKER)[0].tradedAt).toBeNull()
  })

  it('ignores the status and acknowledgement frames', () => {
    expect(krakenTape.read(KRAKEN_STATUS)).toEqual([])
    expect(krakenTape.read(KRAKEN_SUBSCRIBE_ACK)).toEqual([])
  })

  /**
   * Kraken wrote Bitcoin as `XBT` on v1 and writes `BTC` on v2. This is the
   * detail that makes a fallback fail on the one day it is needed, so it is
   * pinned.
   */
  it('subscribes with BTC, not XBT, on v2', () => {
    const frame = JSON.parse(krakenTape.subscribe(['BTC', 'ETH']))
    expect(frame.params.symbol).toEqual(['BTC/USD', 'ETH/USD'])
    expect(krakenTape.pair('BTC')).toBe('BTC/USD')
  })
})

describe('every provider survives what a socket really delivers', () => {
  for (const provider of TAPE_PROVIDERS) {
    it(`${provider.key} returns nothing for malformed input instead of throwing`, () => {
      for (const junk of ['', 'not json', '{', '[]', 'null', '{"type":"error"}', '{"channel":"ticker"}']) {
        expect(() => provider.read(junk)).not.toThrow()
        expect(provider.read(junk)).toEqual([])
      }
    })

    it(`${provider.key} drops a tick with an unusable price`, () => {
      const frames =
        provider.key === 'coinbase'
          ? ['{"type":"ticker","product_id":"BTC-USD","price":"abc"}', '{"type":"ticker","product_id":"BTC-USD"}']
          : ['{"channel":"ticker","data":[{"symbol":"BTC/USD","last":"abc"}]}', '{"channel":"ticker","data":[{"symbol":"BTC/USD"}]}']
      for (const f of frames) expect(provider.read(f)).toEqual([])
    })

    it(`${provider.key} opens a wss connection, never a plain one`, () => {
      expect(provider.url.startsWith('wss://')).toBe(true)
    })
  }
})

describe('the policy and the providers cannot drift apart', () => {
  /**
   * A provider whose origin is missing from the Content-Security-Policy fails
   * only in a real browser, only on the deployed site, and silently — the class
   * of fault the CSP tests were written for in the first place.
   */
  it('every provider origin is in the exported host list', () => {
    for (const p of TAPE_PROVIDERS) {
      expect(TAPE_HOSTS).toContain(new URL(p.url).origin)
    }
  })
})

describe('the tape’s shape', () => {
  it('carries majors only, uppercase, with no duplicates', () => {
    expect(TAPE_SYMBOLS.length).toBeGreaterThanOrEqual(4)
    expect(TAPE_SYMBOLS.length).toBeLessThanOrEqual(12)
    expect(new Set(TAPE_SYMBOLS).size).toBe(TAPE_SYMBOLS.length)
    for (const s of TAPE_SYMBOLS) expect(s).toBe(s.toUpperCase())
  })

  /**
   * The charter forbids `Math.random()`, so the backoff has no jitter — which
   * means it must at least be monotonic and bounded, or a venue outage turns
   * every reader into a retry loop at a fixed short interval.
   */
  it('backs off monotonically and stops growing', () => {
    const steps = [0, 1, 2, 3, 4, 10].map(backoffMs)
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1])
    expect(steps[steps.length - 1]).toBeLessThanOrEqual(60_000)
    expect(backoffMs(0)).toBeGreaterThanOrEqual(500)
  })

  it('names a venue for every provider, because a price without one is not a price', () => {
    for (const p of TAPE_PROVIDERS) {
      expect(p.label.length).toBeGreaterThan(2)
    }
  })

  /**
   * Binance answered 451 — legally restricted — from this deployment's egress.
   * A source that returns 451 must not reappear via another route, and the
   * cheapest way to keep that decision is to make its return fail a test.
   */
  it('does not carry a venue that refused us on legal grounds', () => {
    for (const p of TAPE_PROVIDERS) {
      expect(p.url).not.toContain('binance')
    }
  })
})
