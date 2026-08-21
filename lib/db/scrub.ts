/**
 * Make a database driver's error text safe to return over HTTP.
 *
 * Split out of `probe.ts` so that `errors.ts` can use it without importing the
 * probe — which imports the schema, the client and Drizzle, none of which
 * belongs in the path that runs when a request has already failed.
 *
 * Postgres drivers are generous with detail: the connection string, the host,
 * the role, sometimes the password, all end up in `message`. Every one of those
 * belongs in the environment and nowhere else (charter §5), and this text is
 * read by `/api/health`, which is public.
 *
 * The host is redacted too, which loses a little diagnostic value and is still
 * right: a deployment has exactly one `DATABASE_URL`, so an operator reading
 * "ENOTFOUND [host]" already knows which host it was — while a stranger reading
 * it would learn the project's database address, which is the first thing an
 * attacker wants and the last thing a health check should hand out.
 */

/** Hostname-shaped tokens, matched by their suffix so SQL identifiers survive. */
const FQDN =
  /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|net|org|io|dev|co|app|cloud|tech|sh|xyz|ai|de|eu|uk|us)\b/gi

export function scrubError(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[connection string]')
    .replace(/\/\/[^\s/@]+:[^\s/@]+@/g, '//[credentials]@')
    .replace(/password[^\s,;]*/gi, 'password[redacted]')
    .replace(FQDN, '[host]')
    .slice(0, 300)
}
