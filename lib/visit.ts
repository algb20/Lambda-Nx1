/**
 * Client-side visit beacon.
 *
 * Fires a single, best-effort POST to /api/visit so the server can record — into
 * the private, admin-only registry — that the app was opened, and (server-side,
 * from the edge geo header) from which country. It never blocks rendering and
 * never surfaces an error: analytics must not affect the product.
 *
 * De-duplicated per page load per mode, so the "signed-in" re-fire that follows
 * a successful Pi login doesn't also re-send the earlier "guest" ping.
 */
const sent = new Set<string>()

export function pingVisit(mode: string): void {
  if (typeof window === 'undefined') return
  if (sent.has(mode)) return
  sent.add(mode)

  try {
    const body = JSON.stringify({ mode })
    // sendBeacon survives the page being backgrounded/navigated away; fall back
    // to a keepalive fetch where it isn't available.
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/visit', new Blob([body], { type: 'application/json' }))
    } else {
      void fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    /* never throw from a beacon */
  }
}
