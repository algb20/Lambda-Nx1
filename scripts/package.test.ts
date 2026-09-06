import { describe, expect, it } from 'vitest'
import { listFiles, STUDIO_EXCLUDE, STUDIO_LIMIT_BYTES } from './package.mjs'

/**
 * What the release bundles contain, asserted rather than remembered.
 *
 * The studio profile silently stopped meeting its own ceiling. Nothing measured
 * it between releases, its header comment described a tree that had not existed
 * for months ("117 test files, 26 documents"), and the way it was discovered was
 * a person running it and reading a red line — on the one script whose entire
 * job is to measure sizes.
 *
 * These tests are cheap because they read the file *list*, not the archive: the
 * expensive part of packaging is compression, and none of what rotted was in
 * the compression.
 */

const full = listFiles('full') as string[]
const studio = listFiles('studio') as string[]

describe('what a release bundle contains', () => {
  it('ships the application in both profiles', () => {
    for (const profile of [full, studio]) {
      expect(profile).toContain('package.json')
      expect(profile).toContain('next.config.mjs')
      expect(profile.some((f) => f.startsWith('app/'))).toBe(true)
      expect(profile.some((f) => f.startsWith('lib/'))).toBe(true)
      expect(profile.some((f) => f.startsWith('components/'))).toBe(true)
    }
  })

  /**
   * A database has to be buildable from zero from either bundle (charter rule
   * #4). The drizzle *snapshots* are only needed to generate the next migration;
   * the `.sql` files are the migration.
   */
  it('keeps every SQL migration in the studio bundle, and drops only the snapshots', () => {
    expect(studio.some((f) => /^db\/migrations\/\d+.*\.sql$/.test(f))).toBe(true)
    expect(studio.some((f) => f.startsWith('db/migrations/meta/'))).toBe(false)
    expect(full.some((f) => f.startsWith('db/migrations/meta/'))).toBe(true)
  })

  /** The two files Pi's domain verification reads, in both bundles. */
  it('keeps the Pi verification files', () => {
    for (const profile of [full, studio]) {
      expect(profile).toContain('public/validation-key.txt')
      expect(profile).toContain('public/piapp-link-verification.txt')
    }
  })

  it('never ships a real environment file, in either profile', () => {
    for (const profile of [full, studio]) {
      const env = profile.filter((f) => /(^|\/)\.env/.test(f))
      expect(env).toEqual(['.env.example'])
    }
  })
})

describe('the studio profile holds back apparatus, not application', () => {
  it('drops tests, docs, tooling and the lockfile', () => {
    expect(studio.some((f) => /\.test\.(ts|tsx)$/.test(f))).toBe(false)
    expect(studio.some((f) => f.startsWith('docs/'))).toBe(false)
    expect(studio.some((f) => f.startsWith('scripts/'))).toBe(false)
    expect(studio).not.toContain('package-lock.json')
    // …and the full profile keeps all of them, so nothing is lost from the repo.
    expect(full.some((f) => f.startsWith('docs/'))).toBe(true)
    expect(full).toContain('package-lock.json')
  })

  /**
   * The regression that cost more than half the bundle.
   *
   * Two 1024×1024 logos prepared for submission forms and one dashboard
   * screenshot came to 1.56 MB of a 2.88 MB archive. No page loads any of them:
   * a logo sized for an upload form was the reason an upload was refused.
   */
  it('drops large assets no page loads', () => {
    expect(studio).not.toContain('dash-laptop.png')
    expect(studio.some((f) => f.startsWith('public/branding/'))).toBe(false)
    expect(full).toContain('dash-laptop.png')
  })

  /**
   * The guard that would have caught it: nothing large and non-code may sit in
   * the studio bundle unnamed. Stated as a rule about *size on disk* rather than
   * about the three files we happen to know about, because the next one will be
   * a different file.
   */
  it('carries no single non-code file over 100 KB', async () => {
    const { statSync } = await import('node:fs')
    const heavy = studio
      .filter((f) => !/\.(ts|tsx|js|jsx|mjs|cjs|json|sql|css|md)$/.test(f))
      .map((f) => ({ f, bytes: statSync(f).size }))
      .filter((x) => x.bytes > 100 * 1024)
    expect(heavy.map((x) => `${x.f} (${Math.round(x.bytes / 1024)} KB)`)).toEqual([])
  })

  it('states its ceiling in binary megabytes', () => {
    expect(STUDIO_LIMIT_BYTES).toBe(1024 * 1024)
  })

  it('excludes by pattern, so a renamed file in a named directory stays excluded', () => {
    expect(STUDIO_EXCLUDE.some((re: RegExp) => re.test('public/branding/anything-new.png'))).toBe(true)
    expect(STUDIO_EXCLUDE.some((re: RegExp) => re.test('docs/whatever.md'))).toBe(true)
    expect(STUDIO_EXCLUDE.some((re: RegExp) => re.test('lib/engine/catalog/index.ts'))).toBe(false)
  })
})
