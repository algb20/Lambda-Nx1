import { describe, expect, it } from 'vitest'
import { HostBudget, HostBusyError, HOST_INTERVALS, type BudgetClock } from './host-budget'

/**
 * A clock that only moves when the queue asks it to.
 *
 * The behaviour worth testing here is entirely about concurrency and time, and
 * a queue tested with real timers is a queue tested at one speed on one machine.
 * `sleep` advances the clock immediately and yields, so four callers racing for
 * one host resolve in the order the queue actually puts them in, at the times it
 * actually chooses, in under a millisecond.
 */
function fakeClock(): BudgetClock & { time: number } {
  const clock = {
    time: 1_000_000,
    now() {
      return clock.time
    },
    async sleep(ms: number) {
      clock.time += ms
      // Yield so the awaiting caller resumes before the next one is examined.
      await Promise.resolve()
    },
  }
  return clock
}

const HOST = 'api.example.com'
const budget = (intervalMs = 1000, maxWaitMs = 3_500) => {
  const clock = fakeClock()
  return { clock, b: new HostBudget({ [HOST]: intervalMs }, clock, maxWaitMs) }
}

describe('a host nobody limits costs nothing', () => {
  it('returns immediately for a host with no interval', async () => {
    const { b, clock } = budget()
    const before = clock.time
    await b.take('unbudgeted.example.com')
    expect(clock.time).toBe(before)
  })

  it('reports zero interval for an unlisted host', () => {
    expect(budget().b.intervalFor('unbudgeted.example.com')).toBe(0)
  })

  it('matches a host whatever case it is written in', () => {
    const { b } = budget()
    expect(b.intervalFor('API.EXAMPLE.COM')).toBe(1000)
  })
})

describe('spacing one host', () => {
  it('lets the first caller straight through', async () => {
    const { b, clock } = budget()
    const before = clock.time
    await b.take(HOST)
    expect(clock.time).toBe(before)
  })

  it('holds the second caller for the interval', async () => {
    const { b, clock } = budget(1000)
    await b.take(HOST)
    const after = clock.time
    await b.take(HOST)
    expect(clock.time - after).toBe(1000)
  })

  /**
   * The measured production fault, as an assertion. Four sources reading one
   * provider in the same sweep used to arrive together; now they arrive spaced.
   */
  it('spaces four concurrent callers instead of letting them collide', async () => {
    const { b, clock } = budget(1000)
    const times: number[] = []
    await Promise.all(
      [0, 1, 2, 3].map(async () => {
        await b.take(HOST)
        times.push(clock.time)
      }),
    )
    times.sort((a, z) => a - z)
    for (let i = 1; i < times.length; i++) {
      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(1000)
    }
  })

  it('does not make a caller wait when the interval has already passed', async () => {
    const { b, clock } = budget(1000)
    await b.take(HOST)
    clock.time += 5000
    const before = clock.time
    await b.take(HOST)
    expect(clock.time).toBe(before)
  })

  it('keeps a separate budget per host', async () => {
    const clock = fakeClock()
    const b = new HostBudget({ 'a.example.com': 1000, 'b.example.com': 1000 }, clock)
    await b.take('a.example.com')
    const before = clock.time
    await b.take('b.example.com')
    expect(clock.time).toBe(before)
  })
})

describe('refusing a wait the caller cannot afford', () => {
  /**
   * A caller twelve deep on a two-second host would wait twenty-four seconds
   * inside a request the orchestrator abandons at eight. Waiting for a slot we
   * cannot use is not politeness.
   */
  it('throws rather than joining a queue that is too long', async () => {
    const { b } = budget(1000, 2_500)
    // Three callers waiting means a fourth is priced at 3s, over the 2.5s cap.
    const held = [b.take(HOST), b.take(HOST), b.take(HOST)]
    await expect(b.take(HOST)).rejects.toBeInstanceOf(HostBusyError)
    await Promise.all(held)
  })

  it('names the host and the wait it refused', async () => {
    const { b } = budget(1000, 1_500)
    const held = [b.take(HOST), b.take(HOST)]
    await b.take(HOST).catch((err: HostBusyError) => {
      expect(err.host).toBe(HOST)
      expect(err.waitMs).toBeGreaterThan(1_500)
      expect(err.message).toContain(HOST)
    })
    await Promise.all(held)
  })

  /**
   * A refusal must not cost the callers already in line. Pricing before joining
   * is what makes that true — joining and then giving up would leave everyone
   * behind waiting for us to abandon our slot.
   */
  it('leaves the existing queue undisturbed', async () => {
    const { b, clock } = budget(1000, 2_500)
    const times: number[] = []
    const held = [0, 1, 2].map(async () => {
      await b.take(HOST)
      times.push(clock.time)
    })
    await b.take(HOST).catch(() => undefined)
    await Promise.all(held)
    expect(times).toHaveLength(3)
    times.sort((a, z) => a - z)
    expect(times[2] - times[0]).toBe(2000)
  })

  it('clears its depth again once the queue drains', async () => {
    const { b } = budget(1000)
    await Promise.all([b.take(HOST), b.take(HOST), b.take(HOST)])
    expect(b.depthOf(HOST)).toBe(0)
  })
})

describe('the table itself', () => {
  /**
   * A budget is a cost. Imposing one on a provider that has never refused us
   * slows every sweep to protect nobody, so the table must stay small and every
   * entry must be there because of something observed.
   */
  it('budgets only hosts we have measured refusing us', () => {
    expect(Object.keys(HOST_INTERVALS)).toEqual(['api.coingecko.com'])
  })

  it('keeps every interval inside what a caller can afford alone', () => {
    for (const [host, ms] of Object.entries(HOST_INTERVALS)) {
      expect(ms, host).toBeGreaterThan(0)
      expect(ms, host).toBeLessThanOrEqual(3_500)
    }
  })

  it('writes every host in lower case, since lookups fold case', () => {
    for (const host of Object.keys(HOST_INTERVALS)) {
      expect(host).toBe(host.toLowerCase())
    }
  })
})
