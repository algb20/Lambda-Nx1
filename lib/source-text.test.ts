import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Source files must be text, all the way through.
 *
 * ## The measurement that forced this
 *
 * Five files carried a literal NUL byte (U+0000) as a key separator, typed
 * straight into a string instead of written as the escape `'\u0000'`. The
 * runtime cannot tell the difference. Every review tool can:
 *
 * - `git` classifies the file as binary, so a commit touching it shows
 *   "Binary files differ" instead of a diff. `lib/engine/analysis.ts` — which
 *   holds the confidence-grading rule — entered the repository that way, and
 *   its rule was never once reviewable as a diff.
 * - `grep` prints "binary file matches" and hides the line, so a text audit
 *   silently skips the file. The first pass of the 2026-10-03 reconciliation
 *   audit did exactly that.
 *
 * The defect hid a second one (the confidence grade counting source keys
 * instead of independent origins), which is why a byte is worth a test.
 *
 * The escape is the fix, and this keeps it fixed: the shape is easy to
 * reintroduce by pasting, and invisible once it is in.
 */

const ROOTS = ['app', 'components', 'contexts', 'hooks', 'lib', 'db', 'netlify', 'scripts', 'styles', 'tests']
const TEXT = /\.(ts|tsx|mts|mjs|js|cjs|json|sql|css|md|py|toml|ya?ml|txt|html)$/
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'release'])

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (TEXT.test(name)) out.push(path)
  }
  return out
}

function sourceFiles(): string[] {
  const cwd = process.cwd()
  return ROOTS.flatMap((root) => {
    try {
      return walk(join(cwd, root))
    } catch {
      return []
    }
  })
}

describe('source text', () => {
  it('finds the files it is meant to police', () => {
    // A walker that matched nothing would pass the real assertion vacuously.
    expect(sourceFiles().length).toBeGreaterThan(500)
  })

  it('contains no literal NUL byte in any source file', () => {
    const cwd = process.cwd()
    const offenders = sourceFiles()
      .filter((file) => readFileSync(file).includes(0))
      .map((file) => relative(cwd, file))
    expect(offenders, "write the separator as the escape '\\u0000'").toEqual([])
  })
})
