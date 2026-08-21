/**
 * Make a publisher's shorthand readable, without inventing anything.
 *
 * ## The problem
 *
 * Agencies write for people who already know their vocabulary. NASA's space
 * weather feed publishes an event whose entire headline is `CME`. Japan's
 * seismic feed publishes `八丈島東方沖` — a sea area east of Hachijōjima, with
 * no word anywhere saying an earthquake happened there. CoinGecko publishes
 * `XRP`.
 *
 * Every one of those is true, sourced and timestamped, and every one is
 * unreadable to the person the product is for. The owner's verdict on the
 * board: *"لن يفهمها اي مستخدم مهما كان نوعه وخبرته"* — no user of any kind or
 * level of experience will understand it. That is a fair description of a row
 * that says `RBE` and nothing else.
 *
 * ## The rule this obeys
 *
 * **Only restate what the record already carries.** The category, the
 * magnitude, and the publisher's own published expansion of its own
 * abbreviation. Nothing here consults an outside source, guesses at a location,
 * or characterises an event. `八丈島東方沖` becomes *"Earthquake M4.7 —
 * 八丈島東方沖"* because the record already said `seismic` and `4.7`; it never
 * becomes "Earthquake near Tokyo", which would be a claim the publisher did not
 * make.
 *
 * The original text is always kept, never replaced. A reader who does know the
 * vocabulary — and an auditor checking us against the source — must still see
 * exactly what the publisher wrote.
 *
 * ## Why this is not translation
 *
 * A Japanese place name stays in Japanese. Translating it would be a different
 * feature with different risks, and the thing that made the row unreadable was
 * not the language: it was the absence of any statement of *what happened*. A
 * reader who cannot read `八丈島東方沖` can still act on "Earthquake M4.7".
 */

/**
 * NASA DONKI's event-type codes, expanded as NASA itself expands them.
 *
 * Taken from the publisher's own documentation rather than inferred, because an
 * expansion we invented would be our claim wearing their authority.
 */
const DONKI_CODES: Record<string, string> = {
  CME: 'Coronal mass ejection',
  IPS: 'Interplanetary shock',
  FLR: 'Solar flare',
  SEP: 'Solar energetic particle event',
  MPC: 'Magnetopause crossing',
  RBE: 'Radiation belt enhancement',
  HSS: 'High-speed solar wind stream',
  GST: 'Geomagnetic storm',
  WSA: 'Solar wind model run',
  MSE: 'Magnetospheric event',
}

/**
 * What a category *is*, in one plain noun, for prefixing a bare location.
 *
 * Deliberately narrower than the board's category labels: only the categories
 * whose publishers are known to headline with a bare place or measurement are
 * listed. Everything else is left exactly as the publisher wrote it — a prefix
 * added where none was needed is noise, and noise was the original complaint.
 */
const EVENT_NOUN: Record<string, string> = {
  seismic: 'Earthquake',
  volcano: 'Volcanic activity',
  tsunami: 'Tsunami report',
  flood: 'Flooding',
  wildfire: 'Wildfire',
  storm: 'Storm',
  landslide: 'Landslide',
  space: 'Space weather',
  markets: 'Market move',
  economy: 'Market move',
}

/** Does this text state anything at all beyond a bare token? */
function isBareToken(title: string): boolean {
  const t = title.trim()
  if (t.length === 0) return true
  // An all-caps acronym of two to five letters: CME, RBE, SEP, XRP.
  if (/^[A-Z]{2,5}$/.test(t)) return true
  // A short string with no Latin and no Arabic letters — a CJK place name on
  // its own. Length-bounded so a real CJK sentence is left alone.
  if (t.length <= 20 && !/[A-Za-z؀-ۿ]/.test(t)) return true
  return false
}

export interface LegibleInput {
  title: string
  category: string
  magnitude: number | null
  magnitudeUnit?: string | null
  sourceKey: string
}

/**
 * The headline a reader can act on.
 *
 * Returns the original untouched whenever it already says something — which is
 * the overwhelming majority of rows. This exists for the handful that do not.
 */
export function legibleTitle(input: LegibleInput): string {
  const title = input.title.trim()
  if (!isBareToken(title)) return title

  /**
   * A publisher's own code, expanded by that publisher's own glossary. Scoped
   * to the source that uses it: `CME` means something else entirely in a
   * financial feed, and a global code table would eventually mistranslate one.
   */
  if (input.sourceKey.startsWith('nasa_donki')) {
    const expanded = DONKI_CODES[title.toUpperCase()]
    if (expanded) return `${expanded} (${title})`
  }

  const noun = EVENT_NOUN[input.category]
  if (!noun) return title

  /**
   * The measurement, when the record carries one. `M 4.7` for seismic, because
   * that is how every seismic agency writes it; the unit otherwise, because a
   * bare number next to a word is not a measurement.
   */
  const measure =
    input.magnitude === null
      ? ''
      : input.category === 'seismic'
        ? ` M${input.magnitude}`
        : input.magnitudeUnit
          ? ` ${input.magnitude} ${input.magnitudeUnit}`
          : ''

  return `${noun}${measure} — ${title}`
}
