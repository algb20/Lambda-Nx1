'use client'

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'

/**
 * A section of a long analytical page, and the index that makes the page usable.
 *
 * ## The page this exists to fix
 *
 * The globe page measured **11,439 pixels tall** and every part of it was a
 * card stacked on the next one, so it read as a single interlocked sheet with
 * no edges. A reader who scrolled past the map met, in order: a ranked list, an
 * unplaceable list, a fusion count, **167 source names in a column**, then the
 * *same 159 names again* as a paragraph, then twelve shipping corridors each
 * printing a full sentence to say nothing happened, then three country bands
 * each saying "No country currently falls in this band."
 *
 * Almost none of that was information. It was the *absence* of information,
 * rendered at the same size as information — which is the specific failure that
 * makes a person say they cannot tell how to work the page.
 *
 * ## The three rules
 *
 * **1. An empty section states its emptiness in one line and stops.** It never
 * opens, because there is nothing to open. This is where most of those pixels
 * went, and it is not a display trick: knowing a category reported nothing is
 * genuinely useful, and it costs one line to say.
 *
 * **2. A section that has content carries its count in the header**, so the
 * reader can decide whether to open it without opening it.
 *
 * **3. The reader's choices persist.** Collapsing something that reopens on
 * every refresh is not a control, it is a suggestion.
 */

export interface SectionState {
  /** Stable id — also the anchor the index scrolls to. */
  id: string
  title: string
  /** How many items are inside. `0` means the section renders as one line. */
  count: number
}

/** Where collapse choices are kept between visits. */
const STORE_KEY = 'lambda.sections.collapsed'

function readCollapsed(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [])
  } catch {
    // A browser with storage blocked still gets a working page — it simply
    // forgets. Never let a preference take the content down with it.
    return new Set()
  }
}

/**
 * Collapse state for a whole page of sections.
 *
 * Held in one place rather than per-section so the index and the sections agree,
 * and so "collapse all" is one operation rather than twenty.
 */
export function useSectionCollapse() {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  // Read after mount, never during render: the server has no storage, so
  // reading it in an initialiser is a hydration mismatch — the exact bug that
  // was re-rendering the whole document on every deep link.
  useEffect(() => setCollapsed(readCollapsed()), [])

  const persist = useCallback((next: Set<string>) => {
    setCollapsed(next)
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify([...next]))
    } catch {
      /* storage blocked — the choice still applies for this visit */
    }
  }, [])

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(collapsed)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      persist(next)
    },
    [collapsed, persist],
  )

  const isCollapsed = useCallback((id: string) => collapsed.has(id), [collapsed])

  return { isCollapsed, toggle }
}

/**
 * The index of what is on this page.
 *
 * Sticky, so the answer to "what is down there, and how do I get to it?" is
 * always one glance away rather than one long scroll away. Sections with
 * nothing in them are still listed — with a zero — because knowing a category
 * is silent is a finding, and hiding it would make the page look shorter by
 * making it less honest.
 */
export function SectionIndex({
  sections,
  className = '',
}: {
  sections: SectionState[]
  className?: string
}) {
  const [active, setActive] = useState<string | null>(null)

  /**
   * Which section the reader is currently inside.
   *
   * An index that does not track position is a table of contents; one that does
   * is a location. `IntersectionObserver` rather than a scroll handler, because
   * a scroll handler on a page this tall runs hundreds of times a second on the
   * slowest device we ship to.
   */
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const seen = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) seen.set(entry.target.id, entry.intersectionRatio)
        let best: string | null = null
        let bestRatio = 0
        for (const [id, ratio] of seen) {
          if (ratio > bestRatio) {
            bestRatio = ratio
            best = id
          }
        }
        if (best) setActive(best)
      },
      { rootMargin: '-72px 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] },
    )
    for (const s of sections) {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [sections])

  if (sections.length === 0) return null

  return (
    <nav
      aria-label="Sections on this page"
      className={`scroll-row sticky top-0 z-20 -mx-1 flex items-center gap-1 border-y border-border bg-background/95 px-1 py-1.5 backdrop-blur ${className}`}
    >
      {sections.map((s) => {
        const isActive = active === s.id
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={(e) => {
              e.preventDefault()
              const el = document.getElementById(s.id)
              if (!el) return
              // `scrollIntoView` rather than the default anchor jump, so the
              // sticky index does not land on top of the heading it just
              // scrolled to.
              el.scrollIntoView({ behavior: 'smooth', block: 'start' })
              setActive(s.id)
            }}
            aria-current={isActive ? 'true' : undefined}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              isActive
                ? 'border-primary bg-primary/10 font-medium text-primary'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {s.title}
            <span
              className={`font-mono tabular-nums ${
                s.count === 0 ? 'opacity-40' : isActive ? 'text-primary' : 'text-foreground'
              }`}
            >
              {s.count}
            </span>
          </a>
        )
      })}
    </nav>
  )
}

/**
 * One section: a real edge, a heading, a count, and a body that can be put away.
 */
export function PanelSection({
  id,
  title,
  count,
  /** One sentence under the heading. Kept visible when open, hidden when shut. */
  hint,
  /** What to say instead of a body when `count` is 0. */
  emptyLabel = 'Nothing reported in this window.',
  /** Controls that belong to this section — sort, filter — rendered in the header. */
  controls,
  collapsed,
  onToggle,
  children,
}: {
  id: string
  title: string
  count: number
  hint?: ReactNode
  emptyLabel?: string
  controls?: ReactNode
  collapsed: boolean
  onToggle: (id: string) => void
  children: ReactNode
}) {
  const bodyId = useId()
  const empty = count === 0

  return (
    <Card
      id={id}
      /**
       * `scroll-mt` so an index jump does not park the heading underneath the
       * sticky index bar — the classic anchor bug, where the thing you asked
       * for is the one thing hidden.
       */
      className="scroll-mt-14 overflow-hidden p-0"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/60 bg-muted/30 px-3 py-2">
        <button
          type="button"
          onClick={() => !empty && onToggle(id)}
          aria-expanded={empty ? undefined : !collapsed}
          aria-controls={empty ? undefined : bodyId}
          disabled={empty}
          className={`touch-target flex min-w-0 items-center gap-1.5 text-start ${
            empty ? 'cursor-default' : 'cursor-pointer'
          }`}
        >
          {empty ? (
            <span className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
                collapsed ? '-rotate-90 rtl:rotate-90' : ''
              }`}
            />
          )}
          <h3 className="truncate text-xs font-semibold">{title}</h3>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
              empty ? 'text-muted-foreground/60' : 'bg-primary/10 text-primary'
            }`}
          >
            {count}
          </span>
        </button>
        {!empty && !collapsed && controls ? (
          <div className="ms-auto flex flex-wrap items-center gap-1">{controls}</div>
        ) : null}
      </div>

      {empty ? (
        <p className="px-3 py-2 text-[11px] text-muted-foreground">{emptyLabel}</p>
      ) : collapsed ? null : (
        <div id={bodyId} className="space-y-2 p-3">
          {hint ? <div className="text-[10px] leading-relaxed text-muted-foreground">{hint}</div> : null}
          {children}
        </div>
      )}
    </Card>
  )
}

/**
 * A long list of names — sources, feeds — that must be countable at a glance and
 * readable on demand.
 *
 * The globe page printed 167 source keys as a column and then 159 of them again
 * inside a paragraph. Nobody reads 326 monospace identifiers; they scroll past
 * them, and everything real is on the other side of that scroll.
 */
export function NameList({
  names,
  label,
  tone = 'muted',
  limit = 12,
}: {
  names: string[]
  label: string
  tone?: 'muted' | 'warn' | 'bad'
  limit?: number
}) {
  const [open, setOpen] = useState(false)
  const shown = useMemo(() => (open ? names : names.slice(0, limit)), [open, names, limit])
  if (names.length === 0) return null

  const toneClass =
    tone === 'bad'
      ? 'border-destructive/40 text-destructive'
      : tone === 'warn'
        ? 'border-amber-500/40 text-amber-600 dark:text-amber-500'
        : 'border-border text-muted-foreground'

  return (
    <div className="space-y-1.5">
      <p className="text-[11px]">
        <span className="font-medium text-foreground">{names.length}</span>{' '}
        <span className="text-muted-foreground">{label}</span>
      </p>
      <div className="flex flex-wrap gap-1">
        {shown.map((n) => (
          <span key={n} className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${toneClass}`}>
            {n}
          </span>
        ))}
        {names.length > limit ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="touch-target rounded border border-border px-1.5 py-0.5 text-[10px] text-primary transition-colors hover:bg-muted"
          >
            {open ? 'show fewer' : `+${names.length - limit} more`}
          </button>
        ) : null}
      </div>
    </div>
  )
}
