/**
 * One producer, many readers — the part of "streaming" that is actually ours.
 *
 * ## The problem this exists for
 *
 * `/api/track` already streams: it holds a connection open and pushes on a
 * timer instead of making the client poll. But it calls `buildTargetProfile`
 * **per connection**, so ten readers watching the same target are ten timers
 * and ten sets of upstream requests. That is polling with extra steps, moved
 * from the browser to the server, and on a passive-only engine whose whole
 * bargain with publishers is asking politely and rarely, it is the wrong shape.
 *
 * A channel here is the other arrangement: **one** timer per topic per process,
 * however many readers are attached. The tenth reader costs a `Set.add` and
 * nothing upstream at all.
 *
 * ## Why it starts and stops with its readers
 *
 * A channel with no subscribers does no work. The producer starts on the first
 * subscriber and stops when the last one leaves, so an idle deployment makes no
 * requests — which matters because the alternative is a server quietly fetching
 * a publisher's feed forever because someone once opened a page.
 *
 * ## Why the latest value is kept
 *
 * A reader arriving between ticks would otherwise stare at nothing for up to
 * the whole interval. The channel hands over what it last produced, **with the
 * time it was produced**, so the client can render immediately and say how old
 * the reading is. Serving a cached value silently, with no age beside it, is
 * the failure this codebase has already fixed twice; the age is not optional.
 *
 * ## Scope: one process
 *
 * This is in-memory and per-process, and that is honest for what it is. On a
 * platform that runs several instances, each has its own channel and its own
 * timer — so the saving is per instance, not global. Making it global needs a
 * shared bus (Redis, Postgres LISTEN/NOTIFY), which is a real option behind the
 * same interface and is deliberately not pretended at here.
 */

/** What a subscriber receives: the value, and when it was produced. */
export interface Reading<T> {
  value: T
  /** ISO-8601. The moment the producer returned it, never the moment we sent. */
  at: string
}

export interface Channel<T> {
  /** Attach a reader. Returns the detach function; calling it twice is safe. */
  subscribe(onReading: (reading: Reading<T>) => void, onError?: (message: string) => void): () => void
  /** The last value produced, or `null` if the channel has not run yet. */
  latest(): Reading<T> | null
  /** How many readers are attached. For tests and for reporting. */
  readers(): number
}

export interface ChannelOptions<T> {
  /** How often to produce, in milliseconds. */
  intervalMs: number
  /** Produces one reading. Errors are delivered to subscribers, never thrown. */
  produce: () => Promise<T>
  /**
   * How long a kept value stays worth handing to a new reader.
   *
   * Past this the channel says nothing rather than handing over something stale
   * enough to mislead. Defaults to three intervals: long enough to cover a
   * producer that missed a tick, short enough that nobody is shown a reading
   * from a different situation.
   */
  maxAgeMs?: number
  /** Injectable clock and timers, so the tests do not sleep. */
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export function createChannel<T>(options: ChannelOptions<T>): Channel<T> {
  const {
    intervalMs,
    produce,
    maxAgeMs = intervalMs * 3,
    now = () => Date.now(),
    setTimer = (fn, ms) => setInterval(fn, ms),
    clearTimer = (h) => clearInterval(h as ReturnType<typeof setInterval>),
  } = options

  type Reader = { onReading: (r: Reading<T>) => void; onError?: (m: string) => void }
  const readers = new Set<Reader>()
  let timer: unknown
  let held: { reading: Reading<T>; producedAtMs: number } | null = null
  /** Guards against a slow producer being started again by the next tick. */
  let producing = false

  const run = async () => {
    if (producing) return
    producing = true
    try {
      const value = await produce()
      const producedAtMs = now()
      const reading: Reading<T> = { value, at: new Date(producedAtMs).toISOString() }
      held = { reading, producedAtMs }
      for (const r of readers) r.onReading(reading)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'the producer failed'
      // Delivered, not swallowed. A reader that is told nothing cannot tell a
      // quiet channel from a broken one — the exact confusion this project
      // keeps paying for elsewhere.
      for (const r of readers) r.onError?.(message)
    } finally {
      producing = false
    }
  }

  const start = () => {
    if (timer !== undefined) return
    timer = setTimer(() => void run(), intervalMs)
    void run()
  }

  const stop = () => {
    if (timer === undefined) return
    clearTimer(timer)
    timer = undefined
  }

  return {
    subscribe(onReading, onError) {
      const reader: Reader = { onReading, onError }
      readers.add(reader)
      start()

      // Hand over what we hold, if it is still worth holding.
      const kept = held
      if (kept && now() - kept.producedAtMs <= maxAgeMs) onReading(kept.reading)

      let detached = false
      return () => {
        if (detached) return
        detached = true
        readers.delete(reader)
        if (readers.size === 0) stop()
      }
    },
    latest() {
      const kept = held
      if (!kept) return null
      return now() - kept.producedAtMs <= maxAgeMs ? kept.reading : null
    },
    readers: () => readers.size,
  }
}
