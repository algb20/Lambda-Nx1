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
        ADMIN_SECRET: 'a',
        SOCIAL_SECRET_KEY: 'k'.repeat(32),
        SMTP_URL: 'smtp://user:pass@mail.example.org:587',
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

  /**
   * The two credentials whose absence stops the platform doing its own work.
   * Both were unset in production for weeks and nothing said so: auto-publishing
   * and the social dashboard simply answered 503 to a caller nobody was watching.
   */
  it('names the operator credentials that silently disable whole features', () => {
    const r = buildHealthReport({ now: fixedNow, env: { SESSION_SECRET: 's'.repeat(32) } })

    const admin = r.checks.find((c) => c.name === 'admin_secret')
    expect(admin?.status).toBe('off')
    expect(admin?.detail).toContain('503')

    const social = r.checks.find((c) => c.name === 'social_secret_key')
    expect(social?.status).toBe('off')

    const cron = r.checks.find((c) => c.name === 'cron_secret')
    expect(cron?.status).toBe('off')
    expect(cron?.detail).toContain('nothing publishes on a schedule')
  })

  describe('the database check', () => {
    /**
     * The distinction this whole probe exists for. A set variable is not a
     * working connection, and the shallow check must not imply that it is.
     */
    it('does not claim a connection it has not made', () => {
      const r = buildHealthReport({
        now: fixedNow,
        env: { SESSION_SECRET: 's'.repeat(32), DATABASE_URL: 'postgres://x' },
      })
      const db = r.checks.find((c) => c.name === 'database')
      expect(db?.detail).toContain('not verified')
      expect(db?.detail).toContain('deep=1')
    })

    it('reports what the database said when the caller probed it', () => {
      const r = buildHealthReport({
        now: fixedNow,
        env: { SESSION_SECRET: 's'.repeat(32), DATABASE_URL: 'postgres://x' },
        liveDatabase: { status: 'ok', detail: 'connected to PostgreSQL 15.8 in 11ms' },
      })
      expect(r.checks.find((c) => c.name === 'database')?.status).toBe('ok')
      expect(r.checks.find((c) => c.name === 'database')?.detail).toContain('PostgreSQL 15.8')
    })

    /** A configured-but-unreachable database must not read as healthy. */
    it('lets a live failure override a present variable', () => {
      const r = buildHealthReport({
        now: fixedNow,
        env: { SESSION_SECRET: 's'.repeat(32), DATABASE_URL: 'postgres://x' },
        liveDatabase: { status: 'off', detail: 'database did not answer within 5000ms' },
      })
      expect(r.checks.find((c) => c.name === 'database')?.status).toBe('off')
      expect(r.status).toBe('degraded')
    })
  })
})

/**
 * Mail was the one thing the report never mentioned, and its absence was the
 * most expensive of all of them: email sign-up and password recovery both mail
 * a six-digit code, so with no provider they refuse and the form quietly hides
 * them. The flows work; the deployment has nowhere to post the message. Nothing
 * said so, which left "registration is broken" as the only available reading.
 */
describe('mail, and saying why sign-up is missing', () => {
  const base = {
    now: fixedNow,
    env: { SESSION_SECRET: 's'.repeat(32), DATABASE_URL: 'postgres://x' },
  }

  it('reports mail off, and names the variable that turns it on', () => {
    const check = buildHealthReport(base).checks.find((c) => c.name === 'mail')
    expect(check?.status).toBe('off')
    expect(check?.detail).toContain('SMTP_URL')
  })

  it('reports mail configured when SMTP is set', () => {
    const r = buildHealthReport({
      ...base,
      env: { ...base.env, SMTP_URL: 'smtp://user:pass@mail.example.org:587' },
    })
    expect(r.checks.find((c) => c.name === 'mail')?.status).toBe('ok')
  })

  /**
   * The setting that looks like success and is not. Codes go to the server log,
   * which is right for a developer and wrong for anyone with real users — so it
   * is degraded, never ok.
   */
  it('does not let the log provider pass as working mail', () => {
    const r = buildHealthReport({ ...base, env: { ...base.env, MAIL_PROVIDER: 'log' } })
    const check = r.checks.find((c) => c.name === 'mail')
    expect(check?.status).toBe('degraded')
    expect(check?.detail).toContain('never sent')
  })
})
