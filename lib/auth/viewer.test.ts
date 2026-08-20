import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  VIEWER_UNKNOWN,
  loadViewer,
  refreshViewer,
  resetViewerForTests,
  subscribeToViewer,
  viewerOnServer,
  viewerState,
} from './viewer'

const realWindow = (globalThis as { window?: unknown }).window
const realFetch = globalThis.fetch

function serve(user: unknown, ok = true) {
  const fn = vi.fn(async () => ({ ok, json: async () => ({ user }) }) as unknown as Response)
  globalThis.fetch = fn as unknown as typeof fetch
  return fn
}

beforeEach(() => {
  resetViewerForTests()
  ;(globalThis as { window?: unknown }).window = { document: {} }
})

afterEach(() => {
  if (realWindow === undefined) delete (globalThis as { window?: unknown }).window
  else (globalThis as { window?: unknown }).window = realWindow
  globalThis.fetch = realFetch
})

describe('the shared session store', () => {
  /**
   * `unknown` and "signed out" must stay different states. Collapsing them is
   * what makes a cold load flash a sign-in prompt at somebody already signed in.
   */
  it('starts unknown, not signed out', () => {
    expect(viewerState()).toEqual({ status: 'unknown', user: null })
    expect(viewerState().status).not.toBe('ready')
  })

  it('reads the session once and shares the answer', async () => {
    const fetched = serve({ id: 'u1', username: 'ada' })
    await Promise.all([loadViewer(), loadViewer(), loadViewer()])
    expect(fetched).toHaveBeenCalledTimes(1)
    expect(viewerState()).toEqual({ status: 'ready', user: { id: 'u1', username: 'ada' } })
  })

  /**
   * Every consumer subscribes on mount and they all mount together, so the
   * concurrent case is the ordinary one, not an edge case.
   */
  it('collapses concurrent subscribers into one request', async () => {
    const fetched = serve({ id: 'u1', username: 'ada' })
    const stops = [subscribeToViewer(() => {}), subscribeToViewer(() => {}), subscribeToViewer(() => {})]
    await loadViewer()
    expect(fetched).toHaveBeenCalledTimes(1)
    for (const stop of stops) stop()
  })

  it('tells every subscriber when the account changes', async () => {
    serve({ id: 'u1', username: 'ada' })
    let a = 0
    let b = 0
    const stopA = subscribeToViewer(() => a++)
    const stopB = subscribeToViewer(() => b++)
    await loadViewer()
    // Both saw the answer land. A also saw the `loading` step, because
    // subscribing is what started the request — a difference of one notification
    // that says nothing about the state they end up sharing.
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(0)
    expect(viewerState()).toEqual({ status: 'ready', user: { id: 'u1', username: 'ada' } })

    // Unsubscribed listeners stop hearing about it.
    stopA()
    const before = a
    serve(null)
    await refreshViewer()
    expect(a).toBe(before)
    stopB()
  })

  /** Signing out, uploading a picture, changing a handle — all re-read. */
  it('re-reads on demand even when it already has an answer', async () => {
    const first = serve({ id: 'u1', username: 'ada' })
    await loadViewer()
    expect(first).toHaveBeenCalledTimes(1)

    // A second plain load is a no-op; only a refresh goes back to the server.
    await loadViewer()
    expect(first).toHaveBeenCalledTimes(1)

    const second = serve(null)
    await refreshViewer()
    expect(second).toHaveBeenCalledTimes(1)
    expect(viewerState()).toEqual({ status: 'ready', user: null })
  })

  /**
   * A failed request must settle, not hang. Left in `loading`, every consumer
   * would render its placeholder forever.
   */
  it('settles as signed out when the request fails', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    await loadViewer()
    expect(viewerState()).toEqual({ status: 'ready', user: null })
  })

  it('treats a non-200 as signed out rather than throwing', async () => {
    serve({ id: 'u1', username: 'ada' }, false)
    await loadViewer()
    expect(viewerState()).toEqual({ status: 'ready', user: null })
  })

  /**
   * `useSyncExternalStore` compares snapshots by identity, so a fresh object per
   * call would re-render forever. Both of these must be the same object.
   */
  it('returns an identity-stable snapshot between changes', async () => {
    expect(viewerState()).toBe(viewerOnServer())
    expect(viewerOnServer()).toBe(VIEWER_UNKNOWN)
    serve({ id: 'u1', username: 'ada' })
    await loadViewer()
    expect(viewerState()).toBe(viewerState())
  })

  it('does not reach for the network on the server', async () => {
    delete (globalThis as { window?: unknown }).window
    const fetched = serve({ id: 'u1', username: 'ada' })
    await loadViewer()
    expect(fetched).not.toHaveBeenCalled()
    expect(viewerState().status).toBe('unknown')
  })
})
