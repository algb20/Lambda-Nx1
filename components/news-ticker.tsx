'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Pause, Play } from 'lucide-react'

/**
 * The live ticker — a fixed rectangle whose contents move, not a list that grows.
 *
 * The point is that the box keeps its size no matter how much news there is:
 * headlines scroll through it one at a time, so a busy day and a quiet one take
 * exactly the same space on the page. Everything in it is a real event with a
 * real source, and every line is a link to that source.
 *
 * Three details it has to get right to not be annoying:
 *  - it stops while you are pointing at it, so a headline cannot slide away
 *    mid-click;
 *  - it stops when the tab is hidden, so it is not animating in the background;
 *  - it respects `prefers-reduced-motion`, where it advances without sliding.
 */
export interface TickerItem {
  id: string
  text: string
  /** Small leading label — a country code, a category. */
  tag?: string | null
  /** Dot colour, so the ticker speaks the map's category language. */
  color?: string | null
  href?: string | null
  meta?: string | null
}

const ROW_HEIGHT = 44
const INTERVAL_MS = 4200

export function NewsTicker({
  items,
  rows = 3,
  label,
}: {
  items: TickerItem[]
  /** How many headlines are visible at once. The rectangle's height. */
  rows?: number
  label?: string
}) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  /**
   * Duplicating the head of the list lets the strip slide past the end and be
   * reset to the top without the reader seeing a jump back.
   */
  const strip = useMemo(() => {
    if (items.length === 0) return []
    return [...items, ...items.slice(0, rows)]
  }, [items, rows])

  useEffect(() => {
    if (paused || items.length <= rows) return
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      setIndex((i) => i + 1)
    }
    const timer = window.setInterval(tick, INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [paused, items.length, rows])

  // When the strip has slid past the real items, snap back with no animation.
  const wrapped = items.length > 0 && index >= items.length
  useEffect(() => {
    if (!wrapped) return
    const t = window.setTimeout(() => setIndex(0), reduced ? 0 : 420)
    return () => window.clearTimeout(t)
  }, [wrapped, reduced])

  if (items.length === 0) return null

  const height = rows * ROW_HEIGHT
  const offset = -(index % (items.length + rows)) * ROW_HEIGHT

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        className="relative overflow-hidden"
        style={{ height }}
        role="list"
        aria-label={label ?? 'Live headlines'}
      >
        <div
          className="will-change-transform"
          style={{
            transform: `translateY(${offset}px)`,
            transition: reduced || wrapped ? 'none' : 'transform 420ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {strip.map((item, i) => (
            <a
              key={`${item.id}:${i}`}
              href={item.href ?? undefined}
              target={item.href ? '_blank' : undefined}
              rel={item.href ? 'noreferrer noopener' : undefined}
              role="listitem"
              className={`flex items-center gap-2 border-b border-border/40 px-0.5 ${
                item.href ? 'cursor-pointer hover:bg-muted/40' : 'cursor-default'
              }`}
              style={{ height: ROW_HEIGHT }}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color ?? 'var(--color-primary, #38bdf8)' }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs leading-tight">{item.text}</span>
                {item.meta ? (
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {item.meta}
                  </span>
                ) : null}
              </span>
              {item.tag ? (
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {item.tag}
                </span>
              ) : null}
              {item.href ? (
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/60" />
              ) : null}
            </a>
          ))}
        </div>

        {/* Soft edges, so a headline entering or leaving does not look clipped. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-card to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-card to-transparent" />
      </div>

      {items.length > rows ? (
        <button
          onClick={() => setPaused((p) => !p)}
          className="absolute -top-6 right-0 flex items-center gap-1 rounded px-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          aria-label={paused ? 'Resume the ticker' : 'Pause the ticker'}
        >
          {paused ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
          {Math.min(items.length, (index % items.length) + 1)}/{items.length}
        </button>
      ) : null}
    </div>
  )
}
