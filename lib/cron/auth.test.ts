import { describe, it, expect } from 'vitest'
import { authorizeCron, cronGate, presentedSecret, secretsMatch } from './auth'

const req = (headers: Record<string, string>) =>
  new Request('https://lambda.example/api/cron/publish', { headers })

describe('presentedSecret', () => {
  /** What hosted cron sends. If this form is not read, nothing is ever scheduled. */
  it('reads a bearer token, which is what a hosted scheduler sends', () => {
    expect(presentedSecret(req({ authorization: 'Bearer s3cret' }).headers)).toBe('s3cret')
    expect(presentedSecret(req({ authorization: 'bearer  s3cret  ' }).headers)).toBe('s3cret')
  })

  it('still reads the header our own schedules already use', () => {
    expect(presentedSecret(req({ 'x-cron-secret': 's3cret' }).headers)).toBe('s3cret')
  })

  it('prefers the bearer token when both are present', () => {
    expect(
      presentedSecret(req({ authorization: 'Bearer a', 'x-cron-secret': 'b' }).headers),
    ).toBe('a')
  })

  it('returns empty rather than a partial value when neither header is usable', () => {
    expect(presentedSecret(req({}).headers)).toBe('')
    expect(presentedSecret(req({ authorization: 'Basic abc' }).headers)).toBe('')
  })
})

describe('secretsMatch', () => {
  it('accepts an exact match and nothing else', () => {
    expect(secretsMatch('abc', 'abc')).toBe(true)
    expect(secretsMatch('abd', 'abc')).toBe(false)
  })

  /** A length mismatch must not throw — timingSafeEqual does, on unequal buffers. */
  it('refuses a different length without throwing', () => {
    expect(secretsMatch('ab', 'abc')).toBe(false)
    expect(secretsMatch('', 'abc')).toBe(false)
    expect(secretsMatch('abcd', 'abc')).toBe(false)
  })
})

describe('authorizeCron', () => {
  it('authorizes a correct secret in either header', () => {
    expect(authorizeCron(req({ authorization: 'Bearer top' }), 'top')).toBe('ok')
    expect(authorizeCron(req({ 'x-cron-secret': 'top' }), 'top')).toBe('ok')
  })

  it('refuses a wrong or absent secret', () => {
    expect(authorizeCron(req({ authorization: 'Bearer nope' }), 'top')).toBe('forbidden')
    expect(authorizeCron(req({}), 'top')).toBe('forbidden')
  })

  /**
   * Unset is a different failure from wrong, and the operator needs to be able
   * to tell them apart: one is a misconfigured deployment, the other an intruder.
   */
  it('distinguishes "not configured" from "forbidden"', () => {
    expect(authorizeCron(req({ authorization: 'Bearer top' }), undefined)).toBe('not-configured')
    expect(authorizeCron(req({ authorization: 'Bearer top' }), '   ')).toBe('not-configured')
  })
})

describe('cronGate', () => {
  it('lets an authorized request through', () => {
    expect(cronGate(req({ authorization: 'Bearer top' }), 'top')).toBeNull()
  })

  it('answers 503 when the deployment has no secret, and 403 when the caller is wrong', async () => {
    const missing = cronGate(req({}), undefined)!
    expect(missing.status).toBe(503)
    expect(await missing.json()).toMatchObject({ error: expect.stringContaining('CRON_SECRET') })

    const wrong = cronGate(req({ authorization: 'Bearer nope' }), 'top')!
    expect(wrong.status).toBe(403)
  })

  /** The refusal must not echo the expected value back to the caller. */
  it('never reveals the secret in its refusal', async () => {
    const wrong = cronGate(req({ authorization: 'Bearer nope' }), 'top-secret-value')!
    expect(JSON.stringify(await wrong.json())).not.toContain('top-secret-value')
  })
})
