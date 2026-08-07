import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import * as lucide from 'lucide-react'

/**
 * Every lucide icon the app imports must actually exist.
 *
 * This is not hypothetical. `IdCard` — a recent addition to lucide — imported
 * cleanly here and broke the app on a host that resolves lucide-react from its
 * own, older bundle (a v0 / Pi App Studio preview): the module had no such
 * export, the import failed, and the whole app went down with
 * "does not provide an export named 'IdCard'".
 *
 * Our own build cannot catch that, because our node_modules has the icon. What
 * it can catch is the general class: an icon that is *marginal*. So this test
 * asserts two things — every imported name exists, and none of them is on a
 * denylist of icons known to be too new to rely on across hosts.
 */

const ROOTS = ['components', 'app', 'contexts', 'hooks']

/**
 * Icons that exist in our lucide but are recent enough that other hosts may ship
 * a build without them. Add to this list when an icon is found to break
 * elsewhere; prefer a long-established alternative in the code.
 */
const TOO_NEW = new Set(['IdCard'])

function tsxFiles(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) tsxFiles(full, out)
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) out.push(full)
  }
  return out
}

/** Named imports from lucide-react, per file. */
function lucideImports(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  const names: string[] = []
  const re = /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    for (const raw of m[1].split(',')) {
      // Handles `Icon`, `Icon as Alias`, and stray whitespace/newlines.
      const name = raw.trim().split(/\s+as\s+/)[0].trim()
      if (name) names.push(name)
    }
  }
  return names
}

const FILES = ROOTS.flatMap((r) => tsxFiles(r))
const USED = [...new Set(FILES.flatMap(lucideImports))].sort()

describe('lucide icons', () => {
  it('finds the icon imports to check', () => {
    // A silent zero here would make every assertion below vacuously true.
    expect(FILES.length).toBeGreaterThan(10)
    expect(USED.length).toBeGreaterThan(20)
  })

  it('every imported icon is exported by the installed lucide-react', () => {
    const missing = USED.filter((name) => !(name in lucide))
    expect(missing, `not exported by lucide-react: ${missing.join(', ')}`).toEqual([])
  })

  it('avoids icons known to be missing on other hosts', () => {
    const risky = USED.filter((name) => TOO_NEW.has(name))
    expect(
      risky,
      `these exist here but broke on a host with an older lucide build — ` +
        `use a long-established icon instead: ${risky.join(', ')}`,
    ).toEqual([])
  })

  it('imports icons as components, not as a namespace', () => {
    // `import * as Icons from 'lucide-react'` would pull the whole set into the
    // bundle and defeat tree-shaking.
    const offenders = FILES.filter((f) =>
      /import\s+\*\s+as\s+\w+\s+from\s+['"]lucide-react['"]/.test(readFileSync(f, 'utf8')),
    )
    expect(offenders, `namespace import in: ${offenders.join(', ')}`).toEqual([])
  })
})
