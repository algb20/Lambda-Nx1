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
]

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
    const offenders = lines
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => ABANDONS.some((re) => re.test(line)))
      .filter(
        ({ i }) =>
          !lines.slice(Math.max(0, i - WINDOW), i + WINDOW + 1).some((near) => SETTLED.test(near)),
      )
      .map(({ line, i }) => `${file}:${i + 1}  ${line.trim()}`)

    expect(
      offenders,
      'these decide from the status and never read the body — call discardBody(res), or the connection is held open for the life of the page. See lib/http/discard.ts.',
    ).toEqual([])
  })
})
