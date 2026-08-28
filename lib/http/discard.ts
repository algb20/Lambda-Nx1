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
 * ## What it actually costs, and a claim of ours that was wrong
 *
 * This paragraph used to say the `load` event never fires. **It does.** Measured
 * on a build without this fix, in a real browser, `load` fired on exactly the
 * three routes said to be affected:
 *
 * | route | `load` | `networkidle` |
 * |---|---|---|
 * | `/` | 191ms | 9,821ms |
 * | `/monitor` | **150ms** | **never (20s)** |
 * | `/intelligence` | **153ms** | **never (20s)** |
 * | `/account` | **141ms** | **never (20s)** |
 *
 * `load` fires when the document and its *declared* subresources finish. A
 * `fetch` a script starts is not part of that accounting, so an unread body
 * cannot delay it, and nothing gated on `load` waits at all.
 *
 * The real cost is quiescence, which is a different and narrower thing:
 *
 * - **The page never goes quiet.** Anything that waits for the network to
 *   settle waits forever — Lighthouse's fully-loaded style metrics, and our own
 *   browser suite, which hit this from the other side the same week and spent
 *   two wrong diagnoses on it (`tests/browser/harness.ts`).
 * - **A socket is held per abandoned response.** On a phone that keeps the
 *   radio from idling, which is a battery cost rather than a latency one. Under
 *   HTTP/1.1 it also occupies one of roughly six connections per origin and
 *   makes later requests queue; under HTTP/2, which this deployment serves, it
 *   costs a stream out of a much larger budget, so that part is real but small.
 *
 * The fix is worth having on the quiescence argument alone. It is written down
 * this way because the first version of this comment claimed a user-visible
 * page-load win that the measurement does not support, and a fix defended by a
 * wrong reason is one somebody later removes for the right one.
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
