/**
 * A mark per kind of thing, drawn — not a coloured number.
 *
 * ## The complaint this answers
 *
 * The map drew every event as a coloured disc, and a merged cluster as that
 * disc with a numeral inside it. The owner's verdict was blunt and correct:
 * *«نظام الأرقام ملونة … غير فعال وغير مفهوم ابدا»* — the coloured-number system
 * is not effective and not understandable at all. He is right, and the reason is
 * structural rather than aesthetic:
 *
 * - **A colour is not a name.** Twenty-five categories share a hue wheel; two
 *   oranges eight degrees apart are the same orange to everyone who is not
 *   holding the legend. The legend was elsewhere on the page.
 * - **The number answered a question nobody asked.** "17" tells a reader how
 *   many marks were merged. It does not tell them whether those are earthquakes
 *   or power cuts, which is the only thing worth knowing at a glance.
 * - **Nothing moved for a reason.** One pulse ring was reused for every urgent
 *   signal, so motion carried no information either.
 *
 * So: **each thing gets its own shape, its own motion, and its own reading.**
 * The count survives as a small badge — it is real information — but it is no
 * longer the whole mark.
 *
 * ## Why these are drawn rather than typed
 *
 * No emoji and no icon font. An emoji is a different picture on every operating
 * system, is unreadable at the ten pixels a distant mark gets, and would put a
 * foreign asset inside our own renderer. Every glyph here is vector strokes on
 * the canvas we already own, legible from about eight pixels up.
 *
 * ## The motion vocabulary, and the rule it follows
 *
 * Motion describes the thing, never its urgency — urgency is severity and has
 * its own ring. A reader who learns one of these has learned all of them:
 *
 * | Kind | Shape | Motion | Why that motion |
 * |---|---|---|---|
 * | seismic | ripple rings | rings expand outward | that is what a wave front does |
 * | storm | spiral | rotates | a cyclone rotates |
 * | wildfire | flame | flickers in height | fire is not steady |
 * | flood | wave | oscillates sideways | water moves along |
 * | volcano | cone + plume | plume rises and fades | ash rises |
 * | health | ring of satellites | orbits | spread outward from a source |
 * | conflict | crossed strokes | strikes on the beat | impact, not drift |
 * | cyber | hexagon | scans top to bottom | a sweep through a system |
 * | energy | bolt | flashes | power is on or it is not |
 * | transport | chevron | drifts forward | movement along a route |
 *
 * `phase` is a number in [0,1) supplied by the renderer's own clock, so nothing
 * here holds state and every glyph is a pure function of its arguments — which
 * is what makes them testable at all.
 */

/** The slice of the canvas context a glyph may use. Nothing else is permitted. */
export interface GlyphSurface {
  beginPath(): void
  closePath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void
  stroke(): void
  fill(): void
  save(): void
  restore(): void
  lineWidth: number
  /**
   * The union the real canvas uses. A glyph only ever assigns a colour string,
   * but the surface it is handed is a `CanvasRenderingContext2D`, and narrowing
   * these to `string` here would make the real context unassignable to the very
   * interface written to describe it.
   */
  strokeStyle: string | CanvasGradient | CanvasPattern
  fillStyle: string | CanvasGradient | CanvasPattern
  globalAlpha: number
  lineCap: CanvasLineCap
  lineJoin: CanvasLineJoin
}

/**
 * Draw one mark.
 *
 * `size` is the radius the mark may occupy; nothing may be drawn outside it, or
 * neighbouring marks overlap and the clustering that placed them is wasted.
 * `phase` runs 0→1 and wraps.
 */
export type GlyphDraw = (surface: GlyphSurface, x: number, y: number, size: number, phase: number) => void

/** Whether a glyph's drawing changes with `phase`. Used by the renderer and by tests. */
export interface GlyphSpec {
  draw: GlyphDraw
  animated: boolean
  /** One line, shown when a reader selects the mark. */
  reading: string
}

const TAU = Math.PI * 2

/** Ease a 0→1 phase into a there-and-back 0→1→0, for anything that oscillates. */
function pingPong(phase: number): number {
  return 1 - Math.abs(phase * 2 - 1)
}

/** A filled dot — the fallback, and the right mark for a thing with no shape. */
const dot: GlyphDraw = (s, x, y, size) => {
  s.beginPath()
  s.arc(x, y, size * 0.62, 0, TAU)
  s.fill()
}

/**
 * Concentric rings expanding outward, with a solid core.
 *
 * The core stays put because the epicentre does; only the front travels.
 */
const ripple: GlyphDraw = (s, x, y, size, phase) => {
  s.beginPath()
  s.arc(x, y, size * 0.28, 0, TAU)
  s.fill()
  const base = s.globalAlpha
  for (let i = 0; i < 2; i++) {
    const t = (phase + i * 0.5) % 1
    s.globalAlpha = base * (1 - t) * 0.9
    s.lineWidth = Math.max(1, size * 0.14)
    s.beginPath()
    s.arc(x, y, size * (0.35 + t * 0.62), 0, TAU)
    s.stroke()
  }
  s.globalAlpha = base
}

/** A two-armed spiral that turns. */
const spiral: GlyphDraw = (s, x, y, size, phase) => {
  const spin = phase * TAU
  s.lineWidth = Math.max(1, size * 0.2)
  s.lineCap = 'round'
  for (const arm of [0, Math.PI]) {
    s.beginPath()
    for (let i = 0; i <= 8; i++) {
      const t = i / 8
      const a = spin + arm + t * 2.6
      const r = size * 0.2 + t * size * 0.75
      const px = x + Math.cos(a) * r
      const py = y + Math.sin(a) * r
      if (i === 0) s.moveTo(px, py)
      else s.lineTo(px, py)
    }
    s.stroke()
  }
  s.beginPath()
  s.arc(x, y, size * 0.16, 0, TAU)
  s.fill()
}

/** A flame whose tip rises and falls. */
const flame: GlyphDraw = (s, x, y, size, phase) => {
  const lift = 0.82 + pingPong(phase) * 0.26
  s.beginPath()
  s.moveTo(x, y + size * 0.78)
  s.quadraticCurveTo(x - size * 0.82, y + size * 0.1, x - size * 0.2, y - size * 0.28)
  s.quadraticCurveTo(x - size * 0.26, y - size * 0.68 * lift, x, y - size * lift)
  s.quadraticCurveTo(x + size * 0.3, y - size * 0.6 * lift, x + size * 0.22, y - size * 0.24)
  s.quadraticCurveTo(x + size * 0.84, y + size * 0.12, x, y + size * 0.78)
  s.closePath()
  s.fill()
}

/**
 * Two stacked wave crests that slide sideways.
 *
 * The travel is a sine of the phase, not a linear ramp. A ramp was the first
 * version and it jumped half the mark's width at every wrap, at full opacity —
 * a visible glitch, caught by the cycle-continuity test rather than by looking
 * at it. Water oscillates anyway, so the sine is also the truer motion.
 */
const wave: GlyphDraw = (s, x, y, size, phase) => {
  const shift = Math.sin(phase * TAU) * size * 0.25
  s.lineWidth = Math.max(1, size * 0.2)
  s.lineCap = 'round'
  for (const row of [-0.3, 0.3]) {
    s.beginPath()
    s.moveTo(x - size * 0.85, y + size * row)
    s.quadraticCurveTo(x - size * 0.4 + shift, y + size * (row - 0.42), x + shift * 0.2, y + size * row)
    s.quadraticCurveTo(x + size * 0.45 + shift, y + size * (row + 0.42), x + size * 0.85, y + size * row)
    s.stroke()
  }
}

/** A cone with a plume that rises and thins. */
const volcano: GlyphDraw = (s, x, y, size, phase) => {
  s.beginPath()
  s.moveTo(x - size * 0.85, y + size * 0.75)
  s.lineTo(x - size * 0.22, y - size * 0.15)
  s.lineTo(x + size * 0.22, y - size * 0.15)
  s.lineTo(x + size * 0.85, y + size * 0.75)
  s.closePath()
  s.fill()
  const base = s.globalAlpha
  const rise = phase
  s.globalAlpha = base * (1 - rise) * 0.85
  s.beginPath()
  s.arc(x, y - size * (0.3 + rise * 0.6), size * (0.18 + rise * 0.2), 0, TAU)
  s.fill()
  s.globalAlpha = base
}

/** A core with satellites orbiting it — spread from a source. */
const orbit: GlyphDraw = (s, x, y, size, phase) => {
  s.beginPath()
  s.arc(x, y, size * 0.3, 0, TAU)
  s.fill()
  for (let i = 0; i < 3; i++) {
    const a = phase * TAU + (i * TAU) / 3
    s.beginPath()
    s.arc(x + Math.cos(a) * size * 0.72, y + Math.sin(a) * size * 0.72, size * 0.18, 0, TAU)
    s.fill()
  }
}

/** Two crossed strokes that strike on the beat. */
const cross: GlyphDraw = (s, x, y, size, phase) => {
  const strike = 0.78 + pingPong(phase) * 0.22
  const r = size * strike
  s.lineWidth = Math.max(1.2, size * 0.24)
  s.lineCap = 'round'
  s.beginPath()
  s.moveTo(x - r * 0.7, y - r * 0.7)
  s.lineTo(x + r * 0.7, y + r * 0.7)
  s.moveTo(x + r * 0.7, y - r * 0.7)
  s.lineTo(x - r * 0.7, y + r * 0.7)
  s.stroke()
}

/** A hexagon with a scan line crossing it. */
const hexScan: GlyphDraw = (s, x, y, size, phase) => {
  s.lineWidth = Math.max(1, size * 0.16)
  s.lineJoin = 'round'
  s.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i * TAU) / 6 - Math.PI / 2
    const px = x + Math.cos(a) * size * 0.82
    const py = y + Math.sin(a) * size * 0.82
    if (i === 0) s.moveTo(px, py)
    else s.lineTo(px, py)
  }
  s.closePath()
  s.stroke()
  /**
   * The scan line runs top to bottom and restarts — which is what a sweep does,
   * and would be a visible jump if it restarted while still opaque. It fades in
   * and out across its travel instead, so the restart happens at zero.
   */
  const base = s.globalAlpha
  const yScan = y + (phase * 2 - 1) * size * 0.6
  s.globalAlpha = base * Math.sin(phase * Math.PI)
  s.beginPath()
  s.moveTo(x - size * 0.5, yScan)
  s.lineTo(x + size * 0.5, yScan)
  s.stroke()
  s.globalAlpha = base
}

/** A bolt that flashes on and off rather than fading. */
const bolt: GlyphDraw = (s, x, y, size, phase) => {
  const base = s.globalAlpha
  // On for the first two-thirds. Power is on or it is not.
  s.globalAlpha = base * (phase < 0.66 ? 1 : 0.35)
  s.beginPath()
  s.moveTo(x + size * 0.28, y - size * 0.85)
  s.lineTo(x - size * 0.42, y + size * 0.1)
  s.lineTo(x - size * 0.02, y + size * 0.1)
  s.lineTo(x - size * 0.28, y + size * 0.85)
  s.lineTo(x + size * 0.45, y - size * 0.12)
  s.lineTo(x + size * 0.04, y - size * 0.12)
  s.closePath()
  s.fill()
  s.globalAlpha = base
}

/**
 * A chevron travelling along its own axis.
 *
 * Two attempts, and the second is the honest one. The first drifted strictly
 * forward on the reasoning that movement along a route has a direction — and it
 * jumped back a third of the mark at every wrap, in full view. Fading it out at
 * the ends fixed the jump and introduced a worse fault: a route marker that
 * blinks out twice a second is a marker a reader cannot rely on being there.
 *
 * So the travel is a sine and the mark stays visible throughout. Direction is
 * not lost by this — it is carried by the chevron's shape, which points, and a
 * pointing mark that breathes along its axis reads as travel without ever
 * leaving the map.
 */
const chevron: GlyphDraw = (s, x, y, size, phase) => {
  const drift = Math.sin(phase * TAU) * size * 0.18
  s.lineWidth = Math.max(1.2, size * 0.22)
  s.lineCap = 'round'
  s.lineJoin = 'round'
  s.beginPath()
  s.moveTo(x - size * 0.55, y + size * 0.38 + drift)
  s.lineTo(x, y - size * 0.4 + drift)
  s.lineTo(x + size * 0.55, y + size * 0.38 + drift)
  s.stroke()
}

/** A square that does not move — for anything structural. */
const block: GlyphDraw = (s, x, y, size) => {
  s.beginPath()
  s.moveTo(x - size * 0.6, y - size * 0.6)
  s.lineTo(x + size * 0.6, y - size * 0.6)
  s.lineTo(x + size * 0.6, y + size * 0.6)
  s.lineTo(x - size * 0.6, y + size * 0.6)
  s.closePath()
  s.fill()
}

/** A ring — an outline rather than a fill, for advisories and observations. */
const ring: GlyphDraw = (s, x, y, size) => {
  s.lineWidth = Math.max(1, size * 0.24)
  s.beginPath()
  s.arc(x, y, size * 0.6, 0, TAU)
  s.stroke()
}

/** An upward wedge — for anything measured on a rising scale. */
const wedge: GlyphDraw = (s, x, y, size) => {
  s.beginPath()
  s.moveTo(x, y - size * 0.75)
  s.lineTo(x + size * 0.7, y + size * 0.6)
  s.lineTo(x - size * 0.7, y + size * 0.6)
  s.closePath()
  s.fill()
}

const spec = (draw: GlyphDraw, animated: boolean, reading: string): GlyphSpec => ({
  draw,
  animated,
  reading,
})

/**
 * One entry per category the world report can produce.
 *
 * Exhaustive on purpose: a category with no glyph would silently fall back to a
 * dot, which is the state this module exists to end. The test asserts every
 * category in `CATEGORY_META` is present here.
 */
export const GLYPHS: Record<string, GlyphSpec> = {
  seismic: spec(ripple, true, 'Ground movement — rings travel outward from where it was measured'),
  tsunami: spec(wave, true, 'A wave warning — the crest travels'),
  volcano: spec(volcano, true, 'A volcano — the plume rises above the cone'),
  landslide: spec(wedge, false, 'Ground giving way'),
  storm: spec(spiral, true, 'A rotating storm'),
  wildfire: spec(flame, true, 'Fire — the flame is not steady'),
  flood: spec(wave, true, 'Water on the move'),
  drought: spec(wedge, false, 'Absence of water, measured over time'),
  ice: spec(wedge, false, 'Ice and snow conditions'),
  dust: spec(orbit, true, 'Airborne dust, spreading from a source'),
  temperature: spec(wedge, false, 'A temperature extreme'),
  water: spec(wave, true, 'Water conditions'),
  natural: spec(ripple, true, 'A natural hazard'),
  health: spec(orbit, true, 'A health signal spreading from a source'),
  humanitarian: spec(ring, false, 'A humanitarian situation'),
  conflict: spec(cross, true, 'Armed conflict — the strike is on the beat'),
  manmade: spec(cross, true, 'A man-made incident'),
  cyber: spec(hexScan, true, 'A cyber signal — the scan crosses the system'),
  energy: spec(bolt, true, 'Power — on, or not'),
  infrastructure: spec(block, false, 'Fixed infrastructure'),
  transport: spec(chevron, true, 'Movement along a route'),
  space: spec(orbit, true, 'Something in orbit or beyond it'),
  economy: spec(wedge, false, 'An economic measure'),
  research: spec(ring, false, 'A research finding'),
  world: spec(dot, false, 'A world signal'),
}

/** The mark for a category, or the plain dot for one we have never seen. */
export function glyphFor(category: string | null | undefined): GlyphSpec {
  if (!category) return spec(dot, false, 'A signal')
  return GLYPHS[category] ?? spec(dot, false, 'A signal')
}

/** Whether anything on screen needs a frame loop at all. */
export function anyAnimated(categories: Iterable<string>): boolean {
  for (const c of categories) if (glyphFor(c).animated) return true
  return false
}
