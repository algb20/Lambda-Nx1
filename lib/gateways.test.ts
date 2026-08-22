import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ALL_MODES, GATEWAY_FAMILIES, GATEWAY_GUIDANCE } from './gateways'
import { BOARDS } from './modules/board-shared'

/**
 * The grouping is what the user navigates by, so its failures are invisible in
 * code and total in the product: a gateway missing from every family exists,
 * is counted, and cannot be reached.
 */
describe('every gateway is reachable, exactly once', () => {
  const grouped = GATEWAY_FAMILIES.flatMap((f) => f.modes)

  it('places every gateway in a family', () => {
    const missing = ALL_MODES.filter((m) => !grouped.includes(m))
    expect(missing, 'gateways with no family are unreachable in the interface').toEqual([])
  })

  it('places none of them in two families', () => {
    const seen = new Set<string>()
    const duplicated = grouped.filter((m) => (seen.has(m) ? true : (seen.add(m), false)))
    expect(duplicated).toEqual([])
  })

  it('names no gateway that does not exist', () => {
    const unknown = grouped.filter((m) => !(ALL_MODES as readonly string[]).includes(m))
    expect(unknown).toEqual([])
  })

  it('gives every family a label and at least one gateway', () => {
    for (const family of GATEWAY_FAMILIES) {
      expect(family.label.trim().length, family.label).toBeGreaterThan(0)
      expect(family.modes.length, family.label).toBeGreaterThan(0)
    }
  })
})

/**
 * An empty gateway with no guidance is an empty box, which reads as broken.
 * Adding a gateway without writing its guidance must fail here rather than ship.
 */
describe('every gateway explains itself when empty', () => {
  it('has guidance', () => {
    const missing = ALL_MODES.filter((m) => !GATEWAY_GUIDANCE[m])
    expect(missing).toEqual([])
  })

  it('states what it answers, an example, and an honest limit', () => {
    for (const mode of ALL_MODES) {
      const g = GATEWAY_GUIDANCE[mode]
      expect(g.answers.trim().length, `${mode}.answers`).toBeGreaterThan(20)
      expect(g.example.trim().length, `${mode}.example`).toBeGreaterThan(0)
      expect(g.limit.trim().length, `${mode}.limit`).toBeGreaterThan(20)
    }
  })

  /**
   * The limit text is where the passive-only guarantee reaches the user at the
   * moment it matters. It must never promise something the engine refuses to do.
   */
  it('never offers an active capability the engine forbids', () => {
    for (const mode of ALL_MODES) {
      const text = `${GATEWAY_GUIDANCE[mode].answers} ${GATEWAY_GUIDANCE[mode].limit}`.toLowerCase()
      for (const forbidden of ['we scan', 'port scan the', 'we probe', 'brute force']) {
        expect(text, `${mode} promises "${forbidden}"`).not.toContain(forbidden)
      }
    }
  })
})

/**
 * The registry and the screen must agree.
 *
 * A live browser walk caught the exact failure this prevents: the `statements`
 * gateway was added to `ALL_MODES` and to a family, the app then advertised
 * "27 passive gateways" in its own navigation — and the Investigate screen
 * offered 26, because its `MODES` array had not been touched. The gateway was
 * built, tested, routed, reachable by URL, and simply invisible to anyone using
 * the product.
 *
 * Reading the array out of the component source rather than importing it is
 * deliberate: `intelligence-dashboard.tsx` is a client component that pulls in
 * the whole UI tree, and importing it here would drag `node:crypto` into a test
 * environment that has no business loading it.
 */
describe('the gateways on screen are the gateways that exist', () => {
  const source = readFileSync(join(process.cwd(), 'components/intelligence-dashboard.tsx'), 'utf8')
  const listed = [...source.matchAll(/^\s*\{ id: '([a-z-]+)',/gm)].map((m) => m[1])

  it('offers every registered gateway in the picker', () => {
    const missing = (ALL_MODES as readonly string[]).filter((m) => !listed.includes(m))
    expect(missing, 'in ALL_MODES but not selectable on screen').toEqual([])
  })

  it('offers nothing the registry does not know about', () => {
    const unknown = listed.filter((m) => !(ALL_MODES as readonly string[]).includes(m))
    expect(unknown, 'selectable on screen but not a registered gateway').toEqual([])
  })

  /** Two chips with one label is a picker a person cannot use. */
  it('lists each gateway exactly once', () => {
    expect(new Set(listed).size).toBe(listed.length)
  })
})

/**
 * A gateway that runs and shows nothing is worse than one that is missing.
 *
 * Measured in a real browser: pressing Enter on **Broadcasts**, **Filings** and
 * **Exchanges** sent the request, the server answered `200` with real data, and
 * the page stayed at 986 pixels — the height of the picker with no result under
 * it. Three gateways had a chip, a placeholder, a route, a source and a module,
 * and no view. They had looked "unmeasured" in two sweeps because a page that
 * renders nothing and a page that never ran are the same 986 pixels.
 *
 * Nothing caught it because `run()` ends in `setResult({ kind, data } as Result)`
 * — and that cast is exactly the assertion that a `kind` outside the union is
 * fine. TypeScript had the fact and was told to ignore it.
 *
 * So the check lives here instead, in the same source-reading style as the
 * picker test above, and it is about the *rendering* rather than the union:
 * every gateway on screen either shares the boards' one view, or names itself
 * in a branch of its own.
 */
describe('every gateway on screen has somewhere to render', () => {
  const source = readFileSync(join(process.cwd(), 'components/intelligence-dashboard.tsx'), 'utf8')
  const listed = [...source.matchAll(/^\s*\{ id: '([a-z-]+)',/gm)].map((m) => m[1])
  const rendered = new Set(
    [...source.matchAll(/result\?\.kind === '([a-z-]+)'/g)].map((m) => m[1]),
  )
  const boards = new Set(BOARDS.map((b) => b.key as string))

  it('renders a result for every gateway the picker offers', () => {
    // The seven boards share `board-page` deliberately: one shape, one view.
    const invisible = listed.filter((m) => !boards.has(m) && !rendered.has(m))
    expect(invisible, 'has a chip and a route but nothing to draw the answer').toEqual([])
  })

  /**
   * And the subject has to survive the trip.
   *
   * The same three gateways sent `{ broadcasts: "SA" }` to a route that reads
   * `value` or `query`, so typing a subject was accepted, ignored, and answered
   * with the unfiltered default — a wrong answer presented as a right one,
   * which is worse than an error and much harder to notice.
   *
   * Rather than list the exceptions, this reads each route and checks that the
   * key the client actually sends is a key that route actually reads. It stays
   * true when someone renames a field on either side.
   */
  it('sends every gateway a body key its own route reads', () => {
    const bodyKeys = source.slice(source.indexOf('const BODY_KEY'), source.indexOf('const EMPTY_OK'))
    // Gateways `run()` names explicitly never reach the generic branch: the
    // markets board and property take no subject at all, and media sends an
    // image rather than a string. Read that set out of the code rather than
    // listing it, so the exception stays tied to the reason for it.
    const handledByName = new Set(
      [...source.matchAll(/mode === '([a-z-]+)'/g)].map((m) => m[1]),
    )
    const wrong: string[] = []
    for (const mode of listed) {
      if (boards.has(mode) || handledByName.has(mode)) continue
      const routeFile = join(process.cwd(), `app/api/intelligence/${mode}/route.ts`)
      if (!existsSync(routeFile)) continue
      const sent = bodyKeys.match(new RegExp(`'?${mode}'?:\\s*'([a-zA-Z]+)'`))?.[1] ?? mode
      const route = readFileSync(routeFile, 'utf8')
      if (!new RegExp(`body\\.${sent}\\b`).test(route)) wrong.push(`${mode} sends "${sent}"`)
    }
    expect(wrong, 'the typed subject arrives under a name the route ignores').toEqual([])
  })
})
