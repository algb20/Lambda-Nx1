import { buildTargetProfile } from '@/lib/modules/target'
import { formatSse, sseComment, SSE_HEADERS } from '@/lib/stream/sse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/**
 * Gateways fan out to several public providers. The platform default (10s) is
 * below the worst realistic case, and being killed mid-request returns an HTML
 * error page where the client expects JSON — which is how the world map ended
 * up empty. Sources also run in parallel and each carries its own deadline, so
 * this ceiling is a safety net, not the normal path.
 */
export const maxDuration = 60

/**
 * GET /api/track?q=<target>  — Server-Sent Events stream.
 * Holds the connection open and pushes the target profile on connect, then
 * re-tracks and pushes updates continuously (no client polling). Emits a
 * heartbeat so intermediaries keep the door open.
 */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim()
  if (!q) return new Response('Missing "q"', { status: 400 })

  const encoder = new TextEncoder()
  let refresh: ReturnType<typeof setInterval> | undefined
  let beat: ReturnType<typeof setInterval> | undefined
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(s))
          } catch {
            /* controller already closed */
          }
        }
      }
      const push = async (reason: 'initial' | 'refresh') => {
        try {
          const profile = await buildTargetProfile(q)
          send(formatSse({ event: 'target', data: { reason, profile } }))
        } catch (err) {
          send(formatSse({ event: 'error', data: { message: err instanceof Error ? err.message : 'error' } }))
        }
      }

      const stop = () => {
        if (closed) return
        closed = true
        if (refresh) clearInterval(refresh)
        if (beat) clearInterval(beat)
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }

      request.signal.addEventListener('abort', stop)
      send(formatSse({ event: 'open', data: { target: q }, retryMs: 3000 }))
      await push('initial')
      // Continuous tracking: re-fetch and push; heartbeat keeps the door open.
      refresh = setInterval(() => void push('refresh'), 20000)
      beat = setInterval(() => send(sseComment()), 15000)
    },
    cancel() {
      closed = true
      if (refresh) clearInterval(refresh)
      if (beat) clearInterval(beat)
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}
