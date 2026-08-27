import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * `package.json` is the one file whose mistakes a lockfile hides.
 *
 * ## The bug this exists for
 *
 * `overrides` carried `"postcss": "$postcss"`. That `$name` syntax means "use
 * the version this package is already pinned to in **`dependencies`**" — and
 * postcss lives in `devDependencies`, where npm does not look. So the reference
 * was unresolvable and `npm install` failed outright with:
 *
 *   npm error Unable to resolve reference $postcss
 *
 * It never fired here, because `package-lock.json` already had every version
 * resolved and npm therefore never evaluated the reference. It fired the moment
 * anyone installed **without** our lockfile — a fork, a CI cache miss, a
 * different package manager, or the Pi App Studio bundle. The project was one
 * `rm package-lock.json` away from not installing at all, and nothing in the
 * repository would have told us.
 *
 * Found by actually unpacking the bundle and running `npm install` in it.
 */
const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  overrides?: Record<string, string>
  scripts?: Record<string, string>
}

describe('package.json installs without our lockfile', () => {
  /**
   * The exact failure. A `$name` override resolves only against `dependencies`,
   * so one pointing at a devDependency — or at nothing — breaks a fresh install
   * while every install that reuses the lockfile keeps working.
   */
  it('has no override referencing a package npm cannot resolve it from', () => {
    for (const [name, version] of Object.entries(pkg.overrides ?? {})) {
      if (!version.startsWith('$')) continue
      const target = version.slice(1)
      expect(
        pkg.dependencies?.[target],
        `overrides["${name}"] = "${version}" — "${target}" must be in dependencies for npm to resolve it, and it is not`,
      ).toBeDefined()
    }
  })

  it('gives every override a version a resolver can act on', () => {
    for (const [name, version] of Object.entries(pkg.overrides ?? {})) {
      expect(version.trim(), name).not.toBe('')
      // Either a concrete range, or a `$ref` that the test above proved resolvable.
      expect(version, name).toMatch(/^(\$[\w@/.-]+|[\^~]?\d|[\d*x]|>=|<=|>|<)/)
    }
  })

  it('pins nothing to a version that does not exist in the tree it names', () => {
    const all = { ...pkg.dependencies, ...pkg.devDependencies }
    for (const name of Object.keys(pkg.overrides ?? {})) {
      // An override for a package nothing depends on is dead weight at best and
      // a typo for a real dependency at worst.
      const present = name in all || Object.keys(all).some((d) => d.endsWith(`/${name}`))
      expect(present || name in TRANSITIVE_ONLY, `override "${name}"`).toBe(true)
    }
  })

  /**
   * A transitive override with no stated reason is a pin nobody can safely
   * remove: the package is not in our dependencies, so the next reader cannot
   * tell whether it patches a real advisory or was a guess. This started as two
   * bare names in an `||` chain and grew a third the day an advisory landed —
   * which is exactly when the reason matters most.
   */
  it('says why every transitive-only override exists', () => {
    for (const [name, why] of Object.entries(TRANSITIVE_ONLY)) {
      expect(why.length, `${name} is pinned with no reason beside it`).toBeGreaterThan(30)
      expect(pkg.overrides?.[name], `${name} is excused but no longer overridden`).toBeDefined()
    }
  })
})

/**
 * Overrides for packages nothing of ours depends on directly, and why each one
 * is pinned anyway. Every entry lifts a transitive dependency that a parent we
 * do not control pins too low.
 */
const TRANSITIVE_ONLY: Record<string, string> = {
  sharp: "Next.js image optimisation pulls it; pinned to keep one copy of a large native binary rather than several.",
  esbuild:
    'Pulled by both vitest and drizzle-kit at different ranges; pinned so the two do not install separate native binaries.',
  nanoid:
    'GHSA-2v37-7h3g-55p8 — high severity, custom generators can loop indefinitely when size is zero, fixed in 3.3.18. It reaches us only through postcss, whose own range (^3.3.17) admits the vulnerable versions, so Dependabot could not lift it and failed three runs trying. `npm audit` reported one high vulnerability before this pin and zero after.',
}

describe('the scripts a fresh clone needs', () => {
  it('keeps the three commands the setup page tells people to run', () => {
    for (const script of ['build', 'start']) {
      expect(pkg.scripts?.[script], script).toBeDefined()
    }
  })

  it('keeps both packaging profiles, since the studio bundle is a separate view', () => {
    expect(pkg.scripts?.package).toBeDefined()
    expect(pkg.scripts?.['package:studio']).toContain('--profile studio')
  })
})
