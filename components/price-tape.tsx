'use client'

import { useEffect, useRef, useState } from 'react'
import { useTape } from '@/lib/markets/use-tape'
import { STALE_TICK_MS, TAPE_SYMBOLS, type Tick } from '@/lib/markets/tape'

/**
 * The tape — live prices, and an honest account of how live they are.
 *
 * ## What it shows about itself
 *
 * Three states, and the difference between them is the whole point:
 *
 * - **live** — a socket is open and every symbol printed inside the staleness
 *   bound. The venue is named beside it, because a last trade on Coinbase is
 *   not "the price of Bitcoin".
 * - **thin** — the socket is open but something has not printed for a while.
 *   That is a real market condition, not a fault, and it is the state a strip
 *   that only says "LIVE" quietly lies about.
 * - **off** — no venue answered. The strip says so and disappears rather than
 *   showing the last numbers it happened to catch under a live badge.
 *
 * ## The colour flash
 *
 * A price that changed since the previous tick is tinted for a moment: green
 * up, red down. It is derived from two real numbers, it fades, and it never
 * changes what the figure says. A tape without it is unreadable at eight
 * symbols and four updates a second — the eye needs somewhere to land.
 */

/** How long the up/down tint lasts. Long enough to catch, short enough to clear. */
const FLASH_MS = 900

interface Flash {
  direction: 'up' | 'down'
  at: number
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return price.toPrecision(4)
}

export function PriceTape({ symbols = TAPE_SYMBOLS }: { symbols?: string[] } = {}) {
  const tape = useTape(symbols)
  const previous = useRef<Map<string, number>>(new Map())
  const [flashes, setFlashes] = useState<Map<string, Flash>>(new Map())

  /**
   * Direction is computed against the *previous* published price, not against
   * a 24-hour open. The question a tape answers is "did it just move", and a
   * green tick on an asset down 8% today is correct and useful.
   */
  useEffect(() => {
    const next = new Map(flashes)
    let changed = false
    for (const [symbol, tick] of tape.ticks) {
      const before = previous.current.get(symbol)
      if (before !== undefined && before !== tick.price) {
        next.set(symbol, { direction: tick.price > before ? 'up' : 'down', at: Date.now() })
        changed = true
      }
      previous.current.set(symbol, tick.price)
    }
    const now = Date.now()
    for (const [symbol, flash] of next) {
      if (now - flash.at > FLASH_MS) {
        next.delete(symbol)
        changed = true
      }
    }
    if (changed) setFlashes(next)
    // `tape.ticks` is a fresh Map on every publish beat, so this runs at the
    // beat and not per tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tape.ticks])

  if (tape.state === 'failed') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" aria-hidden />
        No venue answered the live tape. The board below is polled and carries its
        own timestamps.
      </div>
    )
  }

  const rows = symbols
    .map((s) => [s, tape.ticks.get(s)] as const)
    .filter((entry): entry is readonly [string, Tick] => entry[1] !== undefined)

  if (rows.length === 0) {
    /**
     * What the strip says while nothing has arrived yet, and why it is three
     * messages rather than one.
     *
     * The first version printed "Opening the tape…" for every state with no
     * ticks. Measured in a real browser against a blocked socket, that message
     * stayed on screen indefinitely while the connection was being reset over
     * and over — the reader was told the product was starting when it was in
     * fact being refused. That is the same fault as a green light over a dead
     * feed, and it is the one this codebase keeps finding.
     */
    const connecting = tape.state === 'connecting' || tape.state === 'idle'
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            connecting ? 'animate-pulse bg-sky-400' : 'bg-amber-500'
          }`}
          aria-hidden
        />
        {connecting ? (
          <>Opening the tape…</>
        ) : (
          <>
            Reconnecting{tape.venue ? ` to ${tape.venue}` : ''}
            {tape.detail ? ` — ${tape.detail}` : ''}. The board below is polled and
            carries its own timestamps.
          </>
        )}
      </div>
    )
  }

  const thin = !tape.fresh
  const now = Date.now()

  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-lg border border-border bg-card px-3 py-1.5">
      {/* The state light, and the venue. Never one without the other. */}
      <span className="flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-wide">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            thin ? 'bg-amber-500' : 'animate-pulse bg-emerald-500'
          }`}
          aria-hidden
        />
        <span className={thin ? 'text-amber-600 dark:text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}>
          {thin ? 'thin' : 'live'}
        </span>
        {tape.venue ? <span className="text-muted-foreground">· {tape.venue}</span> : null}
      </span>

      <div className="scroll-row flex min-w-0 flex-1 items-center gap-4">
        {rows.map(([symbol, tick]) => {
          const flash = flashes.get(symbol)
          const stale = now - tick.receivedAt > STALE_TICK_MS
          const tone =
            flash?.direction === 'up'
              ? 'text-emerald-600 dark:text-emerald-400'
              : flash?.direction === 'down'
                ? 'text-destructive'
                : stale
                  ? 'text-muted-foreground'
                  : 'text-foreground'
          return (
            <span
              key={symbol}
              className="flex shrink-0 items-baseline gap-1.5 text-[11px]"
              // The one place the exact age is available, for anyone who wants
              // to check rather than trust the light.
              title={`${symbol} — last trade on ${tape.venue ?? 'the venue'}, ${Math.round(
                (now - tick.receivedAt) / 1000,
              )}s ago`}
            >
              <span className="font-medium text-muted-foreground">{symbol}</span>
              <span className={`font-semibold tabular-nums transition-colors duration-300 ${tone}`}>
                {formatPrice(tick.price)}
              </span>
              {stale ? <span className="text-[9px] text-amber-500">stale</span> : null}
            </span>
          )
        })}
      </div>

      {/*
        The claim, spelled out. "Last trade" and not "price", because these are
        one venue's prints and the difference matters to anyone who would act on
        the number.
      */}
      <span className="hidden shrink-0 text-[10px] text-muted-foreground lg:inline">
        last trade · USD
      </span>
    </div>
  )
}
