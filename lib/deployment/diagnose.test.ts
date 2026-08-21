import { describe, expect, it } from 'vitest'
import { diagnose, verdict, type ProbeResult } from './diagnose'
import { ALL_MODES } from '../gateways'

/** A probe that answered normally with JSON. */
const json = (body: unknown, status = 200): ProbeResult => ({ status, json: true, body, ms: 12 })

/**
 * The health body **as `/api/health` actually returns it**, captured from a
 * live run rather than written from memory. Every field name here matters: the
 * first version of this module read a `checks[].ok` boolean that the endpoint
 * has never emitted, and because `Boolean(undefined)` is false, a deployment
 * with a connected Postgres was told its database was not configured.
 */
const health = (
  dbStatus: 'ok' | 'degraded' | 'off' | null,
  /**
   * The detail line, which carries the *reason* — and therefore decides which
   * of two completely different situations this is. Defaulted to the endpoint's
   * real "nothing configured" wording, because that is what the older tests in
   * this file were describing when they only had a status to go on.
   */
  dbDetail = 'no DATABASE_URL — persistence-backed features are disabled (keyless intel still works)',
) => ({
  status: 'degraded',
  version: '0.1.0',
  checks: [
    { name: 'session_secret', status: 'ok', detail: 'configured', required: true },
    ...(dbStatus
      ? [
          {
            name: 'database',
            status: dbStatus,
            detail: dbStatus === 'ok' ? 'connected to PostgreSQL 16.13' : dbDetail,
            required: false,
          },
        ]
      : []),
  ],
})

const world = (events: number) => json({ events: Array.from({ length: events }, () => ({})) })
const board = (rows: number) => json({ summary: { rows } })

const healthy = { health: json(health('ok')), world: world(2882), board: board(11) }
const byId = (checks: ReturnType<typeof diagnose>, id: string) => checks.find((c) => c.id === id)!

describe('a deployment where everything works', () => {
  it('says so, and reports the numbers it saw rather than a bare tick', () => {
    const checks = diagnose(healthy)
    expect(checks.every((c) => c.state === 'ok')).toBe(true)
    expect(byId(checks, 'outbound').detail).toContain('2882')
    expect(verdict(checks).state).toBe('ok')
  })

  /**
   * The regression this file was written for. A live run against a real
   * Postgres reported "Not configured" while the same server's health endpoint
   * said the database was connected — a diagnostic confidently giving the wrong
   * diagnosis, which is worse than having none.
   */
  it('reads the database state from the field the endpoint really sends', () => {
    expect(byId(diagnose(healthy), 'database').state).toBe('ok')
  })

  it('counts the gateways instead of stating a number that can drift', () => {
    expect(byId(diagnose(healthy), 'gateways').detail).toContain(String(ALL_MODES.length))
  })
})

describe('the three causes that look identical from the browser', () => {
  /**
   * The most likely thing to have gone wrong with a self-hosted copy: the zip
   * was unpacked and served as static files, so no route handler exists.
   */
  it('names a static host when the health route answers HTML', () => {
    const checks = diagnose({
      ...healthy,
      health: { status: 200, json: false, body: '<!doctype html>', ms: 3 },
    })
    expect(checks).toHaveLength(1)
    expect(checks[0].state).toBe('fail')
    expect(checks[0].action).toContain('Node server')
  })

  it('names an unreachable server when nothing answers at all', () => {
    const checks = diagnose({
      ...healthy,
      health: { status: 0, json: false, body: null, ms: 30, error: 'Failed to fetch' },
    })
    expect(checks).toHaveLength(1)
    expect(checks[0].detail).toContain('Failed to fetch')
  })

  /**
   * Stopping at the first fatal check is the point. Telling someone about their
   * database while their API routes 404 sends them in the wrong direction for
   * an afternoon.
   */
  it('stops at the first fatal check rather than listing consequences of it', () => {
    const checks = diagnose({
      health: { status: 0, json: false, body: null, ms: 1 },
      world: { status: 0, json: false, body: null, ms: 1 },
      board: { status: 0, json: false, body: null, ms: 1 },
    })
    expect(checks.map((c) => c.id)).toEqual(['server'])
  })

  it('reads an empty world feed as a blocked network, not as a bug', () => {
    const checks = diagnose({ ...healthy, world: world(0) })
    const outbound = byId(checks, 'outbound')
    expect(outbound.state).toBe('fail')
    expect(outbound.action).toContain('outbound HTTPS')
    // The distinction that saves the afternoon.
    expect(outbound.action).toContain('not a key problem')
  })
})

describe('what the database check must not do', () => {
  /**
   * Someone whose map is empty must not be sent to configure Postgres. The map,
   * the panels, the news and every gateway are keyless and account-free
   * (charter §1), and this sentence is the only thing that says so.
   */
  it('states plainly that the map and the gateways do not need one', () => {
    const check = byId(diagnose({ ...healthy, health: json(health('degraded')) }), 'database')
    expect(check.state).toBe('warn')
    expect(check.detail).toContain('does not affect the map')
    expect(check.action).toContain('only if you want accounts')
  })

  it('never claims a verdict when the health report says nothing about it', () => {
    expect(byId(diagnose({ ...healthy, health: json(health(null)) }), 'database').state).toBe('unknown')
  })

  it('does not let an optional gap read as a broken product', () => {
    const summary = verdict(diagnose({ ...healthy, health: json(health('degraded')) }))
    expect(summary.state).toBe('warn')
    expect(summary.message).toContain('The product works')
  })
})

describe('a gateway that answers imperfectly', () => {
  it('calls our own rate limiter what it is, rather than a failure', () => {
    const check = byId(diagnose({ ...healthy, board: json({ summary: { rows: 0 } }, 429) }), 'gateways')
    expect(check.state).toBe('warn')
    expect(check.detail).toContain('Not a fault')
  })

  it('treats one quiet publisher as a warning, and points at the real answer', () => {
    const check = byId(diagnose({ ...healthy, board: board(0) }), 'gateways')
    expect(check.state).toBe('warn')
    expect(check.action).toContain('outbound check above')
  })
})

describe('a database that is configured and broken', () => {
  /**
   * The live failure this branch exists for. `DATABASE_URL` was set, the host
   * was unreachable, and this page said "Not configured. Set DATABASE_URL" —
   * telling the owner to do the one thing they had already done, from the page
   * whose whole purpose is to stop that guessing.
   */
  const broken = json(
    health('off', 'connect ETIMEDOUT [ETIMEDOUT] — check you are using the connection pooler host'),
  )

  it('does not tell the owner to set a variable that is already set', () => {
    const check = byId(diagnose({ ...healthy, health: broken }), 'database')
    expect(check.action).not.toContain('Set DATABASE_URL')
  })

  it('relays the real cause and the fix, rather than re-deriving a worse one', () => {
    const check = byId(diagnose({ ...healthy, health: broken }), 'database')
    expect(check.detail).toContain('ETIMEDOUT')
    expect(check.detail).toMatch(/pooler/i)
  })

  /**
   * A fault, not an optional extra. On this deployment accounts are meant to
   * work and do not — calling that a warning puts it below the reader's
   * attention, which is where it sat for days.
   */
  it('calls it a failure', () => {
    expect(byId(diagnose({ ...healthy, health: broken }), 'database').state).toBe('fail')
  })

  it('still says the rest of the product is unaffected', () => {
    const check = byId(diagnose({ ...healthy, health: broken }), 'database')
    expect(check.action).toMatch(/map|gateway/i)
  })
})
