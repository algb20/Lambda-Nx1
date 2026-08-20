/**
 * Why this deployment is not working — answered from the browser.
 *
 * ## The failure this exists for
 *
 * A zip of this project was built and run, and the globe, the panels and the
 * gateways all came back empty. Every one of them shows the same thing when it
 * has no data: a spinner, then nothing. Three completely different causes —
 * a static build with no server, a firewall with no outbound access, a missing
 * database — produce one identical blank screen, and the person looking at it
 * has no way to tell which they have.
 *
 * That is the real defect. Not the empty globe: the *silence*.
 *
 * ## What this does
 *
 * Runs the smallest set of requests that can distinguish the causes, from the
 * browser, and names the one that is actually happening:
 *
 *  1. **Does a route handler answer at all?** `/api/health` is the cheapest
 *     server-rendered endpoint. If it returns HTML, or 404, the deployment is
 *     serving static files and *no* API route will ever work — which is the
 *     single most likely thing to have gone wrong with a self-hosted build.
 *  2. **Can the server reach the outside world?** The health probe reports it.
 *     A server that answers but cannot fetch means a firewall, not a bug.
 *  3. **Is a database configured?** Only accounts and cross-device preferences
 *     need one. Saying so stops a person configuring Postgres to fix a map.
 *
 * Each check names what it proves, what it does not, and the one action that
 * follows. Pure and dependency-free so it can be tested without a browser.
 */

import { ALL_MODES } from '../gateways'

export type CheckState = 'ok' | 'warn' | 'fail' | 'unknown'

export interface DiagnosisCheck {
  id: string
  /** What was actually tested, in the reader's terms. */
  title: string
  state: CheckState
  /** What the result means — never a bare "failed". */
  detail: string
  /** The one thing to do about it, or null when nothing is wrong. */
  action: string | null
}

/**
 * The health endpoint's shape, as it actually is.
 *
 * Written from `/api/health`'s real output rather than from memory, because
 * this module originally read a boolean `ok` field that endpoint has never
 * emitted. `Boolean(undefined)` is false, so the database check reported "Not
 * configured" on a deployment with a healthy, connected database — a
 * diagnostic tool confidently giving the wrong diagnosis, which is worse than
 * having no diagnostic at all. Found by running the page against a live server
 * and a real Postgres, not by reading the code.
 */
export interface HealthShape {
  status?: string
  version?: string
  checks?: Array<{ name?: string; status?: string; detail?: string; required?: boolean }>
}

export interface ProbeResult {
  /** HTTP status, or 0 when the request never completed. */
  status: number
  /** True when the body parsed as JSON — an HTML body means a static host. */
  json: boolean
  body: unknown
  /** Round trip in milliseconds, for the latency line. */
  ms: number
  error?: string
}

/**
 * The verdict.
 *
 * Ordered so the first failing check is the one to fix first: a deployment with
 * no server cannot have a working database, and telling someone about their
 * database while their API routes 404 sends them in the wrong direction for an
 * afternoon.
 */
export function diagnose(input: {
  health: ProbeResult
  world: ProbeResult
  board: ProbeResult
}): DiagnosisCheck[] {
  const checks: DiagnosisCheck[] = []

  // ── 1. Is anything server-rendered at all? ─────────────────────────────────
  if (input.health.status === 0) {
    checks.push({
      id: 'server',
      title: 'The app’s own server',
      state: 'fail',
      detail: `No response at all from /api/health${input.health.error ? ` — ${input.health.error}` : ''}. The page you are reading loaded, so this is not the browser: the request never reached a running server.`,
      action:
        'Start the app with `npm start` after `npm run build`. Opening the files directly, or serving the folder as static files, cannot run any of this.',
    })
    return checks
  }

  if (!input.health.json) {
    checks.push({
      id: 'server',
      title: 'The app’s own server',
      state: 'fail',
      detail: `/api/health answered ${input.health.status} with something that is not JSON — almost always an HTML error page. This deployment is serving files, not running the application, so no gateway, no panel and no map can ever fill.`,
      action:
        'This app needs a Node server (Next.js route handlers). A static file host cannot serve it. Use `npm start`, Netlify with @netlify/plugin-nextjs, Vercel, or any Node host.',
    })
    return checks
  }

  if (input.health.status >= 500) {
    checks.push({
      id: 'server',
      title: 'The app’s own server',
      state: 'fail',
      detail: `/api/health answered ${input.health.status}. The server is running and something inside it is failing.`,
      action: 'Read the server log — the health body names which check failed.',
    })
    return checks
  }

  checks.push({
    id: 'server',
    title: 'The app’s own server',
    state: 'ok',
    detail: `Route handlers are running and answered in ${input.health.ms} ms. This is the check that decides whether anything else can work.`,
    action: null,
  })

  // ── 2. Can the server reach the internet? ─────────────────────────────────
  const world = input.world
  const events = countEvents(world.body)

  if (world.status === 0 || !world.json) {
    checks.push({
      id: 'outbound',
      title: 'Reaching the live sources',
      state: 'fail',
      detail: `The world feed did not answer${world.error ? ` — ${world.error}` : ` (${world.status})`}. The server is up, so this is the request to /api/world itself.`,
      action: 'Check the server log for the error this request produced.',
    })
  } else if (events === null) {
    checks.push({
      id: 'outbound',
      title: 'Reaching the live sources',
      state: 'warn',
      detail: 'The world feed answered but in a shape this build does not recognise.',
      action: 'The client and the server may be from different builds — rebuild and restart.',
    })
  } else if (events === 0) {
    checks.push({
      id: 'outbound',
      title: 'Reaching the live sources',
      state: 'fail',
      detail:
        'The world feed answered, and every source returned nothing. The server is running but cannot reach the publishers — 119 independent sources do not fail at once for any other reason.',
      action:
        'Allow outbound HTTPS from wherever the server runs. Behind a corporate proxy, set HTTPS_PROXY. This is not a database problem and not a key problem: every source here is keyless.',
    })
  } else {
    checks.push({
      id: 'outbound',
      title: 'Reaching the live sources',
      state: 'ok',
      detail: `${events} live events are being held right now. The map, the panels and the news are all drawn from this.`,
      action: null,
    })
  }

  // ── 3. Do the gateways answer? ───────────────────────────────────────────
  const boardRows = countRows(input.board.body)
  if (input.board.status === 0 || !input.board.json) {
    checks.push({
      id: 'gateways',
      title: 'The gateways',
      state: 'fail',
      detail: `A gateway request did not answer${input.board.error ? ` — ${input.board.error}` : ` (${input.board.status})`}.`,
      action: 'Check the server log for that request.',
    })
  } else if (input.board.status === 429) {
    checks.push({
      id: 'gateways',
      title: 'The gateways',
      state: 'warn',
      detail:
        'Rate-limited — our own limiter, protecting the public providers we read. Not a fault, and it clears within a minute.',
      action: 'Wait a moment and try again.',
    })
  } else if (boardRows === 0) {
    checks.push({
      id: 'gateways',
      title: 'The gateways',
      state: 'warn',
      detail:
        'A gateway answered with no records. If outbound access is working, this publisher may simply be quiet or briefly unavailable.',
      action: 'Try a second gateway. If every one is empty, the outbound check above is the real answer.',
    })
  } else {
    checks.push({
      id: 'gateways',
      title: 'The gateways',
      state: 'ok',
      // Counted, never typed. The literal that used to live here said 26 while
      // the product shipped 27, because a gateway was added and the sentence
      // was not.
      detail: `A gateway returned ${boardRows} records. All ${ALL_MODES.length} read public sources the same way.`,
      action: null,
    })
  }

  // ── 4. The database — and what actually needs it ─────────────────────────
  const dbCheck = findCheck(input.health.body, 'database')
  if (dbCheck === null) {
    checks.push({
      id: 'database',
      title: 'Database',
      state: 'unknown',
      detail: 'The health report did not mention a database.',
      action: null,
    })
  } else if (dbCheck) {
    checks.push({
      id: 'database',
      title: 'Database',
      state: 'ok',
      detail: 'Connected. Accounts, saved investigations and cross-device preferences all work.',
      action: null,
    })
  } else {
    checks.push({
      id: 'database',
      title: 'Database',
      state: 'warn',
      detail:
        'Not configured. This does not affect the map, the panels, the news or any gateway — those need no account and no key (charter §1). It affects accounts, saved investigations, and preferences following you to another device; without it, preferences still work and stay in this browser.',
      action: 'Set DATABASE_URL and run `npm run db:migrate` — only if you want accounts.',
    })
  }

  return checks
}

function countEvents(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null
  const shape = body as { events?: unknown; unplaceable?: unknown }
  if (!Array.isArray(shape.events)) return null
  return shape.events.length + (Array.isArray(shape.unplaceable) ? shape.unplaceable.length : 0)
}

function countRows(body: unknown): number {
  if (!body || typeof body !== 'object') return 0
  const shape = body as { summary?: { rows?: unknown } }
  return typeof shape.summary?.rows === 'number' ? shape.summary.rows : 0
}

/**
 * `true`/`false` for a named health check, or `null` when it is not reported.
 *
 * `status === 'ok'` and nothing else. The endpoint's other states — `degraded`,
 * `off` — both mean "do not rely on this", so treating anything but `ok` as
 * false is the honest reading rather than a convenience.
 */
function findCheck(body: unknown, name: string): boolean | null {
  if (!body || typeof body !== 'object') return null
  const checks = (body as HealthShape).checks
  if (!Array.isArray(checks)) return null
  const found = checks.find((c) => c.name === name)
  return found ? found.status === 'ok' : null
}

/** The single sentence a person needs before reading the detail. */
export function verdict(checks: DiagnosisCheck[]): { state: CheckState; message: string } {
  const failed = checks.find((c) => c.state === 'fail')
  if (failed) return { state: 'fail', message: failed.detail }
  if (checks.some((c) => c.state === 'warn')) {
    return {
      state: 'warn',
      message: 'The product works. Something optional is not configured — the detail below says which.',
    }
  }
  return { state: 'ok', message: 'Everything this deployment needs is working.' }
}
