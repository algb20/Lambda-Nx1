import { describe, it, expect } from 'vitest'
import {
  reverseImageLinks,
  computeAiIndicators,
  analyzeImageBytes,
  analyzeMedia,
} from './media'

describe('reverseImageLinks', () => {
  it('builds encoded deep links for the major engines', () => {
    const links = reverseImageLinks('https://example.com/a b.jpg')
    expect(links.map((l) => l.engine)).toEqual(['Yandex', 'Google Lens', 'Bing', 'TinEye'])
    expect(links.every((l) => l.url.includes('https%3A%2F%2Fexample.com%2Fa%20b.jpg'))).toBe(true)
  })
})

describe('computeAiIndicators', () => {
  it('flags AI software tags', () => {
    expect(computeAiIndicators({ software: 'Midjourney v6' }, true)[0]).toMatch(/AI generation/)
  })
  it('flags missing EXIF', () => {
    expect(computeAiIndicators({}, false)[0]).toMatch(/No EXIF/)
  })
  it('flags metadata without camera make/model', () => {
    expect(computeAiIndicators({ software: 'GIMP' }, true)[0]).toMatch(/no camera make\/model/)
  })
})

describe('analyzeImageBytes', () => {
  it('handles non-image bytes gracefully (no throw, no EXIF)', async () => {
    const res = await analyzeImageBytes(new Uint8Array([1, 2, 3, 4, 5]))
    expect(res.hasExif).toBe(false)
    expect(res.aiIndicators.some((s) => /No EXIF/.test(s))).toBe(true)
    expect(res.gpsMapUrl).toBeUndefined()
  })
})

describe('analyzeMedia', () => {
  it('returns reverse links when given a URL and no bytes', async () => {
    const report = await analyzeMedia({ imageUrl: 'https://example.com/x.jpg' })
    expect(report.reverseLinks).toHaveLength(4)
    expect(report.hasExif).toBe(false)
  })
})
