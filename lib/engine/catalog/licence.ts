import type { CatalogSource, Licence } from './types'

/**
 * The data-licence registry.
 *
 * "It has a public API" and "we may put it in our product" are different
 * statements, and a platform that treats them as the same one is one complaint
 * away from having to tear a feature out. Availability is not permission —
 * that is charter §3, and this module is where it stops being a sentence in a
 * document and becomes something the engine enforces.
 *
 * Every catalogue entry declares its terms. Registration asks this module
 * whether the intended use is permitted, and a source that does not permit it
 * **is not registered** — not warned about, not flagged in a dashboard nobody
 * reads. If a licence forbids commercial redistribution and we are a commercial
 * product, that source cannot be in the build that ships.
 *
 * The costly cases are the ones this exists for. ACLED's terms restrict
 * redistribution and require attribution; OpenSky's terms require a prior
 * agreement for commercial use of the REST API. Both are genuinely useful
 * sources, and both are exactly the kind that a "we'll sort the licensing out
 * later" approach quietly ships without.
 */

/** How this deployment intends to use what it collects. */
export interface UsageContext {
  /** Is this a commercial product? Ours is (subscriptions), so: yes. */
  commercial: boolean
  /** Do we persist results beyond the request that fetched them? */
  storing: boolean
  /** Do we show the content itself, rather than only linking out? */
  redistributing: boolean
}

/**
 * Lambda's real posture, stated once.
 *
 * All three are true and it would be comfortable to pretend otherwise. We sell
 * subscriptions, we cache and archive findings, and we render the content
 * rather than only linking to it. Setting these honestly is what makes the
 * registry protective instead of decorative — a permissive `UsageContext` would
 * let every source through and reduce this module to paperwork.
 */
export const LAMBDA_USAGE: UsageContext = {
  commercial: true,
  storing: true,
  redistributing: true,
}

export type LicenceProblem = 'commercial' | 'storage' | 'redistribution'

/** Why this source may not be used here, or null if it may. */
export function licenceProblem(
  licence: Licence,
  usage: UsageContext = LAMBDA_USAGE,
): LicenceProblem | null {
  if (usage.commercial && !licence.commercialUse) return 'commercial'
  if (usage.storing && !licence.storage) return 'storage'
  if (usage.redistributing && !licence.redistribute) return 'redistribution'
  return null
}

export function licenceError(source: CatalogSource, problem: LicenceProblem): string {
  const where = source.licence.termsUrl ? ` See ${source.licence.termsUrl}.` : ''
  switch (problem) {
    case 'commercial':
      return `${source.key}: ${source.licence.name} does not permit commercial use.${where}`
    case 'storage':
      return `${source.key}: ${source.licence.name} does not permit storing results.${where}`
    case 'redistribution':
      return `${source.key}: ${source.licence.name} does not permit redistributing content.${where}`
  }
}

/** True when this source may be used under the given posture. */
export function isUsable(source: CatalogSource, usage: UsageContext = LAMBDA_USAGE): boolean {
  return licenceProblem(source.licence, usage) === null
}

/**
 * Split a catalogue into what may ship and what may not, with reasons.
 *
 * Both halves are returned rather than the excluded ones being dropped
 * silently. A source we cannot use is a real fact about our coverage — it
 * belongs in the blind-spot picture, and somebody should be able to see that a
 * licence, not a bug, is why a region is thin.
 */
export function partitionByLicence(
  sources: CatalogSource[],
  usage: UsageContext = LAMBDA_USAGE,
): { usable: CatalogSource[]; excluded: Array<{ source: CatalogSource; reason: string }> } {
  const usable: CatalogSource[] = []
  const excluded: Array<{ source: CatalogSource; reason: string }> = []
  for (const source of sources) {
    const problem = licenceProblem(source.licence, usage)
    if (problem) excluded.push({ source, reason: licenceError(source, problem) })
    else usable.push(source)
  }
  return { usable, excluded }
}

/**
 * The attribution lines we are obliged to display, deduplicated.
 *
 * An obligation nobody can see is an obligation being breached. This produces
 * the list the interface must render, so honouring a CC-BY licence is a
 * property of the build rather than of somebody remembering.
 */
export function requiredAttributions(sources: CatalogSource[]): string[] {
  const lines = new Set<string>()
  for (const s of sources) {
    if (s.licence.attribution) lines.add(s.licence.attribution)
  }
  return [...lines].sort()
}

// ── The licences themselves ─────────────────────────────────────────────────
//
// Shared objects rather than repeated literals: a licence restated per source
// is a licence that will be transcribed wrongly, and the wrong transcription
// will be the permissive one.

/** Work of a government body, released without restriction. */
export const PUBLIC_DOMAIN: Licence = {
  id: 'public-domain',
  name: 'Public domain (government work)',
  commercialUse: true,
  storage: true,
  redistribute: true,
}

export const CC0: Licence = {
  id: 'CC0-1.0',
  name: 'Creative Commons Zero 1.0',
  commercialUse: true,
  storage: true,
  redistribute: true,
}

export function ccBy(attribution: string, termsUrl?: string): Licence {
  return {
    id: 'CC-BY-4.0',
    name: 'Creative Commons Attribution 4.0',
    commercialUse: true,
    storage: true,
    redistribute: true,
    attribution,
    termsUrl,
  }
}

export function ccBySa(attribution: string, termsUrl?: string): Licence {
  return {
    id: 'CC-BY-SA-4.0',
    name: 'Creative Commons Attribution-ShareAlike 4.0',
    commercialUse: true,
    storage: true,
    redistribute: true,
    attribution,
    termsUrl,
  }
}

/**
 * A public feed intended for syndication.
 *
 * The bargain an RSS feed offers: take the headline, the summary and the link,
 * and send the reader back to the publisher. It does **not** license the full
 * article, which is why the feed adapter keeps the summary the publisher chose
 * to put in the feed and never fetches the page behind it.
 */
export function publicFeed(publisher: string, termsUrl?: string): Licence {
  return {
    id: 'feed-syndication',
    name: `${publisher} public feed (headline, summary and link)`,
    commercialUse: true,
    storage: true,
    redistribute: true,
    attribution: publisher,
    termsUrl,
  }
}

/**
 * Non-commercial only. Registering one of these in this product is a bug, and
 * the registry treats it as one.
 */
export function nonCommercial(name: string, termsUrl?: string): Licence {
  return {
    id: 'non-commercial',
    name,
    commercialUse: false,
    storage: true,
    redistribute: false,
    termsUrl,
  }
}

/**
 * Terms requiring a negotiated agreement before commercial use.
 *
 * Kept in the catalogue deliberately rather than deleted. A source we cannot
 * use *yet* is a coverage gap with a known remedy — someone signs an agreement
 * — and deleting the entry would erase both the gap and the remedy.
 */
export function needsAgreement(name: string, termsUrl: string): Licence {
  return {
    id: 'agreement-required',
    name: `${name} (commercial use requires a prior agreement)`,
    commercialUse: false,
    storage: true,
    redistribute: false,
    termsUrl,
  }
}
