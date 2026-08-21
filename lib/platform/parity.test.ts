import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { detectSurface } from '../auth/environment'
import { railForRequest, railForSurface } from '../payments/rail'

/**
 * One codebase, two products — held to it by tests rather than by intention.
 *
 * Lambda NX ships as a Pi Browser app *and* as a standalone `.com` site from a
 * single build. That is a promise with a specific failure mode: a capability
 * that quietly works on only one of them. It is never noticed at the time,
 * because whoever built it was looking at the surface it does work on — and it
 * surfaces at launch, on the surface nobody tested.
 *
 * So the rule is: **the surface is a runtime fact about the visitor, never a
 * build-time fact about the deployment.** Every test here is one way that rule
 * can be broken.
 */

const PI_UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 PiBrowser/2.4.1 Mobile Safari/537.36'
const WEB_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127 Safari/537.36'

function headers(userAgent: string): Headers {
  return new Headers({ 'user-agent': userAgent })
}

describe('the payer decides the rail, not the deployment', () => {
  /**
   * The bug this closes. `PAYMENT_PROVIDER` is fixed at deploy time, so a build
   * set to `pi` could not take money from the website and a build set to
   * `standard` could not take π inside Pi Browser. One build has to do both, or
   * "launch the app and the site together" is not something we can honour.
   */
  it('takes π inside Pi Browser and a card everywhere else, from one build', () => {
    const saved = process.env.PAYMENT_PROVIDER
    delete process.env.PAYMENT_PROVIDER
    try {
      expect(railForRequest(headers(PI_UA))).toBe('pi')
      expect(railForRequest(headers(WEB_UA))).toBe('standard')
    } finally {
      if (saved !== undefined) process.env.PAYMENT_PROVIDER = saved
    }
  })

  it('still obeys an operator who deliberately pins one rail', () => {
    const saved = process.env.PAYMENT_PROVIDER
    try {
      process.env.PAYMENT_PROVIDER = 'standard'
      expect(railForRequest(headers(PI_UA))).toBe('standard')
      process.env.PAYMENT_PROVIDER = 'pi'
      expect(railForRequest(headers(WEB_UA))).toBe('pi')
    } finally {
      if (saved === undefined) delete process.env.PAYMENT_PROVIDER
      else process.env.PAYMENT_PROVIDER = saved
    }
  })

  /**
   * A typo in a deploy variable must not take payments offline for everyone.
   * The surface-derived answer is always a working one, so an unreadable
   * setting falls back to it rather than throwing.
   */
  it('ignores an unrecognised setting rather than refusing to sell anything', () => {
    const saved = process.env.PAYMENT_PROVIDER
    process.env.PAYMENT_PROVIDER = 'stripee'
    try {
      expect(railForRequest(headers(PI_UA))).toBe('pi')
      expect(railForRequest(headers(WEB_UA))).toBe('standard')
    } finally {
      if (saved === undefined) delete process.env.PAYMENT_PROVIDER
      else process.env.PAYMENT_PROVIDER = saved
    }
  })

  it('never leaves a surface without a rail', () => {
    for (const surface of ['pi-browser', 'web'] as const) {
      expect(railForSurface(surface)).toBeTruthy()
    }
  })

  /**
   * A request with no user agent at all — a health check, a script, a stripped
   * proxy — must still get a rail that works rather than a crash.
   */
  it('serves a request with no user agent at all', () => {
    const saved = process.env.PAYMENT_PROVIDER
    delete process.env.PAYMENT_PROVIDER
    try {
      expect(railForRequest(new Headers())).toBe('standard')
    } finally {
      if (saved !== undefined) process.env.PAYMENT_PROVIDER = saved
    }
  })
})

describe('the surface is read where the visitor is', () => {
  it('recognises Pi Browser by either signal alone', () => {
    expect(detectSurface({ userAgent: PI_UA, hasPiBridge: false })).toBe('pi-browser')
    expect(detectSurface({ userAgent: WEB_UA, hasPiBridge: true })).toBe('pi-browser')
  })

  it('does not mistake an ordinary browser for the app', () => {
    expect(detectSurface({ userAgent: WEB_UA, hasPiBridge: false })).toBe('web')
  })
})

/**
 * The source-level rules. These are the ones that catch a *future* change
 * breaking parity, which is the whole point — the runtime tests above only
 * cover the code that exists today.
 */
describe('no page is built for one surface only', () => {
  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
      const path = join(dir, name)
      if (statSync(path).isDirectory()) sourceFiles(path, out)
      else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.test.tsx')) {
        out.push(path)
      }
    }
    return out
  }

  const FILES = [...sourceFiles('app'), ...sourceFiles('components'), ...sourceFiles('lib')]

  /**
   * `NEXT_PUBLIC_AUTH_MODE` is a build-time switch: whatever reads it is frozen
   * into the bundle, so one build serves Pi Browser and a *different* build
   * serves the web. That is precisely the two-deployments arrangement this
   * project does not have and must not grow back into.
   *
   * One reader is allowed — the shell, where an operator's explicit override is
   * applied on top of the runtime answer, in one auditable place.
   */
  const MAY_READ_AUTH_MODE = ['components/app-wrapper.tsx']

  it('reads the build-time auth switch in exactly one place', () => {
    const readers = FILES.filter(
      (file) =>
        readFileSync(file, 'utf8').includes('process.env.NEXT_PUBLIC_AUTH_MODE') &&
        !MAY_READ_AUTH_MODE.some((allowed) => file.endsWith(allowed)),
    )
    expect(readers, `these read a build-time surface switch: ${readers.join(', ')}`).toEqual([])
  })

  /**
   * The Pi SDK exists only inside Pi Browser. A component that touches
   * `window.Pi` directly is a component that throws — or silently does nothing —
   * on the website, and the only way to keep that from happening once per
   * feature is to keep the bridge behind the adapter that already handles its
   * absence.
   */
  const MAY_TOUCH_PI_BRIDGE = [
    'lib/auth/environment.ts',
    'lib/auth/pi-sdk.ts',
    'lib/auth/pi.ts',
    'components/pi-auth-provider.tsx',
  ]

  it('keeps the Pi bridge behind its adapter', () => {
    const touchers = FILES.filter((file) => {
      if (MAY_TOUCH_PI_BRIDGE.some((allowed) => file.endsWith(allowed))) return false
      // Comments explain the rule and have to be able to name the bridge;
      // only code can break it.
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '')
      return /window\s*(\.|\[['"])Pi\b/.test(code)
    })
    expect(touchers, `these reach for window.Pi outside the adapter: ${touchers.join(', ')}`).toEqual([])
  })

  /**
   * A route that serves a payer must choose the rail from that payer. Reaching
   * for the deployment-wide default inside a request handler is how the rail
   * got frozen in the first place.
   */
  it('never picks the payment rail from the deployment inside a request handler', () => {
    const routes = FILES.filter((file) => /^app[\\/].*route\.tsx?$/.test(file))
    const offenders = routes.filter((file) => readFileSync(file, 'utf8').includes('getPaymentProvider('))
    expect(offenders, `these choose a rail without looking at the payer: ${offenders.join(', ')}`).toEqual([])
  })
})
