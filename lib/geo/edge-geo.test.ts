import { describe, it, expect } from 'vitest'
import { geoFromHeaders, countryName } from './edge-geo'

function h(init: Record<string, string>): Headers {
  return new Headers(init)
}

describe('countryName', () => {
  it('resolves a known ISO code to its English name', () => {
    expect(countryName('DE')).toBe('Germany')
    expect(countryName('JP')).toBe('Japan')
  })
  it('returns null for null / unknown codes', () => {
    expect(countryName(null)).toBeNull()
    expect(countryName('ZZ')).toBeNull()
  })
})

describe('geoFromHeaders', () => {
  it('reads Vercel headers', () => {
    const geo = geoFromHeaders(
      h({ 'x-vercel-ip-country': 'de', 'x-vercel-ip-country-region': 'BE' }),
    )
    expect(geo).toEqual({ countryCode: 'DE', countryName: 'Germany', region: 'BE' })
  })

  it('reads a Cloudflare country header', () => {
    expect(geoFromHeaders(h({ 'cf-ipcountry': 'FR' }))).toEqual({
      countryCode: 'FR',
      countryName: 'France',
      region: null,
    })
  })

  it('parses Netlify JSON geo (raw)', () => {
    const nf = JSON.stringify({
      country: { code: 'CA', name: 'Canada' },
      subdivision: { code: 'QC', name: 'Quebec' },
    })
    expect(geoFromHeaders(h({ 'x-nf-geo': nf }))).toEqual({
      countryCode: 'CA',
      countryName: 'Canada',
      region: 'Quebec',
    })
  })

  it('parses Netlify JSON geo (base64)', () => {
    const nf = Buffer.from(
      JSON.stringify({ country: { code: 'BR' }, subdivision: { name: 'São Paulo' } }),
    ).toString('base64')
    expect(geoFromHeaders(h({ 'x-nf-geo': nf }))).toEqual({
      countryCode: 'BR',
      countryName: 'Brazil',
      region: 'São Paulo',
    })
  })

  it('treats Cloudflare "XX"/"T1" placeholders as unknown', () => {
    expect(geoFromHeaders(h({ 'cf-ipcountry': 'XX' })).countryCode).toBeNull()
    expect(geoFromHeaders(h({ 'cf-ipcountry': 'T1' })).countryCode).toBeNull()
  })

  it('ignores malformed country values', () => {
    expect(geoFromHeaders(h({ 'x-country': 'Germany' })).countryCode).toBeNull()
    expect(geoFromHeaders(h({ 'x-country': '' })).countryCode).toBeNull()
  })

  it('returns all-null when no geo header is present (local dev)', () => {
    expect(geoFromHeaders(h({}))).toEqual({
      countryCode: null,
      countryName: null,
      region: null,
    })
  })

  it('keeps a region even when the country is unknown', () => {
    expect(geoFromHeaders(h({ 'x-region-code': 'CA-ON' }))).toEqual({
      countryCode: null,
      countryName: null,
      region: 'CA-ON',
    })
  })
})
