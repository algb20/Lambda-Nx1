/**
 * The repository-wide secret scanner.
 *
 * This exists because the repository is going public, with outside
 * contributors, and the guarantee we need is not "we were careful" — it is that
 * a committed credential **cannot pass the test suite**. Care is a person; a
 * test is a machine.
 *
 * `.mjs` and dependency-free on purpose: it is imported by a vitest test, by
 * the release packager, and can be run straight from the shell by a hook,
 * without dragging the TypeScript build into any of those paths.
 *
 * ## What it looks for
 *
 * Two classes, and they fail differently:
 *
 *  - **Shaped credentials** — a Stripe live key, an Anthropic key, a JWT, a
 *    private key block, an AWS access key id. These are unambiguous: nothing
 *    else looks like them, so a match is a leak.
 *  - **Connection strings with a password.** These need judgement, because
 *    documentation and tests legitimately contain them. The host decides: RFC
 *    2606 and RFC 5737 reserve names and addresses precisely so an example can
 *    name a host that cannot exist. A DSN pointing at one is a worked example;
 *    anything else might be real.
 *
 * ## What it deliberately does not do
 *
 * It does not try to detect "high entropy strings". That heuristic produces a
 * flood of false positives on minified assets, hashes and base64 images, and a
 * scanner people routinely override is a scanner that is off.
 */

/** Hosts that cannot be a real server, so a DSN naming one cannot be a real credential. */
const UNREACHABLE_HOST =
  /^(localhost|127(\.\d{1,3}){3}|\[?::1\]?|0\.0\.0\.0|192\.0\.2\.\d{1,3}|198\.51\.100\.\d{1,3}|203\.0\.113\.\d{1,3}|([a-z0-9-]+\.)*example\.(com|net|org)|([a-z0-9-]+\.)*(test|invalid|example|localhost))$/i

/**
 * Placeholder credentials, which are the *point* of a template file.
 *
 * `user:password@host` in `.env.example` is documentation doing its job. These
 * are matched on the credential pair rather than allow-listing whole files, so
 * a real key pasted into `.env.example` is still caught.
 */
const PLACEHOLDER_CREDENTIALS =
  /^(user|username|user_name|postgres|admin|root|me|you|your[-_]?user|<[^>]+>|\$\{[^}]+\}):(password|pass|secret|changeme|your[-_]?password|xxx+|<[^>]+>|\$\{[^}]+\})$/i

export const SECRET_RULES = [
  { name: 'stripe-live-secret', re: /sk_live_[0-9a-zA-Z]{16,}/g },
  { name: 'stripe-restricted', re: /rk_live_[0-9a-zA-Z]{16,}/g },
  { name: 'anthropic-key', re: /sk-ant-[0-9A-Za-z_-]{20,}/g },
  { name: 'openai-key', re: /\bsk-[A-Za-z0-9]{32,}\b/g },
  { name: 'aws-access-key-id', re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { name: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { name: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'private-key-block', re: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
  { name: 'json-web-token', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: 'connection-string', re: /\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^:\s'"]+:[^@\s'"]+@[^/\s'"]+/g },
]

/** The credentials and host of a `scheme://user:pass@host[:port][/path]` string. */
export function parseDsn(dsn) {
  const at = dsn.lastIndexOf('@')
  if (at < 0) return { credentials: '', host: '' }
  const scheme = dsn.indexOf('://')
  return {
    // Splitting on the LAST @ matters: a password may contain one, and
    // splitting on the first would read the tail of the password as the host —
    // turning `p@ss@real-db.internal` into a harmless-looking `ss@real-db`.
    credentials: scheme >= 0 ? dsn.slice(scheme + 3, at) : dsn.slice(0, at),
    host: dsn
      .slice(at + 1)
      .split(/[/?#]/)[0]
      .replace(/:\d+$/, '')
      .toLowerCase(),
  }
}

/** True when this connection string cannot be a real credential. */
export function isHarmlessDsn(dsn) {
  const { credentials, host } = parseDsn(dsn)
  return UNREACHABLE_HOST.test(host) || PLACEHOLDER_CREDENTIALS.test(credentials)
}

/**
 * Every secret-shaped string in `text` that could plausibly be real.
 *
 * Returns the matches rather than a boolean, so a failure can name what it
 * found instead of only which rule fired.
 */
export function findSecrets(text) {
  const found = []
  for (const rule of SECRET_RULES) {
    // Fresh regex per call: a shared /g regex carries lastIndex between calls
    // and silently skips matches on every other file it is used against.
    const re = new RegExp(rule.re.source, rule.re.flags)
    for (const match of text.matchAll(re)) {
      const value = match[0]
      if (rule.name === 'connection-string' && isHarmlessDsn(value)) continue
      found.push({ rule: rule.name, match: value })
    }
  }
  return found
}

/**
 * A one-line report of a finding, with the secret itself truncated.
 *
 * Printing a credential in order to report a leaked credential would put it in
 * CI logs, terminal scrollback and anywhere those are shipped — turning the
 * warning into a second copy of the leak.
 */
export function describeFinding(file, finding) {
  return `${file}: ${finding.rule} → ${finding.match.slice(0, 12)}…`
}
