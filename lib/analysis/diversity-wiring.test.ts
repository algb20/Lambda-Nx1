import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Every surface that ranks events tells `diversify` who published them.
 *
 * ## Why this is asserted on the source
 *
 * `Rankable.origin` is optional, and it has to be: a source that is its own
 * publisher should not have to say so. That same optionality means a surface
 * can omit it and still compile, still pass its own tests, and still render —
 * it just quietly loses the cap that stops one publisher owning the page.
 *
 * That is not hypothetical. The board, the globe, the MCP tool and the
 * auto-publisher each build their own `Rankable` inline, and the last time a
 * cross-cutting rule was added to this pipeline one of the four was missed and
 * shipped. The failure is invisible in output: the page looks full, and only a
 * reader wondering why every row is a European weather warning would notice.
 *
 * So the rule is checked where it can actually be enforced — across all four
 * call sites at once.
 */

const SURFACES = [
  'components/live-columns.tsx',
  'components/globe-view.tsx',
  'app/api/mcp/route.ts',
  'lib/modules/publish-job.ts',
]

describe.each(SURFACES)('%s', (path) => {
  const source = readFileSync(join(process.cwd(), path), 'utf8')

  it('calls diversify at all', () => {
    expect(source).toMatch(/diversify\(/)
  })

  it('names the publisher, not only the feed', () => {
    expect(
      source,
      'this surface builds a Rankable without `origin`, so one publisher read through many feeds will own the board',
    ).toMatch(/origin:\s*originOf\(/)
  })

  it('takes the publisher from the catalogue rather than inventing one', () => {
    // A hand-written mapping would drift from the independence groups the
    // confidence grade uses, and the two would disagree about who is speaking.
    expect(source).toMatch(/import \{[^}]*originOf[^}]*\} from '@\/lib\/engine\/catalog'/)
  })
})

describe('the catalogue answers with its own independence groups', () => {
  const source = readFileSync(join(process.cwd(), 'lib/engine/catalog/index.ts'), 'utf8')

  it('derives origin from `independence`, the same field §2a counts', () => {
    expect(source).toMatch(/independence \?\? s\.key/)
  })
})
