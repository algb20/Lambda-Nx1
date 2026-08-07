import { describe, it, expect } from 'vitest'
import { lambdaMarkSvg, lambdaMarkDataUri, LAMBDA_STROKES } from './mark'
import { watermarkOrigin, lambdaWatermarkCss } from './watermark'

describe('lambda mark', () => {
  it('renders an SVG with both λ strokes and no embedded text', () => {
    const svg = lambdaMarkSvg({ size: 48 })
    expect(svg).toContain('width="48"')
    expect(svg).toContain('viewBox="0 0 100 100"')
    // Two strokes = the λ; the mark is symbol-only, never a text glyph.
    expect(svg.match(/<line /g)).toHaveLength(2)
    expect(svg).not.toContain('<text')
  })

  it('carries a title only when asked (decorative by default)', () => {
    expect(lambdaMarkSvg()).toContain('aria-hidden="true"')
    const titled = lambdaMarkSvg({ title: 'Lambda NX' })
    expect(titled).toContain('<title>Lambda NX</title>')
    expect(titled).toContain('role="img"')
  })

  it('escapes a title to keep the SVG well-formed', () => {
    expect(lambdaMarkSvg({ title: 'A & B <x>' })).toContain('<title>A &amp; B &lt;x&gt;</title>')
  })

  it('honours colour and opacity', () => {
    const svg = lambdaMarkSvg({ color: '#ff0000', opacity: 0.4 })
    expect(svg).toContain('stroke="#ff0000"')
    expect(svg).toContain('opacity="0.4"')
  })

  it('produces a decodable base64 data URI', () => {
    const uri = lambdaMarkDataUri({ size: 20 })
    expect(uri.startsWith('data:image/svg+xml;base64,')).toBe(true)
    const decoded = Buffer.from(uri.split(',')[1], 'base64').toString('utf8')
    expect(decoded).toContain('<svg')
    expect(decoded).toContain('viewBox="0 0 100 100"')
  })

  it('has exactly the two canonical strokes', () => {
    expect(LAMBDA_STROKES).toHaveLength(2)
  })
})

describe('watermark placement', () => {
  const W = 800
  const H = 600
  const mark = 100
  const margin = 20

  it('places bottom-right by default coordinates', () => {
    expect(watermarkOrigin(W, H, mark, margin, 'bottom-right')).toEqual({
      x: W - mark - margin,
      y: H - mark - margin,
    })
  })

  it('places each corner correctly', () => {
    expect(watermarkOrigin(W, H, mark, margin, 'top-left')).toEqual({ x: margin, y: margin })
    expect(watermarkOrigin(W, H, mark, margin, 'top-right')).toEqual({ x: W - mark - margin, y: margin })
    expect(watermarkOrigin(W, H, mark, margin, 'bottom-left')).toEqual({ x: margin, y: H - mark - margin })
  })
})

describe('lambdaWatermarkCss', () => {
  it('builds a corner-anchored background from the λ data URI', () => {
    const css = lambdaWatermarkCss({ size: 40, corner: 'bottom-right', opacity: 0.5 })
    expect(css.backgroundImage).toContain('data:image/svg+xml;base64,')
    expect(css.backgroundRepeat).toBe('no-repeat')
    expect(css.backgroundPosition).toBe('right 12px bottom 12px')
    expect(css.backgroundSize).toBe('40px 40px')
    expect(css.opacity).toBe(0.5)
  })
})
