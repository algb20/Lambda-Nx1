import { describe, expect, it } from 'vitest'
import { createChannel } from './broadcast'

/**
 * A fake clock and timer, so these tests assert on behaviour rather than on
 * how long they were willing to sleep.
 */
function harness() {
  let ms = 1_700_000_000_000
  const timers: Array<{ fn: () => void; every: number }> = []
  return {
    now: () => ms,
    advance: (by: number) => {
      ms += by
    },
    tick: () => timers.forEach((t) => t.fn()),
    setTimer: (fn: () => void, every: number) => {
      const handle = { fn, every }
      timers.push(handle)
      return handle
    },
    clearTimer: (h: unknown) => {
      const i = timers.indexOf(h as { fn: () => void; every: number })
      if (i >= 0) timers.splice(i, 1)
    },
    live: () => timers.length,
  }
}

describe('one producer, many readers', () => {
  /**
   * The whole reason this module exists. `/api/track` calls its producer per
   * connection, so ten readers are ten sets of upstream requests — polling
   * moved to the server rather than removed. On a passive-only engine whose
   * bargain with publishers is asking rarely, that is the wrong shape.
   */
  it('produces once however many readers are attached', async () => {
    const h = harness()
    let produced = 0
    const ch = createChannel({
      intervalMs: 1000,
      produce: async () => ++produced,
      now: h.now,
      setTimer: h.setTimer,
      clearTimer: h.clearTimer,
    })

    const seen: number[][] = [[], [], []]
    const off = seen.map((bucket) => ch.subscribe((r) => bucket.push(r.value)))
    await Promise.resolve()
    await Promise.resolve()

    expect(produced, 'three readers, one production').toBe(1)
    expect(ch.readers()).toBe(3)

    h.advance(1000)
    h.tick()
    await Promise.resolve()
    await Promise.resolve()
    expect(produced, 'one tick, one production').toBe(2)

    for (const f of off) f()
  })

  it('gives every reader the same reading', async () => {
    const h = harness()
    const ch = createChannel({
      intervalMs: 1000,
      produce: async () => 'shared',
      now: h.now,
      setTimer: h.setTimer,
      clearTimer: h.clearTimer,
    })
    const a: string[] = []
    const b: string[] = []
    const offA = ch.subscribe((r) => a.push(r.value))
    await Promise.resolve()
    await Promise.resolve()
    const offB = ch.subscribe((r) => b.push(r.value))

    expect(a).toEqual(['shared'])
    // B arrived between ticks and was handed what the channel holds, rather
    // than staring at nothing for up to a full interval.
    expect(b).toEqual(['shared'])
    offA()
    offB()
  })
})

describe('a channel with no readers does no work', () => {
  /**
   * Not an optimisation. The alternative is a deployment quietly fetching a
   * publisher's feed forever because someone once opened a page, which is the
   * opposite of the politeness the guardrail enforces on every other request.
   */
  it('starts on the first reader and stops after the last leaves', async () => {
    const h = harness()
    let produced = 0
    const ch = createChannel({
      intervalMs: 1000,
      produce: async () => ++produced,
      now: h.now,
      setTimer: h.setTimer,
      clearTimer: h.clearTimer,
    })

    expect(h.live(), 'nothing runs before anyone is watching').toBe(0)
    const off = ch.subscribe(() => {})
    expect(h.live()).toBe(1)
    off()
    expect(h.live(), 'the timer is gone with the last reader').toBe(0)

    h.advance(5000)
    h.tick()
    await Promise.resolve()
    expect(produced, 'and it produced nothing after leaving').toBe(1)
  })

  it('survives the same reader detaching twice', () => {
    const h = harness()
    const ch = createChannel({
      intervalMs: 1000,
      produce: async () => 1,
      now: h.now,
      setTimer: h.setTimer,
      clearTimer: h.clearTimer,
    })
    const a = ch.subscribe(() => {})
    const b = ch.subscribe(() => {})
    a()
    a()
    expect(ch.readers(), 'a double detach must not remove somebody else').toBe(1)
    b()
  })
})

describe('a kept reading carries its age, or is not handed over', () => {
  /**
   * Serving something cached with no age beside it is the failure this codebase
   * has already fixed twice — once in the orchestrator, once on the board. The
   * reading's `at` is when the producer returned it, never when we sent it.
   */
  it('stamps the reading with when it was produced', async () => {
    const h = harness()
    const ch = createChannel({
      intervalMs: 1000,
      produce: async () => 'v',
      now: h.now,
      setTimer: h.setTimer,
      clearTimer: h.clearTimer,
    })
    const seen: string[] = []
    const off = ch.subscribe((r) => seen.push(r.at))
    await Promise.resolve()
    await Promise.resolve()
    expect(seen[0]).toBe(new Date(h.now()).toISOString())
    off()
  })

  it('says nothing rather than handing over a reading from another situation', async () => {
    const h = harness()
    const ch = createChannel({
      intervalMs: 1000,
      maxAgeMs: 2000,
      produce: async () => 'v',
      now: h.now,
      setTimer: h.setTimer,
      clearTimer: h.clearTimer,
    })
    const first = ch.subscribe(() => {})
    await Promise.resolve()
    await Promise.resolve()
    first()

    h.advance(10_000)
    expect(ch.latest(), 'past its age, the channel holds nothing worth saying').toBeNull()

    const late: string[] = []
    const off = ch.subscribe((r) => late.push(r.value))
    // Nothing handed over on attach; the fresh production arrives instead.
    expect(late).toEqual([])
    off()
  })
})

describe('a broken producer is reported, not swallowed', () => {
  /**
   * A reader told nothing cannot tell a quiet channel from a broken one. That
   * exact confusion cost this project an hour on the reference gateway, where a
   * `429` arrived as an empty page reporting itself healthy.
   */
  it('delivers the failure to every reader', async () => {
    const h = harness()
    const ch = createChannel({
      intervalMs: 1000,
      produce: async () => {
        throw new Error('provider answered 429')
      },
      now: h.now,
      setTimer: h.setTimer,
      clearTimer: h.clearTimer,
    })
    const errors: string[] = []
    const off = ch.subscribe(
      () => {},
      (m) => errors.push(m),
    )
    await Promise.resolve()
    await Promise.resolve()
    expect(errors).toEqual(['provider answered 429'])
    off()
  })

  it('keeps running after a failure', async () => {
    const h = harness()
    let n = 0
    const ch = createChannel({
      intervalMs: 1000,
      produce: async () => {
        n += 1
        if (n === 1) throw new Error('first one failed')
        return n
      },
      now: h.now,
      setTimer: h.setTimer,
      clearTimer: h.clearTimer,
    })
    const values: number[] = []
    const off = ch.subscribe((r) => values.push(r.value))
    await Promise.resolve()
    await Promise.resolve()
    h.advance(1000)
    h.tick()
    await Promise.resolve()
    await Promise.resolve()
    expect(values, 'one bad tick must not end the channel').toEqual([2])
    off()
  })
})
