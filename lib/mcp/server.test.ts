import { describe, expect, it } from 'vitest'
import {
  PROTOCOL_VERSION,
  RPC,
  SERVER_INFO,
  TOOLS,
  handleProtocol,
  readToolCall,
  toolError,
  toolResult,
} from './server'

const rpc = (method: string, params?: Record<string, unknown>, id: string | number | null = 1) => ({
  jsonrpc: '2.0' as const,
  id,
  method,
  params,
})

describe('the handshake', () => {
  it('answers initialize with a protocol version and a server identity', () => {
    const res = handleProtocol(rpc('initialize'))!
    expect('result' in res).toBe(true)
    const result = (res as { result: Record<string, unknown> }).result
    expect(result.protocolVersion).toBe(PROTOCOL_VERSION)
    expect(result.serverInfo).toEqual(SERVER_INFO)
  })

  /**
   * Claiming a capability we do not implement makes a client call it and fail,
   * which is worse than not offering it at all.
   */
  it('advertises only the capability it actually implements', () => {
    const result = (handleProtocol(rpc('initialize'))! as { result: Record<string, unknown> }).result
    expect(result.capabilities).toEqual({ tools: { listChanged: false } })
    expect(result.capabilities).not.toHaveProperty('resources')
    expect(result.capabilities).not.toHaveProperty('prompts')
  })

  /**
   * The instructions reach the model on every session. If the caveat lives only
   * in documentation, an agent relays our numbers without it — which produces
   * exactly the false confidence this platform argues against.
   */
  it('tells the agent, at handshake, to relay the limits with the numbers', () => {
    const result = (handleProtocol(rpc('initialize'))! as { result: { instructions: string } }).result
    expect(result.instructions).toContain('limits')
    expect(result.instructions).toContain('unobserved, never that it is calm')
  })

  it('answers ping and the initialized notification without complaint', () => {
    for (const method of ['ping', 'notifications/initialized']) {
      expect('result' in handleProtocol(rpc(method))!).toBe(true)
    }
  })
})

describe('protocol errors', () => {
  it('rejects a request that is not JSON-RPC 2.0', () => {
    const res = handleProtocol({ jsonrpc: '1.0', id: 1, method: 'ping' })!
    expect((res as { error: { code: number } }).error.code).toBe(RPC.INVALID_REQUEST)
  })

  it('rejects a request with no method', () => {
    const res = handleProtocol({ jsonrpc: '2.0', id: 1 })!
    expect((res as { error: { code: number } }).error.code).toBe(RPC.INVALID_REQUEST)
  })

  it('names the unknown method rather than failing blankly', () => {
    const res = handleProtocol(rpc('resources/list'))!
    const error = (res as { error: { code: number; message: string } }).error
    expect(error.code).toBe(RPC.METHOD_NOT_FOUND)
    expect(error.message).toContain('resources/list')
  })

  it('echoes the id back, including a null one', () => {
    expect((handleProtocol(rpc('ping', undefined, 'abc'))! as { id: string }).id).toBe('abc')
    expect((handleProtocol(rpc('ping', undefined, null))! as { id: null }).id).toBeNull()
  })

  /** tools/call needs data, so the pure handler defers rather than answering. */
  it('defers tools/call to the caller that can reach the data', () => {
    expect(handleProtocol(rpc('tools/call', { name: 'source_health' }))).toBeNull()
  })
})

describe('the tool registry', () => {
  it('lists every tool with a schema a client can render', () => {
    const res = handleProtocol(rpc('tools/list'))!
    const tools = (res as { result: { tools: typeof TOOLS } }).result.tools
    expect(tools.length).toBe(TOOLS.length)
    for (const tool of tools) {
      expect(tool.name, tool.name).toMatch(/^[a-z_]+$/)
      expect(tool.description.length, tool.name).toBeGreaterThan(60)
      expect(tool.inputSchema.type, tool.name).toBe('object')
    }
  })

  it('gives each tool a distinct name', () => {
    expect(new Set(TOOLS.map((t) => t.name)).size).toBe(TOOLS.length)
  })

  /**
   * A description that oversells is how an agent picks the wrong tool and
   * reports the wrong thing confidently. The two tools that are easiest to
   * misread must say what they are not, in the description the model reads.
   */
  it('makes the corridor tool state that it is not a vessel count', () => {
    const corridor = TOOLS.find((t) => t.name === 'corridor_status')!
    expect(corridor.description).toContain('NOT a vessel or transit count')
    expect(corridor.description).toContain('no AIS')
  })

  it('makes the country tool state that low signal is not calm', () => {
    const risk = TOOLS.find((t) => t.name === 'country_risk')!
    expect(risk.description).toContain('NOT that it is calm')
  })

  it('makes the ranking tool forbid flattening the bands', () => {
    const ranking = TOOLS.find((t) => t.name === 'country_ranking')!
    expect(ranking.description).toContain('not comparable')
    expect(ranking.description).toContain('Do not flatten')
  })

  it('marks the arguments a tool cannot work without', () => {
    expect(TOOLS.find((t) => t.name === 'country_risk')!.inputSchema.required).toEqual(['country'])
    expect(TOOLS.find((t) => t.name === 'gateway_query')!.inputSchema.required).toEqual(['gateway'])
  })
})

describe('reading a tool call', () => {
  it('accepts a known tool with its arguments', () => {
    const call = readToolCall({ name: 'country_risk', arguments: { country: 'SD' } })
    expect(call).toEqual({ name: 'country_risk', args: { country: 'SD' } })
  })

  it('defaults missing arguments to an empty object rather than failing', () => {
    expect(readToolCall({ name: 'source_health' })).toEqual({ name: 'source_health', args: {} })
  })

  it('ignores an arguments value that is not an object', () => {
    expect(readToolCall({ name: 'source_health', arguments: 'nope' })).toEqual({
      name: 'source_health',
      args: {},
    })
    expect(readToolCall({ name: 'source_health', arguments: ['a'] })).toEqual({
      name: 'source_health',
      args: {},
    })
  })

  /** An agent that guessed wrong needs the real list, not "invalid tool". */
  it('lists the available tools when the name is unknown', () => {
    const call = readToolCall({ name: 'get_everything' }) as { error: string }
    expect(call.error).toContain('get_everything')
    expect(call.error).toContain('country_risk')
  })

  it('rejects a call with no name', () => {
    expect(readToolCall({})).toEqual({ error: 'params.name is required' })
    expect(readToolCall(undefined)).toEqual({ error: 'params.name is required' })
  })
})

describe('the content envelope', () => {
  it('serialises a payload into a text block, as clients expect', () => {
    const result = toolResult({ signal: 42 })
    expect(result.content[0].type).toBe('text')
    expect(JSON.parse(result.content[0].text)).toEqual({ signal: 42 })
    expect(result.isError).toBeUndefined()
  })

  it('marks a failure as an error the agent can read and relay', () => {
    const result = toolError('Unknown corridor: atlantis')
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('atlantis')
  })
})

/**
 * The routing bug a live call caught, locked so it cannot return.
 *
 * `gateway_query` built `/api/intelligence/<gateway>` for every gateway. The
 * board family answers under `/boards/<key>`, so `statements` returned a 404
 * HTML page — and the agent would have relayed that as "the gateway is down"
 * rather than "the URL was wrong". Unit tests all passed; only calling it found
 * this.
 */
describe('every gateway an agent may ask for has somewhere to answer', () => {
  it('routes board gateways under /boards and the rest at the top level', async () => {
    const { BOARDS } = await import('../modules/board-shared')
    const { ALL_MODES } = await import('../gateways')
    const boardKeys = new Set(BOARDS.map((b) => b.key))
    // The mapping the route uses, asserted here so the two cannot drift.
    const path = (g: string) =>
      boardKeys.has(g) ? `/api/intelligence/boards/${g}` : `/api/intelligence/${g}`
    expect(path('statements')).toBe('/api/intelligence/boards/statements')
    expect(path('domain')).toBe('/api/intelligence/domain')
    // Every advertised gateway resolves to one path or the other.
    for (const mode of ALL_MODES) expect(path(mode), mode).toMatch(/^\/api\/intelligence\//)
  })
})
