import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ALL_MODES, GATEWAY_FAMILIES, GATEWAY_GUIDANCE } from './gateways'

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
