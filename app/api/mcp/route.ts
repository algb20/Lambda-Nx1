import { NextResponse } from 'next/server'
import { getWorldEvents } from '@/lib/modules/world-events'
import { rankByBand, scoreAllCountries, scoreCountry } from '@/lib/analysis/country-risk'
import { CORRIDORS, watchAllCorridors, watchCorridor } from '@/lib/analysis/corridors'
import {
  RPC,
  fail,
  handleProtocol,
  ok,
  readToolCall,
  toolError,
  toolResult,
  type JsonRpcRequest,
} from '@/lib/mcp/server'
import { ALL_MODES } from '@/lib/gateways'
import { BOARDS } from '@/lib/modules/board-shared'

/**
 * POST /api/mcp — the Model Context Protocol endpoint.
 *
 * Lets Claude, or any MCP-capable agent, read live public-source intelligence
 * instead of answering about the world from training-data memory. JSON-RPC 2.0
 * over HTTP; `lib/mcp/server.ts` holds the protocol and the tool registry, and
 * this file holds only the part that touches data.
 *
 * Open, like every other read surface here (charter §1). It runs the same
 * passive collection an anonymous browser gets, so there is nothing to gate —
 * and an agent endpoint behind a key is an agent endpoint nobody wires up.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET — the discovery courtesy.
 *
 * MCP itself is POST-only, but a person or a crawler that finds this URL gets a
 * browser and a `GET`. Answering that with "405 Method Not Allowed" is how an
 * integration dies silently at the first probe, so a GET describes the endpoint
 * and names its tools.
 */
export async function GET() {
  const { TOOLS, PROTOCOL_VERSION, SERVER_INFO } = await import('@/lib/mcp/server')
  return NextResponse.json({
    server: SERVER_INFO,
    protocolVersion: PROTOCOL_VERSION,
    transport: 'JSON-RPC 2.0 over HTTP POST to this URL',
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
    note: 'Every tool result carries its sources and a non-empty `limits` list. Relay the limits with the numbers.',
  })
}

export async function POST(request: Request) {
  let body: JsonRpcRequest
  try {
    body = (await request.json()) as JsonRpcRequest
  } catch {
    return NextResponse.json(fail(null, RPC.PARSE_ERROR, 'Invalid JSON'))
  }

  const protocolAnswer = handleProtocol(body)
  if (protocolAnswer) return NextResponse.json(protocolAnswer)

  const call = readToolCall(body.params)
  if ('error' in call) {
    return NextResponse.json(fail(body.id ?? null, RPC.INVALID_PARAMS, call.error))
  }

  try {
    return NextResponse.json(ok(body.id ?? null, await runTool(call.name, call.args, request)))
  } catch (err) {
    // A tool failure is reported *inside* the result, not as a transport error:
    // an agent can read and relay "this did not work and here is why", whereas
    // a JSON-RPC error is usually swallowed by the client as a broken server.
    return NextResponse.json(
      ok(body.id ?? null, toolError(err instanceof Error ? err.message : 'Tool failed')),
    )
  }
}

/**
 * Where a gateway actually answers.
 *
 * Most gateways own a top-level route; the board family answers under
 * `/boards/<key>` instead. Derived from `BOARDS` rather than listed here, so a
 * board added later routes correctly without anyone remembering this file.
 */
function gatewayPath(gateway: string): string {
  const isBoard = BOARDS.some((b) => b.key === gateway)
  return isBoard ? `/api/intelligence/boards/${gateway}` : `/api/intelligence/${gateway}`
}

async function runTool(name: string, args: Record<string, unknown>, request: Request) {
  const str = (k: string) => (typeof args[k] === 'string' ? (args[k] as string).trim() : '')
  const num = (k: string, fallback: number) =>
    typeof args[k] === 'number' && Number.isFinite(args[k]) ? (args[k] as number) : fallback

  switch (name) {
    case 'world_events': {
      const world = await getWorldEvents()
      const category = str('category').toLowerCase()
      const country = str('country').toUpperCase()
      const limit = Math.max(1, Math.min(200, num('limit', 40)))
      const all = [...world.events, ...world.unplaceable].filter(
        (e) =>
          (!category || e.category === category) && (!country || e.countryIso === country),
      )
      const failed = world.sourceHealth.filter((s) => s.status === 'failed').length
      const empty = world.sourceHealth.filter((s) => s.status === 'empty').length
      return toolResult({
        generatedAt: world.generatedAt,
        matched: all.length,
        events: all.slice(0, limit).map((e) => ({
          title: e.title,
          category: e.categoryLabel,
          country: e.country,
          countryIso: e.countryIso,
          severity: e.severity,
          alertLevel: e.alertLevel,
          happenedAt: e.observedAt,
          receivedAt: e.at,
          source: e.sourceKey,
          sourceUrl: e.sourceUrl,
          admiralty: e.admiralty,
          independenceGroup: e.independence,
        })),
        limits: [
          'Public sources, passively read. Anything unpublished is absent by construction, and its absence is not evidence.',
          `${failed} feed(s) failed and ${empty} returned nothing on this run. A quiet region may be a lost feed — call source_health before reading an absence as calm.`,
          'happenedAt is null where the publisher stated no time of occurrence. It is never filled in with the time we received the report.',
        ],
      })
    }

    case 'country_risk': {
      const iso = str('country').toUpperCase()
      if (!iso) return toolError('country is required (ISO 3166-1 alpha-2, e.g. SD)')
      const world = await getWorldEvents()
      const now = Date.parse(world.generatedAt) || Date.now()
      const risk = scoreCountry([...world.events, ...world.unplaceable], iso, now)
      return toolResult({
        generatedAt: world.generatedAt,
        ...risk,
        limits: [
          ...risk.blindSpots,
          'signal and observability are separate numbers and must not be combined or reported alone. A low signal at low observability means the country is unobserved, never that it is calm.',
        ],
      })
    }

    case 'country_ranking': {
      const world = await getWorldEvents()
      const now = Date.parse(world.generatedAt) || Date.now()
      const limit = Math.max(1, Math.min(50, num('limit', 10)))
      const bands = rankByBand(scoreAllCountries([...world.events, ...world.unplaceable], now))
      return toolResult({
        generatedAt: world.generatedAt,
        bands: bands.map((b) => ({
          band: b.label,
          note: b.note,
          countries: b.countries.slice(0, limit).map((c) => ({
            iso: c.iso,
            country: c.country,
            signal: c.signal,
            observability: c.observability,
            origins: c.origins,
            events: c.events,
          })),
        })),
        limits: [
          'These bands are not one ranking. Countries in different bands are seen through very different amounts of coverage and are not comparable — do not merge the bands into a single list.',
          'A country absent from every band was reported on by no source in this window. That is a fact about our coverage, not about the country.',
          'Public sources only. Ranking by reported events is, in part, ranking by press and sensor density — which is exactly why observability is shown beside every score.',
        ],
      })
    }

    case 'corridor_status': {
      const key = str('corridor').toLowerCase()
      const world = await getWorldEvents()
      const now = Date.parse(world.generatedAt) || Date.now()
      if (key) {
        const corridor = CORRIDORS.find((c) => c.key === key)
        if (!corridor) {
          return toolError(
            `Unknown corridor: ${key}. Available: ${CORRIDORS.map((c) => c.key).join(', ')}`,
          )
        }
        const watch = watchCorridor(world.events, corridor, now)
        return toolResult({ generatedAt: world.generatedAt, ...watch })
      }
      const watches = watchAllCorridors(world.events, now)
      return toolResult({
        generatedAt: world.generatedAt,
        corridors: watches.map((w) => ({
          key: w.corridor.key,
          name: w.corridor.name,
          carries: w.corridor.carries,
          pressure: w.pressure,
          origins: w.origins,
          signalCount: w.signals.length,
          summary: w.summary,
        })),
        limits: watches[0]?.limits ?? [],
      })
    }

    case 'gateway_query': {
      const gateway = str('gateway').toLowerCase()
      if (!gateway) return toolError(`gateway is required. Available: ${ALL_MODES.join(', ')}`)
      if (!(ALL_MODES as readonly string[]).includes(gateway)) {
        return toolError(`Unknown gateway: ${gateway}. Available: ${ALL_MODES.join(', ')}`)
      }
      // Call our own route rather than reimplementing the gateway here: one
      // implementation, and an agent gets exactly what the browser gets.
      //
      // Board gateways answer under `/boards/<key>`, not at the top level. A
      // live call caught this: `statements` returned a 404 HTML page, which the
      // agent would have relayed as "the gateway is down" rather than "the URL
      // was wrong". `gatewayPath` is the one place that mapping lives.
      const origin = new URL(request.url).origin
      const res = await fetch(`${origin}${gatewayPath(gateway)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: str('query'), query: str('query') }),
      })
      const text = await res.text()
      if (!res.ok) return toolError(`Gateway ${gateway} answered ${res.status}: ${text.slice(0, 300)}`)
      let payload: unknown
      try {
        payload = JSON.parse(text)
      } catch {
        return toolError(`Gateway ${gateway} returned a non-JSON body.`)
      }
      return toolResult({
        gateway,
        result: payload,
        limits: [
          'Passive and keyless: the subject of a query is never contacted. No port scan, no probe, no active reconnaissance.',
          'Absence of a record is not evidence of absence — it means no public source we read carries one.',
        ],
      })
    }

    case 'source_health': {
      const world = await getWorldEvents()
      const byStatus = { ok: 0, cached: 0, empty: 0, failed: 0 }
      for (const s of world.sourceHealth) byStatus[s.status] += 1
      return toolResult({
        generatedAt: world.generatedAt,
        totals: byStatus,
        feeds: world.sourceHealth.map((s) => ({
          source: s.sourceKey,
          status: s.status,
          events: s.count,
          error: s.error,
        })),
        limits: [
          '"empty" is not health: the feed answered and gave nothing, so its coverage is missing from this run.',
          '"cached" means we deliberately did not re-fetch, because the publisher\'s minimum interval had not elapsed.',
          'Check this before reading a quiet region as calm. A region with no events and a failed feed is unobserved.',
        ],
      })
    }

    default:
      return toolError(`Unhandled tool: ${name}`)
  }
}
