import { describe, expect, it } from 'vitest'
import { TapeRunner, type RunnerHost, type RunnerSnapshot, type TapeSocket } from './tape-runner'
import { RETRIES_PER_PROVIDER, TAPE_PROVIDERS, coinbaseTape, krakenTape } from './tape'

/**
 * A socket that does exactly what the test tells it to, and a clock that only
 * moves when asked.
 *
 * The bug these were written for: watched in a real browser against a blocked
 * venue, the tape opened one socket in thirty seconds and never retried or fell
 * back. Reading the code found nothing. A failing socket, a clock that can be
 * advanced, and a count of what was opened found it immediately.
 */
class FakeSocket implements TapeSocket {
  sent: string[] = []
  closed = false
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null

  constructor(readonly url: string) {}

  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.closed = true
  }

  /** What a real socket does on a reset: `onerror`, then `onclose`. */
  failLikeABrowser() {
    this.onerror?.()
    this.onclose?.()
  }
}

class Harness implements RunnerHost {
  opened: string[] = []
  sockets: FakeSocket[] = []
  private timers: Array<{ fn: () => void; at: number; id: number }> = []
  private nextId = 1
  private clock = 1_000_000
  snapshots: RunnerSnapshot[] = []
  /** Set to throw synchronously, the way a policy-blocked origin does. */
  throwOnOpen = false

  open(url: string): TapeSocket {
    this.opened.push(url)
    if (this.throwOnOpen) throw new Error('blocked by policy')
    const socket = new FakeSocket(url)
    this.sockets.push(socket)
    return socket
  }
  setTimer(fn: () => void, ms: number) {
    const id = this.nextId++
    this.timers.push({ fn, at: this.clock + ms, id })
    return id
  }
  clearTimer(handle: unknown) {
    this.timers = this.timers.filter((t) => t.id !== handle)
  }
  now() {
    return this.clock
  }

  /** Move the clock and run everything that comes due. */
  advance(ms: number) {
    const target = this.clock + ms
    for (;;) {
      const due = this.timers.filter((t) => t.at <= target).sort((a, b) => a.at - b.at)[0]
      if (!due) break
      this.timers = this.timers.filter((t) => t !== due)
      this.clock = due.at
      due.fn()
    }
    this.clock = target
  }

  get last(): RunnerSnapshot {
    return this.snapshots[this.snapshots.length - 1]
  }
}

function runner(host: Harness, providers = TAPE_PROVIDERS) {
  return new TapeRunner({
    symbols: ['BTC', 'ETH'],
    host,
    providers,
    onChange: (s) => host.snapshots.push(s),
  })
}

describe('the happy path', () => {
  it('subscribes on open and goes live', () => {
    const host = new Harness()
    const tape = runner(host)
    tape.start()

    expect(host.opened).toEqual([coinbaseTape.url])
    host.sockets[0].onopen?.()

    expect(JSON.parse(host.sockets[0].sent[0]).product_ids).toEqual(['BTC-USD', 'ETH-USD'])
    expect(host.last.state).toBe('live')
    expect(host.last.venue).toBe('Coinbase')
    tape.stop()
  })

  it('holds the latest price per symbol and reports its age', () => {
    const host = new Harness()
    const tape = runner(host)
    tape.start()
    host.sockets[0].onopen?.()
    host.sockets[0].onmessage?.({
      data: '{"type":"ticker","product_id":"BTC-USD","price":"80228.06","time":"2026-08-27T09:41:12Z"}',
    })
    tape.publish()

    expect(host.last.ticks.get('BTC')?.price).toBeCloseTo(80228.06, 6)
    expect(host.last.fresh).toBe(true)
    tape.stop()
  })

  /**
   * An open socket that stopped printing is a real market condition, not a
   * fault — and a strip that keeps saying "live" over it is the exact failure
   * this codebase keeps finding.
   */
  it('stops calling itself fresh once the last tick ages out', () => {
    const host = new Harness()
    const tape = runner(host)
    tape.start()
    host.sockets[0].onopen?.()
    host.sockets[0].onmessage?.({ data: '{"type":"ticker","product_id":"BTC-USD","price":"1"}' })
    tape.publish()
    expect(host.last.fresh).toBe(true)

    host.advance(30_000)
    tape.publish()
    expect(host.last.state).toBe('live')
    expect(host.last.fresh).toBe(false)
    expect(host.last.oldestAgeMs).toBeGreaterThanOrEqual(30_000)
    tape.stop()
  })

  it('ignores a symbol it did not ask for', () => {
    const host = new Harness()
    const tape = runner(host)
    tape.start()
    host.sockets[0].onopen?.()
    host.sockets[0].onmessage?.({ data: '{"type":"ticker","product_id":"DOGE-USD","price":"0.4"}' })
    tape.publish()
    expect(host.last.ticks.has('DOGE')).toBe(false)
    tape.stop()
  })
})

describe('what the browser check found', () => {
  /**
   * The measured defect, now an assertion: one socket in thirty seconds, no
   * retry, no fallback, and a strip still claiming to be opening.
   */
  it('retries the same venue, then falls back to the next, then gives up', () => {
    const host = new Harness()
    const tape = runner(host)
    tape.start()

    expect(host.opened).toEqual([coinbaseTape.url])

    // First failure: retry the same venue.
    host.sockets[0].failLikeABrowser()
    expect(host.last.state).toBe('reconnecting')
    host.advance(5_000)
    expect(host.opened).toEqual([coinbaseTape.url, coinbaseTape.url])

    // Second failure exhausts this venue: move to the next.
    host.sockets[1].failLikeABrowser()
    host.advance(5_000)
    expect(host.opened[2]).toBe(krakenTape.url)

    // Kraken gets the same two attempts.
    host.sockets[2].failLikeABrowser()
    host.advance(5_000)
    expect(host.opened[3]).toBe(krakenTape.url)

    host.sockets[3].failLikeABrowser()
    host.advance(30_000)

    expect(host.last.state).toBe('failed')
    expect(host.last.venue).toBeNull()
    expect(host.opened).toHaveLength(RETRIES_PER_PROVIDER * TAPE_PROVIDERS.length)
    tape.stop()
  })

  /**
   * A real socket fires `onerror` *and* `onclose` for one failure. Counting
   * that as two advances the provider twice and silently skips a venue — which
   * is a fallback that does not fall back.
   */
  it('counts one failure once, even though the browser reports it twice', () => {
    const host = new Harness()
    const tape = runner(host)
    tape.start()
    host.sockets[0].failLikeABrowser()
    host.advance(5_000)
    // Still Coinbase. If the double event had counted twice, this would be Kraken.
    expect(host.opened[1]).toBe(coinbaseTape.url)
    tape.stop()
  })

  /**
   * A Content-Security-Policy mismatch throws from the constructor rather than
   * firing `onerror`, and an unguarded throw kills the whole tape on the first
   * attempt instead of falling through to the next venue.
   */
  it('treats a synchronous throw as a failure like any other', () => {
    const host = new Harness()
    host.throwOnOpen = true
    const tape = runner(host)
    tape.start()
    host.advance(60_000)
    expect(host.last.state).toBe('failed')
    expect(host.last.detail).toContain('blocked by policy')
    tape.stop()
  })

  it('never says "connecting" once it has started reconnecting', () => {
    const host = new Harness()
    const tape = runner(host)
    tape.start()
    host.sockets[0].failLikeABrowser()
    host.advance(5_000)
    const after = host.snapshots.slice(1)
    expect(after.some((s) => s.state === 'connecting')).toBe(false)
  })
})

describe('letting go cleanly', () => {
  it('stops retrying after stop(), whatever is still in flight', () => {
    const host = new Harness()
    const tape = runner(host)
    tape.start()
    host.sockets[0].failLikeABrowser()
    tape.stop()
    host.advance(60_000)
    expect(host.opened).toHaveLength(1)
  })

  it('closes the socket it opened', () => {
    const host = new Harness()
    const tape = runner(host)
    tape.start()
    host.sockets[0].onopen?.()
    tape.stop()
    expect(host.sockets[0].closed).toBe(true)
  })

  /**
   * A detached socket must not still be delivering into a runner that has moved
   * on — that is how a reconnect ends up showing two venues' prices at once.
   */
  it('ignores messages from a socket it has already replaced', () => {
    const host = new Harness()
    const tape = runner(host)
    tape.start()
    const first = host.sockets[0]
    first.failLikeABrowser()
    host.advance(5_000)
    first.onmessage?.({ data: '{"type":"ticker","product_id":"BTC-USD","price":"1"}' })
    tape.publish()
    expect(host.last.ticks.size).toBe(0)
    tape.stop()
  })

  it('pauses without treating it as a failure, and resumes from the first venue', () => {
    const host = new Harness()
    const tape = runner(host)
    tape.start()
    host.sockets[0].onopen?.()
    tape.pause()
    expect(host.last.state).toBe('idle')
    host.advance(60_000)
    expect(host.opened).toHaveLength(1)

    tape.resume()
    expect(host.opened[1]).toBe(coinbaseTape.url)
    tape.stop()
  })

  it('publishes nothing after stop()', () => {
    const host = new Harness()
    const tape = runner(host)
    tape.start()
    tape.stop()
    const before = host.snapshots.length
    tape.publish()
    expect(host.snapshots).toHaveLength(before)
  })
})
