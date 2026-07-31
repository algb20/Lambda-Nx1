import { describe, it, expect } from 'vitest'
import {
  calibrationHash,
  forecastsFromHorizon,
  recordClaim,
  resolveClaim,
  scoreboard,
  type CalibrationClaimRow,
  type CalibrationPort,
} from './calibration'

function fakePort(): CalibrationPort & { rows: any[] } {
  const rows: any[] = []
  return {
    rows,
    async record(row) {
      if (rows.some((r) => r.dedupeHash === row.dedupeHash)) return undefined
      const stored = { id: `c${rows.length}`, status: 'open', outcome: null, assertedAt: new Date(), ...row }
      rows.push(stored)
      return stored
    },
    async resolve(id, outcome, note) {
      const r = rows.find((x) => x.id === id)
      if (r) Object.assign(r, { status: 'resolved', outcome, note })
      return r
    },
    async list() {
      return rows as CalibrationClaimRow[]
    },
  }
}

describe('recordClaim / resolveClaim', () => {
  it('records with a dedupe hash and ignores duplicates', async () => {
    const p = fakePort()
    await recordClaim(p, { authorKind: 'us', author: 'Lambda NX', claim: 'X will rise' })
    await recordClaim(p, { authorKind: 'us', author: 'Lambda NX', claim: 'x will rise' }) // same (case-insensitive)
    expect(p.rows).toHaveLength(1)
    expect(p.rows[0].dedupeHash).toBe(calibrationHash('Lambda NX', 'X will rise'))
  })

  it('rejects an empty claim or author', async () => {
    const p = fakePort()
    await expect(recordClaim(p, { authorKind: 'us', author: 'A', claim: '' })).rejects.toThrow(/claim is required/i)
    await expect(recordClaim(p, { authorKind: 'us', author: '', claim: 'y' })).rejects.toThrow(/author is required/i)
  })

  it('resolves a claim with an outcome', async () => {
    const p = fakePort()
    await recordClaim(p, { authorKind: 'external', author: 'gdelt', claim: 'deal closes Q3' })
    await resolveClaim(p, 'c0', 'correct')
    expect(p.rows[0].status).toBe('resolved')
    expect(p.rows[0].outcome).toBe('correct')
  })
})

function row(over: Partial<CalibrationClaimRow>): CalibrationClaimRow {
  return {
    id: Math.random().toString(36).slice(2),
    authorKind: 'us',
    author: 'Lambda NX',
    claim: 'c',
    topic: null,
    status: 'resolved',
    outcome: 'correct',
    confidence: 'probable',
    assertedAt: new Date(),
    horizon: null,
    ...over,
  }
}

describe('scoreboard', () => {
  it('computes weighted accuracy overall, by author and by confidence', () => {
    const rows: CalibrationClaimRow[] = [
      row({ author: 'Lambda NX', outcome: 'correct', confidence: 'probable' }),
      row({ author: 'Lambda NX', outcome: 'partial', confidence: 'possible' }),
      row({ author: 'analystX', authorKind: 'external', outcome: 'wrong', confidence: 'possible' }),
      row({ author: 'analystX', authorKind: 'external', status: 'open', outcome: null, confidence: 'possible' }),
    ]
    const sb = scoreboard(rows)
    expect(sb.total).toBe(4)
    expect(sb.open).toBe(1)
    // overall resolved = 3; score = 1 + 0.5 + 0 = 1.5 / 3 = 0.5
    expect(sb.overall.accuracy).toBeCloseTo(0.5, 5)
    const us = sb.byAuthor.find((a) => a.author === 'Lambda NX')!
    expect(us.accuracy).toBeCloseTo(0.75, 5) // (1 + 0.5)/2
    const ext = sb.byAuthor.find((a) => a.author === 'analystX')!
    expect(ext.accuracy).toBe(0) // one wrong, one still open (not counted)
    expect(us.accuracy! > ext.accuracy!).toBe(true) // ranked best-first
  })
})

describe('forecastsFromHorizon', () => {
  it('maps published forward-looking items to external claims', () => {
    const claims = forecastsFromHorizon('Acme', [
      { title: 'Acme will report Q3 earnings', sourceKey: 'gdelt', sourceUrl: 'https://n/a', at: 't' },
    ])
    expect(claims[0]).toMatchObject({ authorKind: 'external', author: 'gdelt', topic: 'Acme' })
  })
})
