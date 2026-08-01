/**
 * Readiness / health report — a real deploy-verification tool.
 *
 * It reports what the running instance actually has wired: which isolation
 * providers are selected, whether the database and session secret are present,
 * whether the AI analyst has a key, and how many migrations ship in the build.
 * It never touches a target and never calls an external network endpoint — it
 * only inspects the process's own configuration, so it is safe to expose
 * unauthenticated for uptime probes (it leaks no secrets, only booleans/names).
 *
 * Pure and dependency-injected so it can be tested without a live environment.
 */

export type CheckStatus = 'ok' | 'degraded' | 'off'

export interface HealthCheck {
  /** Machine name, e.g. "database", "session_secret". */
  name: string
  status: CheckStatus
  /** Short, non-sensitive human note. Never contains a secret value. */
  detail: string
  /** True when this check must pass for the app to serve its core function. */
  required: boolean
}

export interface HealthReport {
  /** 'healthy' = all required checks ok; 'degraded' = an optional check is off;
   *  'unhealthy' = a required check failed. */
  status: 'healthy' | 'degraded' | 'unhealthy'
  version: string
  /** ISO timestamp the report was produced. */
  time: string
  /** Process uptime in whole seconds (0 when not provided). */
  uptimeSeconds: number
  /** Selected isolation providers (from env; defaults applied). */
  providers: {
    auth: string
    payment: string
    storage: string
    queue: string
    ai: string
  }
  checks: HealthCheck[]
}

export interface HealthDeps {
  /** Environment map (default: process.env). */
  env?: Record<string, string | undefined>
  /** Package version (default: env npm_package_version or '0.0.0'). */
  version?: string
  /** Process uptime seconds (default: 0 — routes pass process.uptime()). */
  uptimeSeconds?: number
  /** Number of migrations shipped in the build. */
  migrationCount?: number
  /** Clock (default: Date.now), for deterministic tests. */
  now?: () => number
}

const has = (v: string | undefined): boolean => typeof v === 'string' && v.trim().length > 0

/**
 * Build the readiness report from configuration only. Deterministic given deps.
 */
export function buildHealthReport(deps: HealthDeps = {}): HealthReport {
  const env = deps.env ?? process.env
  const version = deps.version ?? env.npm_package_version ?? '0.0.0'
  const now = deps.now ?? Date.now
  const uptimeSeconds = Math.max(0, Math.floor(deps.uptimeSeconds ?? 0))

  const providers = {
    auth: env.AUTH_PROVIDER ?? 'pi',
    payment: env.PAYMENT_PROVIDER ?? 'pi',
    storage: env.STORAGE_PROVIDER ?? 'filesystem',
    queue: env.QUEUE_PROVIDER ?? 'memory',
    ai: env.AI_PROVIDER ?? 'claude',
  }

  const checks: HealthCheck[] = []

  // Session signing secret — required: without it our signed sessions cannot be
  // trusted. (We report presence only, never the value.)
  checks.push({
    name: 'session_secret',
    status: has(env.SESSION_SECRET) ? 'ok' : 'degraded',
    detail: has(env.SESSION_SECRET)
      ? 'configured'
      : 'SESSION_SECRET not set — session signing throws, so sign-in is unavailable',
    required: true,
  })

  // Database — required for persistence (archive, monitors, ontology memory,
  // calibration, tiers). The app still serves keyless investigations without it.
  const dbOn = has(env.DATABASE_URL)
  checks.push({
    name: 'database',
    status: dbOn ? 'ok' : 'degraded',
    detail: dbOn
      ? 'DATABASE_URL configured'
      : 'no DATABASE_URL — persistence-backed features are disabled (keyless intel still works)',
    required: false,
  })

  // Auth provider needs — Pi payments/verify need PI_API_KEY; standalone needs none.
  if (providers.auth === 'pi' || providers.payment === 'pi') {
    checks.push({
      name: 'pi_api_key',
      status: has(env.PI_API_KEY) ? 'ok' : 'degraded',
      detail: has(env.PI_API_KEY)
        ? 'configured'
        : 'PI_API_KEY not set — Pi auth verification and Pi payments are unavailable',
      required: false,
    })
  }

  // Standard payments need a Stripe key when selected.
  if (providers.payment === 'standard' || providers.payment === 'stripe') {
    checks.push({
      name: 'stripe_secret_key',
      status: has(env.STRIPE_SECRET_KEY) ? 'ok' : 'degraded',
      detail: has(env.STRIPE_SECRET_KEY)
        ? 'configured'
        : 'STRIPE_SECRET_KEY not set — standard payments will fail',
      required: false,
    })
  }

  // AI analyst — optional by design; degrades to a not-configured notice.
  if (providers.ai !== 'disabled') {
    checks.push({
      name: 'ai_analyst',
      status: has(env.ANTHROPIC_API_KEY) ? 'ok' : 'off',
      detail: has(env.ANTHROPIC_API_KEY)
        ? 'ANTHROPIC_API_KEY configured'
        : 'no ANTHROPIC_API_KEY — analyst returns a not-configured notice (rest of app unaffected)',
      required: false,
    })
  }

  // Radar cron guard — the scheduled sweep endpoint is disabled without it.
  checks.push({
    name: 'radar_cron_secret',
    status: has(env.CRON_SECRET) ? 'ok' : 'off',
    detail: has(env.CRON_SECRET)
      ? 'configured'
      : 'CRON_SECRET not set — POST /api/radar/run is disabled (503) until set',
    required: false,
  })

  // Migrations present in the build (informational; a live DB check is separate).
  if (typeof deps.migrationCount === 'number') {
    checks.push({
      name: 'migrations',
      status: deps.migrationCount > 0 ? 'ok' : 'degraded',
      detail: `${deps.migrationCount} migration(s) bundled`,
      required: false,
    })
  }

  const anyRequiredFailed = checks.some((c) => c.required && c.status !== 'ok')
  const anyOptionalDown = checks.some((c) => !c.required && c.status !== 'ok')
  const status: HealthReport['status'] = anyRequiredFailed
    ? 'unhealthy'
    : anyOptionalDown
      ? 'degraded'
      : 'healthy'

  return {
    status,
    version,
    time: new Date(now()).toISOString(),
    uptimeSeconds,
    providers,
    checks,
  }
}
