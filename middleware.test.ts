import { describe, it, expect } from 'vitest'
import { config } from './middleware'
import { ALL_MODES } from './lib/gateways'

/**
 * The matcher is the whole safety of the rate limiter: a pattern that misses a
 * route leaves it open, and a pattern that catches too much throttles the cron
 * scheduler or the health check. Neither failure raises an error — the first is
 * invisible until a provider bans us, the second until the scheduled jobs
 * quietly stop.
 *
 * Next reads `matcher` at build time from a literal, so it cannot import a
 * shared constant. This re-parses the same string and asserts what it covers.
 */
const matcher = new RegExp(`^${config.matcher[0]}$`)

describe('the rate-limit matcher', () => {
  it('covers every intelligence gateway, including ones added later', () => {
    for (const mode of ALL_MODES) {
      expect(matcher.test(`/api/intelligence/${mode}`), mode).toBe(true)
    }
  })

  it('covers the other fan-out routes that spend provider quota', () => {
    for (const path of [
      '/api/world',
      '/api/chain',
      '/api/trending',
      '/api/analyst',
      '/api/export/share',
      '/api/radar/run',
      '/api/translate',
    ]) {
      expect(matcher.test(path), path).toBe(true)
    }
  })

  it('exempts the scheduler, whose calls all share one outbound address', () => {
    // Netlify's scheduled function and Vercel Cron both call from the platform's
    // own IP. Throttled together, the jobs would starve each other.
    for (const job of ['publish', 'radar', 'radar-monitors', 'radar-watch']) {
      expect(matcher.test(`/api/cron/${job}`), job).toBe(false)
    }
  })

  it('exempts auth, which needs its own tighter policy rather than this loose one', () => {
    for (const path of ['/api/auth/login', '/api/auth/register', '/api/auth/me', '/api/auth/pi/claim']) {
      expect(matcher.test(path), path).toBe(false)
    }
  })

  it('exempts the visit beacon and the health check', () => {
    expect(matcher.test('/api/visit')).toBe(false)
    expect(matcher.test('/api/health')).toBe(false)
  })

  it('leaves pages alone — this is an API gate, not a site gate', () => {
    for (const path of ['/', '/privacy', '/terms', '/admin', '/p/some-post']) {
      expect(matcher.test(path), path).toBe(false)
    }
  })

  it('does not let a path smuggle itself past an exemption prefix', () => {
    // `/api/cronx` is not the cron route and must not inherit its exemption.
    expect(matcher.test('/api/cronx')).toBe(true)
    expect(matcher.test('/api/authorize')).toBe(true)
  })
})
