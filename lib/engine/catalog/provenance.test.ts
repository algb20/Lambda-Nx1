import { describe, expect, it } from 'vitest'
import { CATALOG, activeSources } from './index'
import { licenceProblem } from './licence'

/**
 * GL-14 — a feed whose host is not its publisher's says how it reaches us
 * (R322). Batch 11 found AP stories read from a personal re-feed and
 * catalogued as AP; nothing in the catalogue could have shown it.
 */

/** Hosting and re-feed services that are never a publisher themselves. */
const INTERMEDIARY_HOSTS = ['feeds.feedburner.com', 'feedx.net', 'api.gdeltproject.org', 'rss.app', 'fetchrss.com', 'politepol.com', 'rsshub.app', 'feed43.com']

const host = (url: string) => new URL(url).hostname

describe('catalogue provenance', () => {
  it('makes every record on an intermediary host declare how it reaches us', () => {
    const undeclared = CATALOG.filter((s) => INTERMEDIARY_HOSTS.includes(host(s.url)) && !s.via).map((s) => s.key)
    expect(undeclared).toEqual([])
  })

  it('declares the host it actually reads from', () => {
    for (const s of CATALOG.filter((x) => x.via)) expect(host(s.url), s.key).toBe(s.via!.host)
  })

  it('never runs an unofficial re-feed', () => {
    const refeeds = CATALOG.filter((s) => s.via?.kind === 'unofficial-refeed')
    expect(refeeds.map((s) => s.key)).toContain('ap_topnews')
    for (const s of refeeds) {
      expect(licenceProblem(s.licence), s.key).not.toBeNull()
      expect(activeSources().some((a) => a.key === s.key), s.key).toBe(false)
    }
  })

  it('would have caught the AP re-feed before batch 11 (negative control)', () => {
    const before = { ...CATALOG.find((s) => s.key === 'ap_topnews')!, via: undefined }
    expect(INTERMEDIARY_HOSTS.includes(host(before.url)) && !before.via).toBe(true)
  })
})
