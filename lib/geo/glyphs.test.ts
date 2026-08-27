import { describe, expect, it } from 'vitest'
import { anyAnimated, GLYPHS, glyphFor, type GlyphSurface } from './glyphs'
import { CATEGORY_META } from '@/lib/modules/world-events-shared'

/**
 * A canvas that records instead of drawing.
 *
 * Canvas code is usually left untested on the grounds that it "just draws", and
 * that is how a mark ends up scribbling over its neighbours or standing still
 * when it is supposed to move. Recording every coordinate makes both of those
 * assertions rather than hopes.
 */
class Recorder implements GlyphSurface {
  /**
   * Each coordinate is recorded with the alpha in force when it was drawn.
   *
   * Without the alpha these tests could not tell a bolt flashing from a bolt
   * standing still, nor a ripple that jumps at the end of its cycle from one
   * whose outermost ring has already faded to nothing by then. Both of those
   * distinctions are what a viewer actually sees.
   */
  points: Array<[number, number, number]> = []
  calls: string[] = []
  lineWidth = 1
  strokeStyle: string | CanvasGradient | CanvasPattern = ''
  fillStyle: string | CanvasGradient | CanvasPattern = ''
  globalAlpha = 1
  lineCap: CanvasLineCap = 'butt'
  lineJoin: CanvasLineJoin = 'miter'
  private depth = 0
  maxDepth = 0

  private at(x: number, y: number) {
    this.points.push([x, y, this.globalAlpha])
  }
  beginPath() {
    this.calls.push('beginPath')
  }
  closePath() {
    this.calls.push('closePath')
  }
  moveTo(x: number, y: number) {
    this.calls.push('moveTo')
    this.at(x, y)
  }
  lineTo(x: number, y: number) {
    this.calls.push('lineTo')
    this.at(x, y)
  }
  arc(x: number, y: number, r: number) {
    this.calls.push('arc')
    // An arc reaches r in every direction, so its extent is the box around it.
    this.at(x - r, y - r)
    this.at(x + r, y + r)
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    this.calls.push('quadraticCurveTo')
    /**
     * The control point is recorded too. A quadratic never reaches its control
     * point, so this over-estimates the extent — which is the safe direction for
     * a bounds check: a glyph that passes here cannot overflow, and one that
     * fails might not, so the bound below is generous rather than exact.
     */
    this.at(cx, cy)
    this.at(x, y)
  }
  stroke() {
    this.calls.push('stroke')
  }
  fill() {
    this.calls.push('fill')
  }
  save() {
    this.depth++
    this.maxDepth = Math.max(this.maxDepth, this.depth)
    this.calls.push('save')
  }
  restore() {
    this.depth--
    this.calls.push('restore')
  }

  /** The furthest any recorded coordinate sits from a centre. */
  extentFrom(x: number, y: number): number {
    let max = 0
    for (const [px, py] of this.points) max = Math.max(max, Math.hypot(px - x, py - y))
    return max
  }

  /** Geometry and opacity together — what the viewer would actually see. */
  signature(): string {
    return this.points.map(([x, y, a]) => `${x.toFixed(3)},${y.toFixed(3)}@${a.toFixed(3)}`).join('|')
  }
}

const draw = (category: string, phase: number, size = 12, x = 100, y = 100) => {
  const r = new Recorder()
  glyphFor(category).draw(r, x, y, size, phase)
  return r
}

const ALL = Object.keys(GLYPHS)

describe('every category has a mark of its own', () => {
  /**
   * The state this module exists to end: a category with no glyph falls back to
   * a plain dot, which is exactly the undifferentiated coloured disc the owner
   * rejected. An unlisted category must fail here, not on the map.
   */
  it('covers every category the world report can produce', () => {
    const missing = Object.keys(CATEGORY_META).filter((c) => !(c in GLYPHS))
    expect(missing).toEqual([])
  })

  it('names no category the report cannot produce', () => {
    const unknown = ALL.filter((c) => !(c in CATEGORY_META))
    expect(unknown).toEqual([])
  })

  it('gives every mark a one-line reading', () => {
    for (const c of ALL) {
      expect(glyphFor(c).reading.length, c).toBeGreaterThan(8)
    }
  })

  it('falls back to a plain dot for a category it has never seen', () => {
    expect(glyphFor('teleportation').animated).toBe(false)
    expect(glyphFor(null).reading).toBe('A signal')
    expect(glyphFor(undefined).reading).toBe('A signal')
  })
})

describe('a mark stays inside the space it was given', () => {
  /**
   * The clustering upstream places marks so they do not collide at their stated
   * radius. A glyph that draws past that radius overlaps its neighbour and
   * throws away the work that separated them.
   *
   * The bound is 1.6× rather than 1.0 because the recorder counts quadratic
   * control points, which a curve never actually reaches, and because a ripple's
   * outermost ring is deliberately at the edge.
   */
  it('never draws far outside its radius, at any phase', () => {
    for (const category of ALL) {
      for (const phase of [0, 0.13, 0.25, 0.5, 0.77, 0.99]) {
        const r = draw(category, phase)
        expect(r.extentFrom(100, 100), `${category} @ ${phase}`).toBeLessThanOrEqual(12 * 1.6)
      }
    }
  })

  it('scales with the size it is given', () => {
    for (const category of ALL) {
      const small = draw(category, 0.3, 6).extentFrom(100, 100)
      const large = draw(category, 0.3, 24).extentFrom(100, 100)
      expect(large, category).toBeGreaterThan(small)
    }
  })

  it('draws around the point it is given, not around the origin', () => {
    for (const category of ALL) {
      const r = draw(category, 0.4, 12, 500, 300)
      expect(r.extentFrom(500, 300), category).toBeLessThanOrEqual(12 * 1.6)
    }
  })

  it('emits no non-finite coordinate', () => {
    for (const category of ALL) {
      for (const phase of [0, 0.5, 0.999]) {
        for (const [x, y] of draw(category, phase).points) {
          expect(Number.isFinite(x) && Number.isFinite(y), category).toBe(true)
        }
      }
    }
  })
})

describe('motion means something', () => {
  /**
   * A glyph declared animated must actually change with the phase, and one
   * declared static must not. Both directions matter: a still "animated" mark
   * is a lie in the legend, and a moving "static" one is noise the reader will
   * try to interpret.
   */
  it('an animated mark changes across its cycle', () => {
    for (const category of ALL) {
      if (!GLYPHS[category].animated) continue
      /**
       * Across the whole cycle, not between two arbitrary points. The bolt
       * caught this: it is on for the first two-thirds, so phase 0 and phase
       * 0.5 are identical and a two-sample test called it motionless. Motion
       * here means geometry *or* opacity — a bolt flashes without moving, and
       * that is motion a reader sees.
       */
      const seen = new Set([0, 0.2, 0.4, 0.6, 0.8].map((p) => draw(category, p).signature()))
      expect(seen.size, category).toBeGreaterThan(1)
    }
  })

  it('a static mark is identical at every phase', () => {
    for (const category of ALL) {
      if (GLYPHS[category].animated) continue
      expect(draw(category, 0).signature(), category).toBe(draw(category, 0.6).signature())
    }
  })

  /**
   * The wrap has to be seamless: a mark that jumps at the end of its cycle
   * reads as a glitch, and a map full of them reads as a broken product.
   */
  it('joins up at the end of its cycle, or has faded out by then', () => {
    /**
     * Stated wrongly the first time, and the ripple was right to fail it.
     *
     * A seismic ring travels from 0.35 to 0.97 of the radius and then the next
     * cycle starts it again at 0.35 — a jump of two thirds of the mark. That
     * looked like a defect and is not one: the ring's opacity is `1 − t`, so by
     * the time it wraps it is invisible. The property that matters to a viewer
     * is therefore weaker and truer: **either the geometry wraps, or whatever
     * moved is transparent by the time it does.**
     */
    for (const category of ALL) {
      const nearEnd = draw(category, 0.999).points
      const start = draw(category, 0).points
      expect(nearEnd.length, category).toBe(start.length)
      for (let i = 0; i < start.length; i++) {
        const moved =
          Math.abs(nearEnd[i][0] - start[i][0]) > 1 || Math.abs(nearEnd[i][1] - start[i][1]) > 1
        if (!moved) continue
        expect(nearEnd[i][2], `${category} point ${i} jumps while still visible`).toBeLessThan(0.08)
      }
    }
  })
})

describe('leaving the canvas as it was found', () => {
  /**
   * A glyph that changes `globalAlpha` and does not put it back tints every
   * mark drawn after it — a bug that looks like a rendering problem and is
   * actually a missing line.
   */
  it('restores the alpha it borrowed', () => {
    for (const category of ALL) {
      const r = new Recorder()
      r.globalAlpha = 0.7
      glyphFor(category).draw(r, 10, 10, 10, 0.3)
      expect(r.globalAlpha, category).toBeCloseTo(0.7, 10)
    }
  })

  it('balances every save with a restore', () => {
    for (const category of ALL) {
      const r = draw(category, 0.3)
      const saves = r.calls.filter((c) => c === 'save').length
      const restores = r.calls.filter((c) => c === 'restore').length
      expect(saves, category).toBe(restores)
    }
  })

  it('actually draws something', () => {
    for (const category of ALL) {
      const r = draw(category, 0.3)
      expect(r.calls.filter((c) => c === 'fill' || c === 'stroke').length, category).toBeGreaterThan(0)
    }
  })
})

describe('knowing whether a frame loop is needed at all', () => {
  it('is false when nothing on screen moves', () => {
    expect(anyAnimated(['infrastructure', 'economy', 'research'])).toBe(false)
    expect(anyAnimated([])).toBe(false)
  })

  it('is true as soon as one animated category is present', () => {
    expect(anyAnimated(['infrastructure', 'seismic'])).toBe(true)
  })
})
