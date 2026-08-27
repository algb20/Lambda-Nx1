import type { EventCategory } from '@/lib/modules/world-events-shared'

/**
 * Which categories the map hides, after an operator gesture on the layer rail.
 *
 * Three lines of set arithmetic, in a module rather than inline in the view,
 * because one of them has an edge that is wrong in a way nobody would notice by
 * looking: isolating a category must mute the categories **present in this
 * run**, not the whole catalogue.
 *
 * Muting the catalogue looks equivalent and is not. The rail counts what is
 * hidden so it can offer to restore it, and a run carrying three categories out
 * of twenty-four would then report *twenty-three hidden* — twenty of which had
 * nothing to hide. The reader is told the map is heavily filtered when it is
 * showing everything that arrived.
 *
 * The same reasoning is why these take the present list as an argument instead
 * of importing the catalogue: the answer depends on the run, not on what the
 * engine can express.
 */

/** Hide everything except `keep`. The isolate gesture. */
export function onlyLayer(present: EventCategory[], keep: EventCategory): EventCategory[] {
  return present.filter((c) => c !== keep)
}

/** Show everything again. */
export function allLayers(): EventCategory[] {
  return []
}

/** Flip one category's visibility. */
export function toggleLayer(muted: EventCategory[], category: EventCategory): EventCategory[] {
  return muted.includes(category)
    ? muted.filter((c) => c !== category)
    : [...muted, category]
}

/**
 * How many of the categories on screen are hidden.
 *
 * Counted against `present` for the reason above, and it also means a stale
 * mute — a category hidden in an earlier run that no longer reports — costs
 * nothing and is not announced. Preferences persist across runs; the world does
 * not.
 */
export function hiddenCount(present: EventCategory[], muted: EventCategory[]): number {
  const hidden = new Set(muted)
  return present.filter((c) => hidden.has(c)).length
}
