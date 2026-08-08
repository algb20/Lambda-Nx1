import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { buildAgeHours, describeBuild, getBuildInfo } from './build-info'

const KEYS = [
  'NEXT_PUBLIC_COMMIT_SHA',
  'NEXT_PUBLIC_COMMIT_BRANCH',
  'NEXT_PUBLIC_BUILT_AT',
  'NEXT_PUBLIC_REPO_URL',
  'COMMIT_REF',
  'BRANCH',
  'VERCEL_GIT_COMMIT_SHA',
  'VERCEL_GIT_COMMIT_REF',
  'GITHUB_SHA',
  'REPOSITORY_URL',
  'NETLIFY',
  'VERCEL',
] as const

const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k]
    delete process.env[k]
  }
})
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('getBuildInfo', () => {
  it('reads the stamp the build baked in', () => {
    process.env.NEXT_PUBLIC_COMMIT_SHA = 'e632fd2abc1234567890abcdef1234567890abcd'
    process.env.NEXT_PUBLIC_COMMIT_BRANCH = 'main'
    process.env.NEXT_PUBLIC_BUILT_AT = '2026-08-08T14:00:00.000Z'
    process.env.NEXT_PUBLIC_REPO_URL = 'https://github.com/algb20/Lambda-Nx1'

    const info = getBuildInfo()
    expect(info.shortCommit).toBe('e632fd2')
    expect(info.branch).toBe('main')
    expect(info.commitUrl).toBe(
      'https://github.com/algb20/Lambda-Nx1/commit/e632fd2abc1234567890abcdef1234567890abcd',
    )
  })

  /** Each host names its git variables differently; all must resolve. */
  it('falls back through the hosting providers in turn', () => {
    process.env.COMMIT_REF = 'netlifysha1234'
    expect(getBuildInfo().shortCommit).toBe('netlify')
    delete process.env.COMMIT_REF

    process.env.VERCEL_GIT_COMMIT_SHA = 'vercelsha5678'
    expect(getBuildInfo().shortCommit).toBe('vercels')
    delete process.env.VERCEL_GIT_COMMIT_SHA

    process.env.GITHUB_SHA = 'actionssha90'
    expect(getBuildInfo().shortCommit).toBe('actions')
  })

  it('identifies the host that built it', () => {
    process.env.NETLIFY = 'true'
    expect(getBuildInfo().host).toBe('netlify')
    delete process.env.NETLIFY
    process.env.VERCEL = '1'
    expect(getBuildInfo().host).toBe('vercel')
  })

  it('reports nothing rather than guessing when the build was not stamped', () => {
    const info = getBuildInfo()
    expect(info.commit).toBeNull()
    expect(info.shortCommit).toBeNull()
    expect(info.commitUrl).toBeNull()
  })

  it('does not build a commit link without both a repo and a commit', () => {
    process.env.NEXT_PUBLIC_COMMIT_SHA = 'abc1234'
    expect(getBuildInfo().commitUrl).toBeNull()
  })

  it('strips a trailing .git so the commit link resolves', () => {
    process.env.NEXT_PUBLIC_COMMIT_SHA = 'abc1234'
    process.env.REPOSITORY_URL = 'https://github.com/algb20/Lambda-Nx1.git'
    expect(getBuildInfo().commitUrl).toBe('https://github.com/algb20/Lambda-Nx1/commit/abc1234')
  })

  it('treats an empty variable as absent, which is how hosts pass "unset"', () => {
    process.env.NEXT_PUBLIC_COMMIT_SHA = ''
    process.env.COMMIT_REF = '   '
    expect(getBuildInfo().commit).toBeNull()
  })
})

describe('buildAgeHours — the fact that answers "is this the latest?"', () => {
  it('counts whole hours since the build', () => {
    const info = { ...getBuildInfo(), builtAt: '2026-08-08T00:00:00.000Z' }
    expect(buildAgeHours(info, Date.parse('2026-08-08T05:30:00.000Z'))).toBe(5)
  })

  it('never reports a negative age from clock skew', () => {
    const info = { ...getBuildInfo(), builtAt: '2026-08-08T10:00:00.000Z' }
    expect(buildAgeHours(info, Date.parse('2026-08-08T09:00:00.000Z'))).toBe(0)
  })

  it('returns null when nothing was stamped or the stamp is junk', () => {
    expect(buildAgeHours({ ...getBuildInfo(), builtAt: null })).toBeNull()
    expect(buildAgeHours({ ...getBuildInfo(), builtAt: 'not a date' })).toBeNull()
  })
})

describe('describeBuild', () => {
  it('reads as one short line a person can compare against a commit', () => {
    process.env.NEXT_PUBLIC_COMMIT_SHA = 'e632fd2abc'
    process.env.NEXT_PUBLIC_COMMIT_BRANCH = 'main'
    process.env.NEXT_PUBLIC_BUILT_AT = '2026-08-08T14:05:00.000Z'
    expect(describeBuild()).toBe('build e632fd2 · main · 2026-08-08 14:05')
  })

  it('says so plainly when the build is unidentified', () => {
    expect(describeBuild()).toBe('build unknown')
  })
})
