/**
 * The globe's view, in the address bar.
 *
 * ## What this is for
 *
 * The owner pointed at a competitor's dashboard, and the most useful thing in
 * the link he sent was not the page — it was the link:
 *
 *     ?lat=0.0000&lon=-1.3773&zoom=1.00&view=africa&timeRange=7d
 *     &layers=conflicts,hotspots,sanctions,weather,outages,natural
 *
 * That is a whole board state carried in a URL: camera, region, time window and
 * the set of layers drawn. It means an analyst can send a colleague **exactly
 * what they are looking at**. We had none of it — every one of those settings
 * lived in preferences, which is right for "remember what I chose" and useless
 * for "look at this".
 *
 * So the two live side by side and neither is redundant:
 *
 * - **Preferences** answer *what do I usually want*. They persist per reader,
 *   across devices, and they are the default when a link says nothing.
 * - **The URL** answers *what am I pointing at right now*. It overrides
 *   preferences for that visit, and it is what a share button copies.
 *
 * ## Why the parser is this defensive
 *
 * A shared link is typed, truncated, wrapped by a mail client and rewritten by
 * a chat app. Every field here therefore falls back to the reader's own
 * preference rather than to an error, and a value outside its allowed set is
 * ignored rather than honoured — a link asking for `layer=<script>` gets the
 * reader's layer, not a broken page.
 *
 * ## Why defaults are omitted when writing
 *
 * A URL that spells out every field is unreadable and, worse, it pins settings
 * the sharer never chose. `?layer=latency` says one thing deliberately; a
 * fourteen-parameter URL says everything accidentally.
 */

/** The analytic layers the globe can draw. Mirrors `LAYER_META` in globe-view. */
export const VIEW_LAYERS = ['events', 'corroboration', 'latency', 'coverage', 'liquidity'] as const
export type ViewLayer = (typeof VIEW_LAYERS)[number]

export const VIEW_MODES = ['globe', 'map'] as const
export type ViewMode = (typeof VIEW_MODES)[number]

/**
 * The time windows the scrubber offers, in hours. `null` is "everything held",
 * which is the default and is *not* the same as a very large window: it means
 * the filter is off, and the surface says so.
 */
export const VIEW_WINDOWS: Array<number | null> = [null, 6, 24, 72]

export interface GlobeViewState {
  mode: ViewMode
  layer: ViewLayer
  /** A region key, or `all`. Not validated against the atlas — see below. */
  region: string
  windowHours: number | null
  /** Camera centre in degrees, or null to leave the camera where it is. */
  lat: number | null
  lon: number | null
  /** Camera zoom, or null for untouched. */
  zoom: number | null
}

export interface ViewDefaults {
  mode: ViewMode
  layer: ViewLayer
  region: string
  windowHours: number | null
}

/** Every key this module reads or writes — used to detect "the URL said nothing". */
export const VIEW_KEYS = ['view', 'layer', 'region', 'window', 'lat', 'lon', 'zoom'] as const

const isFinite = (n: number) => Number.isFinite(n)

function readNumber(raw: string | null, min: number, max: number): number | null {
  if (raw === null || raw.trim() === '') return null
  const n = Number(raw)
  if (!isFinite(n) || n < min || n > max) return null
  return n
}

/**
 * Read a view from a query string, falling back to the reader's own defaults.
 *
 * `search` is anything `URLSearchParams` accepts — `location.search` included.
 */
export function parseViewState(search: string, defaults: ViewDefaults): GlobeViewState {
  const q = new URLSearchParams(search)

  const modeRaw = q.get('view')
  const mode = (VIEW_MODES as readonly string[]).includes(modeRaw ?? '')
    ? (modeRaw as ViewMode)
    : defaults.mode

  const layerRaw = q.get('layer')
  const layer = (VIEW_LAYERS as readonly string[]).includes(layerRaw ?? '')
    ? (layerRaw as ViewLayer)
    : defaults.layer

  /**
   * The region is *not* checked against the atlas here.
   *
   * Which regions exist depends on the sweep that just ran — a region with no
   * events in it is not offered — so a link shared an hour ago can legitimately
   * name one that is momentarily absent. Rejecting it here would silently drop
   * a valid share; the surface simply shows nothing for it and the chip is
   * absent, which is the honest outcome. What is rejected is a value that could
   * not be a key at all.
   */
  const regionRaw = q.get('region')
  const region =
    regionRaw && /^[a-z0-9_-]{1,32}$/i.test(regionRaw) ? regionRaw : defaults.region

  const windowRaw = q.get('window')
  let windowHours = defaults.windowHours
  if (windowRaw !== null) {
    if (windowRaw === 'all') windowHours = null
    else {
      const n = Number(windowRaw)
      windowHours = VIEW_WINDOWS.includes(n) ? n : defaults.windowHours
    }
  }

  return {
    mode,
    layer,
    region,
    windowHours,
    lat: readNumber(q.get('lat'), -90, 90),
    lon: readNumber(q.get('lon'), -180, 180),
    zoom: readNumber(q.get('zoom'), 0.2, 32),
  }
}

/** True when the query string names none of our keys — so preferences win outright. */
export function hasViewState(search: string): boolean {
  const q = new URLSearchParams(search)
  return VIEW_KEYS.some((k) => q.has(k))
}

/**
 * Write a view to a query string, omitting anything equal to the defaults.
 *
 * Returns `''` when nothing differs, so the address bar of a reader who has
 * changed nothing stays clean.
 */
export function toSearch(state: GlobeViewState, defaults: ViewDefaults): string {
  const q = new URLSearchParams()
  if (state.mode !== defaults.mode) q.set('view', state.mode)
  if (state.layer !== defaults.layer) q.set('layer', state.layer)
  if (state.region !== defaults.region) q.set('region', state.region)
  if (state.windowHours !== defaults.windowHours) {
    q.set('window', state.windowHours === null ? 'all' : String(state.windowHours))
  }
  /**
   * Coordinates are written to four decimals — about eleven metres, far finer
   * than a globe at any zoom can express and short enough to stay readable.
   * More digits would be precision the camera does not have.
   */
  if (state.lat !== null) q.set('lat', state.lat.toFixed(4))
  if (state.lon !== null) q.set('lon', state.lon.toFixed(4))
  if (state.zoom !== null) q.set('zoom', state.zoom.toFixed(2))
  const s = q.toString()
  return s === '' ? '' : `?${s}`
}

/**
 * Every field, whatever the defaults — for the share button.
 *
 * The address bar and a share link want different things, and conflating them
 * is a real bug rather than a nicety. The address bar should stay clean, so it
 * omits anything the reader has not changed. A share link must be **exact**:
 * if the sharer is looking at the events layer because that is the product
 * default, a link that omits `layer` shows the recipient *their* layer, not the
 * sharer's — and the whole point of sending a link is that both people see the
 * same thing.
 */
export function toCompleteSearch(state: GlobeViewState): string {
  const q = new URLSearchParams()
  q.set('view', state.mode)
  q.set('layer', state.layer)
  q.set('region', state.region)
  q.set('window', state.windowHours === null ? 'all' : String(state.windowHours))
  if (state.lat !== null) q.set('lat', state.lat.toFixed(4))
  if (state.lon !== null) q.set('lon', state.lon.toFixed(4))
  if (state.zoom !== null) q.set('zoom', state.zoom.toFixed(2))
  return `?${q.toString()}`
}

/** The full shareable link for a view — exact, not abbreviated. */
export function shareUrl(origin: string, path: string, state: GlobeViewState): string {
  return `${origin}${path}${toCompleteSearch(state)}`
}
