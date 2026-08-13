#!/usr/bin/env node
/**
 * Lambda NX — end-to-end smoke test.
 *
 * Probes a RUNNING instance (built + started) to prove the wiring survives a
 * real request cycle: the app boots, route handlers resolve, and the readiness
 * probe reports honestly. It needs no database and no network egress — every
 * endpoint it hits degrades gracefully without them, which is exactly the
 * property we want to verify before deploy.
 *
 * Usage:  node scripts/smoke.mjs [baseUrl]      (default http://localhost:3000)
 * Exit 0 = all checks passed, 1 = a check failed.
 */
const BASE = (process.argv[2] ?? process.env.SMOKE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

let passed = 0
let failed = 0

function ok(name, detail = '') {
  passed++
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`)
}
function bad(name, detail = '') {
  failed++
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
}

async function req(path, init) {
  const res = await fetch(`${BASE}${path}`, init)
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    /* not json */
  }
  return { res, text, json }
}

async function main() {
  console.log(`\nLambda NX smoke test → ${BASE}\n`)

  // 1) Home page renders and carries our shell.
  try {
    const { res, text } = await req('/')
    if (res.status === 200 && /Lambda NX|<!DOCTYPE html>|<html/i.test(text)) {
      ok('GET / renders the app shell', `HTTP ${res.status}`)
    } else {
      bad('GET / renders the app shell', `HTTP ${res.status}`)
    }
  } catch (e) {
    bad('GET /', String(e))
  }

  // 2) Readiness probe returns a well-formed report with the right status code.
  try {
    const { res, json } = await req('/api/health')
    const shapeOk =
      json && typeof json.status === 'string' && Array.isArray(json.checks) && json.providers
    const codeOk = json?.status === 'unhealthy' ? res.status === 503 : res.status === 200
    if (shapeOk && codeOk) {
      ok('GET /api/health', `status=${json.status} HTTP ${res.status}`)
    } else {
      bad('GET /api/health', `shape=${!!shapeOk} code=${res.status} status=${json?.status}`)
    }
  } catch (e) {
    bad('GET /api/health', String(e))
  }

  // 3) Public pricing endpoint (single source of truth) is reachable.
  try {
    const { res, json } = await req('/api/plans')
    if (res.status === 200 && Array.isArray(json?.plans) && json.plans.length >= 1) {
      ok('GET /api/plans', `${json.plans.length} plan(s)`)
    } else {
      bad('GET /api/plans', `HTTP ${res.status}`)
    }
  } catch (e) {
    bad('GET /api/plans', String(e))
  }

  // 4) Auth is enforced — a protected write must not succeed unauthenticated.
  try {
    const { res } = await req('/api/analyst', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ report: {} }),
    })
    if (res.status === 401 || res.status === 403) {
      ok('POST /api/analyst rejects anonymous', `HTTP ${res.status}`)
    } else {
      bad('POST /api/analyst rejects anonymous', `expected 401/403, got ${res.status}`)
    }
  } catch (e) {
    bad('POST /api/analyst', String(e))
  }

  // 5) Radar cron endpoint is guarded (no secret → disabled).
  try {
    const { res } = await req('/api/radar/run', { method: 'POST' })
    if ([401, 403, 503].includes(res.status)) {
      ok('POST /api/radar/run is guarded', `HTTP ${res.status}`)
    } else {
      bad('POST /api/radar/run is guarded', `expected 401/403/503, got ${res.status}`)
    }
  } catch (e) {
    bad('POST /api/radar/run', String(e))
  }

  // 6) Every scheduled job refuses an unauthenticated caller. These are public
  //    URLs that write to the live feed, so an open one is the whole product.
  for (const job of ['publish', 'radar', 'radar-monitors', 'radar-watch']) {
    try {
      const { res } = await req(`/api/cron/${job}`)
      if ([401, 403, 503].includes(res.status)) {
        ok(`GET /api/cron/${job} is guarded`, `HTTP ${res.status}`)
      } else {
        bad(`GET /api/cron/${job} is guarded`, `expected 401/403/503, got ${res.status}`)
      }
    } catch (e) {
      bad(`GET /api/cron/${job}`, String(e))
    }
  }

  // 7) An unknown job is a 404, not a 200 — the route must not silently accept
  //    whatever path a misconfigured scheduler was pointed at.
  try {
    const { res } = await req('/api/cron/not-a-job')
    if ([403, 404, 503].includes(res.status)) {
      ok('GET /api/cron/<unknown> is refused', `HTTP ${res.status}`)
    } else {
      bad('GET /api/cron/<unknown> is refused', `expected 403/404/503, got ${res.status}`)
    }
  } catch (e) {
    bad('GET /api/cron/<unknown>', String(e))
  }

  // 8) The Content Security Policy has to permit what the product loads, or the
  //    Pi SDK and page translation die silently in the browser.
  try {
    const res = await fetch(base, { redirect: 'manual' })
    const csp = res.headers.get('content-security-policy') ?? ''
    const missing = ['https://sdk.minepi.com', 'https://api.minepi.com', 'https://www.gstatic.com']
      .filter((host) => !csp.includes(host))
    if (csp && missing.length === 0 && csp.includes("frame-ancestors 'none'")) {
      ok('CSP permits the Pi SDK and translation, and refuses framing')
    } else {
      bad('CSP', csp ? `missing: ${missing.join(', ') || 'frame-ancestors'}` : 'header absent')
    }
  } catch (e) {
    bad('CSP header', String(e))
  }

  // 9) The Radar knowledge base is signed-in surface, not a public feed.
  try {
    const { res } = await req('/api/radar/findings')
    if (res.status === 401 || res.status === 403) {
      ok('GET /api/radar/findings rejects anonymous', `HTTP ${res.status}`)
    } else {
      bad('GET /api/radar/findings rejects anonymous', `expected 401/403, got ${res.status}`)
    }
  } catch (e) {
    bad('GET /api/radar/findings', String(e))
  }

  console.log(`\n${failed === 0 ? '✓ PASS' : '✗ FAIL'} — ${passed} passed, ${failed} failed\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(`smoke test crashed: ${e}`)
  process.exit(1)
})
