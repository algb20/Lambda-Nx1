/**
 * Pi client-side auth helpers — the pure, testable half of the Pi sign-in flow.
 *
 * The Pi SDK loads in any browser, but `Pi.authenticate()` only resolves inside
 * Pi Browser: elsewhere there is no bridge to answer it, so the promise never
 * settles — neither resolving nor rejecting. A bare `await` on it therefore
 * hangs forever, which is what a full-screen spinner with no exit really is.
 *
 * Every step is wrapped in a timeout so "no answer" becomes a real, classified
 * outcome the UI can act on, instead of an eternal wait.
 */

/** How the Pi sign-in attempt ended. */
export type PiAuthStatus =
  | 'connecting'
  /** Signed in through Pi Browser. */
  | 'authenticated'
  /** No Pi bridge answered — almost always "not running inside Pi Browser". */
  | 'unavailable'
  /** Pi answered, but something else went wrong (network, our login call). */
  | 'error'

export class PiTimeoutError extends Error {
  constructor(step: string, ms: number) {
    super(`${step} timed out after ${Math.round(ms / 1000)}s`)
    this.name = 'PiTimeoutError'
  }
}

/**
 * Timeouts per step. Generous enough for a slow phone, short enough to not feel stuck.
 *
 * `grace` is different in kind: it is not a deadline for Pi, it is how long the
 * shell is willing to hide the product while the handshake runs. Inside Pi
 * Browser the handshake normally beats it, so the user never sees a flash of
 * signed-out UI; everywhere else the app appears in well under a second rather
 * than after a wait for an answer that is never coming. The handshake keeps
 * running in the background either way and signs the user in whenever it lands.
 */
export const PI_TIMEOUTS = {
  sdk: 10_000,
  init: 8_000,
  authenticate: 15_000,
  grace: 2_500,
} as const

/**
 * Reject with a `PiTimeoutError` if the promise has not settled in time.
 *
 * The timer is always cleared, including on the success path — an uncleared
 * timer keeps a Node/JSDOM process alive and would fire into a unmounted tree.
 */
type TimerHandle = ReturnType<typeof setTimeout>

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  step: string,
  schedule: (fn: () => void, ms: number) => TimerHandle = setTimeout,
  cancel: (handle: TimerHandle) => void = clearTimeout,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = schedule(() => reject(new PiTimeoutError(step, ms)), ms)
    promise.then(
      (value) => {
        cancel(timer)
        resolve(value)
      },
      (err) => {
        cancel(timer)
        reject(err)
      },
    )
  })
}

/**
 * Which outcome a failure represents.
 *
 * A timeout is not an error in the ordinary sense — it is the normal result of
 * opening the app in a regular browser, and the user deserves to be told that
 * rather than shown a failure. Anything else is a genuine error.
 */
export function classifyPiFailure(err: unknown): Extract<PiAuthStatus, 'unavailable' | 'error'> {
  return err instanceof PiTimeoutError ? 'unavailable' : 'error'
}

/** The message shown for each outcome. Plain, and never blames the user. */
export function piStatusMessage(status: PiAuthStatus, detail?: string): string {
  switch (status) {
    case 'connecting':
      return 'Connecting to Pi Network…'
    case 'authenticated':
      return 'Signed in with Pi Network'
    case 'unavailable':
      return 'Pi sign-in is only available inside Pi Browser. You can keep using Lambda NX — the intelligence gateways are open without an account.'
    case 'error':
      return detail
        ? `Pi sign-in failed: ${detail}. You can keep browsing without an account.`
        : 'Pi sign-in failed. You can keep browsing without an account.'
  }
}

/**
 * Whether the app shell should still hide the product.
 *
 * Only an in-flight handshake inside its grace window blocks. Once the grace
 * window closes the app renders even though Pi has not answered — the free
 * gateways never needed an account (charter §1), so making every visitor wait
 * out a handshake that only Pi Browser can complete was never justified.
 *
 * Every settled outcome renders immediately, including failure.
 */
export function shouldBlockApp(status: PiAuthStatus, graceElapsed = false): boolean {
  return status === 'connecting' && !graceElapsed
}
