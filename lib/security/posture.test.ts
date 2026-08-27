import { describe, expect, it } from 'vitest'
import { checkPosture } from './posture'
import { Registry } from '@/lib/engine/registry'
import {
  registerCatalogSources,
  registerNewsGateway,
  registerWorldEventsGateway,
} from '@/lib/engine/sources'
import type { Source } from '@/lib/engine/types'

/**
 * A posture report that cannot be made to fail is decoration.
 *
 * That is the whole point of this file, and it is why almost every case here
 * builds a *deliberately broken* engine and watches the right check go red. A
 * suite that only ever asserts the healthy case would pass just as happily on a
 * `checkPosture` that returned `lawful: true` unconditionally — which is
 * precisely the hardcoded badge this module replaced.
 */

/** A minimal, well-behaved source. */
const goodSource: Source = {
  key: 'probe_good',
  capability: 'geo',
  passive: true,
  hosts: ['example.invalid'],
  async run() {
    return []
  },
}

/** A registry with one honest source in it. */
function healthyRegistry(): Registry {
  const reg = new Registry()
  reg.register(goodSource)
  return reg
}

describe('the healthy case', () => {
  it('reports lawful when every check passes', async () => {
    const p = await checkPosture(healthyRegistry())
    expect(p.checks.filter((c) => c.state === 'fail')).toEqual([])
    expect(p.lawful).toBe(true)
  })

  it('runs against the real engine, not only a fixture', async () => {
    registerWorldEventsGateway()
    registerNewsGateway()
    registerCatalogSources()
    const p = await checkPosture()
    const failed = p.checks.filter((c) => c.state === 'fail')
    expect(failed.map((c) => `${c.key}: ${c.detail}`)).toEqual([])
    expect(p.lawful).toBe(true)
  }, 30_000)

  /** A pass has to say what it proved, or it is a green light with no evidence. */
  it('gives every check a detail, whichever way it went', async () => {
    for (const c of (await checkPosture(healthyRegistry())).checks) {
      expect(c.detail.length, c.key).toBeGreaterThan(20)
      expect(c.label.length, c.key).toBeGreaterThan(5)
    }
  })

  it('stamps when it was checked, since a compliance claim has an age', async () => {
    const at = new Date('2026-08-27T12:00:00.000Z')
    expect((await checkPosture(healthyRegistry(), at)).checkedAt).toBe(at.toISOString())
  })
})

describe('each check can actually fail', () => {
  /**
   * The registry refuses a non-passive source at registration, which is the
   * real protection. So this bypasses registration to plant one directly — the
   * question the check answers is "is anything active *now*", and a rule that
   * has only ever been enforced at one moment is not the same as a state
   * verified at another.
   */
  it('fails when a source is not marked passive', async () => {
    const reg = healthyRegistry()
    ;(reg as unknown as { byCapability: Map<string, Source[]> }).byCapability
      .get('geo')!
      .push({ ...goodSource, key: 'probe_active', passive: false } as unknown as Source)

    const p = await checkPosture(reg)
    expect(p.lawful).toBe(false)
    const check = p.checks.find((c) => c.key === 'passive-sources')!
    expect(check.state).toBe('fail')
    expect(check.detail).toContain('probe_active')
  })

  it('fails when a source declares no provider hosts', async () => {
    const reg = healthyRegistry()
    ;(reg as unknown as { byCapability: Map<string, Source[]> }).byCapability
      .get('geo')!
      .push({ ...goodSource, key: 'probe_hostless', hosts: [] })

    const p = await checkPosture(reg)
    expect(p.lawful).toBe(false)
    expect(p.checks.find((c) => c.key === 'declared-hosts')!.detail).toContain('probe_hostless')
  })

  /**
   * The strongest check: an allowlist that admits a host nobody registered is
   * not restricting anything, and every other guarantee rests on it.
   */
  it('fails when the allowlist admits a host nothing registered', async () => {
    const reg = healthyRegistry()
    reg.guardrail.allowHosts(['target-under-investigation.invalid'])

    const p = await checkPosture(reg)
    expect(p.lawful).toBe(false)
    const check = p.checks.find((c) => c.key === 'allowlist')!
    expect(check.state).toBe('fail')
    expect(check.detail).toContain('not restricting')
  })
})

describe('the read-only probe', () => {
  /**
   * This is the case the first version got wrong. `createFetch` returns an
   * async function, so it *rejects* rather than throwing, and a synchronous
   * `try/catch` around it caught nothing — the check would have reported the
   * guardrail broken on every render, a compliance badge stuck at red for a
   * fault that was in the checker.
   */
  it('passes, which the un-awaited version could not', async () => {
    const check = (await checkPosture(healthyRegistry())).checks.find(
      (c) => c.key === 'read-only-methods',
    )!
    expect(check.state).toBe('pass')
    expect(check.detail).toContain('DELETE')
  })

  /**
   * And it must not become the violation it tests for. The probe host is one no
   * source declares, so even a guardrail with the method rule removed refuses it
   * at the allowlist instead of sending a DELETE to somebody.
   */
  it('aims at a host nothing has allow-listed', async () => {
    const reg = healthyRegistry()
    expect(reg.guardrail.isAllowed('target-under-investigation.invalid')).toBe(false)
  })
})

describe('the licence gate', () => {
  /**
   * Some catalogued sources are deliberately unusable — `opensky_states` needs a
   * prior agreement for commercial use, so the gate holds it back and the record
   * documents the gap. If the gate ever admitted everything, that is a licence
   * being breached rather than a feature being unlocked.
   */
  it('proves something is still being held back', async () => {
    const check = (await checkPosture(healthyRegistry())).checks.find(
      (c) => c.key === 'licence-gate',
    )!
    expect(check.state).toBe('pass')
    expect(check.detail).toMatch(/\d+ of \d+/)
  })
})
