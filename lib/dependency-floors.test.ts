import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Security floors for dependencies we pin through `overrides`.
 *
 * ## Why a test and not only the audit
 *
 * `sharp` arrives through Next.js, not by our choice, and `overrides` is where
 * we hold it. The override sat at `^0.35.3` after 0.35.4 shipped the fix for
 * GHSA-g89c-p67h-r497 and GHSA-2jg2-4ch7-h545 (vulnerabilities in the bundled
 * libheif, rated high), so the lockfile kept resolving the vulnerable build.
 * `npm audit` reported it; nothing failed. A floor written down here fails the
 * suite if the override or the lockfile ever drops below it again — for
 * example when a lockfile is regenerated on a branch that predates the fix.
 */

/**
 * `pin` says where the floor is held: `overrides` for a transitive package we
 * force, `dependencies` for one we declare directly.
 *
 * `next` 15.5.27 (2026-09-30) fixes GHSA-f87g-xv8r-7p7x (metadata image route
 * information disclosure), GHSA-4jqv-mc3x-m676 and GHSA-mcj8-r9mp-w47p (SSG/ISR
 * cache poisoning); 15.5.26 hardened `next/og`. `npm audit` did not report
 * them on 2026-10-04, which is exactly why the floor is written down here
 * rather than left to the advisory database's timing.
 */
const FLOORS: Record<string, { min: string; why: string; pin: 'overrides' | 'dependencies' }> = {
  sharp: { min: '0.35.4', why: 'GHSA-g89c-p67h-r497, GHSA-2jg2-4ch7-h545 (libheif)', pin: 'overrides' },
  next: { min: '15.5.27', why: 'GHSA-f87g-xv8r-7p7x, GHSA-4jqv-mc3x-m676, GHSA-mcj8-r9mp-w47p', pin: 'dependencies' },
}

const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))

function parse(v: string): number[] {
  return v.replace(/^[\^~>=<\s]+/, '').split('-')[0].split('.').map((n) => Number(n))
}

function atLeast(version: string, min: string): boolean {
  const a = parse(version)
  const b = parse(min)
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return true
}

describe('dependency security floors', () => {
  for (const [name, { min, why, pin }] of Object.entries(FLOORS)) {
    it(`pins ${name} at or above ${min} (${why})`, () => {
      const declared = pkg[pin]?.[name]
      expect(declared, `${name} in ${pin}`).toBeTruthy()
      expect(atLeast(declared, min), `${pin} ${declared}`).toBe(true)
    })

    it(`resolves every installed copy of ${name} at or above ${min}`, () => {
      const copies = Object.entries(lock.packages as Record<string, { version?: string }>).filter(
        ([path]) => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`),
      )
      expect(copies.length, `${name} in the lockfile`).toBeGreaterThan(0)
      for (const [path, entry] of copies) expect(atLeast(entry.version ?? '0.0.0', min), path).toBe(true)
    })
  }

  it('compares versions numerically, not as text', () => {
    expect(atLeast('0.35.10', '0.35.4')).toBe(true)
    expect(atLeast('0.35.3', '0.35.4')).toBe(false)
    expect(atLeast('^0.35.5', '0.35.4')).toBe(true)
  })
})
