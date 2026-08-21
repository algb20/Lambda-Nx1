/**
 * What version is actually running.
 *
 * The recurring question about this project has been "does the live link show
 * the latest work, or an old build?" — and answering it has meant checking git
 * against a hosting dashboard by hand every time. That is a temporary answer to
 * a permanent question.
 *
 * So the build stamps its own identity in, and the running app reports it. The
 * commit is read from whichever host built it (each names the variable
 * differently), which means no build step of ours has to shell out to git and
 * no stamp can go stale — a value baked into a build describes that build, by
 * construction.
 */
import { BUILT_AT, BUILT_FROM } from './build-stamp'

export interface BuildInfo {
  /** Full commit SHA the build came from, or null if the host did not say. */
  commit: string | null
  /** Short form, for display. */
  shortCommit: string | null
  /** Branch, where the host provides it. */
  branch: string | null
  /** ISO timestamp baked in at build time. */
  builtAt: string | null
  /** Which host built it, inferred from the variables that exist. */
  host: 'netlify' | 'vercel' | 'local' | 'unknown'
  /** A link to the exact commit, when we know both repo and SHA. */
  commitUrl: string | null
}

function firstNonEmpty(...values: Array<string | undefined>): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

/**
 * Read the stamp. Deliberately reads `process.env` members by their literal
 * names: Next.js inlines those at build time, and a computed lookup would come
 * back undefined in the browser bundle.
 */
export function getBuildInfo(): BuildInfo {
  const commit = firstNonEmpty(
    process.env.NEXT_PUBLIC_COMMIT_SHA,
    process.env.COMMIT_REF, // Netlify
    process.env.VERCEL_GIT_COMMIT_SHA, // Vercel
    process.env.GITHUB_SHA, // GitHub Actions
    // Written by the build stamp, which falls back to `git rev-parse` — so a
    // build made anywhere still says which commit it came from.
    BUILT_FROM,
  )
  const branch = firstNonEmpty(
    process.env.NEXT_PUBLIC_COMMIT_BRANCH,
    process.env.BRANCH, // Netlify
    process.env.VERCEL_GIT_COMMIT_REF, // Vercel
  )
  /**
   * From the generated constant, not from the environment.
   *
   * `NEXT_PUBLIC_BUILT_AT` was set in `next.config.mjs` with `new Date()`, and
   * that file is evaluated once per *process* — so the browser bundle carried
   * the build's time and the server carried whenever it happened to boot. The
   * stamp was therefore wrong, and the two sides of every page disagreed on a
   * piece of text, which is a hydration mismatch (#418) on every page showing
   * the footer. A compiled-in constant is the same characters on both sides.
   *
   * The environment variable is still read as a fallback so an operator can
   * override the stamp for a build produced outside our own pipeline.
   */
  const builtAt = firstNonEmpty(BUILT_AT, process.env.NEXT_PUBLIC_BUILT_AT)

  const host: BuildInfo['host'] = process.env.NETLIFY
    ? 'netlify'
    : process.env.VERCEL
      ? 'vercel'
      : process.env.NODE_ENV === 'development'
        ? 'local'
        : 'unknown'

  const repo = firstNonEmpty(
    process.env.NEXT_PUBLIC_REPO_URL,
    process.env.REPOSITORY_URL, // Netlify
  )

  return {
    commit,
    shortCommit: commit ? commit.slice(0, 7) : null,
    branch,
    builtAt,
    host,
    commitUrl: repo && commit ? `${repo.replace(/\.git$/, '')}/commit/${commit}` : null,
  }
}

/** One short line a person can read and compare against a commit. */
export function describeBuild(info: BuildInfo = getBuildInfo()): string {
  const parts: string[] = []
  parts.push(info.shortCommit ? `build ${info.shortCommit}` : 'build unknown')
  if (info.branch) parts.push(info.branch)
  if (info.builtAt) parts.push(new Date(info.builtAt).toISOString().slice(0, 16).replace('T', ' '))
  return parts.join(' · ')
}

/**
 * How old this build is, in whole hours, or null when it did not stamp a time.
 * The point of surfacing it is that "deployed 3 days ago" is the fact that
 * answers "am I looking at the latest work?".
 */
export function buildAgeHours(info: BuildInfo = getBuildInfo(), now = Date.now()): number | null {
  if (!info.builtAt) return null
  const t = Date.parse(info.builtAt)
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.floor((now - t) / 3_600_000))
}
