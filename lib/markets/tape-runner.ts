/**
 * The tape's connection state machine, with no React and no global socket in it.
 *
 * ## Why this is not inside the hook
 *
 * It was, and the bug it hid is the reason it is not. Watched in a real browser
 * against a blocked venue, the tape opened **one** socket in thirty seconds and
 * then sat there: no second attempt at the first venue, no fallback to the
 * second, and a strip that said "Opening the tape…" the entire time. Reading
 * the code did not find it. Nothing could, because the failure needed a socket
 * that fails, a clock that advances, and a way to count what happened — none of
 * which a `useEffect` full of closures will give a test.
 *
 * So the machine takes its socket from a factory and its clock from the caller.
 * In the browser those are `WebSocket` and `setTimeout`. In a test they are
 * objects that fail on command and a timer that jumps, and the retry sequence
 * becomes an assertion instead of a hope.
 */
import {
  RETRIES_PER_PROVIDER,
  STALE_TICK_MS,
  TAPE_PROVIDERS,
  backoffMs,
  type TapeProvider,
  type TapeState,
  type Tick,
} from './tape'

/** The slice of `WebSocket` this machine uses. */
export interface TapeSocket {
  send(data: string): void
  close(): void
  onopen: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onerror: (() => void) | null
  onclose: (() => void) | null
}

export interface RunnerHost {
  /** Open a socket, or throw. A throw is a failure like any other. */
  open(url: string): TapeSocket
  setTimer(fn: () => void, ms: number): unknown
  clearTimer(handle: unknown): void
  now(): number
}

export interface RunnerSnapshot {
  ticks: Map<string, Tick>
  venue: string | null
  state: TapeState
  detail: string | null
  oldestAgeMs: number | null
  fresh: boolean
}

export interface RunnerOptions {
  symbols: string[]
  host: RunnerHost
  providers?: TapeProvider[]
  onChange: (snapshot: RunnerSnapshot) => void
}

/**
 * Drive one tape.
 *
 * `start()` opens the first provider. `stop()` releases everything and is safe
 * to call twice — a component unmounting mid-reconnect is the normal case, not
 * the exceptional one.
 */
export class TapeRunner {
  private readonly symbols: string[]
  private readonly host: RunnerHost
  private readonly providers: TapeProvider[]
  private readonly onChange: (snapshot: RunnerSnapshot) => void

  private socket: TapeSocket | null = null
  private providerIndex = 0
  private attempt = 0
  private retryHandle: unknown = null
  private stopped = false
  private readonly ticks = new Map<string, Tick>()
  private state: TapeState = 'idle'
  private detail: string | null = null

  constructor(options: RunnerOptions) {
    this.symbols = options.symbols
    this.host = options.host
    this.providers = options.providers ?? TAPE_PROVIDERS
    this.onChange = options.onChange
  }

  /** What the caller renders. A fresh Map each time, so React sees the change. */
  snapshot(): RunnerSnapshot {
    let oldest: number | null = null
    const now = this.host.now()
    for (const tick of this.ticks.values()) {
      const age = now - tick.receivedAt
      if (oldest === null || age > oldest) oldest = age
    }
    const provider = this.providers[this.providerIndex]
    return {
      ticks: new Map(this.ticks),
      venue: this.state === 'failed' ? null : (provider?.label ?? null),
      state: this.state,
      detail: this.detail,
      oldestAgeMs: oldest,
      // Both halves matter: an open socket with a stale price, and a fresh
      // price on a dead socket, are each a way for the strip to mislead.
      fresh: this.state === 'live' && oldest !== null && oldest <= STALE_TICK_MS,
    }
  }

  /** Publish the current snapshot — called on every state change and every beat. */
  publish(): void {
    if (this.stopped) return
    this.onChange(this.snapshot())
  }

  start(): void {
    if (this.stopped) return
    this.providerIndex = 0
    this.attempt = 0
    this.open()
  }

  stop(): void {
    this.stopped = true
    this.clearRetry()
    this.release()
  }

  /** Close the socket without treating it as a failure — for a hidden tab. */
  pause(): void {
    this.clearRetry()
    this.release()
    this.state = 'idle'
    this.publish()
  }

  /** Reopen from the first provider after a pause. */
  resume(): void {
    if (this.stopped || this.socket) return
    this.start()
  }

  private clearRetry(): void {
    if (this.retryHandle !== null) {
      this.host.clearTimer(this.retryHandle)
      this.retryHandle = null
    }
  }

  /**
   * Detach and close the current socket.
   *
   * Every handler is nulled **before** `close()`, because closing fires
   * `onclose`, and an `onclose` that still points at `fail` turns one failure
   * into two — which advances the provider twice and skips a venue.
   */
  private release(): void {
    const socket = this.socket
    this.socket = null
    if (!socket) return
    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null
    try {
      socket.close()
    } catch {
      /* already gone */
    }
  }

  private open(): void {
    if (this.stopped) return
    this.retryHandle = null
    const provider = this.providers[this.providerIndex]
    if (!provider) {
      this.state = 'failed'
      this.publish()
      return
    }

    this.state = this.attempt === 0 && this.providerIndex === 0 ? 'connecting' : 'reconnecting'
    this.publish()

    let socket: TapeSocket
    try {
      socket = this.host.open(provider.url)
    } catch (err) {
      // A blocked origin throws synchronously instead of firing `onerror`.
      this.fail(err instanceof Error ? err.message : 'Could not open the socket')
      return
    }
    this.socket = socket

    socket.onopen = () => {
      if (this.socket !== socket) return
      this.attempt = 0
      try {
        socket.send(provider.subscribe(this.symbols))
      } catch {
        this.fail('Subscribe failed')
        return
      }
      this.state = 'live'
      this.detail = null
      this.publish()
    }

    socket.onmessage = (event) => {
      if (this.socket !== socket) return
      try {
        for (const tick of provider.read(String(event.data))) {
          if (!this.symbols.includes(tick.symbol)) continue
          /**
           * The runner stamps the receipt time, not the parser.
           *
           * One clock has to own "when did this arrive", and it must be the
           * same clock that later measures the age — otherwise staleness is the
           * difference between two different clocks, which is not a duration.
           * A test caught this: the parser used the real `Date.now()` while the
           * harness advanced a fake one, and a thirty-second-old price measured
           * as fresh by about fifty-six years.
           */
          this.ticks.set(tick.symbol, { ...tick, receivedAt: this.host.now() })
        }
      } catch {
        /* one unreadable frame is not a reason to lose the tape */
      }
    }

    socket.onerror = () => {
      if (this.socket === socket) this.fail('Socket error')
    }
    socket.onclose = () => {
      if (this.socket === socket) this.fail('Socket closed')
    }
  }

  private fail(detail: string): void {
    if (this.stopped) return
    this.release()
    this.detail = detail
    this.attempt++
    if (this.attempt >= RETRIES_PER_PROVIDER) {
      this.attempt = 0
      this.providerIndex++
    }
    if (this.providerIndex >= this.providers.length) {
      this.state = 'failed'
      this.publish()
      return
    }
    this.state = 'reconnecting'
    this.publish()
    this.retryHandle = this.host.setTimer(() => this.open(), backoffMs(this.attempt))
  }
}
