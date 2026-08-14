import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeterministicAnalyst, verdictFromReading, withReading } from './deterministic'
import { getAiProvider } from './index'
import { AnalystRefusedError, type AiProvider, type AnalystInput, type AnalystVerdict } from './types'
import { readEvidence } from '../analysis/reasoning'
import type { Evidence } from '../engine/types'

const NOW = Date.parse('2026-08-14T12:00:00.000Z')

function ev(over: Partial<Evidence> & { claim: string }): Evidence {
  return {
    sourceKey: 'gdelt',
    sourceUrl: 'https://example.org/a',
    retrievedAt: '2026-08-14T12:00:00.000Z',
    publishedAt: '2026-08-14T10:00:00.000Z',
    confidence: 'possible',
    admiralty: { source: 'C', info: 3 },
    ...over,
  }
}

const findings: Evidence[] = [
  ev({
    claim: 'Magnitude 6.1 earthquake strikes off northern Honshu',
    sourceKey: 'usgs',
    admiralty: { source: 'A', info: 1 },
    confidence: 'confirmed',
  }),
  ev({
    claim: 'Magnitude 6.1 earthquake strikes off northern Honshu coast',
    sourceKey: 'emsc',
    admiralty: { source: 'A', info: 2 },
    confidence: 'confirmed',
  }),
  ev({ claim: 'Sendai port suspends container operations', sourceKey: 'gdelt' }),
]

const input: AnalystInput = { subject: 'northern Honshu', gateway: 'world', findings }

describe('DeterministicAnalyst', () => {
  it('is configured with no key, because it needs nothing to run', async () => {
    // The whole point: the product's analysis no longer depends on somebody
    // having bought an API key.
    const analyst = new DeterministicAnalyst()
    expect(analyst.configured).toBe(true)
    const verdict = await analyst.analyze(input)
    expect(verdict.configured).toBe(true)
    expect(verdict.model).toBeNull()
    expect(verdict.provider).toBe('deterministic')
    expect(verdict.summary.length).toBeGreaterThan(60)
  })

  it('carries the full reading, so every sentence can be traced to a row', async () => {
    const verdict = await new DeterministicAnalyst({ now: NOW }).analyze(input)
    expect(verdict.reading?.findings).toBe(3)
    expect(verdict.reading?.corroboration.corroborated).toBe(1)
  })

  it('refuses to grade severity, because risk is a judgement about meaning', async () => {
    // A mechanical engine reading structure cannot say whether a finding is
    // grave without inventing an opinion. `reading.strength` is the honest
    // grade, and it is about our support for the claims, not about the claims.
    const verdict = await new DeterministicAnalyst({ now: NOW }).analyze(input)
    expect(verdict.severity).toBe('info')
    expect(verdict.reading?.strength).toBeDefined()
  })

  it('never suggests a step that touches a target', async () => {
    const verdict = await new DeterministicAnalyst({ now: NOW }).analyze(input)
    expect(verdict.nextSteps.length).toBeGreaterThan(0)
    for (const step of verdict.nextSteps) {
      expect(step).not.toMatch(/scan|probe|port|nmap|connect to|contact the target/i)
    }
  })

  it('adds no claim that is not in the evidence it was given', async () => {
    // The rule the whole layer exists under: the analyst sorts, it does not
    // verify, and it never invents.
    const verdict = await new DeterministicAnalyst({ now: NOW }).analyze(input)
    const claims = findings.map((f) => f.claim)
    for (const point of verdict.keyPoints) {
      expect(claims.some((c) => point.startsWith(c)) || point.startsWith('Sources disagree')).toBe(true)
    }
    for (const item of verdict.needsVerification) {
      expect(claims.includes(item) || item.startsWith('Which origin is right')).toBe(true)
    }
  })

  it('produces a verdict for an empty result without pretending it found nothing to worry about', async () => {
    const verdict = await new DeterministicAnalyst({ now: NOW }).analyze({ ...input, findings: [] })
    expect(verdict.summary).toMatch(/not about the subject/)
    expect(verdict.nextSteps.length).toBeGreaterThan(0)
  })

  it('is deterministic: same evidence, same verdict', async () => {
    const a = verdictFromReading(input, readEvidence(findings, { now: NOW }), 'fixed')
    const b = verdictFromReading(input, readEvidence(findings, { now: NOW }), 'fixed')
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b))
  })

  it('raises the confidence caveat when the picture rests on single origins', async () => {
    const thin = Array.from({ length: 6 }, (_, i) =>
      ev({ claim: `Report ${i} about the terminal lease`, sourceKey: 'wire' }),
    )
    const verdict = await new DeterministicAnalyst({ now: NOW }).analyze({ ...input, findings: thin })
    expect(verdict.confidenceCaveat).toBe(true)
  })
})

function fakeProvider(behaviour: () => Promise<AnalystVerdict>): AiProvider {
  return { name: 'fake-model', configured: true, analyze: behaviour }
}

const modelVerdict: AnalystVerdict = {
  summary: 'the model read',
  severity: 'high',
  keyPoints: ['a'],
  nextSteps: [],
  needsVerification: [],
  confidenceCaveat: false,
  provider: 'fake-model',
  model: 'fake-1',
  generatedAt: '2026-08-14T12:00:00.000Z',
  configured: true,
}

describe('withReading', () => {
  it('returns the model verdict with the mechanical reading attached', async () => {
    // Both, deliberately. The model reads meaning and the arithmetic reads
    // structure; disagreement between them is itself informative.
    const verdict = await withReading(fakeProvider(async () => modelVerdict), { now: NOW }).analyze(input)
    expect(verdict.summary).toBe('the model read')
    expect(verdict.severity).toBe('high')
    expect(verdict.model).toBe('fake-1')
    expect(verdict.reading?.corroboration.corroborated).toBe(1)
  })

  it('propagates a refusal untouched — a model declining is a fact the caller must see', async () => {
    const provider = withReading(
      fakeProvider(async () => {
        throw new AnalystRefusedError('declined')
      }),
      { now: NOW },
    )
    await expect(provider.analyze(input)).rejects.toBeInstanceOf(AnalystRefusedError)
  })

  it('degrades to the mechanical verdict when the model is unreachable, and says so', async () => {
    // Strictly more than an error page: the reader still gets the whole
    // structural analysis, and is told why the model is missing from it.
    const verdict = await withReading(
      fakeProvider(async () => {
        throw new Error('upstream 529')
      }),
      { now: NOW },
    ).analyze(input)
    expect(verdict.provider).toBe('deterministic')
    expect(verdict.summary).toMatch(/could not be reached \(upstream 529\)/)
    expect(verdict.reading?.findings).toBe(3)
  })
})

describe('getAiProvider', () => {
  const env = { ...process.env }
  afterEach(() => {
    process.env = { ...env }
    vi.unstubAllEnvs()
  })

  it('falls back to the deterministic analyst when there is no key, not to a notice', async () => {
    // The failure this whole change exists to fix: without a key the product
    // used to have no analyst at all.
    vi.stubEnv('AI_PROVIDER', 'claude')
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const provider = getAiProvider()
    expect(provider.name).toBe('deterministic')
    const verdict = await provider.analyze(input)
    expect(verdict.configured).toBe(true)
    expect(verdict.reading).toBeTruthy()
  })

  it('uses the model provider when a key is present, still carrying the reading', () => {
    vi.stubEnv('AI_PROVIDER', 'claude')
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-not-a-real-key')
    expect(getAiProvider().name).toBe('claude')
  })

  it('still honours an operator explicitly turning the layer off', async () => {
    vi.stubEnv('AI_PROVIDER', 'disabled')
    const verdict = await getAiProvider().analyze(input)
    expect(verdict.configured).toBe(false)
  })

  it('rejects an unknown provider by name', () => {
    vi.stubEnv('AI_PROVIDER', 'nonsense')
    expect(() => getAiProvider()).toThrow(/not configured/)
  })
})
