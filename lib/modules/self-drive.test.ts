import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MIN_INTERVAL_MS, STALE_AFTER_MS, considerPublishing, driveStatus, resetDrive } from './self-drive'

const T0 = Date.parse('2026-08-20T12:00:00Z')
const iso = (ms: number) => new Date(ms).toISOString()

/** Never resolves, so a run stays in flight for the concurrency assertions. */
const pending = () => new Promise<void>(() => {})

describe('publishing without a scheduler', () => {
  beforeEach(() => resetDrive())

  it('runs when nothing has ever been published', () => {
    const run = vi.fn(async () => {})
    const decision = considerPublishing({ newestAt: null, run, now: T0 })
    expect(decision).toEqual({ started: true, reason: 'started' })
    expect(run).toHaveBeenCalledOnce()
  })

  it('runs when the newest automatic post has gone stale', () => {
    const run = vi.fn(async () => {})
    const stale = iso(T0 - STALE_AFTER_MS - 1000)
    expect(considerPublishing({ newestAt: stale, run, now: T0 }).started).toBe(true)
  })

  it('leaves a fresh feed alone', () => {
    const run = vi.fn(async () => {})
    const fresh = iso(T0 - 60_000)
    expect(considerPublishing({ newestAt: fresh, run, now: T0 })).toEqual({
      started: false,
      reason: 'still-fresh',
    })
    expect(run).not.toHaveBeenCalled()
  })

  /**
   * Ten readers arriving at once on a cold instance would otherwise start ten
   * world sweeps — each fanning out across 119 publishers.
   */
  it('lets concurrent readers share one run rather than starting one each', () => {
    const run = vi.fn(pending)
    for (let i = 0; i < 10; i++) considerPublishing({ newestAt: null, run, now: T0 + i })
    expect(run).toHaveBeenCalledOnce()
  })

  /**
   * The clock is set before the run, not after: a run taking two minutes must
   * not let a reader at minute one start a second one.
   */
  it('holds a floor between runs even after one finishes', async () => {
    const run = vi.fn(async () => {})
    considerPublishing({ newestAt: null, run, now: T0 })
    // A macrotask, not a microtask: the `finally` that clears the in-flight
    // marker is two links down the promise chain, and asserting after one turn
    // tests "already running" instead of the floor this is about.
    await new Promise((r) => setTimeout(r, 0))
    expect(considerPublishing({ newestAt: null, run, now: T0 + MIN_INTERVAL_MS - 1 })).toEqual({
      started: false,
      reason: 'too-soon',
    })
    expect(run).toHaveBeenCalledOnce()
  })

  it('runs again once the floor has passed', async () => {
    const run = vi.fn(async () => {})
    considerPublishing({ newestAt: null, run, now: T0 })
    await new Promise((r) => setTimeout(r, 0))
    expect(considerPublishing({ newestAt: null, run, now: T0 + MIN_INTERVAL_MS + 1 }).started).toBe(true)
    expect(run).toHaveBeenCalledTimes(2)
  })

  /**
   * This is background work nobody asked for. A rejection escaping would become
   * an unhandled rejection and, on some runtimes, take the process with it.
   */
  it('swallows a failure into a counter rather than an unhandled rejection', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const run = vi.fn(async () => {
      throw new Error('publisher unreachable')
    })
    considerPublishing({ newestAt: null, run, now: T0 })
    await new Promise((r) => setTimeout(r, 0))
    const status = driveStatus()
    expect(status.failures).toBe(1)
    expect(status.lastError).toContain('publisher unreachable')
    expect(status.running).toBe(false)
    spy.mockRestore()
  })

  /**
   * Even a failed run sets the clock. Retrying on every request is how a broken
   * publisher becomes an outbound flood.
   */
  it('backs off after a failure instead of retrying on every read', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const run = vi.fn(async () => {
      throw new Error('down')
    })
    considerPublishing({ newestAt: null, run, now: T0 })
    await new Promise((r) => setTimeout(r, 0))
    expect(considerPublishing({ newestAt: null, run, now: T0 + 1000 }).reason).toBe('too-soon')
    expect(run).toHaveBeenCalledOnce()
    spy.mockRestore()
  })

  it('treats an unparseable timestamp as stale rather than as fresh', () => {
    const run = vi.fn(async () => {})
    expect(considerPublishing({ newestAt: 'not a date', run, now: T0 }).started).toBe(true)
  })

  it('reports what it has done, so the behaviour is visible not hidden', async () => {
    const run = vi.fn(async () => {})
    considerPublishing({ newestAt: null, run, now: T0 })
    await new Promise((r) => setTimeout(r, 0))
    const status = driveStatus()
    expect(status.runs).toBe(1)
    expect(status.failures).toBe(0)
    expect(status.lastStartedAt).toBe(iso(T0))
  })
})
