import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Every account route handles a database that has stopped answering.
 *
 * ## Why this is asserted on the source
 *
 * The failure being prevented is not inside any one function — it is a *missing
 * line* in a route: no `catch`, or a `catch` that blames the user. Both halves
 * of a missing join test green in isolation, which is exactly how this shipped:
 * `issueCode` was correct and tested, the route was correct and tested, and an
 * unreachable database still reached the browser as `500` with an empty body.
 *
 * The only alternative is booting Next.js and a deliberately broken Postgres
 * inside the unit suite to prove a `catch` exists. This is the blunter tool and
 * the right one — it fails the moment a new route forgets, which is the point.
 */

const ROUTES = [
  'app/api/auth/verify/request/route.ts',
  'app/api/auth/verify/confirm/route.ts',
  'app/api/auth/password/reset/route.ts',
  'app/api/auth/register/route.ts',
  'app/api/auth/login/route.ts',
]

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe.each(ROUTES)('%s', (path) => {
  const source = read(path)

  it('has a database-failure branch at all', () => {
    expect(
      source,
      'a route that writes to the database with no databaseUnavailable() branch returns a bare 500',
    ).toContain('databaseUnavailable(')
  })

  /**
   * `accountsUnavailable` became async when it started asking the database
   * instead of reading an environment variable. An un-awaited call returns a
   * Promise — which is truthy — so the route would answer 503 to *everybody*,
   * forever. Silent, total, and invisible to a type check that sees a
   * `NextResponse | null` union satisfied by a Promise in a boolean position.
   */
  it('awaits the readiness gate rather than testing a Promise for truthiness', () => {
    if (!source.includes('accountsUnavailable(')) return
    expect(source).toMatch(/await accountsUnavailable\(/)
    expect(source).not.toMatch(/[^t] accountsUnavailable\(/)
  })
})

describe('the readiness gate asks the database, not the environment', () => {
  const source = read('lib/auth/code-flow.ts')

  /**
   * `isDbConfigured()` is true for any non-empty string. Gating account
   * creation on it is what let a deployment pointing at an unreachable host
   * advertise working sign-up.
   */
  it('performs a live check inside accountsUnavailable', () => {
    expect(source).toMatch(/await databaseAvailability\(\)/)
  })

  it('still refuses fast when nothing is configured at all', () => {
    // The cheap checks must come first: with no URL there is nothing to ping,
    // and a deployment with no database should not pay a timeout to find out.
    const gate = /export async function accountsUnavailable[\s\S]*?\n}/.exec(source)?.[0] ?? ''
    expect(gate.indexOf('isDbConfigured()')).toBeGreaterThan(-1)
    expect(gate.indexOf('isDbConfigured()')).toBeLessThan(gate.indexOf('databaseAvailability()'))
  })
})
