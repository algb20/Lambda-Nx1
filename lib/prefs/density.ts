import type { PanelSize } from './schema'

/**
 * How much of the analysis is on screen at once.
 *
 * ## Why one axis and not two
 *
 * The globe page already had `panelSize` — compact, regular, wide — which
 * controls how much of each *row* is drawn. R277 asks for a display-density
 * control across the surface, and the obvious build was a second setting beside
 * the first. That would have been a mistake: two independent density knobs give
 * a reader nine combinations, of which they want about three, and leave the
 * product unable to say what "dense" means because it means two things.
 *
 * So density is the one axis, and it *chooses* the panel size. `panelSize`
 * stays in the schema — a reader who wants wide rows in a minimal layout can
 * still have them — but the density control moves it, and moving it is the
 * ordinary way to change row detail.
 *
 * ## Each level has to mean something checkable
 *
 * A density control whose levels only differ by "more" is decoration. Every
 * level here names the sections it opens, and the difference between two
 * adjacent levels is a specific set of sections and a specific row size. That
 * is what makes it testable, and it is why `SECTIONS_BY_DENSITY` is data rather
 * than a series of conditionals in a component.
 *
 * ## What the levels are for
 *
 * They are not sizes, they are **jobs**:
 *
 * - **Minimal** — *is anything happening?* The map and the six headline figures.
 *   Nothing else. This is the glance from across a room, and the level a phone
 *   reader on a train actually wants.
 * - **Balanced** — *what is happening?* The ranked list and what could not be
 *   placed. The default, because the ranked list is the product.
 * - **Intelligence** — *can I believe it?* Adds fusion, coverage and source
 *   integrity: how many independent origins, where we are blind, which feeds
 *   refused. This is the level the platform's whole claim rests on.
 * - **Extreme** — *show me everything.* Every section open, wide rows, nothing
 *   summarised. For an analyst working a developing event, and honestly named:
 *   it is a wall, and it should be chosen rather than arrived at.
 */

export type Density = 'minimal' | 'balanced' | 'intelligence' | 'extreme'

export const DENSITIES: readonly Density[] = ['minimal', 'balanced', 'intelligence', 'extreme']

export const DEFAULT_DENSITY: Density = 'balanced'

export interface DensityLevel {
  id: Density
  label: string
  /**
   * What the reader wants at this level, in their words.
   *
   * Called `job` and not `question` because three of the four are questions and
   * Extreme's is a request — "Show me everything." Naming the field for the
   * three would have meant rewording the fourth into a question it is not.
   */
  job: string
  /** What it adds over the level below it. Empty for the lowest. */
  adds: string
}

export const DENSITY_LEVELS: readonly DensityLevel[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    job: 'Is anything happening?',
    adds: 'The map and the headline figures, nothing else.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    job: 'What is happening?',
    adds: 'The ranked list, and the events that could not be placed.',
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    job: 'Can I believe it?',
    adds: 'Fusion, blind spots and source integrity — origins, coverage, refusals.',
  },
  {
    id: 'extreme',
    label: 'Extreme',
    job: 'Show me everything.',
    adds: 'Every section open and full-width rows. It is a wall, deliberately.',
  },
]

/**
 * Which sections each level opens.
 *
 * Cumulative by construction — a level shows everything the level below it does
 * — because a density control where turning it up *hides* something is a
 * control nobody can predict. The test holds this property rather than trusting
 * the table.
 */
const MINIMAL: readonly string[] = []
const BALANCED: readonly string[] = [...MINIMAL, 'sec-significant', 'sec-unplaceable']
const INTELLIGENCE: readonly string[] = [...BALANCED, 'sec-fusion', 'sec-coverage', 'sec-sources']

export const SECTIONS_BY_DENSITY: Record<Density, readonly string[]> = {
  minimal: MINIMAL,
  balanced: BALANCED,
  // Extreme opens whatever exists, so it is not a list — see `opensAll`.
  intelligence: INTELLIGENCE,
  extreme: INTELLIGENCE,
}

/** Row detail that goes with each level. Density moves this; it is not separate. */
export const PANEL_SIZE_BY_DENSITY: Record<Density, PanelSize> = {
  minimal: 'compact',
  balanced: 'regular',
  intelligence: 'regular',
  extreme: 'wide',
}

/**
 * Whether this level opens every section that exists, including ones added
 * after this table was written.
 *
 * Only `extreme` does, and that is the point of it: a level meaning "everything"
 * must not quietly mean "everything I knew about in August". A new section
 * appearing closed at Extreme would be the same silent omission this codebase
 * keeps finding.
 */
export function opensAll(density: Density): boolean {
  return density === 'extreme'
}

/**
 * Should this section be collapsed at this density?
 *
 * The one function the view calls. Returns `true` to collapse, matching
 * `isCollapsed`'s sense, so the call site reads the same as the hand-collapse
 * it replaces.
 */
export function collapsedAt(density: Density, sectionId: string): boolean {
  if (opensAll(density)) return false
  return !SECTIONS_BY_DENSITY[density].includes(sectionId)
}

/** A stored value, or the default. Never trusts what came out of storage. */
export function parseDensity(value: unknown): Density {
  return typeof value === 'string' && (DENSITIES as readonly string[]).includes(value)
    ? (value as Density)
    : DEFAULT_DENSITY
}
