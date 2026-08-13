#!/usr/bin/env node
/**
 * Lambda NX — release packager.
 *
 * Produces a clean, self-contained SOURCE bundle zip for handoff / archival /
 * upload (e.g. registering the hosted app with Pi App Studio, or shipping the
 * source to another host). It is deliberately conservative:
 *
 *   • Excludes build output, dependencies, VCS metadata and any local storage.
 *   • HARD-FAILS if it would include a secret file (.env, .env.local, *.pem …)
 *     or if any staged file's contents match a secret-shaped pattern.
 *   • Writes a manifest (file count, bytes, git sha, node/next versions).
 *
 * Usage:  node scripts/package.mjs            → dist/lambda-nx-<sha>.zip
 *         node scripts/package.mjs --out foo  → foo.zip
 *
 * No third-party deps: uses the system `zip` when available, else `git archive`.
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const OUT_DIR = join(ROOT, 'dist')

// Directories/paths never shipped in a source bundle.
const EXCLUDE_DIRS = ['node_modules', '.next', '.git', 'dist', 'out', 'build', '.storage', '.vercel']
// File names that must never appear (secrets / local config). `.env.example`
// is the documented placeholder template and is explicitly allowed.
const SECRET_FILES = /(^|\/)(\.env(\.(?!example$).*)?|.*\.pem|.*\.key|id_rsa.*|.*\.p12|.*\.pfx)$/i
// Content patterns that look like real secrets (not the .env.example placeholders).
const SECRET_CONTENT = [
  /sk_live_[0-9a-zA-Z]{16,}/, // Stripe live secret
  /sk-ant-[0-9A-Za-z_-]{20,}/, // Anthropic key
  /postgres(ql)?:\/\/[^:\s]+:[^@\s]+@[^/\s]+/g, // DSN with a password
]
// Files allowed to contain secret-shaped strings (documentation of placeholders).
const CONTENT_ALLOWLIST = new Set(['.env.example', 'scripts/package.mjs'])

/**
 * Hosts that cannot be a real database, so a DSN pointing at one cannot be a
 * real credential.
 *
 * This exists because the DSN rule fired on `lib/db/probe.test.ts` — a test
 * whose entire purpose is to prove the error scrubber strips connection
 * strings, and which therefore *must* contain one. Blocking the release over it
 * was wrong; so would be the obvious escape hatch of allowlisting the file, or
 * test files generally, because a real secret pasted into a `.test.ts` would
 * then ship.
 *
 * The distinction that actually matters is the host. RFC 2606 reserves
 * `example.com/.net/.org` and `.test`/`.invalid`/`.example` precisely so
 * documentation can name a host that can never exist; RFC 5737 does the same
 * for `192.0.2.0/24`, `198.51.100.0/24` and `203.0.113.0/24`; and loopback is
 * nobody's production database. A DSN aimed at any of them is a worked example
 * by construction. Everything else — including anything in a test file — is
 * still refused.
 */
const UNREACHABLE_HOST =
  /^(localhost|127(\.\d{1,3}){3}|\[?::1\]?|0\.0\.0\.0|192\.0\.2\.\d{1,3}|198\.51\.100\.\d{1,3}|203\.0\.113\.\d{1,3}|([a-z0-9-]+\.)*example\.(com|net|org)|([a-z0-9-]+\.)*(test|invalid|example|localhost))$/i

/**
 * The host of a `scheme://user:pass@host[:port][/path]` string, lowercased.
 *
 * Splits on the **last** `@`, because a password may legitimately contain one
 * and splitting on the first would read the tail of the password as the host —
 * turning `p@ss@real-db.internal` into the harmless-looking `ss@real-db`. The
 * path and port are dropped so this works on a full DSN as well as on the bare
 * `scheme://user:pass@host` fragment the scanner's regex captures.
 */
export function dsnHost(dsn) {
  const at = dsn.lastIndexOf('@')
  if (at < 0) return ''
  return dsn
    .slice(at + 1)
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, '')
    .toLowerCase()
}

/** True when this DSN names a host reserved for documentation or loopback. */
export function isDocumentationDsn(dsn) {
  return UNREACHABLE_HOST.test(dsnHost(dsn))
}

/**
 * The secret-shaped strings in `text` that could plausibly be real.
 *
 * Returns the offending matches rather than a boolean, so the failure message
 * can name what it found instead of only which rule fired.
 */
export function realSecretMatches(text) {
  const found = []
  for (const re of SECRET_CONTENT) {
    const matches = re.global ? [...text.matchAll(re)].map((m) => m[0]) : text.match(re) ? [text.match(re)[0]] : []
    for (const match of matches) {
      if (match.startsWith('postgres') && isDocumentationDsn(match)) continue
      found.push({ rule: re.source, match })
    }
  }
  return found
}

function sh(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function gitSha() {
  try {
    return sh('git rev-parse --short HEAD')
  } catch {
    return 'nogit'
  }
}

/** All tracked, non-excluded files (git is the source of truth for what ships). */
function listFiles() {
  let files
  try {
    files = sh('git ls-files').split('\n').filter(Boolean)
  } catch {
    throw new Error('package.mjs requires a git repository (uses git ls-files).')
  }
  return files.filter((f) => !EXCLUDE_DIRS.some((d) => f === d || f.startsWith(`${d}/`)))
}

function assertNoSecrets(files) {
  const secretFiles = files.filter((f) => SECRET_FILES.test(f))
  if (secretFiles.length) {
    throw new Error(`Refusing to package secret file(s):\n  ${secretFiles.join('\n  ')}`)
  }
  const offenders = []
  for (const f of files) {
    if (CONTENT_ALLOWLIST.has(f)) continue
    let text
    try {
      text = readFileSync(join(ROOT, f), 'utf8')
    } catch {
      continue // binary / unreadable — skip content scan
    }
    const found = realSecretMatches(text)
    // Name what was found, redacted after the scheme — an operator has to be
    // able to tell a leaked credential from a false positive without opening
    // the file, and printing the secret to fix a secret leak is absurd.
    if (found.length) {
      offenders.push(`${f} (matches /${found[0].rule}/ → ${found[0].match.slice(0, 18)}…)`)
    }
  }
  if (offenders.length) {
    throw new Error(`Refusing to package — secret-shaped content found:\n  ${offenders.join('\n  ')}`)
  }
}

function pkgVersion(dep) {
  try {
    const pj = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    return (pj.dependencies?.[dep] ?? pj.devDependencies?.[dep] ?? 'n/a').replace(/^[\^~]/, '')
  } catch {
    return 'n/a'
  }
}

function main() {
  const outArg = process.argv.indexOf('--out')
  const sha = gitSha()
  const base = outArg > -1 ? process.argv[outArg + 1] : join('dist', `lambda-nx-${sha}`)
  const zipPath = base.endsWith('.zip') ? base : `${base}.zip`

  const files = listFiles()
  assertNoSecrets(files)

  const totalBytes = files.reduce((n, f) => {
    try {
      return n + statSync(join(ROOT, f)).size
    } catch {
      return n
    }
  }, 0)

  const manifest = {
    name: 'lambda-nx',
    version: pkgVersion('next') === 'n/a' ? '0.0.0' : JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version,
    gitSha: sha,
    files: files.length,
    bytes: totalBytes,
    next: pkgVersion('next'),
    node: process.version,
    builtAt: new Date().toISOString(),
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'MANIFEST.json'), JSON.stringify(manifest, null, 2))

  // git archive is deterministic and honors the tracked file set precisely.
  try {
    execSync(`git archive --format=zip -o "${zipPath}" HEAD`, { cwd: ROOT, stdio: 'inherit' })
  } catch (err) {
    throw new Error(`git archive failed: ${err instanceof Error ? err.message : err}`)
  }

  console.log(`\n✓ Packaged ${manifest.files} files (${(totalBytes / 1024).toFixed(0)} KB) → ${zipPath}`)
  console.log(`  git ${sha} · next ${manifest.next} · node ${manifest.node}`)
  console.log(`  manifest → dist/MANIFEST.json`)
}

// Only package when run as a command. The secret rules above are exported so
// they can be tested, and importing this file must not build a release.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  try {
    main()
  } catch (err) {
    console.error(`\n✗ Packaging aborted: ${err instanceof Error ? err.message : err}\n`)
    process.exit(1)
  }
}
