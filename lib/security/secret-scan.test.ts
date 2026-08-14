import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { findSecrets, isHarmlessDsn, parseDsn, describeFinding } from './secret-scan.mjs'

/**
 * The repository is going public with outside contributors, so the guarantee
 * that matters is not "we were careful" — it is that a committed credential
 * **cannot pass the test suite**.
 *
 * Two halves. The unit tests pin the rules in both directions, because a
 * scanner that cries wolf gets switched off and one that sleeps is not a
 * scanner. The last block is the one that actually protects the repository: it
 * reads every tracked file and fails if any of them carries a secret.
 *
 * Fixtures are assembled at runtime rather than written out, since this file is
 * itself scanned and a literal key here would fail the very check it describes.
 */
const join_ = (...parts: string[]) => parts.join('')
const dsn = (host: string, user = 'app', pass = 'r3alPassw0rd') =>
  join_('postgres', 'ql://', user, ':', pass, '@', host, ':5432/db')

describe('parseDsn', () => {
  it('splits on the last @, because a password may contain one', () => {
    // Splitting on the first would read the tail of the password as the host,
    // turning a real database into a harmless-looking name.
    const value = dsn('real-db.internal', 'user', join_('p', '@', 'ss'))
    expect(parseDsn(value).host).toBe('real-db.internal')
    expect(parseDsn(value).credentials).toBe(join_('user:p', '@', 'ss'))
  })

  it('drops the port and path', () => {
    expect(parseDsn(dsn('db.example.com')).host).toBe('db.example.com')
  })
})

describe('isHarmlessDsn', () => {
  it('accepts hosts reserved for documentation (RFC 2606, RFC 5737)', () => {
    for (const host of [
      'example.com', 'db.example.com', 'example.net', 'example.org',
      'foo.test', 'bar.invalid', 'localhost', '127.0.0.1', '192.0.2.7',
      '198.51.100.1', '203.0.113.42',
    ]) {
      expect(isHarmlessDsn(dsn(host)), host).toBe(true)
    }
  })

  it('accepts placeholder credentials, which are what a template file is for', () => {
    // `.env.example` documents the shape. Matching on the credential pair
    // rather than allow-listing the whole file means a real key pasted into
    // that same file is still caught.
    expect(isHarmlessDsn(dsn('host', 'user', 'password'))).toBe(true)
    expect(isHarmlessDsn(dsn('myhost', 'username', 'changeme'))).toBe(true)
    expect(isHarmlessDsn(dsn('somewhere', '<user>', '<password>'))).toBe(true)
  })

  it('refuses a real-looking credential at a real-looking host', () => {
    for (const host of [
      join_('aws-0-eu-central-1.pooler.', 'supabase', '.com'),
      'db.internal',
      'example.com.attacker.net', // suffix trick: the real host is attacker.net
      '10.0.0.5',
      '203.0.114.1', // one octet outside the reserved range
    ]) {
      expect(isHarmlessDsn(dsn(host)), host).toBe(false)
    }
  })
})

describe('findSecrets', () => {
  it('catches the provider key shapes', () => {
    const cases: Array<[string, string]> = [
      ['stripe-live-secret', join_('sk_live', '_', '0123456789abcdefghij')],
      ['anthropic-key', join_('sk-ant', '-', 'api03', '-', 'abcdefghijklmnopqrstuvwx')],
      ['aws-access-key-id', join_('AKIA', 'IOSFODNN7EXAMPLE')],
      ['github-token', join_('ghp', '_', 'abcdefghijklmnopqrstuvwxyz0123456789')],
      ['slack-token', join_('xoxb', '-', '123456789012-abcdefghijkl')],
      ['google-api-key', join_('AIza', 'Sy', 'A'.repeat(33))],
      ['private-key-block', join_('-----', 'BEGIN RSA PRIVATE KEY', '-----')],
    ]
    for (const [rule, value] of cases) {
      const found = findSecrets(`const x = "${value}"`)
      expect(found.map((f) => f.rule), rule).toContain(rule)
    }
  })

  it('finds every occurrence, not only the first', () => {
    // A shared /g regex keeps lastIndex between calls and silently skips
    // matches on every other file. One documentation DSN must not shadow a
    // real one below it.
    const text = `${dsn('example.com')} then ${dsn('prod.internal')}`
    const found = findSecrets(text)
    expect(found).toHaveLength(1)
    expect(found[0].match).toContain('prod.internal')
  })

  it('does not fire on ordinary source', () => {
    for (const line of [
      'const url = process.env.DATABASE_URL',
      'export const SESSION_SECRET_HINT = "set this in your host dashboard"',
      'https://example.com/path?query=1',
      'a'.repeat(200), // long, but not shaped like anything
    ]) {
      expect(findSecrets(line), line.slice(0, 40)).toEqual([])
    }
  })
})

describe('describeFinding', () => {
  it('truncates the value, so reporting a leak is not a second leak', () => {
    const value = join_('sk_live', '_', '0123456789abcdefghij')
    const line = describeFinding('some/file.ts', { rule: 'stripe-live-secret', match: value })
    expect(line).toContain('some/file.ts')
    expect(line).toContain('stripe-live-secret')
    expect(line).not.toContain(value)
  })
})

/**
 * The check that actually protects the repository.
 *
 * Every file git tracks is read and scanned. This is the difference between a
 * policy and a control: a contributor cannot merge a credential, because the
 * suite goes red before review even begins.
 */
describe('no tracked file carries a secret', () => {
  const root = process.cwd()

  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)

  /** Binary and vendored paths: scanning them yields only false positives. */
  const SKIP = /\.(png|jpe?g|webp|gif|ico|svg|woff2?|ttf|eot|mp4|webm|pdf|zip)$/i

  it('reads a plausible number of files, so a broken glob cannot pass silently', () => {
    // A scan that finds nothing because it scanned nothing is the failure mode
    // this whole block exists to avoid.
    expect(tracked.length).toBeGreaterThan(100)
  })

  it('finds no credential anywhere in the tree', () => {
    const offenders: string[] = []

    for (const file of tracked) {
      if (SKIP.test(file)) continue
      const full = join(root, file)
      let text: string
      try {
        // Skip anything too large to be source; a 5 MB fixture is not where a
        // key hides, and reading it on every test run is a cost for nothing.
        if (statSync(full).size > 2_000_000) continue
        text = readFileSync(full, 'utf8')
      } catch {
        continue // unreadable or deleted-but-tracked
      }
      for (const finding of findSecrets(text)) {
        offenders.push(describeFinding(file, finding))
      }
    }

    expect(offenders, `Secrets must live in the host's environment, never in a file:\n  ${offenders.join('\n  ')}`).toEqual([])
  })
})
