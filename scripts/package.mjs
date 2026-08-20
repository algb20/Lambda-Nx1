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
 * Usage:  node scripts/package.mjs                    → dist/lambda-nx-<sha>.zip
 *         node scripts/package.mjs --profile studio  → …-studio.zip, under 1 MB
 *         node scripts/package.mjs --out foo          → foo.zip
 *
 * No third-party deps: uses the system `zip` when available, else `git archive`.
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, rmSync, unlinkSync } from 'node:fs'
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

/**
 * The `studio` profile — a runnable bundle under Pi App Studio's 1 MB ceiling.
 *
 * ## Why a second profile rather than a smaller repository
 *
 * Pi App Studio accepts an upload of **one megabyte**. The full source bundle is
 * 1.4 MB zipped and cannot be made to fit by tidying: it is not bloated, it is a
 * real application with 117 test files, 26 documents and nineteen migration
 * snapshots. Deleting any of those to satisfy an upload limit would be trading a
 * permanent loss for a temporary convenience — the tests are the reason the
 * gateways can be trusted, and charter §6 makes them part of "done".
 *
 * So nothing is deleted. A second, smaller *view* of the same commit is built,
 * containing exactly what is needed to install and run:
 *
 *  - **Tests** — 624 KB. They prove the code; they do not execute it.
 *  - **`docs/`** — 397 KB. The request ledger alone is 155 KB.
 *  - **`db/migrations/meta/`** — 720 KB of drizzle-kit snapshots, used only to
 *    *generate* the next migration. The `.sql` files themselves stay, so a
 *    database can still be built from zero — which is the property that
 *    actually matters (charter rule #4).
 *  - **`.claude/`** — agent definitions for our own tooling.
 *  - **`package-lock.json`** — 224 KB, the largest single file in the tree, and
 *    the one that pushed this bundle over the line as the product grew. Pi App
 *    Studio runs its own `npm install`, and `package.json` carries the real
 *    version constraints; the lockfile pins the exact resolution. Dropping it
 *    here trades reproducible installs for fitting the uploader at all, and
 *    that trade is stated rather than made quietly: **the full bundle keeps
 *    it**, and anyone doing serious work should use that one. See docs/RUNNING.
 *  - **`scripts/`** — the packaging and maintenance tooling. It builds the
 *    bundle; it is not needed to run what the bundle contains.
 *
 * What ships is the application. What is held back is the apparatus around it,
 * all of which stays in the repository the bundle was cut from.
 *
 * ## The ceiling is in bytes, and which byte matters
 *
 * `STUDIO_LIMIT_BYTES` is 1024×1024. "One megabyte" is also read as 1,000,000
 * by plenty of uploaders, so the warning threshold below is set against the
 * *decimal* million: a bundle between the two is reported as too close to
 * trust, because which of the two the far end means is not knowable from here.
 */
const STUDIO_EXCLUDE = [
  /\.test\.[tj]sx?$/,
  /^docs\//,
  /^db\/migrations\/meta\//,
  /^\.claude\//,
  /^scripts\//,
  /^package-lock\.json$/,
]

/** All tracked, non-excluded files (git is the source of truth for what ships). */
function listFiles(profile = 'full') {
  let files
  try {
    files = sh('git ls-files').split('\n').filter(Boolean)
  } catch {
    throw new Error('package.mjs requires a git repository (uses git ls-files).')
  }
  const kept = files.filter((f) => !EXCLUDE_DIRS.some((d) => f === d || f.startsWith(`${d}/`)))
  if (profile !== 'studio') return kept
  return kept.filter((f) => !STUDIO_EXCLUDE.some((re) => re.test(f)))
}

/**
 * Zip an explicit file list.
 *
 * `git archive` cannot express "everything except these", so the studio profile
 * needs the system `zip`. It is present on every platform this is built on, and
 * its absence is reported as the actual problem rather than as a mysterious
 * failure to produce a file.
 */
function zipFiles(files, zipPath) {
  const listPath = join(OUT_DIR, '.package-filelist')
  writeFileSync(listPath, files.join('\n'))
  try {
    execSync(`zip -q -X -@ "${zipPath}" < "${listPath}"`, { cwd: ROOT, stdio: 'inherit', shell: '/bin/bash' })
  } catch (err) {
    throw new Error(
      `zip failed (is the "zip" command installed?): ${err instanceof Error ? err.message : err}`,
    )
  } finally {
    rmSync(listPath, { force: true })
  }
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

/** Pi App Studio refuses an upload larger than this. */
const STUDIO_LIMIT_BYTES = 1024 * 1024

/**
 * The stricter reading of "one megabyte".
 *
 * Some uploaders mean 1,048,576 bytes and some mean 1,000,000. A bundle between
 * the two either uploads or does not depending on which, and that is not
 * knowable from here — so anything above this is reported as too close to trust
 * rather than as passing.
 */
const SAFE_STUDIO_BYTES = 1_000_000

function main() {
  const outArg = process.argv.indexOf('--out')
  const profileArg = process.argv.indexOf('--profile')
  const profile = profileArg > -1 ? process.argv[profileArg + 1] : 'full'
  if (profile !== 'full' && profile !== 'studio') {
    throw new Error(`unknown profile "${profile}" (expected: full | studio)`)
  }
  const sha = gitSha()
  const suffix = profile === 'studio' ? '-studio' : ''
  const base = outArg > -1 ? process.argv[outArg + 1] : join('dist', `lambda-nx-${sha}${suffix}`)
  const zipPath = base.endsWith('.zip') ? base : `${base}.zip`

  const files = listFiles(profile)
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
    profile,
    version: pkgVersion('next') === 'n/a' ? '0.0.0' : JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version,
    gitSha: sha,
    files: files.length,
    bytes: totalBytes,
    next: pkgVersion('next'),
    node: process.version,
    builtAt: new Date().toISOString(),
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, `MANIFEST${suffix}.json`), JSON.stringify(manifest, null, 2))

  // Overwrite rather than add to an existing archive: `zip` appends by default,
  // so a rebuild would otherwise keep every file the previous build had and
  // grow past the very limit this profile exists to respect.
  if (existsSync(zipPath)) unlinkSync(zipPath)

  if (profile === 'full') {
    // git archive is deterministic and honors the tracked file set precisely.
    try {
      execSync(`git archive --format=zip -o "${zipPath}" HEAD`, { cwd: ROOT, stdio: 'inherit' })
    } catch (err) {
      throw new Error(`git archive failed: ${err instanceof Error ? err.message : err}`)
    }
  } else {
    zipFiles(files, zipPath)
  }

  const zipped = statSync(join(ROOT, zipPath)).size
  console.log(`\n✓ Packaged ${manifest.files} files (${(totalBytes / 1024).toFixed(0)} KB source) → ${zipPath}`)
  console.log(`  archive ${(zipped / 1024).toFixed(0)} KB · profile ${profile}`)
  console.log(`  git ${sha} · next ${manifest.next} · node ${manifest.node}`)

  if (profile === 'studio' && zipped > SAFE_STUDIO_BYTES && zipped <= STUDIO_LIMIT_BYTES) {
    // Warn before it breaks, not after. The bundle grows with the product, and
    // the failure mode without this is an upload rejected months from now by
    // somebody who has no idea a ceiling exists.
    console.warn(
      `\n⚠ ${(zipped / 1024).toFixed(0)} KB of the ${STUDIO_LIMIT_BYTES / 1024} KB Pi App Studio ceiling — ${(
        (STUDIO_LIMIT_BYTES - zipped) / 1024
      ).toFixed(0)} KB of headroom left.`,
    )
  }

  if (profile === 'studio' && zipped > STUDIO_LIMIT_BYTES) {
    // Loud, and a failure. A bundle that quietly exceeds the ceiling is
    // discovered by the upload being rejected, which is a worse place to find
    // out than here.
    throw new Error(
      `studio bundle is ${(zipped / 1024).toFixed(0)} KB, over Pi App Studio's ${
        STUDIO_LIMIT_BYTES / 1024
      } KB limit. Trim STUDIO_EXCLUDE further.`,
    )
  }
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
