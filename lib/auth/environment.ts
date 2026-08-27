/**
 * Which sign-in a visitor should be offered, decided at runtime.
 *
 * ## The problem with deciding this at build time
 *
 * `NEXT_PUBLIC_AUTH_MODE` chose the whole shell when the bundle was built: one
 * build for Pi Browser, another for the public web. That forces two
 * deployments, two URLs and two things to keep in step — and it is wrong on its
 * face, because the *same page* can be opened in either place. A Pi user who
 * follows a link from a desktop browser reaches a build that only offers Pi
 * sign-in, which they cannot complete there.
 *
 * The charter wants one product that is a Pi app **and** a public website. That
 * means one build, and the decision made where the visitor actually is.
 *
 * ## The signals, weakest to strongest
 *
 *  1. **User agent.** Pi Browser identifies itself. Instant, and available on
 *     the very first frame, so the correct form can be rendered without a
 *     flash of the wrong one.
 *  2. **The SDK bridge exists.** `window.Pi` is injected by Pi Browser. A
 *     stronger hint than the UA, and still only a hint: a page could define it.
 *  3. **The handshake completes.** `Pi.authenticate` resolving is proof, and it
 *     is the only one of the three that is. It is also the slowest, so it
 *     confirms rather than gates.
 *
 * ## This is a presentation decision, not a security boundary
 *
 * Stated plainly because it would be easy to mistake: a spoofed user agent gets
 * a visitor the Pi sign-in *form*, and nothing more. The form is worthless
 * without a Pi access token, and that token is verified server-side against
 * Pi's own API before any session exists. Nothing here decides who gets in —
 * only which door is shown first.
 */

export type Surface = 'pi-browser' | 'web'

export interface EnvironmentSignals {
  userAgent: string
  /**
   * Whether `window.Pi` is present.
   *
   * Weak evidence, and weaker since the app began loading the SDK itself — see
   * `confirmPiSurface` below. Kept for a host that injects the bridge first.
   */
  hasPiBridge: boolean
  /** A real `Pi.authenticate` handshake completed. Proof, not a guess. */
  confirmedPi?: boolean
}

/**
 * Pi Browser's marks in a user agent string.
 *
 * More than one because the token has changed across releases and a single
 * literal would silently stop matching after an update — the failure mode being
 * that every Pi user is quietly shown the email form instead.
 */
const PI_BROWSER_MARKS = ['pibrowser', 'pi browser', 'pinetwork', 'pi network']

export function looksLikePiBrowser(userAgent: string): boolean {
  const ua = userAgent.toLowerCase()
  return PI_BROWSER_MARKS.some((mark) => ua.includes(mark))
}

/**
 * Which surface this is, from what can be known immediately.
 *
 * Either signal alone is enough to show the Pi door. Requiring both would mean
 * a Pi Browser release that changes its user agent leaves the bridge present
 * and the door hidden — failing towards the wrong form for every Pi user at
 * once, which is the worse of the two errors.
 */
export function detectSurface(signals: EnvironmentSignals): Surface {
  if (signals.confirmedPi) return 'pi-browser'
  return signals.hasPiBridge || looksLikePiBrowser(signals.userAgent) ? 'pi-browser' : 'web'
}

/**
 * The pioneer whose Pi Browser does not say so, and the circle that trapped them.
 *
 * ## What was wrong
 *
 * Every signal above is a *guess made before anything is loaded*, and both
 * guesses can be false inside a real Pi Browser:
 *
 *  - The user agent mark is not guaranteed. Pi Browser is a Chromium shell and
 *    its agent string has looked like ordinary mobile Chrome in releases; the
 *    list above exists precisely because the token has changed before.
 *  - `window.Pi` is **injected by the SDK script, which the app loads itself**.
 *    Pi Browser does not put it there.
 *
 * So the two combined into a circle with no way in:
 *
 *     surface is pi-browser  ⟸ window.Pi exists
 *     window.Pi exists       ⟸ the app loaded the SDK
 *     the app loads the SDK  ⟸ surface is pi-browser
 *
 * A pioneer whose agent lacked the mark waited out the whole settle window for
 * a bridge nothing would ever inject, and was shown the email form inside Pi
 * Browser — the exact failure the mark list was written to avoid.
 *
 * ## What replaces it
 *
 * A capability, taken rather than guessed: load the SDK and *ask Pi who this
 * is*. `Pi.authenticate` returns a pioneer inside Pi Browser and settles no
 * other way anywhere else, so a successful handshake is proof no string can
 * give. `confirmPiSurface()` is called by whatever completes that handshake.
 *
 * Note what this makes untrue: once the app loads the SDK on the open web,
 * `window.Pi` exists there too, so `hasPiBridge` stops being evidence of
 * anything. It is kept only for a host that injects the bridge before we do,
 * and the confirmation above is what actually decides.
 */
let piConfirmed = false

/** Record that a real Pi handshake completed. Irreversible by design. */
export function confirmPiSurface(): void {
  if (piConfirmed) return
  piConfirmed = true
  for (const listener of surfaceListeners) listener()
}

export function piSurfaceConfirmed(): boolean {
  return piConfirmed
}

/** Test seam: forget the confirmation between cases. */
export function resetPiSurfaceConfirmation(): void {
  piConfirmed = false
}

const surfaceListeners = new Set<() => void>()

/** Read the signals from the browser. Returns `web` when there is no browser. */
export function detectSurfaceNow(): Surface {
  if (typeof window === 'undefined') return 'web'
  return detectSurface({
    userAgent: window.navigator?.userAgent ?? '',
    hasPiBridge: typeof (window as { Pi?: unknown }).Pi !== 'undefined',
    confirmedPi: piSurfaceConfirmed(),
  })
}

/**
 * ## Reading the surface from React without breaking hydration
 *
 * `detectSurfaceNow()` cannot simply be called during render, and the reason is
 * worth stating because it cost a real bug:
 *
 * The server has no browser, so it answers `web` and emits the web shell's HTML.
 * A Pi Browser client answers `pi-browser` and renders the Pi shell. React then
 * finds two different trees where it expected one and throws **error #418** —
 * a hydration mismatch — after which it discards the server HTML and re-renders
 * the whole page on the client. That is not cosmetic: it is the entire document
 * re-created on the slowest device we ship to, on every load, for exactly the
 * users the Pi build exists for.
 *
 * So the surface is exposed as an external store instead. React hydrates using
 * `surfaceOnServer()` — the same `web` the server rendered, so the trees agree —
 * and switches to the real value immediately afterwards, as an ordinary update.
 *
 * The store also **keeps watching for a while**, which the plain function could
 * not do. `window.Pi` is injected by a script, so on a slow connection the
 * bridge can appear a second or two after first paint. A one-shot read taken
 * before that arrives is wrong for the rest of the session; a store notices and
 * corrects itself.
 */

/** How long to keep watching for the bridge after mount. */
export const SURFACE_SETTLE_MS = 5_000
/** How often to look while watching. */
export const SURFACE_POLL_MS = 250

/**
 * What the server rendered, and therefore what the client must hydrate with.
 *
 * There is no browser on the server, so this is not a guess — it is the only
 * answer the server can give, and hard-coding it here keeps the two sides
 * provably in step rather than coincidentally in step.
 */
export function surfaceOnServer(): Surface {
  return 'web'
}

/** The live value. Cheap enough to call on every render. */
export function surfaceSnapshot(): Surface {
  return detectSurfaceNow()
}

/**
 * Watch for the surface changing, for as long as it can still change.
 *
 * Polling rather than an event, because there is no event: a script assigning
 * `window.Pi` fires nothing. The watch stops as soon as the answer becomes
 * `pi-browser` (it never goes back) or once the settle window closes, so a page
 * left open for hours is not polling in the background.
 */
export function subscribeToSurface(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  let last = detectSurfaceNow()
  if (last === 'pi-browser') return () => {}

  /**
   * The confirmation can arrive after the settle window closes — a Pi
   * handshake on a slow phone is not a 5-second affair — so listeners are
   * notified directly by `confirmPiSurface` rather than only by the poll.
   */
  surfaceListeners.add(onChange)
  const started = Date.now()
  const timer = setInterval(() => {
    const now = detectSurfaceNow()
    if (now !== last) {
      last = now
      onChange()
    }
    if (now === 'pi-browser' || Date.now() - started >= SURFACE_SETTLE_MS) {
      clearInterval(timer)
    }
  }, SURFACE_POLL_MS)

  return () => {
    surfaceListeners.delete(onChange)
    clearInterval(timer)
  }
}

export interface SignInOffer {
  /** Sign in with a Pi Network username, through the Pi SDK. */
  pi: boolean
  /** Sign in or register with an email address and a passphrase. */
  email: boolean
  /** The one-line explanation shown under the form. Never empty. */
  note: string
}

/**
 * What to offer, and what to say about it.
 *
 * The two surfaces are deliberately exclusive rather than "both, with one
 * highlighted":
 *
 *  - **Inside Pi Browser, Pi only.** The pioneer already has a verified
 *    identity with real KYC behind it. Offering an email form beside it invites
 *    them to create a second, weaker account for the same person — and then
 *    neither account is the one their payments are attached to.
 *  - **Outside it, email only.** Pi sign-in cannot complete outside Pi Browser:
 *    the SDK loads and `Pi.authenticate` never settles. Showing a button that
 *    hangs is worse than not showing it, and that hang is a bug this codebase
 *    has already had once.
 *
 * The exception, and it is important: a Pi user who has set a passphrase can
 * sign in **with their Pi username** on the web form. So the web surface is not
 * "email accounts only" — it is "the form that works here", and the note says
 * so rather than leaving a pioneer to assume they are locked out.
 */
export function offerFor(surface: Surface): SignInOffer {
  if (surface === 'pi-browser') {
    return {
      pi: true,
      email: false,
      note: 'Signing in with your Pi Network username. Nothing else to fill in — Pi has already verified who you are.',
    }
  }
  return {
    pi: false,
    email: true,
    note: 'Pi sign-in only completes inside Pi Browser. If you have a Pi account here, link a passphrase from inside Pi Browser once and you can then sign in with your Pi username anywhere.',
  }
}
