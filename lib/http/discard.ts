/**
 * Let go of a response we are not going to read.
 *
 * ## The bug this exists for
 *
 * `fetch` hands back a `Response` whose body is a stream, and the browser holds
 * the connection open until that stream is read or cancelled. Code that decides
 * from the status alone —
 *
 * ```ts
 * const res = await fetch('/api/monitors')
 * if (res.status === 401) return          // ← body never touched
 * ```
 *
 * — leaves the stream open for the life of the page. It is invisible in the
 * network panel (the response arrived, the status is right, the panel renders
 * its signed-out state correctly) and it was measured here in a real browser:
 * with the Pi SDK request taken out of the picture, `/globe` reached network
 * idle in 2.8 seconds and **`/monitor`, `/intelligence` and `/account` never
 * reached it at all**. Each held a socket for a body of thirty characters.
 *
 * What that costs a user: the `load` event never fires, so anything waiting on
 * it — a browser's own progress indicator, a Lighthouse or CrUX measurement, a
 * `load`-gated script — waits forever, and the page reads as still-loading long
 * after it is usable. On a phone the connection is held with it. The three
 * routes that did this are three of the five tabs in the product.
 *
 * ## Why a named function rather than `void res.text()`
 *
 * Because the next person reading `if (res.status === 401) return` has to be
 * able to see that the abandonment is deliberate and complete. `cancel()` is
 * also the cheaper of the two — it discards the stream rather than decoding a
 * body nobody wants.
 *
 * A cancel can reject (the stream may already be errored or locked, and a
 * `Response` from a cache or a test double may have no body at all). None of
 * that matters to a caller who has decided the body is irrelevant, so every
 * failure is swallowed here rather than at thirty call sites.
 */
export function discardBody(res: { body?: ReadableStream | null } | null | undefined): void {
  try {
    void res?.body?.cancel().catch(() => {})
  } catch {
    /* A locked or already-consumed body needs nothing from us. */
  }
}
