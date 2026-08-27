/**
 * The deployments this project actually has, so a check can visit all of them.
 *
 * Public addresses only. Nothing here is a secret — these are the URLs anybody
 * can type into a browser — and nothing that reads this file is ever given a
 * credential, which is what keeps `npm run check:deploys` safe to run and safe
 * to paste the output of.
 *
 * ## Why the list is checked in rather than discovered
 *
 * Discovering it needs a host API token, and a token is exactly the thing this
 * project refuses to put anywhere near the repository. A list a person edits is
 * also a list a person can *see* — and seeing it is how anyone would have
 * noticed that three Netlify projects were building the same repository, two of
 * them unconfigured, one of them twelve days stale. That was invisible for as
 * long as it was only in a dashboard.
 *
 * `NX_DEPLOYMENTS` overrides it (comma-separated URLs) for a fork or a
 * self-host, so nobody has to edit this file to check their own deployment.
 */

export interface Deployment {
  /** Short name for the report. */
  name: string
  /** Origin, no trailing slash. `/api/health` is appended. */
  origin: string
  /** What this deployment is for, so an unexpected one is noticed. */
  role: string
}

export const DEPLOYMENTS: Deployment[] = [
  {
    name: 'gregarious-haupia',
    origin: 'https://gregarious-haupia-b516fd.netlify.app',
    role: 'live — the configured deployment',
  },
  /**
   * The last of three earlier Netlify projects still building this repository
   * with nothing configured. It is listed rather than dropped, because a public
   * deployment of the app that nobody intends to run is not harmless: it serves
   * the product to anyone who finds the URL, with no session secret and no
   * database, and it spends build minutes on every push. The check stays red
   * until it is deleted, which is the point.
   *
   * Delete it in Netlify → Site configuration → General → Danger zone, then
   * remove this entry. `voluble-rabanadas` and `melodious-tiramisu` went the
   * same way on 2026-08-27 and are already gone from here.
   */
  {
    name: 'zippy-gecko',
    origin: 'https://zippy-gecko-fc5e2e.netlify.app',
    role: 'leftover — unconfigured, delete it',
  },
]

/** The list to check: the environment's, when it names one, or ours. */
export function deploymentsToCheck(env = process.env.NX_DEPLOYMENTS): Deployment[] {
  const named = env?.trim()
  if (!named) return DEPLOYMENTS
  return named
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
    .map((origin) => ({ name: hostOf(origin), origin, role: 'from NX_DEPLOYMENTS' }))
}

function hostOf(origin: string): string {
  try {
    return new URL(origin).hostname.split('.')[0]
  } catch {
    return origin
  }
}
