import { describe, expect, it, vi } from 'vitest'
import { byTopic } from '../catalog'
import {
  claimOf,
  factChecks,
  factcheckFeeds,
  looksLikeReference,
  statedFinding,
} from './factcheck'
import type { SourceContext, SourceInput } from '../types'

/**
 * The verification gateway.
 *
 * Two things are worth holding in place, and both are refusals rather than
 * features: it must never infer a verdict a publisher did not state, and it
 * must never turn "three checkers looked at this" into "three sources agree".
 */

function feedOf(
  items: Array<{ title: string; link?: string; date?: string; summary?: string; categories?: string[] }>,
) {
  return `<?xml version="1.0"?><rss><channel>${items
    .map(
      (i) =>
        `<item><title>${i.title}</title><link>${i.link ?? 'https://example.org/a'}</link>` +
        `<description>${i.summary ?? ''}</description>` +
        (i.categories ?? []).map((c) => `<category>${c}</category>`).join('') +
        `<pubDate>${i.date ?? 'Fri, 21 Aug 2026 12:00:00 +0000'}</pubDate></item>`,
    )
    .join('')}</channel></rss>`
}

function ctxOf(handler: (url: string) => { ok?: boolean; status?: number; text?: string }): SourceContext {
  return {
    fetch: vi.fn(async (url: string) => {
      const r = handler(url)
      return {
        ok: r.ok ?? true,
        status: r.status ?? 200,
        text: async () => r.text ?? '',
      } as unknown as Response
    }),
  } as unknown as SourceContext
}

const ask = (value: string): SourceInput => ({ value }) as SourceInput

/** Every publisher answers, each with one item naming the subject. */
function allAnswering(subject = 'flood') {
  return ctxOf((url) => {
    const host = new URL(url).hostname
    return {
      text: feedOf([
        { title: `Fact Check: Video of ${subject} -- Old Footage From 2019`, link: `https://${host}/1` },
        { title: `Unrelated item from ${host}`, link: `https://${host}/2` },
      ]),
    }
  })
}

describe('refusing to invent a verdict', () => {
  /**
   * Only Lead Stories encodes its finding in the title, after a double dash.
   * The other four keep the verdict on the page.
   */
  it('recovers a finding only from the publisher that actually states one', () => {
    const title = 'Fact Check: Video Does NOT Show Trash Dumping -- Ritual Immersion Of Idol'
    expect(statedFinding(title, 'lead_stories')).toBe('Ritual Immersion Of Idol')
    expect(statedFinding(title, 'snopes')).toBeNull()
    expect(statedFinding('No, Argos isn’t selling a bench for £3', 'fullfact')).toBeNull()
  })

  it('does not read a leading negation as a rating', () => {
    // Right often enough to feel safe, wrong often enough to matter: Full Fact's
    // "Reform corrects claim that…" is a correction, and Snopes's "Is X true?
    // What we know" is explicitly unresolved. Neither is a "False".
    expect(statedFinding('No, Argos isn’t selling a bench for £3', 'fullfact')).toBeNull()
    expect(statedFinding('Is Trump admin allowing sale of wild horses? What we know', 'snopes')).toBeNull()
  })

  it('strips the publisher’s own labelling to leave the claim', () => {
    expect(claimOf('Fact Check: Video Shows FAKE Incident -- Staged For Camera', 'lead_stories')).toBe(
      'Video Shows FAKE Incident',
    )
    expect(claimOf('Prebunk: Videos Of Rescued Dogs -- Clickbait', 'lead_stories')).toBe(
      'Videos Of Rescued Dogs',
    )
    // A publisher that does not label is left exactly as published.
    expect(claimOf('Trump’s Misleading Crime Drop Claims', 'factcheck_org')).toBe(
      'Trump’s Misleading Crime Drop Claims',
    )
  })

  it('keeps reference material out of a list of checks', () => {
    // FactCheck.org's feed carries encyclopaedia entries about organisations
    // alongside its checks. Listing those as fact-checks misrepresents both.
    //
    // This reads the publisher's own `<category>`, which is the only signal
    // that works: the first version read the title and the summary, passed its
    // test, and the live board still showed "Americans for Prosperity" as a
    // checked claim — because the label was never in either of those fields.
    expect(looksLikeReference(['Players Guide 2026'], 'Americans for Prosperity')).toBe(true)
    expect(looksLikeReference(['FactCheck Posts', 'Featured Posts'], 'Trump’s Crime Claims')).toBe(false)
    expect(looksLikeReference([], 'Trump’s Crime Claims')).toBe(false)
  })
})

describe('counting checkers, not headlines', () => {
  it('reads its publishers from the catalogue rather than a second list', () => {
    const keys = factcheckFeeds().map((f) => f.key)
    expect(keys).toContain('snopes')
    expect(keys).toContain('fullfact')
    expect(keys).toContain('politifact')
    expect(keys).toHaveLength(5)
    for (const feed of factcheckFeeds()) {
      expect(factChecks.hosts).toContain(new URL(feed.url).hostname.toLowerCase())
    }
  })

  it('reports how many INDEPENDENT checkers addressed the subject', async () => {
    const out = await factChecks.run(ask('flood'), allAnswering())
    const summary = out.find((e) => e.claim.includes('independent fact-checker'))
    expect(summary?.claim).toContain('5 independent fact-checkers have addressed this')
    expect((summary?.data as { value: number }).value).toBe(5)
  })

  it('says in the row itself that the count is not a verdict', async () => {
    // The number invites exactly this mistake, so the correction travels with
    // it rather than living in documentation nobody opens.
    const out = await factChecks.run(ask('flood'), allAnswering())
    const summary = out.find((e) => e.claim.includes('independent fact-checker'))!
    expect(summary.claim).toContain('it is not a verdict')
    expect(summary.claim).toContain('may have reached different conclusions')
  })

  it('counts one checker as one, in the singular', async () => {
    const ctx = ctxOf((url) => ({
      text: url.includes('snopes')
        ? feedOf([{ title: 'A claim about widgets' }])
        : feedOf([{ title: 'Something else entirely' }]),
    }))
    const out = await factChecks.run(ask('widgets'), ctx)
    const summary = out.find((e) => e.claim.includes('independent fact-checker'))
    expect(summary?.claim).toContain('1 independent fact-checker has addressed this')
  })

  it('produces no corroboration row when nothing matched', async () => {
    const ctx = ctxOf(() => ({ text: feedOf([{ title: 'Something else entirely' }]) }))
    const out = await factChecks.run(ask('zzzzzz'), ctx)
    expect(out.some((e) => e.claim.includes('independent fact-checker'))).toBe(false)
    // But the latest checks are still shown — an empty panel would read as
    // "this claim is undisputed", which is the worst empty state in the product.
    expect(out.length).toBeGreaterThan(0)
  })
})

describe('the gateway', () => {
  it('drops reference entries end-to-end, through the real feed parser', async () => {
    // The defect this reproduces shipped: the filter passed its unit test and
    // the live board still listed encyclopaedia entries as checks, because the
    // category never reached it. This test goes through `parseFeed`, so it
    // would have caught that.
    const ctx = ctxOf(() =>
      ({ text: feedOf([
        { title: 'Americans for Prosperity', categories: ['Players Guide 2026'] },
        { title: 'Trump’s Misleading Crime Drop Claims', categories: ['FactCheck Posts'] },
      ]) }),
    )
    const claims = (await factChecks.run(ask(''), ctx)).map((e) => e.claim)
    expect(claims.some((c) => c.includes('Americans for Prosperity'))).toBe(false)
    expect(claims.some((c) => c.includes('Misleading Crime Drop'))).toBe(true)
  })

  it('puts the corroboration reading above the checks it summarises', async () => {
    const out = await factChecks.run(ask('flood'), allAnswering())
    const weight = (needle: string) =>
      (out.find((e) => e.claim.includes(needle))?.data as { groupWeight?: number })?.groupWeight ?? 0
    expect(weight('independent fact-checker')).toBeGreaterThan(weight('Old Footage From 2019'))
  })

  it('shows a stated finding, and admits when the verdict is on the page', async () => {
    const ctx = ctxOf((url) => ({
      text: url.includes('leadstories')
        ? feedOf([{ title: 'Fact Check: Bridge Collapse Video -- Old Clip From 2019' }])
        : feedOf([{ title: 'Bridge collapse claim examined' }]),
    }))
    const claims = (await factChecks.run(ask('bridge'), ctx)).map((e) => e.claim)
    expect(claims.some((c) => c.includes('finding: Old Clip From 2019'))).toBe(true)
    expect(claims.some((c) => c.includes('verdict on the page'))).toBe(true)
  })

  it('grades a stated finding above one we would have to open a page to read', async () => {
    const ctx = ctxOf((url) => ({
      text: url.includes('leadstories')
        ? feedOf([{ title: 'Fact Check: A claim -- Stated Finding' }])
        : feedOf([{ title: 'A claim examined' }]),
    }))
    const out = await factChecks.run(ask('claim'), ctx)
    const stated = out.find((e) => e.claim.includes('Stated Finding'))!
    const unstated = out.find((e) => e.claim.includes('verdict on the page'))!
    expect(stated.admiralty?.info).toBeLessThan(unstated.admiralty?.info as number)
  })

  it('fetches every publisher in one run without refusing itself', async () => {
    const ctx = ctxOf(() => ({ text: feedOf([{ title: 'x' }]) }))
    await factChecks.run(ask(''), ctx)
    expect((ctx.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(5)
  })

  it('keeps going when one checker fails', async () => {
    const ctx = ctxOf((url) =>
      url.includes('snopes') ? { ok: false, status: 503 } : { text: feedOf([{ title: 'x' }]) },
    )
    const out = await factChecks.run(ask(''), ctx)
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((e) => e.sourceKey !== 'snopes')).toBe(true)
  })

  it('fails loudly when every checker is unreachable', async () => {
    // An empty verification panel reads as "this claim is not disputed", which
    // is the most dangerous empty state the product has.
    await expect(
      factChecks.run(ask(''), ctxOf(() => ({ ok: false, status: 503 }))),
    ).rejects.toThrow(/unreachable/)
  })

  it('carries the publisher’s own timestamp, never ours', async () => {
    const ctx = ctxOf(() => ({
      text: feedOf([{ title: 'x', date: 'Wed, 19 Aug 2026 16:17:27 +0000' }]),
    }))
    const out = await factChecks.run(ask(''), ctx)
    expect(out[0]?.publishedAt).toBe('2026-08-19T16:17:27.000Z')
  })

  it('grades a check as a conclusion about evidence, never as the evidence', async () => {
    const out = await factChecks.run(ask(''), ctxOf(() => ({ text: feedOf([{ title: 'x' }]) })))
    expect(out[0]?.admiralty?.source).toBe('B')
    expect(out[0]?.confidence).toBe('probable')
  })

  it('reads passively', () => {
    expect(factChecks.passive).toBe(true)
  })
})

/**
 * A gap in the catalogue must never be counted as a source.
 *
 * The verification gateway's headline figure is **how many independent
 * checkers addressed this claim**, and it reads its publishers from the
 * catalogue by topic. The moment Google's Fact Check Tools was catalogued as a
 * keyed, inactive record — a route that exists and needs a credential we do
 * not have — the gateway counted it and reported six independent checkers
 * where five had spoken.
 *
 * That is the §2a discipline at its sharpest. Counting a source we cannot read
 * is the same inflation as counting a mirror as an independent origin, and it
 * lands in the one number this gateway exists to produce.
 */
describe('a catalogued gap is not a checker', () => {
  it('reads only publishers it can actually reach', () => {
    const keyed = byTopic('factcheck').filter((f) => !f.keyless)
    expect(keyed.length, 'the keyed fact-check route is catalogued as a visible gap').toBeGreaterThan(0)
    for (const f of keyed) {
      expect(
        factcheckFeeds().map((x) => x.key),
        `${f.key} needs ${f.keyEnv} and must not be counted without it`,
      ).not.toContain(f.key)
    }
  })

  /**
   * And the exclusion is about the credential alone. These five publishers are
   * all `enabled: false` because the gateway drives them instead of the
   * ambient sweep — a fact-check has no coordinates and does not belong on a
   * map. Filtering on that flag as well removed every publisher and left the
   * gateway with nothing, which is how this test earned its second half.
   */
  it('still reads the publishers the sweep deliberately skips', () => {
    const keys = factcheckFeeds().map((f) => f.key)
    expect(keys).toContain('snopes')
    expect(keys.length, 'enabled:false means gateway-driven, not unusable').toBeGreaterThanOrEqual(5)
  })
})
