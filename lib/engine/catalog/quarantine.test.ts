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

  it('names only keys the catalogue holds, each once', () => {
    const keys = QUARANTINE.map((e) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
    const known = new Set(CATALOG.map((s) => s.key))
    expect(['bse_india', 'nasa_donki'].filter((k) => !known.has(k))).toEqual([])
  })
})
