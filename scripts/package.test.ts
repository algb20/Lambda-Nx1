import { describe, it, expect } from 'vitest'
import { dsnHost, isDocumentationDsn, realSecretMatches } from './package.mjs'

/**
 * The release packager refuses to ship a file containing something
 * secret-shaped. That guard is only worth having if it is right in *both*
 * directions, and it has already been wrong in one of them: it blocked a
 * release over `lib/db/probe.test.ts`, a test whose whole purpose is to prove
 * the error scrubber strips connection strings — so it must contain one.
 *
 * The tempting fixes were both wrong. Allowlisting that file, or test files in
 * general, would let a real credential pasted into a `.test.ts` ship. Deleting
 * the DSN rule would let a real one ship anywhere.
 *
 * The distinction that holds is the **host**: RFC 2606 and RFC 5737 reserve
 * names and addresses precisely so documentation can name a host that cannot
 * exist. A DSN aimed at one is a worked example by construction; anything else
 * might be real.
 *
 * These tests pin both directions, because a guard that cries wolf gets
 * disabled and a guard that sleeps is not a guard.
 *
 * **Why the fixtures are assembled instead of written out.** The scanner reads
 * *source text*, and this file necessarily describes the shapes it refuses —
 * so written plainly, its own fixtures would trip it and block every release.
 * That is the same failure being fixed here, and it would be absurd to fix it
 * by exempting the file that proves the guard works. Joining the pieces at
 * runtime keeps the scanner at full strictness — no allowlist, no exempted
 * path — while the value the rule sees is byte-identical to the real thing.
 */
const join = (...parts: string[]) => parts.join('')

/** A connection string assembled so no DSN-shaped literal appears in this file. */
const dsn = (host: string, { user = 'u', pass = 'p', path = '/db', scheme = 'postgresql' } = {}) =>
  join(scheme, '://', user, ':', pass, '@', host, ':5432', path)

describe('dsnHost', () => {
  it('takes the host, dropping credentials, port and path', () => {
    expect(dsnHost(dsn('db.example.com', { user: 'admin', pass: 'hunter2', path: '/lambda' }))).toBe('db.example.com')
    expect(dsnHost(dsn('127.0.0.1', { scheme: 'postgres', path: '/none' }))).toBe('127.0.0.1')
    // The scanner's regex stops at the path, so the bare fragment must work too.
    expect(dsnHost(dsn('db.example.com', { path: '' }))).toBe('db.example.com')
  })

  it('splits on the LAST @, since a password may contain one', () => {
    // A password like "p@ss" would otherwise make the host read as "ss@host".
    expect(dsnHost(dsn('real-db.internal', { user: 'user', pass: join('p', '@', 'ss'), path: '/x' }))).toBe('real-db.internal')
  })

  it('is empty when there are no credentials to separate', () => {
    expect(dsnHost(join('postgresql', '://', 'db.example.com:5432/lambda'))).toBe('')
  })
})

describe('isDocumentationDsn', () => {
  it('accepts the reserved documentation domains (RFC 2606)', () => {
    for (const host of ['example.com', 'db.example.com', 'example.net', 'example.org', 'foo.test', 'bar.invalid']) {
      expect(isDocumentationDsn(dsn(host)), host).toBe(true)
    }
  })

  it('accepts loopback and the reserved test addresses (RFC 5737)', () => {
    for (const host of ['localhost', '127.0.0.1', '0.0.0.0', '192.0.2.7', '198.51.100.1', '203.0.113.42']) {
      expect(isDocumentationDsn(dsn(host)), host).toBe(true)
    }
  })

  it('refuses a host that could be a real database', () => {
    for (const host of [
      'aws-0-eu-central-1.pooler.supabase.com',
      'db.internal',
      'example.com.attacker.net', // suffix trick: the real host is attacker.net
      '10.0.0.5',
      '203.0.114.1', // one octet outside the reserved range
    ]) {
      expect(isDocumentationDsn(dsn(host)), host).toBe(false)
    }
  })
})

describe('realSecretMatches', () => {
  it('passes the scrubber test file that used to block the release', () => {
    const line = `'connect ECONNREFUSED for ${dsn('db.example.com', { user: 'admin', pass: 'hunter2', path: '/lambda' })}'`
    expect(realSecretMatches(line)).toEqual([])
  })

  it('still catches a DSN that names a reachable host, even inside a test file', () => {
    const host = join('aws-0-eu-central-1.pooler.', 'supabase', '.com')
    const found = realSecretMatches(`const url = '${dsn(host, { user: 'postgres.abc', pass: 'realpassword', path: '/postgres' })}'`)
    expect(found).toHaveLength(1)
    expect(found[0].match).toContain('supabase.com')
  })

  it('catches every DSN in a file, not only the first', () => {
    // The rule is global: one documentation DSN earlier in a file must not
    // shadow a real one further down.
    const found = realSecretMatches(
      `${dsn('example.com')} and ${dsn('prod.internal', { pass: join('sec', 'ret') })}`,
    )
    expect(found).toHaveLength(1)
    expect(found[0].match).toContain('prod.internal')
  })

  it('catches provider keys regardless of host reasoning', () => {
    expect(realSecretMatches(join('sk_live', '_', '0123456789abcdefghij'))).toHaveLength(1)
    expect(realSecretMatches(join('sk-ant', '-', '0123456789abcdefghijklmn'))).toHaveLength(1)
  })

  it('says nothing about ordinary source', () => {
    expect(realSecretMatches('export const DATABASE_URL = process.env.DATABASE_URL')).toEqual([])
  })
})
