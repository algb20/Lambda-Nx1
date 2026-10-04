import { describe, expect, it } from 'vitest'
import { CATALOG } from './index'
import { QUARANTINE, isQuarantined, quarantineFor } from './quarantine'

/**
 * Observations of 2026-10-04 (maintenance batch 02, M2-03).
 *
 * Production's own `/api/diagnose` reported three feeds failing, and each was
 * re-requested from a second network the same day:
 *
 * - `bse_india` — Akamai "Access Denied", 403. The same refusal that put BLS
 *   here. A bot wall is a statement of the provider's terms (charter §3).
 * - `nasa_donki` — 429 `OVER_RATE_LIMIT` on NASA's shared `DEMO_KEY`, and HTML
 *   instead of JSON on Production. A shared anonymous key on shared serverless
 *   addresses is a standing limit, not one bad sweep — the `afp_via_gdelt`
 *   precedent. The lasting fix is a registered key, which is an owner decision.
 * - `si_volcano_weekly` — 403 on a page titled "temporarily unavailable". That
 *   reads as an outage, not a policy, and the feed is in the first-light pass,
 *   so it is recorded as an observation and **not** withheld.
 */
describe('the 2026-10-04 observations', () => {
  it('withholds the bot-walled BSE notices feed', () => {
    const entry = quarantineFor('bse_india')
    expect(entry?.reason).toBe('bot-blocked')
    expect(entry?.status).toBe(403)
    expect(entry?.observedOn).toBe('2026-10-04')
  })

  it('withholds DONKI while it rides a shared, exhausted demo key', () => {
    const entry = quarantineFor('nasa_donki')
    expect(entry?.reason).toBe('unreachable')
    expect(entry?.status).toBe(429)
    expect(entry?.note).toMatch(/DEMO_KEY/)
  })

  it('does not withhold a feed whose page says the outage is temporary', () => {
    expect(isQuarantined('si_volcano_weekly')).toBe(false)
  })

  /**
   * Released 2026-10-04 by the owner (ledger R311), after the recheck in
   * `docs/reconciliation/AUDIT_PASS_2026-10-04_R310.md` §4: 200, 50 items,
   * the newest from the same day, headlines readable. The 2026-08-22 bar —
   * it parses, it has items, and one of them is recent — not a status code.
   */
  it('releases SCMP once it answers with readable, current items', () => {
    expect(isQuarantined('scmp_news')).toBe(false)
    expect(CATALOG.some((s) => s.key === 'scmp_news')).toBe(true)
  })

  it('names only keys the catalogue holds, each once', () => {
    const keys = QUARANTINE.map((e) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
    const known = new Set(CATALOG.map((s) => s.key))
    expect(['bse_india', 'nasa_donki'].filter((k) => !known.has(k))).toEqual([])
  })
})

/**
 * Moved-source repair of 2026-10-04 (owner R312; maintenance batch 04).
 *
 * Each repair was verified against the publisher's own listing of its feeds,
 * read, and checked against robots.txt before the record changed. A record
 * whose new address answers but is frozen, refused by robots, or needs a
 * registration keeps its quarantine entry — a repaired URL is not a release.
 */
describe('the moved-source repair of 2026-10-04', () => {
  const record = (key: string) => {
    const found = CATALOG.find((s) => s.key === key)
    if (!found) throw new Error(`${key} missing from the catalogue`)
    return found
  }

  it.each([
    ['who_don', 'https://www.who.int/api/news/diseaseoutbreaknews'],
    ['ecdc_threats', 'https://www.ecdc.europa.eu/en/taxonomy/term/1505/feed'],
    ['bis_press', 'https://www.bis.org/doclist/all_pressrels.rss'],
    ['annahar_lebanon', 'https://www.annahar.com/rss'],
  ])('releases %s at its verified address', (key, prefix) => {
    expect(isQuarantined(key)).toBe(false)
    expect(record(key).url.startsWith(prefix)).toBe(true)
  })

  it.each(['who_don', 'ecdc_threats', 'bis_press', 'annahar_lebanon', 'who_afro', 'eluniversal_mx', 'reliefweb_reports'])(
    'keeps the old address of %s as history',
    (key) => {
      const former = record(key).formerUrls ?? []
      expect(former.length).toBeGreaterThan(0)
      expect(former.every((f) => f.url !== record(key).url && /^\d{4}-\d{2}-\d{2}$/.test(f.until))).toBe(true)
    },
  )

  it('keeps a repaired feed out when its new address is frozen or refused', () => {
    expect(quarantineFor('who_afro')?.reason).toBe('frozen')
    expect(quarantineFor('eluniversal_mx')?.reason).toBe('bot-blocked')
  })

  it('treats ReliefWeb as a registration, read from the deployment and never written here', () => {
    for (const key of ['reliefweb_reports', 'reliefweb_disasters']) {
      const r = record(key)
      expect(quarantineFor(key)?.reason).toBe('credential')
      expect(r.keyless).toBe(false)
      expect(r.keyEnv).toBe('RELIEFWEB_APPNAME')
      expect(r.url).not.toMatch(/appname=/)
      expect(r.url).toMatch(/\/v2\//)
    }
  })

  it('puts the deployment appname into the ReliefWeb request', () => {
    const before = process.env.RELIEFWEB_APPNAME
    process.env.RELIEFWEB_APPNAME = 'example-approved-name'
    try {
      for (const key of ['reliefweb_reports', 'reliefweb_disasters']) {
        expect(record(key).urlFor?.(new Date())).toContain('appname=example-approved-name')
      }
    } finally {
      if (before === undefined) delete process.env.RELIEFWEB_APPNAME
      else process.env.RELIEFWEB_APPNAME = before
    }
  })
})

describe('licences found wrong during the 2026-10-04 repair', () => {
  it('does not treat Open-Meteo\'s free API as usable in a commercial product', async () => {
    const { licenceProblem } = await import('./licence')
    const record = CATALOG.find((s) => s.key === 'open_meteo_severe')!
    expect(record.licence.commercialUse).toBe(false)
    expect(licenceProblem(record.licence)).toBe('commercial')
  })
})
