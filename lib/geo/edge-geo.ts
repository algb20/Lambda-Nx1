/**
 * Portable edge geolocation.
 *
 * Different hosts expose the visitor's country through different request
 * headers. Reading them here — behind one function — keeps the app host-agnostic
 * (charter rule #4): moving Vercel → Netlify → Cloudflare → self-host changes
 * nothing above this file.
 *
 * We read **only the coarse country (and an optional region)**. We never read or
 * store the IP address: the edge already resolved geo for us, so the raw address
 * is not needed and is deliberately left untouched (charter §3, data
 * minimization).
 */

/** A resolved, minimized location. All fields optional — the edge may give none. */
export interface EdgeGeo {
  /** ISO-3166 alpha-2, uppercase (e.g. "DE"). */
  countryCode: string | null
  /** Human-readable country name resolved from the code (e.g. "Germany"). */
  countryName: string | null
  /** Coarse subdivision/region when available. Never a city or finer. */
  region: string | null
}

const EMPTY: EdgeGeo = { countryCode: null, countryName: null, region: null }

/** Two uppercase ASCII letters, and not the "unknown" placeholder some CDNs send. */
function normCountry(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cc = raw.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return null
  // Cloudflare uses "XX" for unknown and "T1" for Tor exit nodes.
  if (cc === 'XX' || cc === 'T1') return null
  return cc
}

let displayNames: Intl.DisplayNames | null | undefined
/** Resolve a country name from its code via the platform (no hand-kept table). */
export function countryName(code: string | null): string | null {
  if (!code) return null
  // ZZ is CLDR's explicit "unknown region"; it resolves to a name but isn't a country.
  if (code === 'ZZ') return null
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
    } catch {
      displayNames = null // ancient runtime without Intl.DisplayNames
    }
  }
  try {
    const name = displayNames?.of(code)
    // With fallback:'none', an unrecognised code yields undefined.
    return name && name !== code ? name : null
  } catch {
    return null
  }
}

function firstHeader(h: Headers, names: string[]): string | null {
  for (const n of names) {
    const v = h.get(n)
    if (v) return v
  }
  return null
}

/**
 * Extract the visitor's country/region from request headers, trying every host
 * we support in turn. Returns all-null when no edge geo is present (e.g. local
 * dev), which callers treat as "unknown", never as an error.
 */
export function geoFromHeaders(headers: Headers): EdgeGeo {
  // Vercel · Netlify · Cloudflare · Fastly · generic proxies.
  const countryCode = normCountry(
    firstHeader(headers, [
      'x-vercel-ip-country',
      'x-nf-country', // some Netlify setups
      'cf-ipcountry',
      'x-country-code',
      'x-country',
      'x-geo-country',
      'fastly-geo-country',
    ]),
  )

  let region =
    firstHeader(headers, [
      'x-vercel-ip-country-region',
      'x-region-code',
      'cf-region-code',
    ]) ?? null

  // Netlify packs geo into a single JSON header (x-nf-geo, base64 or raw JSON).
  if (!countryCode || !region) {
    const nf = headers.get('x-nf-geo')
    if (nf) {
      const parsed = parseNetlifyGeo(nf)
      const cc = countryCode ?? parsed.countryCode
      return {
        countryCode: cc,
        countryName: countryName(cc),
        region: region ?? parsed.region,
      }
    }
  }

  if (region) region = region.trim() || null
  if (!countryCode) return region ? { ...EMPTY, region } : EMPTY
  return { countryCode, countryName: countryName(countryCode), region }
}

/** Netlify's `x-nf-geo` header: JSON (sometimes base64-encoded) with country/subdivision. */
function parseNetlifyGeo(raw: string): { countryCode: string | null; region: string | null } {
  let json = raw
  // Try base64 first; if it doesn't look like JSON after decoding, use raw.
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8')
    if (decoded.trimStart().startsWith('{')) json = decoded
  } catch {
    /* not base64 — fall through to raw */
  }
  try {
    const obj = JSON.parse(json) as {
      country?: { code?: string }
      subdivision?: { code?: string; name?: string }
    }
    return {
      countryCode: normCountry(obj.country?.code),
      region: obj.subdivision?.name ?? obj.subdivision?.code ?? null,
    }
  } catch {
    return { countryCode: null, region: null }
  }
}
