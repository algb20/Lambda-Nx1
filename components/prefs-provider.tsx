'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_PREFS, parsePrefs, prefsEqual, type Prefs } from '@/lib/prefs/schema'

/**
 * One place that remembers what the user chose.
 *
 * ## Two stores, and which one wins
 *
 * **`localStorage` is the working copy.** It is instant, it survives a tab
 * switch and a reload, and — the part that matters most — it works for someone
 * without an account, which is most visitors, since the gateways are open by
 * charter §1. A preference system that only remembered signed-in users would
 * not have fixed the complaint at all.
 *
 * **The database is the durable copy**, written for signed-in users only, so a
 * layout survives a new phone. It is written on a debounce and never blocks the
 * interface: a failed save costs the user nothing they can see, because the
 * local copy already holds their choice.
 *
 * On sign-in the *server* copy wins if there is one — that is the point of
 * having it, and the local copy on a freshly-signed-in device is usually a
 * stranger's leftovers or a default. Where the server has nothing, the local
 * copy is pushed up, so a person's existing setup follows them into their new
 * account rather than being erased by it.
 *
 * ## Why the whole blob rather than a key-value store
 *
 * There are eight settings. A row per key means eight round trips, eight
 * migrations and eight chances for a partial write to leave the panel in a state
 * no user chose. One JSON document is read once, written once, and validated as
 * a whole by `parsePrefs` — which is what makes a corrupt or future-shaped blob
 * degrade to defaults instead of crashing the page.
 */

const STORAGE_KEY = 'lambda.prefs.v1'
/** Long enough that dragging a slider is one write, short enough to feel saved. */
const SAVE_DEBOUNCE_MS = 900

interface PrefsValue {
  prefs: Prefs
  /** Merge a partial change. Always call with the smallest change that is true. */
  update: (patch: (current: Prefs) => Prefs) => void
  /** False until the stored copy has been read — components can avoid a flash. */
  ready: boolean
  /** True while a durable save is in flight. Purely informational. */
  saving: boolean
}

const PrefsContext = createContext<PrefsValue | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = useRef<Prefs>(DEFAULT_PREFS)

  // ── Read the local copy, synchronously enough to avoid a visible flash ────
  useEffect(() => {
    let local = DEFAULT_PREFS
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) local = parsePrefs(JSON.parse(raw) as unknown)
    } catch {
      // Unreadable, or storage disabled entirely (private mode, some embedded
      // browsers). Defaults are a correct answer; refusing to render is not.
    }
    setPrefs(local)
    lastSaved.current = local
    setReady(true)

    // ── Then ask the server, for a signed-in user ──────────────────────────
    let live = true
    fetch('/api/preferences')
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { prefs?: unknown; signedIn?: boolean } | null) => {
        if (!live || !body?.signedIn) return
        if (body.prefs) {
          // The server has a copy: it wins. This device's local copy is either
          // a default or somebody else's leftovers.
          const remote = parsePrefs(body.prefs)
          setPrefs(remote)
          lastSaved.current = remote
          writeLocal(remote)
        } else if (!prefsEqual(local, DEFAULT_PREFS)) {
          // Signed in, nothing stored yet, and this device has a real setup —
          // carry it up rather than letting the account erase it.
          void save(local)
        }
      })
      .catch(() => {
        // Offline or unauthenticated. The local copy is already in use.
      })
    return () => {
      live = false
    }
    // Deliberately once, on mount: this is a load, not a subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = useCallback(async (next: Prefs) => {
    setSaving(true)
    try {
      await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefs: next }),
      })
      lastSaved.current = next
    } catch {
      // Silent by design. The local copy already holds the choice, and a toast
      // saying "could not sync your panel layout" is noise about a thing the
      // user did not ask for and has not lost.
    } finally {
      setSaving(false)
    }
  }, [])

  const update = useCallback(
    (patch: (current: Prefs) => Prefs) => {
      setPrefs((current) => {
        const next = patch(current)
        if (prefsEqual(current, next)) return current
        writeLocal(next)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => {
          if (!prefsEqual(lastSaved.current, next)) void save(next)
        }, SAVE_DEBOUNCE_MS)
        return next
      })
    },
    [save],
  )

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return <PrefsContext.Provider value={{ prefs, update, ready, saving }}>{children}</PrefsContext.Provider>
}

function writeLocal(prefs: Prefs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Quota exceeded or storage disabled. Nothing to do and nothing to say.
  }
}

/**
 * Read and change preferences.
 *
 * Returns defaults outside a provider rather than throwing: a component that
 * renders in a context without preferences should show the default view, not
 * take the page down. The `update` is a no-op there, which is honest — there is
 * nowhere to put the change.
 */
export function usePrefs(): PrefsValue {
  const ctx = useContext(PrefsContext)
  if (ctx) return ctx
  return { prefs: DEFAULT_PREFS, update: () => {}, ready: true, saving: false }
}
