import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SURFACE_POLL_MS,
  SURFACE_SETTLE_MS,
  detectSurface,
  looksLikePiBrowser,
  offerFor,
  subscribeToSurface,
  surfaceOnServer,
  surfaceSnapshot,
} from './environment'

const CHROME =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const PI = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 PiBrowser/2.4.1 Mobile Safari/537.36'

describe('recognising Pi Browser', () => {
  it('recognises it from its user agent', () => {
    expect(looksLikePiBrowser(PI)).toBe(true)
  })

  it('does not mistake an ordinary browser for it', () => {
    expect(looksLikePiBrowser(CHROME)).toBe(false)
    expect(looksLikePiBrowser('')).toBe(false)
  })

  /**
   * More than one mark on purpose: the token has changed across releases, and a
   * single literal would silently stop matching after an update — failing
   * towards the email form for every Pi user at once.
   */
  it('matches more than one form of the token', () => {
    expect(looksLikePiBrowser('... PiNetwork/1.0 ...')).toBe(true)
    expect(looksLikePiBrowser('... Pi Browser ...')).toBe(true)
  })

  it('ignores case', () => {
    expect(looksLikePiBrowser('... PIBROWSER/2 ...')).toBe(true)
  })
})

describe('deciding the surface', () => {
  it('calls it Pi Browser when the bridge is there', () => {
    expect(detectSurface({ userAgent: CHROME, hasPiBridge: true })).toBe('pi-browser')
  })

  /**
   * Either signal alone is enough. Requiring both would mean a Pi Browser
   * release that changes its user agent hides the Pi door from every Pi user —
   * the worse of the two possible errors.
   */
  it('calls it Pi Browser on the user agent alone', () => {
    expect(detectSurface({ userAgent: PI, hasPiBridge: false })).toBe('pi-browser')
  })

  it('calls anything else the web', () => {
    expect(detectSurface({ userAgent: CHROME, hasPiBridge: false })).toBe('web')
    expect(detectSurface({ userAgent: '', hasPiBridge: false })).toBe('web')
  })
})

/**
 * The store exists for one reason: calling the detector during render made the
 * server and the client disagree, which is React error #418 — the hydration is
 * thrown away and the whole document re-rendered on the client. These tests pin
 * the two properties that prevent it, plus the late-bridge case a one-shot read
 * could never handle.
 */
describe('reading the surface without breaking hydration', () => {
  const realWindow = (globalThis as { window?: unknown }).window

  afterEach(() => {
    if (realWindow === undefined) delete (globalThis as { window?: unknown }).window
    else (globalThis as { window?: unknown }).window = realWindow
    vi.useRealTimers()
  })

  function fakeWindow(userAgent: string, pi?: unknown) {
    const win: Record<string, unknown> = { navigator: { userAgent } }
    if (pi !== undefined) win.Pi = pi
    ;(globalThis as { window?: unknown }).window = win
    return win
  }

  /**
   * The whole fix in one assertion: whatever the client turns out to be, the
   * value React hydrates with is the value the server rendered.
   */
  it('hydrates with what the server could actually have rendered', () => {
    expect(surfaceOnServer()).toBe('web')
    fakeWindow(PI)
    expect(surfaceOnServer()).toBe('web')
    expect(surfaceSnapshot()).toBe('pi-browser')
  })

  it('reports the web when there is no browser at all', () => {
    delete (globalThis as { window?: unknown }).window
    expect(surfaceSnapshot()).toBe('web')
  })

  /**
   * `window.Pi` is injected by a script, so on a slow connection it can arrive
   * after first paint. A single read taken before that would be wrong for the
   * rest of the session.
   */
  it('notices the bridge arriving after first paint', () => {
    vi.useFakeTimers()
    const win = fakeWindow(CHROME)
    let changes = 0
    const stop = subscribeToSurface(() => changes++)

    vi.advanceTimersByTime(SURFACE_POLL_MS * 3)
    expect(changes).toBe(0)
    expect(surfaceSnapshot()).toBe('web')

    win.Pi = { authenticate: () => {} }
    vi.advanceTimersByTime(SURFACE_POLL_MS)
    expect(changes).toBe(1)
    expect(surfaceSnapshot()).toBe('pi-browser')
    stop()
  })

  /** Once it is Pi Browser it stays Pi Browser, so the watch has nothing to do. */
  it('stops watching once the answer can no longer change', () => {
    vi.useFakeTimers()
    const win = fakeWindow(CHROME)
    let changes = 0
    subscribeToSurface(() => changes++)
    win.Pi = {}
    vi.advanceTimersByTime(SURFACE_POLL_MS)
    expect(changes).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  /** A page left open for hours must not still be polling in the background. */
  it('gives up after the settle window instead of polling forever', () => {
    vi.useFakeTimers()
    fakeWindow(CHROME)
    subscribeToSurface(() => {})
    vi.advanceTimersByTime(SURFACE_SETTLE_MS + SURFACE_POLL_MS)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('never starts a timer on the server', () => {
    vi.useFakeTimers()
    delete (globalThis as { window?: unknown }).window
    const stop = subscribeToSurface(() => {})
    expect(vi.getTimerCount()).toBe(0)
    expect(() => stop()).not.toThrow()
  })
})

describe('what each surface is offered', () => {
  /**
   * Exclusive, not "both with one highlighted". A pioneer offered an email form
   * beside Pi sign-in may create a second, weaker account for the same person —
   * and then neither account is the one their payments are attached to.
   */
  it('offers a pioneer Pi sign-in and nothing else', () => {
    const offer = offerFor('pi-browser')
    expect(offer.pi).toBe(true)
    expect(offer.email).toBe(false)
  })

  /**
   * Outside Pi Browser `Pi.authenticate` never settles, so a Pi button would
   * hang forever — a bug this codebase has already had once.
   */
  it('offers the web the form that can actually complete there', () => {
    const offer = offerFor('web')
    expect(offer.pi).toBe(false)
    expect(offer.email).toBe(true)
  })

  it('always explains itself, and never leaves a pioneer thinking they are locked out', () => {
    expect(offerFor('pi-browser').note.length).toBeGreaterThan(30)
    const web = offerFor('web').note
    expect(web.length).toBeGreaterThan(30)
    // The web note must tell a Pi user the route that does work for them.
    expect(web).toContain('Pi username')
  })
})
