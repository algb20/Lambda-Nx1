/**
 * Model Context Protocol — the platform as tools an agent can call.
 *
 * ## Why this exists
 *
 * A field survey on 2026-08-20 (see `docs/COMPETITORS.md`) found this to be the
 * largest genuine capability gap between us and the strongest comparable
 * product. Their framing is the right one: without it, an agent asked about the
 * world answers from training-data memory — confidently, fluently, and as of
 * whenever its weights were frozen. With it, the same agent reads what public
 * sources published in the last hour.
 *
 * ## The design decision that is ours rather than theirs
 *
 * Every tool here returns **evidence, not verdicts**. A tool that answers "is
 * Yemen unstable?" with `72` has laundered a judgement into a number and handed
 * an agent something it cannot check or caveat. So each result carries, in the
 * payload and not in documentation the agent will never read:
 *
 *  - the sources behind it, with links and timestamps,
 *  - how many *independent* origins agreed,
 *  - and `limits` — a plain list of what the answer does not cover.
 *
 * `limits` is never empty and never optional. An agent that relays our numbers
 * without our caveats produces exactly the false confidence this platform was
 * built to argue against, and the only place we can prevent that is in the
 * payload itself.
 *
 * ## Transport
 *
 * Plain JSON-RPC 2.0 over HTTP POST, which is what MCP is underneath. No SDK
 * dependency: the protocol is a handful of methods and writing them directly
 * keeps `lib/mcp` free of a vendor package that would have to be tracked,
 * audited and kept in step with our own release cadence (§2 rule 3).
 */

export interface McpTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, { type: string; description: string; enum?: string[] }>
    required?: string[]
  }
}

/**
 * The tool registry.
 *
 * Descriptions are written for a model choosing between tools, so each says
 * what question it answers and — where it matters — what it explicitly does
 * not. A tool description that oversells is how an agent picks the wrong tool
 * and reports the wrong thing with confidence.
 */
export const TOOLS: McpTool[] = [
  {
    name: 'world_events',
    description:
      'Live world events from ~119 public sources: earthquakes, storms, wildfires, floods, conflict, health and infrastructure reports. Each event carries its source, both timestamps (when it happened and when we received it), an Admiralty rating and its independence group. Use for "what is happening right now" questions. Does not include anything unpublished.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter to one category, e.g. conflict, seismic, storm, cyber.' },
        country: { type: 'string', description: 'ISO 3166-1 alpha-2 code, e.g. YE.' },
        limit: { type: 'number', description: 'Maximum events to return. Default 40.' },
      },
    },
  },
  {
    name: 'country_risk',
    description:
      'Instability signal for a country AND how well that country is observed — two numbers that are never combined. Returns every component with the strongest report named, plus blind spots. Critical: a low signal with low observability means the country cannot be seen, NOT that it is calm. Never present the signal without the observability.',
    inputSchema: {
      type: 'object',
      properties: {
        country: { type: 'string', description: 'ISO 3166-1 alpha-2 code, e.g. SD.' },
      },
      required: ['country'],
    },
  },
  {
    name: 'country_ranking',
    description:
      'Countries ranked by instability signal, grouped into observability bands. Returns bands rather than one list on purpose: countries seen through very different amounts of coverage are not comparable, and a flat ranking asserts that they are. Do not flatten the bands when relaying this.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum countries per band. Default 10.' },
      },
    },
  },
  {
    name: 'corridor_status',
    description:
      'Pressure near critical maritime and cable corridors (Hormuz, Bab el-Mandeb, Suez, Malacca, Taiwan, Panama and 10 more). IMPORTANT: this is NOT a vessel or transit count — we carry no AIS. It is published activity near the corridor that could affect transit. A corridor can be badly disrupted with nothing here, and busy with signals while shipping runs normally.',
    inputSchema: {
      type: 'object',
      properties: {
        corridor: { type: 'string', description: 'Corridor key, e.g. hormuz, bab_el_mandeb, suez, malacca, taiwan, panama. Omit for all.' },
      },
    },
  },
  {
    name: 'gateway_query',
    description:
      'Run one of the passive intelligence gateways: domain, threat, finance, companies, courts, regulation, statements, research, markets and others. Passive and keyless — the subject is never contacted. Returns graded findings with source links.',
    inputSchema: {
      type: 'object',
      properties: {
        gateway: { type: 'string', description: 'Gateway id, e.g. statements, companies, courts, threat, research.' },
        query: { type: 'string', description: 'What to look for. Some gateways accept an empty query and return the current board.' },
      },
      required: ['gateway'],
    },
  },
  {
    name: 'source_health',
    description:
      'Per-feed status right now: ok, cached, empty or failed, with the reason. Use this before trusting an absence — a quiet region may be a failed feed. "empty" means a source answered and gave nothing, which is coverage lost, not health.',
    inputSchema: { type: 'object', properties: {} },
  },
]

export interface JsonRpcRequest {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: string | number | null; result: unknown }
  | { jsonrpc: '2.0'; id: string | number | null; error: { code: number; message: string } }

/** JSON-RPC error codes, as the spec defines them. */
export const RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const

export const PROTOCOL_VERSION = '2024-11-05'

export const SERVER_INFO = { name: 'lambda-nx', version: '1.0.0' } as const

export function ok(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, result }
}

export function fail(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }
}

/**
 * Wrap a tool result in MCP's content envelope.
 *
 * MCP delivers tool output as content blocks; JSON goes in a text block as
 * serialised JSON, which is what every client expects to parse.
 */
export function toolResult(payload: unknown): {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
} {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] }
}

export function toolError(message: string): {
  content: Array<{ type: 'text'; text: string }>
  isError: boolean
} {
  return { content: [{ type: 'text', text: message }], isError: true }
}

/**
 * Handle the protocol methods that need no data access.
 *
 * Separated from the tool calls so the handshake, the tool list and the error
 * paths are testable without touching a network or a source catalogue —
 * which is most of what can go wrong in an MCP server.
 */
export function handleProtocol(req: JsonRpcRequest): JsonRpcResponse | null {
  const id = req.id ?? null

  if (req.jsonrpc !== '2.0') {
    return fail(id, RPC.INVALID_REQUEST, 'jsonrpc must be "2.0"')
  }
  if (typeof req.method !== 'string' || !req.method) {
    return fail(id, RPC.INVALID_REQUEST, 'method is required')
  }

  switch (req.method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        // Tools only. We deliberately advertise no `resources` and no
        // `prompts`: claiming a capability we do not implement makes a client
        // call it and fail, which is worse than not offering it.
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          'Lambda NX serves passively collected public-source intelligence. Every result carries its sources, how many independent origins agreed, and a `limits` list. Relay the limits with the numbers — a score repeated without its caveats becomes a claim we did not make. In particular: a low country signal with low observability means the country is unobserved, never that it is calm.',
      })

    case 'notifications/initialized':
      // A notification has no id and expects no reply.
      return ok(id, {})

    case 'ping':
      return ok(id, {})

    case 'tools/list':
      return ok(id, { tools: TOOLS })

    case 'tools/call':
      return null // needs data — the route handles it

    default:
      return fail(id, RPC.METHOD_NOT_FOUND, `Unknown method: ${req.method}`)
  }
}

/** Validate a tools/call before any work is done. */
export function readToolCall(
  params: Record<string, unknown> | undefined,
): { name: string; args: Record<string, unknown> } | { error: string } {
  const name = params?.name
  if (typeof name !== 'string' || !name) return { error: 'params.name is required' }
  if (!TOOLS.some((t) => t.name === name)) {
    return { error: `Unknown tool: ${name}. Available: ${TOOLS.map((t) => t.name).join(', ')}` }
  }
  const raw = params?.arguments
  const args = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return { name, args }
}
