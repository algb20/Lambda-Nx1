/**
 * Ask Pi who this is, instead of guessing from a user-agent string.
 *
 * ## Why anything has to load the SDK unconditionally
 *
 * `environment.ts` decided the surface from two signals taken before anything
 * loaded, and both can be false inside a real Pi Browser — the agent mark is
 * not guaranteed, and `window.Pi` is injected by the SDK **that the app itself
 * loads**. So the app only loaded the SDK when it already believed it was in Pi
 * Browser, and it only believed that when the SDK had loaded. A pioneer whose
 * agent lacked the mark could never get in, and was shown the email form inside
 * Pi Browser.
 *
 * This is the one thing outside the circle: load the script, ask, and let the
 * answer decide. Inside Pi Browser `Pi.authenticate` returns a pioneer; nowhere
 * else does it return anything at all.
 *
 * ## What it costs the public web, and why that is acceptable
 *
 * One script from `sdk.minepi.com` — already the only script host in the
 * Content-Security-Policy, so nothing widens — fetched **after** first paint,
 * on an idle callback, and bounded. A visitor who is not in Pi Browser waits
 * for nothing: the page is already interactive, the probe fails quietly inside
 * its timeout, and no interface changes.
 *
 * It runs **once per page load, never on a schedule**, and it is skipped
 * entirely when the surface is already known — so the ordinary Pi Browser
 * visitor, whose agent does carry the mark, pays nothing for it either.
 */
import { PI_TIMEOUTS } from '@/lib/auth/pi-client'
import { PI_NETWORK_CONFIG } from '@/lib/system-config'
import { confirmPiSurface, detectSurfaceNow, piSurfaceConfirmed } from './environment'

/** How long to wait for the whole ask before giving up on it. */
export const PROBE_BUDGET_MS = 6_000

/** Runs at most once per page load, whatever calls it. */
let started = false

interface PiBridge {
  init(options: { version: string; sandbox?: boolean }): Promise<void> | void
  authenticate(
    scopes: string[],
    onIncompletePaymentFound: (payment: unknown) => void,
  ): Promise<{ user?: { uid?: string; username?: string } } | undefined>
}

function bridge(): PiBridge | undefined {
  return (window as unknown as { Pi?: PiBridge }).Pi
}

function loadScript(src: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      // Another loader is already in flight; wait on the same tag rather than
      // adding a second one and racing it.
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Pi SDK failed to load')), { once: true })
      return
    }
    const tag = document.createElement('script')
    tag.src = src
    tag.async = true
    tag.onload = () => resolve()
    tag.onerror = () => reject(new Error('Pi SDK failed to load'))
    document.head.appendChild(tag)
    setTimeout(() => reject(new Error('Pi SDK load timed out')), timeoutMs)
  })
}

/**
 * Try the handshake. Resolves `true` only when Pi named a real pioneer.
 *
 * Every failure is silent and expected: outside Pi Browser this is what
 * *should* happen, and a console full of errors on the public web would train
 * everyone to ignore the console.
 */
export async function probePiSurface(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  if (piSurfaceConfirmed()) return true
  if (started) return false
  started = true

  const deadline = new Promise<false>((resolve) => setTimeout(() => resolve(false), PROBE_BUDGET_MS))

  const ask = (async () => {
    try {
      if (!bridge()) await loadScript(PI_NETWORK_CONFIG.SDK_URL, PI_TIMEOUTS.sdk)
      const pi = bridge()
      if (!pi) return false
      await pi.init({ version: '2.0', sandbox: PI_NETWORK_CONFIG.SANDBOX })
      /**
       * `username` only. The probe asks the smallest question that identifies
       * the pioneer — requesting `payments` here would put a payments consent
       * in front of someone who has only opened the page.
       */
      const result = await pi.authenticate(['username'], () => {})
      if (!result?.user?.uid) return false
      confirmPiSurface()
      return true
    } catch {
      return false
    }
  })()

  return Promise.race([ask, deadline])
}

/**
 * Start the probe once the page has stopped being busy.
 *
 * `requestIdleCallback` where it exists, a timeout where it does not (Safari,
 * and every iOS browser, which is most of Pi's audience). Either way it is
 * after first paint: the point of the probe is that nobody waits for it.
 */
export function schedulePiProbe(): void {
  if (typeof window === 'undefined') return
  // Already known to be Pi Browser by its agent — nothing to find out.
  if (detectSurfaceNow() === 'pi-browser') return

  const run = () => void probePiSurface()
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
    .requestIdleCallback
  if (typeof idle === 'function') idle(run, { timeout: 3_000 })
  else window.setTimeout(run, 1_200)
}
