import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { discardBody } from './discard'

describe('discardBody', () => {
  it('cancels the stream of a response nobody is going to read', () => {
    let cancelled = false
    const res = {
      body: {
        cancel: () => {
          cancelled = true
          return Promise.resolve()
        },
      } as unknown as ReadableStream,
    }
    discardBody(res)
    expect(cancelled).toBe(true)
  })

  it('survives a response with no body at all', () => {
    // A 204, a cached response, or a test double. None of them owe us a stream.
    expect(() => discardBody({ body: null })).not.toThrow()
    expect(() => discardBody(undefined)).not.toThrow()
  })

  it('survives a body that is already locked or errored', () => {
    // `cancel()` throws synchronously on a locked stream and rejects on an
    // errored one. A caller who has decided the body is irrelevant must not be
    // handed either failure.
    const throwing = { body: { cancel: () => { throw new TypeError('locked') } } as unknown as ReadableStream }
    const rejecting = { body: { cancel: () => Promise.reject(new Error('errored')) } as unknown as ReadableStream }
    expect(() => discardBody(throwing)).not.toThrow()
    expect(() => discardBody(rejecting)).not.toThrow()
  })
})

/**
 * Nobody re-introduces the leak by hand.
 *
 * The bug was not one component's mistake — it was the same three-word idiom
 * written in nine places over months, each one obviously correct on its own.
 * The three routes it broke (`/monitor`, `/intelligence`, `/account`) never
 * reached network idle at all until every one of them was fixed, so one new
 * occurrence is enough to bring the failure back.
 *
 * The scan is deliberately narrow: it looks for a decision made on `ok`/`status`
 * that returns or resolves *without* the body being read, in the same statement.
 * Anything that reads the body — `await res.json()`, `.then((r) => r.json())` —
 * is correct and is not matched.
 */
const CLIENT_DIRS = ['components', 'app', 'hooks']

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) sourceFiles(rel, out)
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(rel)
  }
  return out
}

/**
 * The idioms that decide from the status and walk away.
 *
 *  - `if (!res.ok) return` / `return setState(…)` — the early exit.
 *  - `r.ok ? r.json() : null` / `: Promise.reject(…)` — the ternary.
 */
const ABANDONS = [
  /if\s*\(\s*!\w+\.ok\s*\)\s*return(\s|$)/,
  /if\s*\(\s*\w+\.status\s*===\s*\d{3}\s*\)\s*return(\s|$)/,
  /\w+\.ok\s*\?\s*\w+\.json\(\)\s*:\s*(null|Promise\.reject|undefined)/,
  /**
   * The positive guard, and the one this scan originally missed.
   *
   *     if (aRes.ok) setAlerts((await aRes.json()).alerts ?? [])
   *
   * Reads the body on the happy path and has no else branch at all, so every
   * *unhappy* status — 429, 500, a 401 on a second call — leaks exactly as the
   * early-return form did. Found by the browser suite, not by this file: under
   * the app's own rate limit `/api/alerts` answered 429 and `/monitor` stopped
   * reaching quiescence again, days after it was declared fixed.
   *
   * That is the lesson worth keeping. This scan was written around the *shape*
   * of the bug that had been noticed, and the fault is not a shape — it is
   * "a response whose body no path reads". A guard built from examples will
   * always trail the thing it guards, which is why the browser test that
   * measures the actual behaviour is the one that has to be authoritative.
   */
]

/**
 * The positive guard, which needs a stricter rule than the others.
 *
 *     if (aRes.ok) setAlerts((await aRes.json()).alerts ?? [])
 *
 * It reads the body on the happy path and has no else branch, so every unhappy
 * status — 429, 500, a 401 on a second call — leaks exactly as the early-return
 * form did.
 *
 * It is listed apart because `SETTLED` cannot judge it. That rule accepts "the
 * body was read nearby", and here the read is *inside the guard*: it happens
 * only when the response was ok, which is the one case that was never the
 * problem. A read cannot settle this shape. Only an explicit release can.
 *
 * ## How it was found, which is the part worth remembering
 *
 * Not by this file. The browser suite measured `/monitor` failing to reach
 * quiescence again, days after the leak was declared fixed — under the app's own
 * rate limit `/api/alerts` answered 429 and the body was dropped unread.
 *
 * This scan was written around the *shape* of the bug that had been noticed, and
 * the fault is not a shape: it is "a response whose body no path reads". A guard
 * built from examples will always trail the thing it guards, which is why
 * `tests/browser/quiescence.browser.ts` — which measures the behaviour rather
 * than the text — is the authority, and this file is the fast early warning.
 */
const POSITIVE_GUARDS = [/if\s*\(\s*\w+\.ok\s*\)[^\n]*\.(json|text)\(\)/]

/**
 * What settles the matter, near the line that walks away: the body was
 * released, or it was read.
 *
 * Reading counts because a read body is not abandoned — `const text = await
 * res.text()` followed by `if (!res.ok) return toolError(text)` is the correct
 * shape, and flagging it would teach the next person to silence this test
 * rather than trust it.
 */
const SETTLED = /discardBody|await\s+\w+\.(json|text|arrayBuffer|blob)\(\)/

/**
 * How near that has to be to count.
 *
 * The point is that the reader of the abandoning line can *see* it without
 * scrolling — on the line itself (`return discardBody(res)`), or in the branch
 * immediately around it. A `discardBody` two hundred lines away in an unrelated
 * handler proves nothing.
 */
const WINDOW = 4

describe('no client fetch abandons a response body', () => {
  const files = CLIENT_DIRS.flatMap((d) => sourceFiles(d)).filter((f) =>
    readFileSync(join(process.cwd(), f), 'utf8').includes('fetch('),
  )

  it.each(files)('%s', (file) => {
    const lines = readFileSync(join(process.cwd(), file), 'utf8').split('\n')
    const near = (i: number) => lines.slice(Math.max(0, i - WINDOW), i + WINDOW + 1)
    const offenders = lines
      .map((line, i) => ({ line, i }))
      .filter(({ line, i }) => {
        // The early-exit forms: settled by a release *or* by a read, because a
        // body already read is not abandoned.
        if (ABANDONS.some((re) => re.test(line))) {
          return !near(i).some((l) => SETTLED.test(l))
        }
        // The positive guard: only an explicit release settles it, since the
        // read it contains happens on the one path that was never leaking.
        if (POSITIVE_GUARDS.some((re) => re.test(line))) {
          return !near(i).some((l) => /discardBody/.test(l))
        }
        return false
      })
      .map(({ line, i }) => `${file}:${i + 1}  ${line.trim()}`)

    expect(
      offenders,
      'these decide from the status and never read the body — call discardBody(res), or the connection is held open for the life of the page. See lib/http/discard.ts.',
    ).toEqual([])
  })
})
