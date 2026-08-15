import { describe, expect, it } from 'vitest'
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { API_GROUPS, INTERNAL_ROUTES, RATE_LIMIT, allEndpoints } from './api-catalog'
import { GATEWAY_LIMIT } from './rate-limit'

const API_DIR = join(process.cwd(), 'app', 'api')

/** Every route directory under app/api, as the catalogue names them. */
function routesOnDisk(dir = API_DIR, prefix = ''): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (!statSync(full).isDirectory()) continue
    const name = prefix ? `${prefix}/${entry}` : entry
    if (existsSync(join(full, 'route.ts'))) found.push(name)
    found.push(...routesOnDisk(full, name))
  }
  return found.sort()
}

/**
 * The mechanism that makes the published documentation worth reading.
 *
 * A hand-written API document is a copy of the routes, and a copy drifts: a
 * parameter is renamed, a route is added, and the page becomes a set of
 * confident statements about software that no longer works that way. Nobody
 * notices, because nothing checks.
 *
 * These tests check, in both directions. A route added without a decision about
 * whether it is public fails here, and making that decision is the point.
 */
describe('the API catalogue matches the routes that exist', () => {
  const onDisk = routesOnDisk()

  it('finds the routes at all — a passing test over an empty list proves nothing', () => {
    expect(onDisk.length).toBeGreaterThan(30)
    expect(onDisk).toContain('world')
  })

  it('documents nothing that does not exist', () => {
    const missing = allEndpoints()
      .map((e) => e.route)
      .filter((route) => !onDisk.includes(route))
    expect(missing).toEqual([])
  })

  it('leaves no route undecided — every one is public or explicitly internal', () => {
    const documented = new Set(allEndpoints().map((e) => e.route))
    const undecided = onDisk.filter((r) => !documented.has(r) && !(r in INTERNAL_ROUTES))
    expect(undecided).toEqual([])
  })

  it('does not carry internal entries for routes that were deleted', () => {
    const stale = Object.keys(INTERNAL_ROUTES).filter((r) => !onDisk.includes(r))
    expect(stale).toEqual([])
  })

  it('never lists a route as both public and internal', () => {
    const both = allEndpoints()
      .map((e) => e.route)
      .filter((r) => r in INTERNAL_ROUTES)
    expect(both).toEqual([])
  })

  it('gives every internal route a stated reason, not an empty string', () => {
    for (const [route, reason] of Object.entries(INTERNAL_ROUTES)) {
      expect(reason.trim().length, `${route} has no reason`).toBeGreaterThan(8)
    }
  })
})

describe('every documented endpoint is described usefully', () => {
  it('states a path that matches its route', () => {
    for (const e of allEndpoints()) expect(e.path).toBe(`/api/${e.route}`)
  })

  it('says what it returns', () => {
    for (const e of allEndpoints()) expect(e.returns.length, e.path).toBeGreaterThan(0)
  })

  it('gives POST endpoints a body contract with an example', () => {
    for (const e of allEndpoints().filter((x) => x.method === 'POST' && x.params)) {
      for (const p of e.params!) {
        expect(p.example.length, `${e.path} ${p.name}`).toBeGreaterThan(0)
        expect(p.description.length).toBeGreaterThan(8)
      }
    }
  })

  it('describes GET endpoints without inventing a body for them', () => {
    for (const e of allEndpoints().filter((x) => x.method === 'GET')) {
      expect(e.params, `${e.path} should take no body`).toBeUndefined()
    }
  })

  it('has no duplicate paths', () => {
    const paths = allEndpoints().map((e) => e.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('groups every endpoint under a titled section', () => {
    for (const g of API_GROUPS) {
      expect(g.title.length).toBeGreaterThan(0)
      expect(g.endpoints.length).toBeGreaterThan(0)
    }
  })
})

/**
 * A published rate limit the gate does not apply would be the exact failure
 * this file exists to prevent, committed in the file that prevents it.
 */
describe('the published rate limit is the one enforced', () => {
  it('reads from the same constant the middleware uses', () => {
    expect(RATE_LIMIT.requests).toBe(GATEWAY_LIMIT.limit)
    expect(RATE_LIMIT.windowSeconds).toBe(GATEWAY_LIMIT.windowMs / 1000)
  })
})
