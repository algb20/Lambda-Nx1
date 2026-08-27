'use client'

import { useEffect, useState } from 'react'
import { TAPE_SYMBOLS } from './tape'
import { TapeRunner, type RunnerHost, type RunnerSnapshot } from './tape-runner'

/**
 * Hold the tape open, and say honestly how it is going.
 *
 * ## Why this is only a wrapper
 *
 * Everything that decides anything lives in `TapeRunner`, which takes its
 * socket and its clock from the caller and is tested against a socket that
 * fails on command. The first version of this file had the state machine inside
 * the effect, in closures, and it shipped a retry that never fired: watched in
 * a real browser against a blocked venue it opened **one** socket in thirty
 * seconds, never retried, never fell back, and told the reader it was still
 * opening. Reading the code did not find it; a test with a controllable clock
 * found it in one run.
 *
 * So this file does three things and no more: build the browser's host, run the
 * machine, and publish snapshots into React state.
 *
 * ## The publish beat
 *
 * Ticks arrive far faster than a screen is read — Coinbase printed six in a
 * second for two pairs, and this carries eight. Setting state per tick would
 * re-render the tree hundreds of times a second for a strip a human reads about
 * four times. So the runner publishes on state changes, and a 250ms beat
 * publishes the ages so the staleness marker stays honest between ticks.
 */

export type TapeReading = RunnerSnapshot

const EMPTY: TapeReading = {
  ticks: new Map(),
  venue: null,
  state: 'idle',
  detail: null,
  oldestAgeMs: null,
  fresh: false,
}

/** The browser's own socket, timers and clock. */
const browserHost: RunnerHost = {
  open: (url) => new WebSocket(url) as unknown as ReturnType<RunnerHost['open']>,
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
}

export function useTape(symbols: string[] = TAPE_SYMBOLS, enabled = true): TapeReading {
  const [reading, setReading] = useState<TapeReading>(EMPTY)

  // A string, so a caller passing a fresh array literal each render does not
  // tear the socket down and rebuild it on every render.
  const key = symbols.join(',')

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof WebSocket === 'undefined') return

    const wanted = key.split(',').filter(Boolean)
    if (wanted.length === 0) return

    const runner = new TapeRunner({
      symbols: wanted,
      host: browserHost,
      onChange: setReading,
    })

    const beat = setInterval(() => runner.publish(), 250)

    /**
     * A hidden tab holds a socket it cannot show anything with. Closing it is
     * politeness to the venue and battery to the reader; reopening on return
     * costs the 223ms the connection was measured at.
     */
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') runner.pause()
      else runner.resume()
    }
    document.addEventListener('visibilitychange', onVisibility)

    runner.start()

    return () => {
      clearInterval(beat)
      document.removeEventListener('visibilitychange', onVisibility)
      runner.stop()
    }
  }, [key, enabled])

  return reading
}
