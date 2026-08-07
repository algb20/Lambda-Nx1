import { describe, it, expect, vi } from 'vitest'
import { Registry } from './registry'
import { collect } from './orchestrator'
import { Guardrail, PassiveGuardrailError } from './guardrail'
import { gradeConfidence, dedupeEvidence, buildGraph, formatAdmiralty } from './analysis'
import type { Admiralty, Capability, Evidence, Source } from './types'

function ev(claim: string, sourceKey = 's', admiralty?: Admiralty): Evidence {
  return {
    claim,
    sourceKey,
    retrievedAt: new Date().toISOString(),
    confidence: 'possible',
    admiralty,
  }
}

function makeSource(o: {
  key: string
  run: Source['run']
  capability?: Capability
}): Source {
  return {
    key: o.key,
    capability: o.capability ?? 'dns',
    passive: true,
    hosts: ['provider.test'],
    run: o.run,
  }
}

describe('guardrail — passive-only enforcement', () => {
  it('rejects a source not marked passive', () => {
    const g = new Guardrail()
    expect(() =>
      g.assertPassiveSource({ key: 'x', passive: false, hosts: ['a.com'] } as unknown as Source),
    ).toThrow(PassiveGuardrailError)
  })

  it('rejects a source that declares no provider hosts', () => {
    const g = new Guardrail()
    expect(() =>
      g.assertPassiveSource({ key: 'x', passive: true, hosts: [] } as unknown as Source),
    ).toThrow(PassiveGuardrailError)
  })

  it('blocks requests to a non-allow-listed host (cannot touch a target)', async () => {
    const g = new Guardrail()
    g.allowHosts(['api.good.test'])
    const f = g.createFetch('s')
    await expect(f('https://evil.test/probe')).rejects.toThrow(/not allow-listed/)
  })

  it('allows provider query POST but blocks state-changing methods', async () => {
    const g = new Guardrail()
    g.allowHosts(['api.good.test'])
    const f = g.createFetch('s')
    await expect(f('https://api.good.test/x', { method: 'DELETE' })).rejects.toThrow(/state-changing/)

    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'))
    vi.stubGlobal('fetch', fetchMock)
    try {
      await f('https://api.good.test/x', { method: 'POST' })
      expect(fetchMock).toHaveBeenCalledOnce()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('allows a GET to an allow-listed host', async () => {
    const g = new Guardrail()
    g.allowHosts(['api.good.test'])
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'))
    vi.stubGlobal('fetch', fetchMock)
    try {
      const res = await g.createFetch('s')('https://api.good.test/x')
      expect(await res.text()).toBe('ok')
      expect(fetchMock).toHaveBeenCalledOnce()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('orchestrator — multi-source fallback', () => {
  it('falls back to the next source when one errors', async () => {
    const reg = new Registry()
    reg.registerAll([
      makeSource({
        key: 'fail',
        run: async () => {
          throw new Error('provider down')
        },
      }),
      makeSource({ key: 'ok', run: async () => [ev('resolved', 'ok')] }),
    ])
    const out = await collect({ capability: 'dns', value: 'example.com' }, { registry: reg })
    expect(out.evidence).toHaveLength(1)
    expect(out.results.find((r) => r.sourceKey === 'fail')?.ok).toBe(false)
    expect(out.results.find((r) => r.sourceKey === 'ok')?.ok).toBe(true)
  })

  it('mode "first" stops after the first source that returns evidence', async () => {
    const reg = new Registry()
    const second = vi.fn(async () => [ev('b', 'two')])
    reg.registerAll([
      makeSource({ key: 'one', run: async () => [ev('a', 'one')] }),
      makeSource({ key: 'two', run: second }),
    ])
    const out = await collect({ capability: 'dns', value: 'x' }, { registry: reg, mode: 'first' })
    expect(out.evidence).toHaveLength(1)
    expect(second).not.toHaveBeenCalled()
  })

  it('mode "all" aggregates evidence from every source', async () => {
    const reg = new Registry()
    reg.registerAll([
      makeSource({ key: 'one', run: async () => [ev('a', 'one')] }),
      makeSource({ key: 'two', run: async () => [ev('b', 'two')] }),
    ])
    const out = await collect({ capability: 'dns', value: 'x' }, { registry: reg, mode: 'all' })
    expect(out.evidence).toHaveLength(2)
  })

  it('throws when no source is registered for a capability', async () => {
    const reg = new Registry()
    await expect(collect({ capability: 'dns', value: 'x' }, { registry: reg })).rejects.toThrow(
      /No source registered/,
    )
  })
})

describe('analysis — confidence grading (never assert from one source)', () => {
  it('unconfirmed with no evidence', () => {
    expect(gradeConfidence([])).toBe('unconfirmed')
  })
  it('confirmed with two independent reliable sources', () => {
    expect(
      gradeConfidence([ev('c', 's1', { source: 'A', info: 1 }), ev('c', 's2', { source: 'B', info: 2 })]),
    ).toBe('confirmed')
  })
  it('probable with two distinct non-reliable sources', () => {
    expect(gradeConfidence([ev('c', 's1'), ev('c', 's2')])).toBe('probable')
  })
  it('probable with a single reliable source', () => {
    expect(gradeConfidence([ev('c', 's1', { source: 'A', info: 1 })])).toBe('probable')
  })
  it('possible with a single non-reliable source', () => {
    expect(gradeConfidence([ev('c', 's1')])).toBe('possible')
  })
})

describe('analysis — dedupe & pivot graph', () => {
  it('drops exact duplicates but keeps independent corroboration', () => {
    const out = dedupeEvidence([ev('claim', 's1'), ev('claim', 's1'), ev('claim', 's2')])
    expect(out).toHaveLength(2)
  })

  it('builds a pivot graph rooted at the subject', () => {
    const root = { type: 'domain', value: 'example.com' } as const
    const g = buildGraph(root, [
      { ...ev('resolves to', 'dns'), entity: { type: 'ip', value: '1.2.3.4' } },
      { ...ev('has subdomain', 'crtsh'), entity: { type: 'domain', value: 'api.example.com' } },
    ])
    expect(g.nodes).toHaveLength(3)
    expect(g.edges).toHaveLength(2)
    expect(g.edges.every((e) => e.from === 'domain:example.com')).toBe(true)
  })

  it('formats the Admiralty code', () => {
    expect(formatAdmiralty({ source: 'A', info: 1 })).toBe('A1')
  })
})

/**
 * Regression: the news gateway ran four sources sequentially, each preceded by
 * its politeness delay. The total exceeded the hosting request limit, the
 * request was killed, and the client got an HTML error page where it expected
 * JSON — which is why the live world map rendered empty. Independent sources
 * must run at once, and no single provider may consume the whole budget.
 */
describe('orchestrator — parallelism and deadlines', () => {
  function slowSource(key: string, ms: number, claim: string): Source {
    return {
      key,
      capability: 'news',
      passive: true,
      hosts: [`${key}.example`],
      async run() {
        await new Promise((r) => setTimeout(r, ms))
        return [
          {
            claim,
            sourceKey: key,
            retrievedAt: new Date().toISOString(),
            confidence: 'possible' as const,
          },
        ]
      },
    }
  }

  it("runs mode 'all' in parallel, not one after another", async () => {
    const reg = new Registry()
    reg.registerAll([
      slowSource('a', 120, 'from a'),
      slowSource('b', 120, 'from b'),
      slowSource('c', 120, 'from c'),
      slowSource('d', 120, 'from d'),
    ])
    const started = Date.now()
    const out = await collect({ capability: 'news', value: '' }, { registry: reg, mode: 'all' })
    const elapsed = Date.now() - started

    expect(out.evidence).toHaveLength(4)
    // Sequential would be ~480ms; parallel is ~120ms. The midpoint separates
    // them without being flaky on a loaded machine.
    expect(elapsed).toBeLessThan(300)
  })

  it('bounds each source, and keeps what the others returned', async () => {
    const reg = new Registry()
    reg.registerAll([
      slowSource('fast', 10, 'arrived'),
      // Never settles — the real-world case of a provider that stops answering.
      {
        key: 'hung',
        capability: 'news',
        passive: true,
        hosts: ['hung.example'],
        run: () => new Promise(() => {}),
      } as Source,
    ])
    const out = await collect(
      { capability: 'news', value: '' },
      { registry: reg, mode: 'all', timeoutMs: 80 },
    )

    expect(out.evidence.map((e) => e.claim)).toEqual(['arrived'])
    const hung = out.results.find((r) => r.sourceKey === 'hung')
    expect(hung?.ok).toBe(false)
    expect(hung?.error).toMatch(/timed out/)
  })

  it("keeps mode 'first' ordered — it is a fallback chain", async () => {
    const reg = new Registry()
    reg.registerAll([
      { key: 'empty', capability: 'news', passive: true, hosts: ['e.example'], run: async () => [] } as Source,
      slowSource('second', 5, 'from second'),
      slowSource('third', 5, 'from third'),
    ])
    const out = await collect({ capability: 'news', value: '' }, { registry: reg, mode: 'first' })

    expect(out.evidence.map((e) => e.claim)).toEqual(['from second'])
    // It stopped at the first source that answered; the third never ran.
    expect(out.results.map((r) => r.sourceKey)).toEqual(['empty', 'second'])
  })
})
