/**
 * Natural hazards as one family, split into what happened and what was warned.
 *
 * ## The problem this solves
 *
 * Thirteen of the board's twenty-five categories are natural hazards —
 * earthquake, volcano, storm, flood, wildfire, drought, landslide, ice, dust,
 * temperature, water, tsunami and the catch-all "natural". They are also, by a
 * wide margin, the highest-volume categories, because the agencies that publish
 * them are automated and publish continuously.
 *
 * The result was that a reader looking for the world saw thirteen separate
 * streams of weather, interleaved with everything else, repeating. The owner's
 * words: *"فقد ازعجنا رئيتها كثيرا في الاخبار وتداخل"* — we are tired of seeing
 * them all through the news, overlapping. That is a correct read of a real
 * design fault: thirteen labels for one kind of thing is not thirteen kinds of
 * information.
 *
 * ## The split that matters, and why it is not cosmetic
 *
 * Inside that family there are two genuinely different claims, and conflating
 * them is what makes the volume feel like noise:
 *
 *  - **An event** is a measurement of something that has happened. An
 *    earthquake of M 6.9 occurred. A volcano is erupting. A fire is burning
 *    this many hectares. It is a fact with an instrument behind it.
 *  - **A warning** is an agency's statement about what *may* happen, issued to
 *    a population. A flood warning until 6:30PM. A thunderstorm watch.
 *
 * A warning is re-issued, extended, amended and superseded — which is exactly
 * why they dominate by count and why they repeat. An event happens once.
 *
 * Keeping them apart lets a reader ask the two questions separately: *what has
 * happened*, and *what is anyone being told to prepare for*. Merged, neither
 * question can be answered, and the answer to both looks like a wall of county
 * weather.
 *
 * ## How the two are told apart
 *
 * From what the publisher actually said, never from a guess:
 *
 *  1. **An agency alert level** (`alertLevel`) is the strongest signal. An
 *     agency setting "Red" or "Severe" is by definition issuing a warning.
 *  2. **The publisher's own wording.** Meteorological services name these
 *     documents in a standard way — warning, watch, advisory, alert, بيان
 *     تحذيري — and that wording is in the title they published.
 *  3. **A measurement with no alert** is an event: a magnitude, an area, a
 *     water level. Nobody issues a magnitude to a population.
 *
 * Where none of the three applies, it is treated as an **event**, deliberately.
 * A record with no alert wording and no measurement is more likely a report of
 * something that occurred than an unlabelled warning, and the failure mode of
 * the other default is worse: a real event hidden in a warnings list is a
 * missed event, while a warning shown among events is merely untidy.
 */

/**
 * The categories that are one family.
 *
 * Listed rather than derived, because "is this a natural hazard" is a judgement
 * about the world and not a property the data carries. `manmade` is absent on
 * purpose — an industrial accident is a hazard but it is not a natural one, and
 * folding it in here would make the family mean "anything dangerous", which is
 * not a category anybody can reason about.
 */
export const NATURAL_HAZARD_CATEGORIES: ReadonlySet<string> = new Set([
  'seismic',
  'volcano',
  'tsunami',
  'storm',
  'flood',
  'wildfire',
  'drought',
  'landslide',
  'ice',
  'dust',
  'temperature',
  'water',
  'natural',
])

export function isNaturalHazard(category: string): boolean {
  return NATURAL_HAZARD_CATEGORIES.has(category)
}

export type HazardKind = 'event' | 'warning'

/**
 * The words agencies use when they are warning a population.
 *
 * English and Arabic, because our readers get both and a board that split
 * correctly in one language and not the other would be worse than one that did
 * not split at all — the reader would trust a division that was only sometimes
 * real.
 *
 * `advisory` and `outlook` are included: both are forward-looking statements to
 * the public, which is the thing being separated, whatever their severity.
 */
const WARNING_WORDS = [
  'warning',
  'watch',
  'advisory',
  'alert',
  'outlook',
  'statement',
  'bulletin',
  'تحذير',
  'إنذار',
  'انذار',
  'تنبيه',
  'بيان',
]

export interface HazardCandidate {
  title: string
  /** The agency's own alert wording, where it issued one. */
  alertLevel: string | null
  /** A measured quantity, where an instrument produced one. */
  magnitude: number | null
}

/**
 * Whether this is something that happened, or something being warned about.
 *
 * See the header for why the unknown case falls to `event`.
 */
export function hazardKind(candidate: HazardCandidate): HazardKind {
  // An agency setting an alert level is issuing a warning, by definition.
  if (candidate.alertLevel && candidate.alertLevel.trim()) return 'warning'

  const title = candidate.title.toLowerCase()
  if (WARNING_WORDS.some((word) => title.includes(word))) return 'warning'

  return 'event'
}

/**
 * Split a set of hazards into the two questions.
 *
 * Returns both lists rather than a filtered one, because a board that showed
 * only events would be hiding live warnings from people who may be under them —
 * which is the one thing a hazard surface must never do.
 */
export function splitHazards<T extends HazardCandidate>(
  items: readonly T[],
): { events: T[]; warnings: T[] } {
  const events: T[] = []
  const warnings: T[] = []
  for (const item of items) {
    if (hazardKind(item) === 'warning') warnings.push(item)
    else events.push(item)
  }
  return { events, warnings }
}
