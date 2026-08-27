/**
 * Threat Intelligence (CTI) sources — passive lookups against public threat
 * feeds. Keyless-first; where a provider now requires an API key, the source
 * degrades to no findings (never a false "clean"). Each source self-filters by
 * indicator shape, so they can all register under the `threat` capability.
 */
import type { Evidence, Source } from '../types'
import { expectOk } from '../fetch-guard'

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/
const isIp = (v: string) => IPV4.test(v)
const isDomain = (v: string) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v) && !isIp(v)

interface FeodoEntry {
  ip_address?: string
  malware?: string
}

/** Feodo Tracker — abuse.ch botnet C2 IP blocklist (keyless GET). */
export const feodo: Source = {
  key: 'feodo',
  capability: 'threat',
  passive: true,
  hosts: ['feodotracker.abuse.ch'],
  minIntervalMs: 1000,
  async run(input, ctx) {
    const ip = input.value.trim()
    if (!isIp(ip)) return []
    const url = 'https://feodotracker.abuse.ch/downloads/ipblocklist.json'
    const res = await ctx.fetch(url)
    expectOk('feodo', res)
    const list = (await res.json().catch(() => null)) as FeodoEntry[] | null
    if (!Array.isArray(list)) return []
    const hit = list.find((e) => e.ip_address === ip)
    if (!hit) return []
    return [
      {
        claim: `Listed as botnet C2 (Feodo Tracker${hit.malware ? `, ${hit.malware}` : ''})`,
        entity: { type: 'ip', value: ip },
        sourceKey: 'feodo',
        sourceUrl: url,
        retrievedAt: new Date().toISOString(),
        admiralty: { source: 'B', info: 2 },
        confidence: 'probable',
        data: hit,
      },
    ]
  },
}

interface UrlhausResp {
  query_status?: string
  url_count?: string | number
  urls?: Array<{ url?: string; threat?: string }>
}

/** URLhaus — malicious URLs known on a host (POST). */
export const urlhaus: Source = {
  key: 'urlhaus',
  capability: 'threat',
  passive: true,
  hosts: ['urlhaus-api.abuse.ch'],
  minIntervalMs: 1000,
  async run(input, ctx) {
    const host = input.value.trim()
    if (!isDomain(host) && !isIp(host)) return []
    const res = await ctx.fetch('https://urlhaus-api.abuse.ch/v1/host/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `host=${encodeURIComponent(host)}`,
    })
    expectOk('urlhaus', res)
    const j = (await res.json().catch(() => null)) as UrlhausResp | null
    if (!j || j.query_status !== 'ok') return []
    const count = Number(j.url_count ?? 0)
    if (!count) return []
    return [
      {
        claim: `Known malicious URLs on host (URLhaus): ${count}`,
        entity: { type: isIp(host) ? 'ip' : 'domain', value: host },
        sourceKey: 'urlhaus',
        sourceUrl: `https://urlhaus.abuse.ch/browse.php?search=${encodeURIComponent(host)}`,
        retrievedAt: new Date().toISOString(),
        admiralty: { source: 'B', info: 2 },
        confidence: 'probable',
        data: { url_count: count, sample: j.urls?.slice(0, 3) },
      },
    ]
  },
}

interface ThreatFoxResp {
  query_status?: string
  data?: Array<{ threat_type?: string; malware?: string; ioc?: string }>
}

/** ThreatFox — IOC search (POST). */
export const threatfox: Source = {
  key: 'threatfox',
  capability: 'threat',
  passive: true,
  hosts: ['threatfox-api.abuse.ch'],
  minIntervalMs: 1000,
  async run(input, ctx) {
    const term = input.value.trim()
    if (!term) return []
    const res = await ctx.fetch('https://threatfox-api.abuse.ch/api/v1/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'search_ioc', search_term: term }),
    })
    expectOk('threatfox', res)
    const j = (await res.json().catch(() => null)) as ThreatFoxResp | null
    if (!j || j.query_status !== 'ok' || !Array.isArray(j.data) || j.data.length === 0) return []
    const first = j.data[0]
    return [
      {
        claim: `Threat IOC match (ThreatFox): ${first.malware ?? first.threat_type ?? 'flagged'}`,
        sourceKey: 'threatfox',
        sourceUrl: 'https://threatfox.abuse.ch/browse/',
        retrievedAt: new Date().toISOString(),
        admiralty: { source: 'B', info: 2 },
        confidence: 'probable',
        data: { matches: j.data.length, first },
      },
    ]
  },
}
