import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * No source may turn a refusal into a healthy silence.
 *
 * ## The measurement that forced this
 *
 * Audited on the deployed site, `/api/chain` reported:
 *
 *     13 sources OK · 0 failed · 0 movers
 *
 * Thirteen green lights over a blank panel. `coingecko_board` had met a
 * throttle, and its `if (!res.ok) return []` turned the refusal into "the
 * provider answered, and had nothing to say". The board then reported perfect
 * health while showing nothing, which is worse than an obvious outage: an
 * operator reads an empty panel as *nothing is happening*.
 *
 * Forty-four instances of the pattern existed across twenty-four source files.
 * The fix was mechanical; keeping it fixed is not, because the shape is the
 * natural thing to write and reads as defensive rather than as dishonest.
 *
 * ## What is still allowed, and why the rule is not "never return empty"
 *
 * Two very different things arrive as a non-OK status:
 *
 * - **"That does not exist."** A 404 on a lookup — no Gravatar for this
 *   address, no RDAP record for this domain — is the provider answering. Empty
 *   is correct, and a source may say `if (res.status === 404) return []`.
 * - **"I will not serve you."** 429, 403, 451, 5xx. The question was never
 *   answered, and empty is a fabrication.
 *
 * So this test bans the blanket form and permits the specific one.
 */

const SOURCE_DIR = join(process.cwd(), 'lib/engine/sources')

/** Every shipped source file — tests and fixtures are not sources. */
function sourceFiles(): string[] {
  return readdirSync(SOURCE_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .sort()
}

/**
 * The file with its comments removed.
 *
 * Three files quote the banned pattern inside a doc comment explaining why it
 * is banned. A rule that cannot be described in the codebase that enforces it
 * is a rule nobody will understand well enough to keep.
 */
function code(file: string): string {
  return readFileSync(join(SOURCE_DIR, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

/** `if (!x.ok) return []` in any spacing — the blanket form. */
const BLANKET = /if\s*\(\s*!\s*\w+\s*\.\s*ok\s*\)\s*return\s*\[\s*\]/

/** `if (!x.ok) continue` — the same fault inside a loop over several items. */
const BLANKET_CONTINUE = /if\s*\(\s*!\s*\w+\s*\.\s*ok\s*\)\s*continue/

describe('a refusal is never reported as an empty answer', () => {
  it('no source swallows a non-OK response into an empty list', () => {
    const offenders = sourceFiles().filter((f) => BLANKET.test(code(f)))
    expect(offenders).toEqual([])
  })

  /**
   * The loop form is subtler and was found in the same pass: a source fetching
   * nine series skipped each failing one, which is right — one missing number
   * must not cost the other eight — and then returned an empty list when *all*
   * nine refused, which is the same lie one level up.
   *
   * A source that skips items must therefore count the skips and raise a
   * refusal when nothing survived, so `continue` on its own is not enough.
   */
  it('a source that skips failed items either tallies them or says why not', () => {
    /**
     * Refined once, because the first version of this rule was too coarse and
     * the codebase was right to fail it.
     *
     * Two loops look identical and are not. A **fan-out** asks several
     * providers for things that should all be there, so every one refusing is
     * the provider side going dark. A **walk-back** asks for candidates until
     * one exists — recent quarters, recent months, record types a domain may
     * simply not have — and exhausting those is a genuine empty.
     *
     * So the rule is not a shape. Either the source counts refusals and raises
     * a total one, or it states in a comment why exhaustion is legitimately
     * empty. What is banned is neither: skipping quietly and returning nothing.
     */
    for (const file of sourceFiles()) {
      const raw = readFileSync(join(SOURCE_DIR, file), 'utf8')
      if (!BLANKET_CONTINUE.test(code(file))) continue
      const tallied = /refused/.test(code(file))
      const explained = raw.includes('EXHAUSTION-IS-EMPTY')
      expect(
        tallied || explained,
        `${file} skips failed items without tallying them or saying why exhaustion is empty`,
      ).toBe(true)
    }
  })

  /**
   * And the positive half: the guard exists and is what sources reach for.
   * Without this, the rule above could be satisfied by deleting the check
   * altogether and letting an HTML error page be parsed as data.
   */
  it('sources use the shared guard rather than hand-rolling the check', () => {
    const users = sourceFiles().filter((f) => /expect(Ok|Json)\(/.test(code(f)))
    expect(users.length).toBeGreaterThan(15)
  })
})
