import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { CATALOG } from './index'
import { SOURCE_ORIGINS, originOf } from './origins'
import { independenceGroup } from './types'

/**
 * The generated index must say exactly what the catalogue says.
 *
 * `origins.ts` exists so the browser can group events by publisher without
 * downloading 192 KB of feed definitions. The whole reason it is generated
 * rather than written is that a second, hand-kept copy of the independence
 * groups would drift — and a drifted copy does not fail loudly, it quietly
 * counts one publisher as two and inflates a confidence grade (charter §2a).
 *
 * So the copy is checked against its origin here, both ways, on every run.
 */
describe('the generated origin index', () => {
  it('lists every source that shares a group with another', () => {
    const expected = Object.fromEntries(
      CATALOG.filter((s) => s.independence && s.independence !== s.key).map((s) => [
        s.key,
        s.independence as string,
      ]),
    )
    expect(SOURCE_ORIGINS).toEqual(expected)
  })

  it('answers identically to the catalogue for every source in it', () => {
    for (const source of CATALOG) {
      expect(originOf(source.key), source.key).toBe(independenceGroup(source))
    }
  })

  it('returns an unknown key as its own origin', () => {
    // The safe default: never merge two voices we cannot show are one.
    expect(originOf('a-source-that-does-not-exist')).toBe('a-source-that-does-not-exist')
  })

  it('is small enough to be worth having', () => {
    // The point of the file. If it ever approaches the catalogue's own weight,
    // the split has stopped paying for itself and should be reconsidered.
    expect(JSON.stringify(SOURCE_ORIGINS).length).toBeLessThan(20_000)
  })
})

/**
 * The catalogue itself never reaches a browser.
 *
 * Two components imported `@/lib/engine/catalog` for `originOf` alone, and that
 * import pulled all 192 KB of `feeds/` — every URL, rate limit and Admiralty
 * rating we hold — into the first chunk of the default page, on every open. It
 * compiled, it worked, and nothing said the phone was downloading it.
 *
 * The rule is not only about weight. The catalogue is the engine's own map of
 * where it reads from, including routes that need credentials we hold; there is
 * no reason for it to be readable in a page's source.
 */
function componentFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) componentFiles(rel, out)
    else if (/\.tsx$/.test(entry.name)) out.push(rel)
  }
  return out
}

describe('the browser does not download the catalogue', () => {
  it('no client component imports the full catalogue', () => {
    // Server components are exempt and must be: `app/pricing/page.tsx` counts
    // the catalogue to state its own source figures, and that computation never
    // leaves the server. The rule is about what is sent to a browser.
    const offenders = componentFiles('components')
      .concat(componentFiles('app'))
      .map((file) => ({ file, source: readFileSync(join(process.cwd(), file), 'utf8') }))
      .filter(({ source }) => /^['"]use client['"]/m.test(source))
      .filter(({ source }) => /from ['"]@\/lib\/engine\/catalog['"]/.test(source))
      .map(({ file }) => file)

    expect(
      offenders,
      "import from '@/lib/engine/catalog/origins' instead — the index pulls every feed definition into the page's first chunk",
    ).toEqual([])
  })
})
