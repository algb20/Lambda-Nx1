import { describe, it, expect } from 'vitest'
import {
  computeDomainFingerprint,
  diffFingerprints,
  summarizeChanges,
} from './fingerprint'
import { checkDomainMonitor, runDueMonitors } from './scheduler'
import { ingestFeedItems, feedDedupeHash } from './internal'
import type { DomainReport } from '../modules/domain'
import type { Evidence } from '../engine/types'
import type { Monitor, NewRadarFinding } from '../db'

function ev(claim: string, entity?: Evidence['entity']): Evidence {
  return { claim, entity, sourceKey: 'test', retrievedAt: new Date().toISOString(), confidence: 'possible' }
}

function makeReport(o: {
  subdomains?: string[]
  ips?: string[]
  registrar?: string
  nameservers?: string[]
}): DomainReport {
  return {
    subject: 'example.com',
    generatedAt: new Date().toISOString(),
    sections: {
      dns: (o.ips ?? []).map((ip) => ev(`A record: ${ip}`, { type: 'ip', value: ip })),
      registration: [
        ...(o.registrar ? [ev(`Registrar: ${o.registrar}`)] : []),
        ...(o.nameservers ?? []).map((ns) => ev(`Nameserver: ${ns}`, { type: 'domain', value: ns })),
      ],
      subdomains: (o.subdomains ?? []).map((s) => ev(`Subdomain: ${s}`, { type: 'domain', value: s })),
      hosting: [],
      ipExposure: [],
      history: [],
    },
    graph: { nodes: [], edges: [] },
    sourcesUsed: [],
    summary: {
      subdomains: (o.subdomains ?? []).length,
      resolvedIps: (o.ips ?? []).length,
      entities: 0,
      sourcesOk: 0,
      sourcesFailed: 0,
    },
  }
}

function makeMonitor(o: Partial<Monitor>): Monitor {
  return {
    id: 'm1',
    userId: 'u1',
    targetType: 'domain',
    targetValue: 'example.com',
    intervalMinutes: 1440,
    status: 'active',
    lastRunAt: null,
    lastFingerprint: null,
    createdAt: new Date(),
    ...o,
  } as Monitor
}

describe('radar — fingerprint & diff', () => {
  it('reduces a report to a stable fingerprint', () => {
    const fp = computeDomainFingerprint(
      makeReport({ subdomains: ['b.example.com', 'a.example.com'], ips: ['1.2.3.4'], registrar: 'IANA' }),
    )
    expect(fp.subdomains).toEqual(['a.example.com', 'b.example.com']) // sorted, unique
    expect(fp.ips).toEqual(['1.2.3.4'])
    expect(fp.registrar).toBe('IANA')
  })

  it('reports no change on the first run (baseline)', () => {
    const fp = computeDomainFingerprint(makeReport({ subdomains: ['a.example.com'] }))
    expect(diffFingerprints(null, fp).changed).toBe(false)
  })

  it('detects an added and a removed subdomain', () => {
    const before = computeDomainFingerprint(makeReport({ subdomains: ['a.example.com', 'old.example.com'] }))
    const after = computeDomainFingerprint(makeReport({ subdomains: ['a.example.com', 'new.example.com'] }))
    const diff = diffFingerprints(before, after)
    expect(diff.changed).toBe(true)
    const subs = diff.fields.find((f) => f.category === 'subdomains')
    expect(subs?.added).toEqual(['new.example.com'])
    expect(subs?.removed).toEqual(['old.example.com'])
    expect(summarizeChanges(diff)).toContain('subdomains')
  })

  it('detects a registrar change', () => {
    const before = computeDomainFingerprint(makeReport({ registrar: 'OldReg' }))
    const after = computeDomainFingerprint(makeReport({ registrar: 'NewReg' }))
    expect(diffFingerprints(before, after).changed).toBe(true)
  })
})

describe('radar — monitor check', () => {
  it('first run establishes a baseline without change', async () => {
    const res = await checkDomainMonitor(
      { targetValue: 'example.com', lastFingerprint: null },
      async () => makeReport({ subdomains: ['a.example.com'] }),
    )
    expect(res.isFirstRun).toBe(true)
    expect(res.changes.changed).toBe(false)
  })

  it('flags a change against a stored fingerprint', async () => {
    const oldFp = JSON.stringify(computeDomainFingerprint(makeReport({ subdomains: ['a.example.com'] })))
    const res = await checkDomainMonitor(
      { targetValue: 'example.com', lastFingerprint: oldFp },
      async () => makeReport({ subdomains: ['a.example.com', 'new.example.com'] }),
    )
    expect(res.changes.changed).toBe(true)
  })
})

describe('radar — scheduler sweep', () => {
  it('alerts on changed monitors, saves fingerprint, and marks run', async () => {
    const oldFp = JSON.stringify(computeDomainFingerprint(makeReport({ subdomains: ['a.example.com'] })))
    const alerts: string[] = []
    const saved: Record<string, string> = {}
    const marked: string[] = []

    const run = await runDueMonitors({
      listDue: async () => [makeMonitor({ id: 'm1', lastFingerprint: oldFp })],
      investigate: async () => makeReport({ subdomains: ['a.example.com', 'new.example.com'] }),
      onChange: async (m) => {
        alerts.push(m.id)
      },
      saveFingerprint: async (id, fp) => {
        saved[id] = fp
      },
      markRun: async (id) => {
        marked.push(id)
      },
    })

    expect(run.checked).toBe(1)
    expect(run.alerted).toBe(1)
    expect(alerts).toEqual(['m1'])
    expect(saved['m1']).toBeTruthy()
    expect(marked).toEqual(['m1'])
  })

  it('skips non-domain monitors without investigating', async () => {
    let investigated = 0
    const run = await runDueMonitors({
      listDue: async () => [makeMonitor({ id: 'ip1', targetType: 'ip', targetValue: '1.2.3.4' })],
      investigate: async () => {
        investigated++
        return makeReport({})
      },
      onChange: async () => {},
      saveFingerprint: async () => {},
      markRun: async () => {},
    })
    expect(investigated).toBe(0)
    expect(run.alerted).toBe(0)
  })
})

describe('radar — knowledge base ingest', () => {
  it('stores new items and de-duplicates by hash', async () => {
    const store = new Set<string>()
    const upsert = async (f: NewRadarFinding) => {
      if (store.has(f.dedupeHash)) return undefined
      store.add(f.dedupeHash)
      return { id: f.dedupeHash }
    }
    const items = [
      { title: 'New OSINT tool', url: 'https://example.com/tool' },
      { title: 'New OSINT tool', url: 'https://example.com/tool' }, // duplicate url
      { title: 'A technique' },
    ]
    const stored = await ingestFeedItems(items, upsert)
    expect(stored).toBe(2)
    expect(feedDedupeHash(items[0])).toBe(feedDedupeHash(items[1]))
  })
})
