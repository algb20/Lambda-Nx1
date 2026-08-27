/**
 * What a person has chosen, and what it means.
 *
 * ## The defect this exists for
 *
 * Every setting on the globe — the layer, the muted categories, the region, the
 * time window, globe-or-map — lived in `useState` inside one component. Switching
 * tabs unmounted it and threw all of it away. A user who spent a minute setting
 * the board up to watch two things lost that minute every time they looked at
 * anything else, which is not a small annoyance: it teaches them not to bother
 * configuring anything, and then the configurability may as well not exist.
 *
 * ## Why the shape is validated rather than trusted
 *
 * These values come back from `localStorage` — a store the user can edit, that
 * survives a deploy, and that will one day contain a shape this build has never
 * seen. Reading it with a cast would put `undefined` where a `Set` is expected
 * and crash the panel on load, for a stranger, with no way back except clearing
 * site data. So every field is checked on the way in and anything unrecognised
 * is replaced by its default. A preference is a convenience; it must never be
 * able to break the product.
 *
 * `VERSION` is the escape hatch for a change too large to migrate field by
 * field: bump it and every stored blob is discarded once, deliberately.
 *
 * Pure and dependency-free on purpose — the browser, the API route and the
 * tests all read this same file.
 */

import { DEFAULT_DENSITY, parseDensity, type Density } from './density'

export const PREFS_VERSION = 1

/** How many gateways a person may pin to the front page. */
export const MIN_HOME_GATEWAYS = 1
export const MAX_HOME_GATEWAYS = 5

export type PanelSize = 'compact' | 'regular' | 'wide'

export const PANEL_SIZES: ReadonlyArray<{ id: PanelSize; label: string; note: string }> = [
  { id: 'compact', label: 'Compact', note: 'Headlines only — most panels visible at once' },
  { id: 'regular', label: 'Regular', note: 'Headline, source and time' },
  { id: 'wide', label: 'Wide', note: 'Full detail and the analytic note, one panel per row' },
]

export interface Prefs {
  version: number
  globe: {
    /** `globe` or `map` — the projection the user last chose. */
    view: 'globe' | 'map'
    /** Which data layer is drawn. */
    layer: string
    /** Categories the user has switched **off**. Empty means show everything. */
    muted: string[]
    /** Region filter, or `all`. */
    region: string
    /** Hours of history, or null for everything we hold. */
    windowHours: number | null
    /**
     * Categories the user has opened a panel for, in the order they arranged
     * them. Order is the user's, so it is stored as a list rather than a set.
     */
    panels: string[]
    panelSize: PanelSize
    /**
     * How much of the analysis is on screen at once.
     *
     * One axis rather than two: it *chooses* the panel size above rather than
     * competing with it — see `lib/prefs/density` for why a second independent
     * density knob would have left the product unable to say what "dense" means.
     */
    density: Density
  }
  /** Gateways pinned to the front page, in the user's own order. */
  homeGateways: string[]
}

export const DEFAULT_PREFS: Prefs = {
  version: PREFS_VERSION,
  globe: {
    view: 'globe',
    layer: 'events',
    muted: [],
    region: 'all',
    windowHours: null,
    // Nothing opened by default. A first visit that immediately renders nine
    // panels is the wall of noise this platform keeps being told it is.
    panels: [],
    panelSize: 'regular',
    density: DEFAULT_DENSITY,
  },
  homeGateways: [],
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 && value.length < 64 ? value : fallback
}

/**
 * A list of short identifiers, deduplicated, bounded and order-preserving.
 *
 * Bounded because this is user-editable storage: without a cap, a hand-edited
 * blob with fifty thousand entries renders fifty thousand panels and hangs the
 * tab. Order-preserving because for `panels` and `homeGateways` the order *is*
 * the preference.
 */
function idList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !item || item.length > 64) continue
    if (!out.includes(item)) out.push(item)
    if (out.length >= max) break
  }
  return out
}

/**
 * Read anything and return a `Prefs` this build can use.
 *
 * Never throws, never returns a partial object. A blob from a future version, a
 * hand-edited string, `null` — all produce defaults rather than a crash.
 */
export function parsePrefs(raw: unknown): Prefs {
  if (!raw || typeof raw !== 'object') return structuredCloneish(DEFAULT_PREFS)
  const input = raw as Record<string, unknown>

  // A stored blob from a different generation is discarded rather than guessed
  // at. This is the one case where losing a preference is the right outcome.
  if (input.version !== PREFS_VERSION) return structuredCloneish(DEFAULT_PREFS)

  const globe = (input.globe && typeof input.globe === 'object' ? input.globe : {}) as Record<string, unknown>
  const view = globe.view === 'map' ? 'map' : 'globe'
  const size = PANEL_SIZES.some((s) => s.id === globe.panelSize)
    ? (globe.panelSize as PanelSize)
    : DEFAULT_PREFS.globe.panelSize

  const hours = globe.windowHours
  return {
    version: PREFS_VERSION,
    globe: {
      view,
      layer: str(globe.layer, DEFAULT_PREFS.globe.layer),
      muted: idList(globe.muted, 64),
      region: str(globe.region, DEFAULT_PREFS.globe.region),
      // A window of zero or a negative one would filter everything away and
      // read as "the platform is broken".
      windowHours: typeof hours === 'number' && Number.isFinite(hours) && hours > 0 ? hours : null,
      panels: idList(globe.panels, 32),
      panelSize: size,
      density: parseDensity(globe.density),
    },
    homeGateways: idList(input.homeGateways, MAX_HOME_GATEWAYS),
  }
}

/** `structuredClone` is not in every runtime this file is parsed by. */
function structuredCloneish(prefs: Prefs): Prefs {
  return {
    version: prefs.version,
    globe: { ...prefs.globe, muted: [...prefs.globe.muted], panels: [...prefs.globe.panels] },
    homeGateways: [...prefs.homeGateways],
  }
}

/** True when two preference sets are the same, so a no-op is not saved. */
export function prefsEqual(a: Prefs, b: Prefs): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
