import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BOARDS, boardByKey, boardReport } from './board'
import { Registry } from '@/lib/engine/registry'
import type { Source } from '@/lib/engine/types'
import { ALL_MODES, GATEWAY_GUIDANCE, GATEWAY_FAMILIES } from '@/lib/gateways'

/**
 * The boards are data, and the whole point of that is that adding the eighth is
 * a row rather than a stack. These assert the row is enough — that a board
 * cannot exist as a definition while being unreachable in the interface, or
 * appear in the interface with no definition behind it.
 */
describe('the board catalogue', () => {
  it('gives every board a gateway a user can actually open', () => {
    for (const b of BOARDS) {
      expect(ALL_MODES, `board "${b.key}" is not a gateway`).toContain(b.key)
    }
  })

  it('gives every board the guidance an empty gateway shows', () => {
    for (const b of BOARDS) {
      const guidance = GATEWAY_GUIDANCE[b.key as (typeof ALL_MODES)[number]]
      expect(guidance, `board "${b.key}" has no guidance`).toBeTruthy()
      // A limit that is not stated is a limit the reader discovers by being
      // wrong about something.
      expect(guidance.limit.length).toBeGreaterThan(30)
    }
  })

  it('files every board into exactly one family, so it is reachable', () => {
    for (const b of BOARDS) {
      const families = GATEWAY_FAMILIES.filter((f) => (f.modes as readonly string[]).includes(b.key))
      expect(families, `board "${b.key}" appears in ${families.length} families`).toHaveLength(1)
    }
  })

  it('uses each capability once — two boards on one capability would merge', () => {
    const capabilities = BOARDS.map((b) => b.capability)
    expect(new Set(capabilities).size).toBe(capabilities.length)
  })

  it('resolves a key, and refuses one it does not have', () => {
    expect(boardByKey('courts')?.capability).toBe('courts')
    expect(boardByKey('not-a-board')).toBeUndefined()
  })

  /**
   * The note is what a reader sees before any data arrives. A board whose note
   * does not say which publisher it reads is a board asking to be trusted on
   * nothing.
   */
  it('names what each board is, in a sentence', () => {
    for (const b of BOARDS) {
      expect(b.note.length, `board "${b.key}" has a thin note`).toBeGreaterThan(60)
      expect(b.title.length).toBeGreaterThan(4)
    }
  })
})

/**
 * Group order.
 *
 * The board's default is size, and it is a good default — a group of one is
 * usually a footnote. It is the wrong default the moment a board answers a
 * *specific* question: the crypto gateway returns seven rows about the asset
 * that was searched for beside seventy headlines about the sector, and ordering
 * by size buries the answer under two walls of context. So a source may declare
 * where its groups belong, and one that declares nothing keeps the old order
 * exactly.
 */
describe('the order the boxes are read in', () => {
  const CAP = 'crypto' as const

  function fakeSource(key: string, rows: Array<Record<string, unknown>>): Source {
    return {
      key,
      capability: CAP,
      passive: true,
      // The guardrail refuses a source that declares no host, which is right —
      // it is how the allowlist stays derived from the sources that exist. This
      // one never fetches, so the name only has to be one that cannot resolve.
      hosts: ['board-order.test.invalid'],
      async run() {
        return rows.map((data) => ({
          claim: String(data.headline),
          sourceKey: key,
          retrievedAt: '2026-08-22T00:00:00.000Z',
          admiralty: { source: 'B' as const, info: 2 as const },
          confidence: 'probable' as const,
          data,
        }))
      },
    }
  }

  it('lets a source put a small, important group above a large one', async () => {
    const reg = new Registry()
    reg.registerAll([
      fakeSource(
        'test_board',
        [
          { group: 'The answer', headline: 'Price', groupWeight: 100 },
          ...Array.from({ length: 20 }, (_, i) => ({
            group: 'Background',
            headline: `Headline ${i}`,
            groupWeight: 20,
          })),
        ],
      ),
    ])
    const report = await boardReport('crypto', CAP, '', reg)
    expect(report.groups.map((g) => g.name)).toEqual(['The answer', 'Background'])
    // The larger group is still there in full — it moved, it was not trimmed.
    expect(report.groups[1]?.rows).toHaveLength(20)
  })

  it('keeps size as the order when no source says otherwise', async () => {
    const reg = new Registry()
    reg.registerAll([
      fakeSource('test_board', [
        { group: 'Small', headline: 'One' },
        { group: 'Large', headline: 'A' },
        { group: 'Large', headline: 'B' },
      ]),
    ])
    const report = await boardReport('crypto', CAP, '', reg)
    expect(report.groups.map((g) => g.name)).toEqual(['Large', 'Small'])
  })
})

/**
 * Requests from the board sources, after the courts gateway was found
 * reporting `ok: 1, failed: 0` with zero rows for ninety minutes at a time.
 *
 * Read from the source rather than executed, for the same reason as the
 * gateway assertions above: this pulls the orchestrator, and the point here is
 * a property of how the file is written.
 */
describe('board sources say who they are, and fail out loud', () => {
  const raw = readFileSync(join(process.cwd(), 'lib/engine/sources/boards.ts'), 'utf8')
  /**
   * Comments stripped before matching. The doc comment on `boardFetch` quotes
   * the very pattern being banned, and a naive search finds its own
   * explanation — a trap this codebase has now sprung three times.
   *
   * Both strippers are anchored to the start of a line, and both anchors were
   * paid for. A blanket `//` strip eats the `//` in `https://github.com/…`
   * inside the User-Agent string and reports the User-Agent as missing. A
   * blanket `/* … *\/` strip is worse: the `Accept` header ends in `*\/*;q=0.5`,
   * whose `/` + `*` opens a comment that runs to the end of the next doc block
   * and swallows the `expectOk(` call this file exists to protect. Every
   * comment in `boards.ts` starts its own line; no string literal does.
   */
  const boards = raw
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')

  it('never calls ctx.fetch directly outside the two helpers', () => {
    // Nine call sites, each with its own idea of how to ask and what to do
    // when refused. One of them swallowed a `429 throttled, available in 5040
    // seconds` and reported a healthy board.
    const direct = [...boards.matchAll(/ctx\.fetch\(/g)].length
    expect(direct, 'a call site bypassing boardFetch/boardTry').toBeLessThanOrEqual(2)
  })

  /**
   * The engine has one identity, set once in `Guardrail.createFetch`. This file
   * briefly set its own — unnecessary, since nothing here was ever anonymous,
   * and in the one form `guardrail.ts` records as measured to draw a 403 from
   * the SEC's edge filter. A second identity is a second thing to get wrong.
   */
  it('does not invent a second identity for the engine', () => {
    expect(boards.toLowerCase()).not.toContain('user-agent')
  })

  it('turns a refusal into a recorded failure for a single-source board', () => {
    // `if (!res.ok) return []` is what made a throttled provider look like a
    // healthy source with nothing to say.
    expect(boards).toContain('expectOk(')
    expect(boards).not.toContain('if (!res.ok) return []')
  })

  it('still lets one of many endpoints fail without killing the run', () => {
    // Nine press offices, eighteen FRED series, three CelesTrak groups: losing
    // one must not turn a partial answer into no answer. Collapsing this into
    // the strict helper would be a bug in the other direction.
    expect(boards).toContain('async function boardTry(')
    expect(boards).toMatch(/boardTry\(/)
    expect(boards).toMatch(/if \(!res\.ok\) continue/)
  })
})
