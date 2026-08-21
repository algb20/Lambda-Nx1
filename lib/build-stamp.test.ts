import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The build stamp, and the hydration bug it exists to prevent.
 *
 * `next.config.mjs` used to set `NEXT_PUBLIC_BUILT_AT: new Date().toISOString()`.
 * That file is evaluated once per *process*, so `next start` — and every
 * serverless cold start — ran the clock again: the browser bundle carried the
 * build's time and the server carried whenever it happened to boot.
 *
 * Two failures from one line. The stamp reported when the server started, which
 * is the opposite of the question it exists to answer. And the two sides of
 * every page disagreed on a piece of text, which is React error #418 — after
 * which React discards the server HTML and re-renders the entire document on
 * the client. Nothing looks wrong afterwards. That is precisely why it survived.
 */

vi.mock('./build-stamp', () => ({
  BUILT_AT: '2026-08-08T14:00:00.000Z',
  BUILT_FROM: 'abc1234567890abcdef1234567890abcdef12345',
}))

const CLEARED = [
  'NEXT_PUBLIC_COMMIT_SHA',
  'NEXT_PUBLIC_BUILT_AT',
  'COMMIT_REF',
  'VERCEL_GIT_COMMIT_SHA',
  'GITHUB_SHA',
] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of CLEARED) {
    saved[k] = process.env[k]
    delete process.env[k]
  }
})
afterEach(() => {
  for (const k of CLEARED) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('the stamp compiled into the build is what the app reports', () => {
  it('identifies the build with no host variables at all', async () => {
    const { getBuildInfo } = await import('./build-info')
    const info = getBuildInfo()
    expect(info.shortCommit).toBe('abc1234')
    expect(info.builtAt).toBe('2026-08-08T14:00:00.000Z')
  })

  it('lets a host variable override it, for builds made outside our pipeline', async () => {
    process.env.NEXT_PUBLIC_COMMIT_SHA = 'e632fd2abc1234567890abcdef1234567890abcd'
    const { getBuildInfo } = await import('./build-info')
    expect(getBuildInfo().shortCommit).toBe('e632fd2')
  })
})

describe('nothing reads a clock where the two sides could disagree', () => {
  /**
   * The single line that caused it. If a `new Date()` ever returns to the
   * config's `env` block, every page carrying the footer starts hydrating badly
   * again — invisibly.
   */
  it('the Next config never stamps a time into the client environment', () => {
    const config = readFileSync(join(process.cwd(), 'next.config.mjs'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
    expect(config).not.toContain('new Date(')
  })

  /**
   * And the generated module has to actually exist and carry a real value —
   * a stamp of `''` would send the app back to reading the environment.
   */
  it('the generated stamp is present and populated', () => {
    const stamp = readFileSync(join(process.cwd(), 'lib/build-stamp.ts'), 'utf8')
    expect(stamp).toMatch(/export const BUILT_AT = "\d{4}-\d{2}-\d{2}T/)
    expect(stamp).toContain('export const BUILT_FROM')
  })
})
