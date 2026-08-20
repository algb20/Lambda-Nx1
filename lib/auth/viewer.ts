/**
 * Who is signed in, asked once and shared by everything that needs to know.
 *
 * ## Why this exists
 *
 * Four components each fetched `/api/auth/me` on mount and each kept its own
 * copy of the answer. That is four requests per page load for one fact, and —
 * worse — four copies that drift: uploading a picture updated the avatar
 * control's copy and nothing else, so the header kept showing the old one until
 * a reload.
 *
 * It also produced a real bug. The composer asked the *Pi* context whether
 * anyone was signed in, because at the time that was the only session a client
 * could see. The server has always accepted either kind (`getSessionUserId`
 * covers Pi and email alike), so every email-account holder was shown "sign in
 * to publish" while already signed in and perfectly entitled to publish.
 *
 * So there is one store. One request, one copy, and a `refreshViewer()` that
 * every consumer sees at once.
 *
 * ## Shape of the state
 *
 * `status` is deliberately three-valued. `unknown` and `null` are not the same
 * thing — "we have not asked yet" must not render as "signed out", or every
 * cold load flashes a sign-in prompt at people who are signed in.
 */

export interface Viewer {
  id: string
  /** What to show. Falls back to older fields for pre-handle accounts. */
  username: string
  /** The handle proper, or null if this account predates handles. */
  handle?: string | null
  /** The permanent, human-readable account code. See lib/users/identifier. */
  identifier?: string
  plan?: 'free' | 'pro'
  avatarUrl?: string | null
  provider?: string
  /** The owner's own real name. Only ever sent to the account it belongs to. */
  fullName?: string | null
  /** Whether other people see that name beside the handle. */
  showRealName?: boolean
}

export interface ViewerState {
  /** `unknown` until the first answer arrives — never treat it as signed out. */
  status: 'unknown' | 'loading' | 'ready'
  user: Viewer | null
}

/**
 * The state before anything has been asked.
 *
 * A module constant rather than a fresh object, because it is also what the
 * server renders with: `useSyncExternalStore` compares snapshots by identity,
 * and a new object each call is an infinite render loop.
 */
export const VIEWER_UNKNOWN: ViewerState = { status: 'unknown', user: null }

let state: ViewerState = VIEWER_UNKNOWN
const listeners = new Set<() => void>()
let inFlight: Promise<void> | null = null

function publish(next: ViewerState): void {
  state = next
  for (const fn of listeners) fn()
}

/** The current answer. Identity-stable between changes. */
export function viewerState(): ViewerState {
  return state
}

/** What the server renders with. There is no session to read there. */
export function viewerOnServer(): ViewerState {
  return VIEWER_UNKNOWN
}

/**
 * Ask the server, at most once at a time.
 *
 * Concurrent callers share the one request — which is the whole point, since
 * every consumer calls this on mount and they all mount together.
 */
export function loadViewer(force = false): Promise<void> {
  if (inFlight) return inFlight
  if (!force && state.status === 'ready') return Promise.resolve()
  if (typeof window === 'undefined') return Promise.resolve()

  publish({ status: 'loading', user: state.user })
  inFlight = fetch('/api/auth/me', { credentials: 'same-origin' })
    .then((res) => (res.ok ? res.json() : { user: null }))
    .then((data: { user?: Viewer | null }) => {
      publish({ status: 'ready', user: data?.user ?? null })
    })
    .catch(() => {
      /**
       * A failed request means "we could not ask", which for every consumer
       * behaves the same as "nobody is signed in" — the features that need an
       * account will refuse server-side anyway. What it must not do is leave
       * the app stuck in `loading` forever, which is what an unhandled
       * rejection here would produce.
       */
      publish({ status: 'ready', user: null })
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/**
 * Re-read the session and tell everyone.
 *
 * Called after anything that changes the account: signing in or out, uploading
 * a picture, changing a handle. This is what keeps the copies from drifting.
 */
export function refreshViewer(): Promise<void> {
  return loadViewer(true)
}

/** Subscribe to changes, and start the first read if nobody has yet. */
export function subscribeToViewer(onChange: () => void): () => void {
  listeners.add(onChange)
  void loadViewer()
  return () => {
    listeners.delete(onChange)
  }
}

/** Test seam: drop everything this module remembers. */
export function resetViewerForTests(): void {
  state = VIEWER_UNKNOWN
  listeners.clear()
  inFlight = null
}
