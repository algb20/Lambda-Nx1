'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Read a pushed channel, and fall back to asking when it cannot be pushed.
 *
 * ## Why the fallback is not optional
 *
 * This product ships to two surfaces from one codebase (R265): a standard
 * browser and the Pi Browser. `EventSource` is widely supported, and "widely"
 * is not "here" — a corporate proxy that buffers, an embedded webview that does
 * not implement it, or a platform that closes long connections all end with a
 * reader watching nothing. A live surface that silently stops being live is
 * worse than one that never claimed to be, because nothing on screen changes to
 * say so.
 *
 * So the stream is the preferred path and polling is the floor, the switch is
 * automatic, and `transport` is returned so the interface can say which one is
 * in use rather than implying the better one.
 *
 * ## Why one failure does not demote it
 *
 * `EventSource` reconnects on its own, and a single blip is exactly what its
 * `retry` interval is for. Falling back on the first error would abandon the
 * stream over a dropped packet. Only after several consecutive failures — with
 * no reading in between — is the connection judged unusable and the poller
 * started.
 */
export type Transport = 'stream' | 'poll' | 'connecting'

export interface Live<T> {
  /** The newest value, or `null` before the first one arrives. */
  value: T | null
  /** When the **producer** returned it, never when we received it. */
  at: string | null
  /** What the last attempt said, when it failed. */
  error: string | null
  /** How the value is arriving, so the interface can be honest about it. */
  transport: Transport
}

/** Consecutive stream failures, with no reading between, before polling. */
const FAILURES_BEFORE_POLLING = 3

export function useLive<T>(options: {
  /** SSE endpoint, e.g. `/api/world/stream`. */
  streamUrl: string
  /** Plain JSON endpoint for the fallback, e.g. `/api/world`. */
  pollUrl: string
  /** How often the fallback asks. Matches what the surface polled before. */
  pollMs: number
  /** Set false to detach entirely — an unmounted panel should cost nothing. */
  enabled?: boolean
}): Live<T> {
  const { streamUrl, pollUrl, pollMs, enabled = true } = options
  const [state, setState] = useState<Live<T>>({
    value: null,
    at: null,
    error: null,
    transport: 'connecting',
  })
  // Held in a ref so a reconnect does not restart the effect and thereby the
  // connection it is counting failures for.
  const failures = useRef(0)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    let source: EventSource | null = null
    let pollTimer: ReturnType<typeof setInterval> | undefined

    const poll = async () => {
      try {
        const res = await fetch(pollUrl, { cache: 'no-store' })
        if (!res.ok) throw new Error(`the feed answered ${res.status}`)
        const value = (await res.json()) as T
        if (!alive) return
        setState({ value, at: new Date().toISOString(), error: null, transport: 'poll' })
      } catch (err) {
        if (!alive) return
        // A stale picture is still shown and still labelled with its age.
        // Blanking it over one failed poll throws away something true.
        setState((s) => ({
          ...s,
          transport: 'poll',
          error: err instanceof Error ? err.message : 'the feed did not answer',
        }))
      }
    }

    const startPolling = () => {
      if (pollTimer !== undefined) return
      source?.close()
      source = null
      void poll()
      pollTimer = setInterval(() => void poll(), pollMs)
    }

    if (typeof EventSource === 'undefined') {
      startPolling()
      return () => {
        alive = false
        if (pollTimer) clearInterval(pollTimer)
      }
    }

    source = new EventSource(streamUrl)

    source.addEventListener('reading', (event) => {
      if (!alive) return
      failures.current = 0
      try {
        const reading = JSON.parse((event as MessageEvent).data) as { value: T; at: string }
        setState({ value: reading.value, at: reading.at, error: null, transport: 'stream' })
      } catch {
        setState((s) => ({ ...s, error: 'the stream sent something unreadable' }))
      }
    })

    source.addEventListener('error', (event) => {
      if (!alive) return
      // Two different things arrive here: a named `error` event the server sent
      // (the producer failed, and the connection is fine), and the transport's
      // own error (the connection dropped). Only the second counts toward the
      // fallback, because only the second means the stream is not working.
      const data = (event as MessageEvent).data
      if (typeof data === 'string' && data.length > 0) {
        try {
          const { message } = JSON.parse(data) as { message?: string }
          setState((s) => ({ ...s, error: message ?? 'the producer failed' }))
          return
        } catch {
          /* fall through to treating it as a transport failure */
        }
      }
      failures.current += 1
      if (failures.current >= FAILURES_BEFORE_POLLING) startPolling()
    })

    return () => {
      alive = false
      source?.close()
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [streamUrl, pollUrl, pollMs, enabled])

  return state
}
