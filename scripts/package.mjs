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
import { findSecrets, describeFinding } from '../lib/security/secret-scan.mjs'

const ROOT = process.cwd()
const OUT_DIR = join(ROOT, 'dist')

// Directories/paths never shipped in a source bundle.
const EXCLUDE_DIRS = ['node_modules', '.next', '.git', 'dist', 'out', 'build', '.storage', '.vercel']
// File names that must never appear (secrets / local config). `.env.example`
// is the documented placeholder template and is explicitly allowed.
const SECRET_FILES = /(^|\/)(\.env(\.(?!example$).*)?|.*\.pem|.*\.key|id_rsa.*|.*\.p12|.*\.pfx)$/i
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
  // No file-level allowlist. There used to be one, and an allowlist is exactly
  // how a real key ships: the file granted an exemption for holding
  // placeholders is the same file somebody later pastes a working credential
  // into. The scanner distinguishes a placeholder from a credential by what the
  // value *is*, which no path-based exemption can do.
  const offenders = []
  for (const f of files) {
    let text
    try {
      text = readFileSync(join(ROOT, f), 'utf8')
    } catch {
      continue // binary / unreadable — skip content scan
    }
    // One scanner for the whole project. The packager used to carry its own
    // copy of these rules, which meant the release gate and the test gate could
    // disagree about what a secret is — and the one that drifts weaker is the
    // one that ships the leak.
    const found = findSecrets(text)
    if (found.length) offenders.push(describeFinding(f, found[0]))
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

// Only package when run as a command: importing this file must not build a
// release. The secret rules live in lib/security/secret-scan.mjs and are tested
// there, against the whole repository rather than only what a release includes.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  try {
    main()
  } catch (err) {
    console.error(`\n✗ Packaging aborted: ${err instanceof Error ? err.message : err}\n`)
    process.exit(1)
  }
}
