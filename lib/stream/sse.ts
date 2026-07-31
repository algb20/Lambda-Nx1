/**
 * Server-Sent Events helpers — the "always-open door" for live tracking.
 *
 * We stream over a single held-open HTTP connection and push updates as they are
 * produced, instead of the client polling every few seconds (the traditional way
 * we deliberately avoid). This module only frames events; the route owns the
 * connection lifecycle. Framing is pure and unit-tested.
 */

/** Format one SSE message. `event` is optional; `id` lets clients resume. */
export function formatSse(input: { data: unknown; event?: string; id?: string; retryMs?: number }): string {
  const lines: string[] = []
  if (input.retryMs !== undefined) lines.push(`retry: ${input.retryMs}`)
  if (input.id !== undefined) lines.push(`id: ${input.id}`)
  if (input.event !== undefined) lines.push(`event: ${input.event}`)
  const payload = typeof input.data === 'string' ? input.data : JSON.stringify(input.data)
  // Every data line must be prefixed; split so multi-line payloads stay valid.
  for (const line of payload.split('\n')) lines.push(`data: ${line}`)
  return lines.join('\n') + '\n\n'
}

/** A comment line doubles as a keep-alive heartbeat (ignored by EventSource). */
export function sseComment(text = 'keep-alive'): string {
  return `: ${text}\n\n`
}

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  // Disable proxy buffering so events flush immediately (e.g. behind nginx).
  'X-Accel-Buffering': 'no',
} as const
