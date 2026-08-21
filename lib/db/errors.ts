/**
 * What the database actually said, and what to do about it.
 *
 * ## Why this file exists
 *
 * A deployment went out with `DATABASE_URL` set and the database unreachable.
 * Every symptom the owner could see was a lie about the cause:
 *
 *  - the sign-up form offered email registration, because `isDbConfigured()`
 *    only asks whether the *variable* is set;
 *  - pressing "send code" returned `HTTP 500` with an empty body, because the
 *    store threw and no route caught it;
 *  - the health endpoint said `Failed query: select version() as version` and
 *    nothing else, because Drizzle wraps the driver's error and the real reason
 *    — the host, the port, the SQLSTATE — is one level down in `cause`.
 *
 * Three layers each discarded the one fact that mattered. Days went into
 * guessing at a cause the database had stated plainly the whole time.
 *
 * So: unwrap the chain, classify it, and turn it into a sentence an operator
 * can act on. Nothing here reads configuration or performs I/O — it is a pure
 * translation from an error to an explanation, which is what makes it testable
 * against every failure we have actually seen.
 *
 * ## What must never leak
 *
 * The output of this file is returned over HTTP. Postgres drivers put the host,
 * and sometimes the whole connection string, into their messages. Every path
 * out of here goes through `scrubError` (charter §5: secrets live in the
 * environment and stay there).
 */
import { scrubError } from './scrub'

/**
 * Driver-level codes: the connection never reached a Postgres server.
 *
 * The `E*` codes come from Node's socket layer, the rest from postgres.js,
 * which invents its own for states a socket code cannot express.
 */
const NETWORK_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'EPROTO',
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_ENDED',
  'CONNECTION_DESTROYED',
  'CONNECTION_REFUSED',
  'UNDEFINED_CONNECTION',
])

/**
 * SQLSTATEs where a server answered but the deployment still cannot use it.
 *
 * Class 08 is connection exception, 28 is authorisation, 3D000 is "no such
 * database", 53300 is the connection limit, class 57 is the server shutting
 * down or refusing new work. Every one of them is an operator's problem and
 * none of them is a bug in a query.
 */
const UNUSABLE_SQLSTATES = new Set([
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08P01',
  '28000',
  '28P01',
  '3D000',
  '53300',
  '57P01',
  '57P02',
  '57P03',
])

/**
 * The schema was never applied.
 *
 * Kept apart from the two sets above because the fix is completely different —
 * the connection is fine, the tables are not there — and because a user must
 * not be told "try again later" for something that will never fix itself.
 */
const MISSING_SCHEMA_SQLSTATES = new Set(['42P01', '42703', '3F000'])

/** Node/undici TLS refusals, which arrive as codes rather than SQLSTATEs. */
const TLS_CODES = new Set([
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
])

export type DatabaseFailureKind =
  | 'unreachable'
  | 'credentials'
  | 'tls'
  | 'capacity'
  | 'schema'
  | 'query'
  | 'unknown'

export interface DatabaseFailure {
  /**
   * True when the deployment cannot use the database at all, as opposed to one
   * statement being rejected. This is what decides 503-vs-400: a rejected
   * statement is the caller's problem, an unusable database is ours.
   */
  infrastructure: boolean
  kind: DatabaseFailureKind
  /** The driver code or SQLSTATE, when there was one. */
  code: string | null
  /** The innermost message the driver produced, scrubbed. */
  detail: string
  /** What an operator should change. Null when the code does not say. */
  hint: string | null
}

/**
 * Every error in the `cause` chain, outermost first.
 *
 * Drizzle throws `DrizzleQueryError` with the driver's error as `cause`, and
 * some drivers nest one further. Reading only the top message is how a real
 * diagnosis became the string "Failed query". The depth limit guards against a
 * self-referential chain, which is cheap insurance against an infinite loop in
 * the code path that runs when things are already going wrong.
 */
export function causeChain(err: unknown, maxDepth = 8): unknown[] {
  const chain: unknown[] = []
  let current = err
  const seen = new Set<unknown>()
  while (current !== undefined && current !== null && chain.length < maxDepth) {
    if (seen.has(current)) break
    seen.add(current)
    chain.push(current)
    current = (current as { cause?: unknown }).cause
  }
  return chain
}

function codeOf(value: unknown): string | null {
  const code = (value as { code?: unknown } | null)?.code
  return typeof code === 'string' && code ? code : null
}

function messageOf(value: unknown): string {
  if (value instanceof Error) return value.message
  if (typeof value === 'string') return value
  const message = (value as { message?: unknown } | null)?.message
  return typeof message === 'string' ? message : ''
}

/**
 * The message a person should read.
 *
 * The innermost non-empty message wins, because the outer ones are wrappers:
 * "Failed query: select version()" describes what we were doing, and
 * "getaddrinfo ENOTFOUND db.example.supabase.co" describes what went wrong.
 * Only the second one has ever helped anybody.
 */
function deepestMessage(chain: unknown[]): string {
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const message = messageOf(chain[i]).trim()
    if (message) return message
  }
  return 'the database call failed without a message'
}

/**
 * The Supabase sentence, written once.
 *
 * This is far and away the most common way this product fails to reach its
 * database, and it is invisible from the connection string: Supabase's *direct*
 * host resolves only over IPv6, which serverless platforms — Vercel and Netlify
 * functions among them — do not have. The URL is correct, the password is
 * correct, and the host simply does not exist from where the code runs.
 */
const POOLER_ADVICE =
  "If this is Supabase, check you are using the connection pooler host (…pooler.supabase.com, port 6543) and not the direct host (db.<ref>.supabase.co, port 5432) — the direct host is IPv6-only and serverless platforms cannot reach it. Also confirm the project is not paused."

function classify(code: string | null, message: string): { kind: DatabaseFailureKind; hint: string | null } {
  const text = message.toLowerCase()

  if (code && TLS_CODES.has(code)) {
    return {
      kind: 'tls',
      hint: 'The database refused the TLS handshake. Append ?sslmode=require to DATABASE_URL, and use the provider\'s own certificate rather than disabling verification.',
    }
  }
  if (code && NETWORK_CODES.has(code)) {
    return { kind: 'unreachable', hint: POOLER_ADVICE }
  }
  if (code === '28P01' || code === '28000' || /password authentication failed|role .* does not exist/i.test(message)) {
    return {
      kind: 'credentials',
      hint: 'The database rejected the credentials. Re-copy the connection string from the provider — a password containing @ : / ? # must be percent-encoded, which is the usual cause when the same string works elsewhere.',
    }
  }
  if (code === '3D000') {
    return {
      kind: 'credentials',
      hint: 'The database named at the end of DATABASE_URL does not exist on that server. On Supabase the name is "postgres".',
    }
  }
  if (code === '53300' || /too many clients|max client connections/i.test(message)) {
    return {
      kind: 'capacity',
      hint: 'The server is out of connection slots. Use the transaction pooler and keep DATABASE_POOL_MAX small — serverless functions each open their own pool.',
    }
  }
  if (code && MISSING_SCHEMA_SQLSTATES.has(code)) {
    return {
      kind: 'schema',
      hint: 'The database is connected but the schema was never applied. Paste db/schema.sql into the provider\'s SQL editor — it is one file, safe to run more than once.',
    }
  }
  if (code && UNUSABLE_SQLSTATES.has(code)) {
    return { kind: 'unreachable', hint: POOLER_ADVICE }
  }
  /**
   * No code at all. Fall back to wording, but only for phrases that cannot
   * belong to a rejected statement — "timeout" and "terminating connection"
   * are never things a SELECT is told about its own syntax.
   */
  if (!code) {
    if (/did not answer within|connect_timeout|connection timeout|timed out/.test(text)) {
      return { kind: 'unreachable', hint: POOLER_ADVICE }
    }
    if (/terminating connection|connection (closed|refused|ended|reset)|getaddrinfo/.test(text)) {
      return { kind: 'unreachable', hint: POOLER_ADVICE }
    }
    if (/database_url is not set/.test(text)) {
      return {
        kind: 'unreachable',
        hint: 'DATABASE_URL is not set on this deployment. Add it in the hosting project settings and redeploy — environment variables are read at boot, so an existing deployment will not pick it up.',
      }
    }
    return { kind: 'unknown', hint: null }
  }
  // A code we recognise as a server-side rejection: a constraint, a type
  // error, a bad statement. Real bugs, but not reasons to say "try later".
  return { kind: 'query', hint: null }
}

/**
 * Turn any thrown value into an explanation.
 *
 * Never throws itself — this runs on the path where something has already gone
 * wrong, and an error handler that fails is how a diagnosable outage becomes a
 * blank 500.
 */
export function explainDatabaseError(err: unknown): DatabaseFailure {
  const chain = causeChain(err)
  // The innermost code, for the same reason as the innermost message: the
  // wrapper does not carry one, the driver does.
  let code: string | null = null
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const found = codeOf(chain[i])
    if (found) {
      code = found
      break
    }
  }

  const message = deepestMessage(chain)
  const { kind, hint } = classify(code, message)
  return {
    infrastructure: kind !== 'query' && kind !== 'unknown',
    kind,
    code,
    detail: scrubError(message),
    hint,
  }
}

/**
 * Should this failure be reported as "the service cannot do this right now"?
 *
 * Used by the account routes to answer 503 with a cause instead of 500 with an
 * empty body. `schema` counts: a deployment whose tables were never created
 * cannot create accounts, and telling the visitor their input was wrong would
 * be false.
 */
export function isDatabaseUnavailable(err: unknown): boolean {
  return explainDatabaseError(err).infrastructure
}

/** One line, for a server log. Includes the hint, which is the useful half. */
export function describeDatabaseError(err: unknown): string {
  const failure = explainDatabaseError(err)
  const code = failure.code ? ` [${failure.code}]` : ''
  return `${failure.kind}${code}: ${failure.detail}${failure.hint ? ` — ${failure.hint}` : ''}`
}
