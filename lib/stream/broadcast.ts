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
 * ## Why it starts and stops with its readers — and why it waits before stopping
 *
 * A channel with no subscribers does no work. The producer starts on the first
 * subscriber and stops when the last one leaves, so an idle deployment makes no
 * requests — which matters because the alternative is a server quietly fetching
 * a publisher's feed forever because someone once opened a page.
 *
 * Stopping *the instant* the last reader leaves was measured to invert that.
 * **On 2026-08-22 the deployed Netlify preview severed both SSE connections at
 * 30.6 seconds** — twice, on both endpoints, ignoring the routes' declared
 * `maxDuration = 300`. The browser reconnects three seconds later, and with an
 * eager stop that sequence read: last reader leaves → producer stops → producer
 * starts → **produce immediately**. One reader watching a 120-second channel
 * therefore fetched every ~33 seconds. Not a small regression: **3.6× the
 * upstream requests**, in the module written to make a reader cost nothing
 * upstream, against publishers whose goodwill is the whole bargain.
 *
 * So the channel lingers after its last reader, long enough to outlast a
 * reconnect by an order of magnitude, and a restart that still holds a current
 * reading does not re-fetch to produce one it already has. The idle guarantee
 * survives: with nobody watching, the channel stops one linger later, having
 * produced at most one extra reading.
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
  /**
   * How long the producer keeps running after the last reader leaves.
   *
   * Sized against a measurement, not a guess: the deployed host cuts an SSE
   * connection at ~30 seconds and `EventSource` reconnects 3 seconds later. A
   * linger shorter than that gap turns every platform-imposed cut into a full
   * stop/start cycle with an immediate fetch. Thirty seconds clears the gap ten
   * times over while bounding what an idle deployment costs to a single extra
   * reading.
   */
  lingerMs?: number
  /** Injectable clock and timers, so the tests do not sleep. */
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
  setLinger?: (fn: () => void, ms: number) => unknown
  clearLinger?: (handle: unknown) => void
}

export function createChannel<T>(options: ChannelOptions<T>): Channel<T> {
  const {
    intervalMs,
    produce,
    maxAgeMs = intervalMs * 3,
    lingerMs = 30_000,
    now = () => Date.now(),
    setTimer = (fn, ms) => setInterval(fn, ms),
    clearTimer = (h) => clearInterval(h as ReturnType<typeof setInterval>),
    setLinger = (fn, ms) => setTimeout(fn, ms),
    clearLinger = (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
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
    /**
     * Produce now only when there is nothing current to hand over.
     *
     * A restart that already holds a reading younger than one interval is not
     * behind on anything, and fetching to replace it makes a reconnect cost an
     * upstream request — which is the cost this module exists to remove. The
     * timer covers it, so the worst case after such a restart is one interval
     * later than it would otherwise have been, and no publisher is asked twice
     * for what we are already holding.
     */
    if (!held || now() - held.producedAtMs >= intervalMs) void run()
  }

  const stop = () => {
    if (timer === undefined) return
    clearTimer(timer)
    timer = undefined
  }

  let linger: unknown
  const cancelLinger = () => {
    if (linger === undefined) return
    clearLinger(linger)
    linger = undefined
  }

  return {
    subscribe(onReading, onError) {
      const reader: Reader = { onReading, onError }
      readers.add(reader)
      // A reader arriving inside the linger window rejoins the channel that is
      // still running, which is the whole point of the window.
      cancelLinger()
      start()

      // Hand over what we hold, if it is still worth holding.
      const kept = held
      if (kept && now() - kept.producedAtMs <= maxAgeMs) onReading(kept.reading)

      let detached = false
      return () => {
        if (detached) return
        detached = true
        readers.delete(reader)
        if (readers.size > 0) return
        // Not stopped here: the host severs connections on its own clock, and a
        // browser that reconnects three seconds later must find the channel
        // still running rather than restart it.
        cancelLinger()
        linger = setLinger(() => {
          linger = undefined
          if (readers.size === 0) stop()
        }, lingerMs)
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
