/**
 * One budget per provider host, shared by every source that touches it.
 *
 * ## The production fault this was written for
 *
 * The engine's rate limit was keyed by **source**. Four of our sources read
 * `api.coingecko.com` — the asset list, the markets board, the chain radar and
 * the new price series — and each held its own independent interval, so during
 * one sweep all four fired at the same provider within a second of each other
 * from a single Netlify address.
 *
 * Measured on the deployed site, and the symptom is exactly what that predicts:
 *
 * | Surface | What it showed |
 * |---|---|
 * | total market cap | **$2.689T — live**, the first call through |
 * | movers | **0** |
 * | exchanges | **0** |
 * | correlation constellation | **0 assets, 1 source failed** |
 *
 * The CoinGecko-backed lists are empty while the figures that come from
 * elsewhere are live. Meanwhile the same deployment read 145 other sources
 * successfully, so nothing is wrong with the deployment.
 *
 * ## What this fixes, and what it does not — stated before it is believed
 *
 * I first wrote that this was one cause behind all four rows. That is more than
 * the evidence supports, and the difference matters:
 *
 * - **Within one request** — several sources reading the same host inside a
 *   single sweep — the collision is real, and this queue removes it. That is
 *   what the tests demonstrate.
 * - **Across requests** the budget lives in module scope, and on this host
 *   module scope is not guaranteed to survive between invocations (the same
 *   property that made a streaming linger inert here, measured earlier in this
 *   codebase). `/api/chain` and `/api/markets/constellation` are separate
 *   requests, so this does not necessarily connect them.
 *
 * So the honest statement is: a real defect, fixed and proven under test;
 * whether it is *the* cause of the production emptiness is not yet established.
 * What will settle it is the other half of the same change — every failure now
 * carries the provider's own words, so the next deployment prints CoinGecko's
 * reason instead of a silent zero.
 *
 * ## Why a queue rather than a longer interval
 *
 * A per-source interval cannot fix this however large it is, because the four
 * sources do not know about each other. The budget has to belong to the thing
 * that is actually limited: **the host**.
 *
 * And it has to serialise properly. The existing per-source check reads the last
 * call time, computes a wait, sleeps and then writes the time — which under
 * concurrency lets two callers read the same value and both proceed. That race
 * is harmless when each key has one caller and is the entire problem when four
 * share one. So each host owns a promise chain: a caller joins the back of it,
 * waits its turn, takes its slot, and releases the next.
 *
 * ## Why it refuses rather than queueing without limit
 *
 * A caller twelve deep on a two-second host would wait twenty-four seconds
 * inside a request the orchestrator will abandon at eight. Waiting for a slot we
 * cannot use is the same self-inflicted outage the per-source limiter was
 * already fixed for. So the queue is bounded by what the caller can afford, and
 * anything beyond it is refused immediately and distinguishably — the caller can
 * then serve its last good answer instead of reporting a dead provider.
 */

/** How long a caller may politely wait for a host slot before refusing. */
export const MAX_HOST_WAIT_MS = 3_500

/**
 * Hosts that throttle a keyless caller hard enough to need a shared budget,
 * with the spacing we will keep to.
 *
 * Every entry is here because of something measured, not because of a published
 * number — providers rarely publish one that matches what they enforce for an
 * anonymous cloud address.
 *
 * A host absent from this table is unlimited by us. That is the right default:
 * a shared budget costs latency, and imposing one on a provider that has never
 * refused us would slow every sweep to protect nobody.
 */
export const HOST_INTERVALS: Record<string, number> = {
  /**
   * Four of our sources read this host. Keyless callers get roughly 5–15 calls
   * a minute per address and a cloud address is treated less generously than a
   * home one. 2.5s spacing keeps a whole sweep's CoinGecko traffic inside about
   * 24 calls a minute at worst, and in practice the sweep makes four.
   */
  'api.coingecko.com': 2_500,
}

/** Thrown when a slot would take longer to reach than the caller can afford. */
export class HostBusyError extends Error {
  constructor(
    readonly host: string,
    readonly waitMs: number,
  ) {
    super(`host busy: "${host}" has no slot for another ${Math.ceil(waitMs / 1000)}s`)
    this.name = 'HostBusyError'
  }
}

interface HostState {
  /** Resolves when the caller currently holding the host releases it. */
  tail: Promise<void>
  /** How many callers are waiting, so a newcomer can price its own wait. */
  depth: number
  /** When the last request to this host actually went out. */
  lastAt: number
}

export interface BudgetClock {
  now(): number
  sleep(ms: number): Promise<void>
}

const realClock: BudgetClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
}

/**
 * The shared budget.
 *
 * One instance per engine. The clock is injectable so the queueing behaviour can
 * be tested without waiting real seconds — the concurrency is the whole point of
 * this module and an untestable queue is a queue nobody has checked.
 */
export class HostBudget {
  private readonly hosts = new Map<string, HostState>()

  constructor(
    private readonly intervals: Record<string, number> = HOST_INTERVALS,
    private readonly clock: BudgetClock = realClock,
    private readonly maxWaitMs: number = MAX_HOST_WAIT_MS,
  ) {}

  /** The spacing this host is held to, or 0 when it is not budgeted. */
  intervalFor(host: string): number {
    return this.intervals[host.toLowerCase()] ?? 0
  }

  /** How many callers are queued on a host right now. Diagnostics and tests. */
  depthOf(host: string): number {
    return this.hosts.get(host.toLowerCase())?.depth ?? 0
  }

  /**
   * Wait for this host's next slot.
   *
   * Resolves when the caller may make its request. Throws `HostBusyError`
   * without joining the queue when the wait would exceed what a caller can
   * afford — measured from the queue depth, because a caller cannot know how
   * long the ones ahead of it will take but does know how many there are.
   */
  async take(host: string): Promise<void> {
    const key = host.toLowerCase()
    const interval = this.intervalFor(key)
    if (interval <= 0) return

    const state = this.hosts.get(key) ?? {
      tail: Promise.resolve(),
      depth: 0,
      lastAt: 0,
    }
    this.hosts.set(key, state)

    /**
     * Priced before joining, not after. Joining and then discovering the wait
     * is unaffordable means the callers behind still have to wait for us to
     * give up, which spreads one caller's bad luck to everyone behind it.
     */
    const projected = state.depth * interval
    if (projected > this.maxWaitMs) {
      throw new HostBusyError(key, projected)
    }

    const prior = state.tail
    let release!: () => void
    const mine = new Promise<void>((resolve) => {
      release = resolve
    })
    state.tail = prior.then(() => mine)
    state.depth++

    try {
      await prior
      const wait = state.lastAt + interval - this.clock.now()
      if (wait > 0) await this.clock.sleep(wait)
      state.lastAt = this.clock.now()
    } finally {
      state.depth--
      // Release the next caller whatever happened to this one: a throw here
      // must not wedge the host for every source behind it.
      release()
    }
  }

  /** Forget every queue. Tests only — a live engine has one budget for its life. */
  reset(): void {
    this.hosts.clear()
  }
}
