import { describe, it, expect } from 'vitest'
import { buildHealthReport } from './health'

const fixedNow = () => new Date('2026-08-01T00:00:00.000Z').getTime()

describe('buildHealthReport', () => {
  it('is healthy when every required and optional check passes', () => {
    const r = buildHealthReport({
      now: fixedNow,
      version: '1.2.3',
      uptimeSeconds: 42.9,
      migrationCount: 8,
      env: {
        SESSION_SECRET: 's'.repeat(32),
        DATABASE_URL: 'postgres://x',
        AUTH_PROVIDER: 'standalone',
        PAYMENT_PROVIDER: 'standard',
        STRIPE_SECRET_KEY: 'sk_live_x',
        AI_PROVIDER: 'claude',
        ANTHROPIC_API_KEY: 'sk-ant-x',
        CRON_SECRET: 'c',
      },
    })
    expect(r.status).toBe('healthy')
    expect(r.version).toBe('1.2.3')
    expect(r.uptimeSeconds).toBe(42) // floored
    expect(r.time).toBe('2026-08-01T00:00:00.000Z')
    expect(r.providers.payment).toBe('standard')
    expect(r.checks.find((c) => c.name === 'migrations')?.detail).toContain('8')
    // standalone auth + standard payment → no pi_api_key check emitted
    expect(r.checks.find((c) => c.name === 'pi_api_key')).toBeUndefined()
  })

  it('is unhealthy when a required check (session secret) fails', () => {
    const r = buildHealthReport({
      now: fixedNow,
      env: { DATABASE_URL: 'postgres://x', CRON_SECRET: 'c', ANTHROPIC_API_KEY: 'k' },
    })
    expect(r.status).toBe('unhealthy')
    expect(r.checks.find((c) => c.name === 'session_secret')?.status).toBe('degraded')
  })

  it('is degraded (not unhealthy) when only optional providers are missing', () => {
    const r = buildHealthReport({
      now: fixedNow,
      env: { SESSION_SECRET: 's'.repeat(32) }, // required ok; db/ai/cron off
    })
    expect(r.status).toBe('degraded')
    expect(r.checks.find((c) => c.name === 'database')?.status).toBe('degraded')
    expect(r.checks.find((c) => c.name === 'ai_analyst')?.status).toBe('off')
  })

  it('emits a pi_api_key check under the default (Pi) providers', () => {
    const r = buildHealthReport({ now: fixedNow, env: { SESSION_SECRET: 's'.repeat(32) } })
    expect(r.providers.auth).toBe('pi')
    expect(r.checks.find((c) => c.name === 'pi_api_key')).toBeDefined()
    // never a stripe check under Pi payments
    expect(r.checks.find((c) => c.name === 'stripe_secret_key')).toBeUndefined()
  })

  it('never leaks a secret value into any detail string', () => {
    const secret = 'TOP-SECRET-VALUE-should-not-appear'
    const r = buildHealthReport({
      now: fixedNow,
      env: {
        SESSION_SECRET: secret,
        DATABASE_URL: secret,
        PI_API_KEY: secret,
        ANTHROPIC_API_KEY: secret,
        CRON_SECRET: secret,
      },
    })
    const blob = JSON.stringify(r)
    expect(blob).not.toContain(secret)
  })
})
