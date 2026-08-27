import { describe, expect, it } from 'vitest'
import {
  collapsedAt,
  DEFAULT_DENSITY,
  DENSITIES,
  DENSITY_LEVELS,
  opensAll,
  PANEL_SIZE_BY_DENSITY,
  parseDensity,
  SECTIONS_BY_DENSITY,
  type Density,
} from './density'

/** Every section the globe page can show, in the order it shows them. */
const ALL_SECTIONS = [
  'sec-significant',
  'sec-unplaceable',
  'sec-coverage',
  'sec-fusion',
  'sec-sources',
]

describe('the levels are ordered, and turning it up never hides anything', () => {
  /**
   * The property that makes a density control predictable. A level that shows
   * something the level above it does not is a control nobody can reason about
   * — and it is an easy thing to introduce by editing one row of the table.
   */
  it('each level shows everything the level below it shows', () => {
    for (let i = 1; i < DENSITIES.length; i++) {
      const lower = SECTIONS_BY_DENSITY[DENSITIES[i - 1]]
      const higher = DENSITIES[i]
      for (const section of lower) {
        expect(
          collapsedAt(higher, section),
          `${higher} hides "${section}", which ${DENSITIES[i - 1]} shows`,
        ).toBe(false)
      }
    }
  })

  /**
   * Non-decreasing, not strictly increasing — which is what the first version
   * of this test demanded, and it was wrong about the design rather than
   * finding a fault in it.
   *
   * Over the five sections that exist today, Intelligence and Extreme open the
   * same five. Extreme is denser in the two ways the level below cannot be:
   * it opens sections that do not exist yet, and it widens every row. Both are
   * asserted separately below, which is a better test than a count that would
   * have forced an arbitrary sixth section into the table to satisfy it.
   */
  it('never shows fewer sections as the level rises', () => {
    const shown = (d: Density) => ALL_SECTIONS.filter((s) => !collapsedAt(d, s)).length
    for (let i = 1; i < DENSITIES.length; i++) {
      expect(
        shown(DENSITIES[i]),
        `${DENSITIES[i]} shows fewer than ${DENSITIES[i - 1]}`,
      ).toBeGreaterThanOrEqual(shown(DENSITIES[i - 1]))
    }
  })

  it('makes Minimal, Balanced and Intelligence each strictly denser', () => {
    const shown = (d: Density) => ALL_SECTIONS.filter((s) => !collapsedAt(d, s)).length
    expect(shown('balanced')).toBeGreaterThan(shown('minimal'))
    expect(shown('intelligence')).toBeGreaterThan(shown('balanced'))
  })

  /** And Extreme earns its place by the two things a section count cannot see. */
  it('makes Extreme denser than Intelligence in the ways a count cannot show', () => {
    expect(collapsedAt('intelligence', 'sec-invented-next-year')).toBe(true)
    expect(collapsedAt('extreme', 'sec-invented-next-year')).toBe(false)
    expect(PANEL_SIZE_BY_DENSITY.extreme).not.toBe(PANEL_SIZE_BY_DENSITY.intelligence)
  })
})

describe('what each level is for', () => {
  it('minimal opens nothing but the map and the figures', () => {
    for (const s of ALL_SECTIONS) expect(collapsedAt('minimal', s)).toBe(true)
  })

  it('balanced opens the ranked list and the unplaceable events', () => {
    expect(collapsedAt('balanced', 'sec-significant')).toBe(false)
    expect(collapsedAt('balanced', 'sec-unplaceable')).toBe(false)
    // …and not the evidence sections, which are the level above.
    expect(collapsedAt('balanced', 'sec-fusion')).toBe(true)
  })

  /**
   * The level the platform's whole claim rests on: how many independent
   * origins, where we are blind, which feeds refused.
   */
  it('intelligence opens fusion, blind spots and source integrity', () => {
    expect(collapsedAt('intelligence', 'sec-fusion')).toBe(false)
    expect(collapsedAt('intelligence', 'sec-coverage')).toBe(false)
    expect(collapsedAt('intelligence', 'sec-sources')).toBe(false)
  })

  /**
   * "Everything" must not quietly mean "everything I knew about in August". A
   * section added later has to be open at Extreme without anyone remembering to
   * add it to a list.
   */
  it('extreme opens a section nobody has heard of yet', () => {
    expect(collapsedAt('extreme', 'sec-invented-next-year')).toBe(false)
    expect(opensAll('extreme')).toBe(true)
  })

  it('no other level opens the unknown, or the control would be meaningless', () => {
    for (const d of DENSITIES) {
      if (d === 'extreme') continue
      expect(collapsedAt(d, 'sec-invented-next-year'), d).toBe(true)
    }
  })
})

describe('density moves the row size rather than competing with it', () => {
  it('gives every level a panel size', () => {
    for (const d of DENSITIES) expect(PANEL_SIZE_BY_DENSITY[d], d).toBeTruthy()
  })

  it('reads compact at the lowest and wide at the highest', () => {
    expect(PANEL_SIZE_BY_DENSITY.minimal).toBe('compact')
    expect(PANEL_SIZE_BY_DENSITY.extreme).toBe('wide')
  })

  it('never shrinks a row as the level rises', () => {
    const order = { compact: 0, regular: 1, wide: 2 }
    for (let i = 1; i < DENSITIES.length; i++) {
      expect(order[PANEL_SIZE_BY_DENSITY[DENSITIES[i]]]).toBeGreaterThanOrEqual(
        order[PANEL_SIZE_BY_DENSITY[DENSITIES[i - 1]]],
      )
    }
  })
})

describe('reading a stored value', () => {
  it('accepts a known level', () => {
    expect(parseDensity('intelligence')).toBe('intelligence')
  })

  /** Storage is user-editable and survives deploys; it will hold junk one day. */
  it('falls back to the default for anything else', () => {
    expect(parseDensity('extreme-plus')).toBe(DEFAULT_DENSITY)
    expect(parseDensity(null)).toBe(DEFAULT_DENSITY)
    expect(parseDensity(3)).toBe(DEFAULT_DENSITY)
    expect(parseDensity(undefined)).toBe(DEFAULT_DENSITY)
  })

  /**
   * Balanced, not Minimal. A first visit that shows the map and nothing else
   * teaches a reader the product has nothing in it; one that opens nine panels
   * is the wall of noise the page has repeatedly been told it is.
   */
  it('defaults to the level that shows the ranked list', () => {
    expect(DEFAULT_DENSITY).toBe('balanced')
    expect(collapsedAt(DEFAULT_DENSITY, 'sec-significant')).toBe(false)
  })
})

describe('the labels a reader actually sees', () => {
  it('describes every level exactly once, in order', () => {
    expect(DENSITY_LEVELS.map((l) => l.id)).toEqual([...DENSITIES])
  })

  /**
   * Each level names the reader's **job**, not its size — "Is anything
   * happening?" rather than "Small".
   *
   * The field was called `question` and asserted to end in `?`, which three of
   * the four do. Extreme's is "Show me everything." — a request, not a question,
   * and the honest thing was to widen the field's name rather than contort the
   * one level that did not fit a rule invented for the other three.
   */
  it('gives every level a job and a plain statement of what it adds', () => {
    for (const l of DENSITY_LEVELS) {
      expect(l.job.length, l.id).toBeGreaterThan(10)
      expect(/[?.]$/.test(l.job), `${l.id}: "${l.job}" is not a sentence`).toBe(true)
      expect(l.adds.length, l.id).toBeGreaterThan(20)
      expect(l.label.length, l.id).toBeLessThanOrEqual(14)
    }
  })
})
