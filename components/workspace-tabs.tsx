'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'

/**
 * Workspaces on one screen, instead of a column that never ends.
 *
 * ## What this replaces
 *
 * The globe page stacked four different jobs on top of each other — the live
 * map, the reading of the evidence, the country picture, and the per-category
 * feeds — and asked the reader to scroll nine thousand pixels through all four
 * to reach any one of them. Collapsing the empty parts took it from 11,439px to
 * 8,989px, which made it navigable and did not make it *right*: the remaining
 * height is real analysis, and stacking real analysis is still the wrong shape.
 *
 * They are not sections of one document. They are four answers to four
 * questions, and a reader arrives holding one of them. So they become
 * workspaces: one visible at a time, all of them one tap away, each with a live
 * count so the choice is informed before it is made.
 *
 * ## Why the URL carries it
 *
 * The chosen workspace goes in the hash. A reader who finds something worth
 * showing someone can send the address and have it open where they were, a
 * reload lands where they left, and the back button works. A tab strip whose
 * state lives only in memory is a tab strip that loses the reader's place every
 * time the page reloads — and this page reloads itself on a timer.
 *
 * The hash rather than a query parameter or a route, because switching
 * workspace must not re-run the shell or re-fetch the world: these panels read
 * one shared world picture, and a navigation that dropped it would make the
 * counts flicker and the sweep run again.
 */

export interface Workspace {
  id: string
  label: string
  /** Shown beside the label. `null` when the panel has nothing to count. */
  count?: number | null
  /** One line explaining what this workspace answers. */
  hint?: string
  render: () => ReactNode
}

/** Read the workspace out of the address, defaulting to the first. */
function fromHash(valid: string[], fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const id = window.location.hash.replace(/^#/, '')
  return valid.includes(id) ? id : fallback
}

export function WorkspaceTabs({
  workspaces,
  label,
}: {
  workspaces: Workspace[]
  /** Names the tab list for a screen reader — never rendered visually. */
  label: string
}) {
  const first = workspaces[0]?.id ?? ''
  const [active, setActive] = useState(first)

  /**
   * Read the hash after mount, never during render.
   *
   * The server has no address bar, so reading it in a `useState` initialiser
   * makes the server and the client disagree on which panel exists — a
   * hydration mismatch, which React resolves by throwing the server's HTML away
   * and rebuilding the document. That bug has been paid for twice in this
   * codebase already.
   */
  useEffect(() => {
    const ids = workspaces.map((w) => w.id)
    setActive(fromHash(ids, first))
    const onHash = () => setActive(fromHash(ids, first))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, workspaces.map((w) => w.id).join(',')])

  const choose = useCallback((id: string) => {
    setActive(id)
    if (typeof window === 'undefined') return
    // `replaceState`, not a new entry per tap: a reader who tried four
    // workspaces should not have to press back four times to leave the page.
    window.history.replaceState(null, '', `#${id}`)
  }, [])

  const current = workspaces.find((w) => w.id === active) ?? workspaces[0]
  if (!current) return null

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label={label}
        className="scroll-row flex items-center gap-1 border-b border-border pb-px"
      >
        {workspaces.map((w) => {
          const selected = w.id === current.id
          return (
            <button
              key={w.id}
              role="tab"
              id={`tab-${w.id}`}
              aria-selected={selected}
              aria-controls={`panel-${w.id}`}
              onClick={() => choose(w.id)}
              className={`touch-target -mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-xs transition-colors ${
                selected
                  ? 'border-primary font-semibold text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {w.label}
              {typeof w.count === 'number' ? (
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
                    selected
                      ? 'bg-primary/10 text-primary'
                      : w.count === 0
                        ? 'text-muted-foreground/50'
                        : 'text-muted-foreground'
                  }`}
                >
                  {w.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {current.hint ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{current.hint}</p>
      ) : null}

      <div role="tabpanel" id={`panel-${current.id}`} aria-labelledby={`tab-${current.id}`}>
        {current.render()}
      </div>
    </div>
  )
}
