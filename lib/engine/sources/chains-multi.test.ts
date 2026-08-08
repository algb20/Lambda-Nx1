import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  ethereumChain,
  exchangeVenues,
  multiChainSources,
  parseDecimal,
  parseHex,
  piNetworkChain,
  solanaChain,
} from './chains-multi'

const input = { capability: 'chain_state' as const, value: '' }

function ok(body: unknown): Response {
  return { ok: true, json: async () => body } as unknown as Response
}

afterEach(() => vi.resetAllMocks())

describe('every multi-chain source is passive and declares its host', () => {
  it('keeps the guardrail meaningful', () => {
    for (const s of multiChainSources) {
      expect(s.passive, s.key).toBe(true)
      expect(s.hosts.length, s.key).toBeGreaterThan(0)
      expect(s.capability, s.key).toBe('chain_state')
    }
  })
})

describe('number parsing across wildly different chain encodings', () => {
  it('reads Horizon decimal strings', () => {
    expect(parseDecimal('100000000000.0000000')).toBe(1e11)
    expect(parseDecimal('1,234.5')).toBe(1234.5)
    expect(parseDecimal(42)).toBe(42)
    expect(parseDecimal('not a number')).toBeNull()
    expect(parseDecimal(null)).toBeNull()
  })

  it('reads Ethereum hex quantities', () => {
    expect(parseHex('0x10')).toBe(16)
    expect(parseHex('0x0')).toBe(0)
    expect(parseHex('0x12A05F200')).toBe(5_000_000_000)
    expect(parseHex('16')).toBeNull()
    expect(parseHex('0xZZ')).toBeNull()
    expect(parseHex(null)).toBeNull()
  })
})

describe('piNetworkChain', () => {
  it('reads supply and ledger height from Pi mainnet Horizon', async () => {
    const ctx = {
      fetch: vi.fn(async () =>
        ok({
          _embedded: {
            records: [
              {
                sequence: 12_345_678,
                closed_at: '2026-08-07T13:00:00Z',
                total_coins: '7500000000.0000000',
                fee_pool: '1234.5000000',
                operation_count: 42,
                successful_transaction_count: 30,
                failed_transaction_count: 2,
                base_fee_in_stroops: 100,
              },
            ],
          },
        }),
      ),
    }
    const [e] = await piNetworkChain.run(input, ctx)
    expect(e.claim).toContain('12,345,678')
    expect(e.claim).toContain('7.50B')
    // Mainnet answering about its own ledger is an A/1 observation.
    expect(e.admiralty).toEqual({ source: 'A', info: 1 })
    const d = e.data as Record<string, unknown>
    expect(d.chain).toBe('pi')
    expect(d.symbol).toBe('PI')
    expect(d.height).toBe(12_345_678)
    expect(d.totalSupply).toBe(7.5e9)
    // Both successes and failures are activity on the ledger.
    expect(d.transactions).toBe(32)
    expect(e.retrievedAt).toBe('2026-08-07T13:00:00Z')
  })

  it('returns nothing rather than a partial network when the ledger is unusable', async () => {
    const ctx = { fetch: vi.fn(async () => ok({ _embedded: { records: [{}] } })) }
    expect(await piNetworkChain.run(input, ctx)).toEqual([])
  })
})

describe('ethereumChain', () => {
  it('decodes the head block and gas price from JSON-RPC', async () => {
    const ctx = {
      fetch: vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as { method?: string }
        if (body.method === 'eth_blockNumber') return ok({ result: '0x14A5C1F' })
        return ok({ result: '0x6FC23AC00' }) // 30 gwei
      }),
    }
    const [e] = await ethereumChain.run(input, ctx)
    const d = e.data as Record<string, unknown>
    expect(d.chain).toBe('ethereum')
    expect(d.height).toBe(0x14a5c1f)
    expect(d.gasPrice).toBeCloseTo(30)
    expect(d.feeUnit).toBe('gwei')
  })

  it('still reports the block when the gas call fails', async () => {
    const ctx = {
      fetch: vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as { method?: string }
        if (body.method === 'eth_blockNumber') return ok({ result: '0x10' })
        throw new Error('rpc down')
      }),
    }
    const [e] = await ethereumChain.run(input, ctx)
    const d = e.data as Record<string, unknown>
    expect(d.height).toBe(16)
    expect(d.gasPrice).toBeNull()
  })

  it('reports nothing at all when the head block is unreadable', async () => {
    const ctx = { fetch: vi.fn(async () => ok({ result: 'garbage' })) }
    expect(await ethereumChain.run(input, ctx)).toEqual([])
  })
})

describe('solanaChain', () => {
  it('computes throughput only from a real performance sample', async () => {
    const ctx = {
      fetch: vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as { method?: string }
        if (body.method === 'getEpochInfo') {
          return ok({
            result: { blockHeight: 250_000_000, epoch: 700, slotIndex: 216_000, slotsInEpoch: 432_000 },
          })
        }
        return ok({ result: [{ numTransactions: 60_000, samplePeriodSecs: 60 }] })
      }),
    }
    const [e] = await solanaChain.run(input, ctx)
    const d = e.data as Record<string, unknown>
    expect(d.height).toBe(250_000_000)
    expect(d.tps).toBe(1000)
    expect(d.epochProgress).toBeCloseTo(0.5)
  })

  it('leaves throughput null rather than guessing when no sample came back', async () => {
    const ctx = {
      fetch: vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as { method?: string }
        if (body.method === 'getEpochInfo') return ok({ result: { blockHeight: 42 } })
        return ok({ result: [] })
      }),
    }
    const [e] = await solanaChain.run(input, ctx)
    expect((e.data as Record<string, unknown>).tps).toBeNull()
  })
})

describe('exchangeVenues', () => {
  it('carries each venue volume and its registered country', async () => {
    const ctx = {
      fetch: vi.fn(async () =>
        ok([
          { id: 'binance', name: 'Binance', country: 'Cayman Islands', trade_volume_24h_btc: 210_000, trust_score: 10, url: 'https://binance.com' },
          { id: 'nogeo', name: 'NoCountry', country: null, trade_volume_24h_btc: 1_000 },
          { id: 'novol', name: 'NoVolume', country: 'Japan' },
        ]),
      ),
    }
    const evidence = await exchangeVenues.run(input, ctx)
    // The venue with no volume is dropped; the one with no country is kept,
    // because it still counts toward total traded volume.
    expect(evidence).toHaveLength(2)
    const binance = evidence[0].data as Record<string, unknown>
    expect(binance.metric).toBe('venue')
    expect(binance.country).toBe('Cayman Islands')
    expect(binance.volumeBtc).toBe(210_000)
    // An aggregator reporting venue-declared volume is not an A/1 observation.
    expect(evidence[0].admiralty).toEqual({ source: 'B', info: 3 })
  })

  it('returns nothing when the payload is not a list', async () => {
    const ctx = { fetch: vi.fn(async () => ok({ error: 'rate limited' })) }
    expect(await exchangeVenues.run(input, ctx)).toEqual([])
  })
})
