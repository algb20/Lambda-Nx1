import { createChannel, type Channel } from './broadcast'
import { formatSse, sseComment, SSE_HEADERS } from './sse'

/**
 * One SSE route, built from one channel — the shape every live surface uses.
 *
 * `/api/track` proved the transport and hand-rolled the lifecycle: a producer,
 * two intervals, an abort listener and a close guard, written inline. Repeating
 * that per surface would repeat its bugs per surface, and it has one worth not
 * repeating — it produces per connection, so readers multiply upstream load.
 *
 * Here the producer lives in a `Channel`, which runs once for everybody, and
 * this function owns only what a *connection* owns: framing, the heartbeat, and
 * letting go when the reader does.
 *
 * ## What a reader is told
 *
 * - `open` — the channel is attached, with the retry interval the browser
 *   should use if the connection drops.
 * - `reading` — a value, always carrying `at`: the moment the **producer**
 *   returned it, never the moment we sent it. A reader attaching between ticks
 *   is handed the kept value immediately, and its age is the reason that is
 *   honest rather than misleading.
 * - `error` — the producer failed, with its reason. Silence would leave a
 *   reader unable to tell a quiet channel from a broken one.
 *
 * The heartbeat is an SSE comment. `EventSource` ignores it; proxies and load
 * balancers see traffic and leave the connection alone.
 */
export function streamChannel<T>(request: Request, channel: Channel<T>, options?: { heartbeatMs?: number; retryMs?: number }): Response {
  const heartbeatMs = options?.heartbeatMs ?? 15_000
  const retryMs = options?.retryMs ?? 3_000
  const encoder = new TextEncoder()

  let detach: (() => void) | undefined
  let beat: ReturnType<typeof setInterval> | undefined
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (s: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(s))
        } catch {
          // The reader went away between our check and this write. Not an
          // error: it is the normal end of every stream.
          closed = true
        }
      }

      const stop = () => {
        if (closed) return
        closed = true
        detach?.()
        if (beat) clearInterval(beat)
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }

      request.signal.addEventListener('abort', stop)
      send(formatSse({ event: 'open', data: { at: new Date().toISOString() }, retryMs }))

      detach = channel.subscribe(
        (reading) => send(formatSse({ event: 'reading', data: reading, id: reading.at })),
        (message) => send(formatSse({ event: 'error', data: { message } })),
      )

      beat = setInterval(() => {
        if (closed) return
        send(sseComment())
      }, heartbeatMs)
    },
    cancel() {
      closed = true
      detach?.()
      if (beat) clearInterval(beat)
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}

/**
 * The channels this deployment serves, made once per process.
 *
 * Module scope on purpose: that is what makes "one producer, many readers"
 * true. A channel created inside the request handler would be one channel per
 * connection, which is the arrangement this whole module exists to replace.
 *
 * Intervals match what the panels polled at before — two minutes. The saving is
 * not a faster clock, it is that the clock now ticks **once** rather than once
 * per open tab, and that a reader sees the result the moment it lands instead
 * of up to two minutes later.
 */
const channels = new Map<string, Channel<unknown>>()

export function sharedChannel<T>(key: string, intervalMs: number, produce: () => Promise<T>): Channel<T> {
  const existing = channels.get(key)
  if (existing) return existing as Channel<T>
  const created = createChannel<T>({ intervalMs, produce })
  channels.set(key, created as Channel<unknown>)
  return created
}
