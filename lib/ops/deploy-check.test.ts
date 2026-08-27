import { describe, expect, it } from 'vitest'
import {
  judgeDeployments,
  STALE_AFTER_HOURS,
  summariseDeployments,
  type Finding,
  type Reading,
} from './deploy-check'

/**
 * Every case below is what the three live deployments actually answered on
 * 2026-08-27, when the owner reported "errors in the database, the settings and
 * GitHub" and finding out what they were meant three `curl`s by hand.
 */
const AT = Date.parse('2026-08-27T02:14:00Z')

describe('what the deployments were actually saying', () => {
  /**
   * The finding that mattered most and was invisible: the health route marks
   * `session_secret` required, and it was unset on all three sites, so nobody
   * could sign in to any of them.
   */
  it('calls a missing required setting blocking, not just degraded', () => {
    const findings = judgeDeployments(
      [
        {
          site: 'zippy-gecko',
          health: {
            status: 'unhealthy',
            checks: [
              {
                name: 'session_secret',
                status: 'degraded',
                required: true,
                detail: 'SESSION_SECRET not set — session signing throws, so sign-in is unavailable',
              },
            ],
            build: { shortCommit: '9cf4946', builtAt: '2026-08-27T00:41:24.507Z' },
          },
        },
      ],
      AT,
    )
    expect(findings).toHaveLength(1)
    expect(findings[0].severity).toBe('blocking')
    expect(findings[0].detail).toContain('session_secret')
  })

  it('keeps an optional capability out of the blocking list', () => {
    const findings = judgeDeployments(
      [
        {
          site: 'zippy-gecko',
          health: {
            status: 'unhealthy',
            checks: [
              { name: 'mail', status: 'off', required: false, detail: 'no mail provider — email sign-up answers 503.' },
              { name: 'migrations', status: 'ok' },
            ],
            build: { shortCommit: '9cf4946', builtAt: '2026-08-27T00:41:24.507Z' },
          },
        },
      ],
      AT,
    )
    expect(findings.map((f) => f.severity)).toEqual(['degraded'])
    expect(findings[0].detail, 'the paragraph is a manual; the report wants the claim').not.toContain('503')
  })

  it('says nothing about a check that is configured', () => {
    const findings = judgeDeployments(
      [
        {
          site: 'ok-site',
          health: {
            status: 'ok',
            checks: [{ name: 'session_secret', status: 'ok', required: true }],
            build: { shortCommit: 'abc1234', builtAt: '2026-08-27T00:41:24.507Z' },
          },
        },
      ],
      AT,
    )
    expect(findings).toEqual([])
  })
})

/**
 * The silent one. `voluble-rabanadas` was serving a build from 15 August while
 * the other two served 27 August, and every check it reported looked like the
 * others' — so reading one site told you nothing was wrong with it.
 */
describe('a deployment left behind', () => {
  const twoCurrentOneStale = (): Reading[] => [
    {
      site: 'voluble-rabanadas',
      health: {
        status: 'unhealthy',
        checks: [],
        build: { shortCommit: 'bb5d88e', builtAt: '2026-08-15T02:24:19.468Z' },
      },
    },
    {
      site: 'zippy-gecko',
      health: { status: 'unhealthy', checks: [], build: { shortCommit: '9cf4946', builtAt: '2026-08-27T00:41:24.507Z' } },
    },
    {
      site: 'melodious-tiramisu',
      health: { status: 'unhealthy', checks: [], build: { shortCommit: '9cf4946', builtAt: '2026-08-27T00:39:50.442Z' } },
    },
  ]

  it('names the site that is behind, and by how much', () => {
    const findings = judgeDeployments(twoCurrentOneStale(), AT)
    expect(findings).toHaveLength(1)
    expect(findings[0].site).toBe('voluble-rabanadas')
    expect(findings[0].severity).toBe('stale')
    expect(findings[0].detail, 'the number is what makes it actionable').toContain('11 days')
    expect(findings[0].detail).toContain('bb5d88e')
  })

  /**
   * Two hosts finishing minutes apart is normal. Reporting it would train the
   * reader to skip this check, which is how the twelve-day gap survived.
   */
  it('says nothing about deploys that merely finished at different minutes', () => {
    const findings = judgeDeployments(
      [
        { site: 'a', health: { status: 'ok', checks: [], build: { builtAt: '2026-08-27T00:41:24.507Z' } } },
        { site: 'b', health: { status: 'ok', checks: [], build: { builtAt: '2026-08-27T00:39:50.442Z' } } },
      ],
      AT,
    )
    expect(findings).toEqual([])
  })

  it('holds the line exactly where the constant says', () => {
    const newest = '2026-08-27T12:00:00.000Z'
    const behind = (hours: number) =>
      judgeDeployments(
        [
          { site: 'newest', health: { status: 'ok', checks: [], build: { builtAt: newest } } },
          {
            site: 'older',
            health: {
              status: 'ok',
              checks: [],
              build: { builtAt: new Date(Date.parse(newest) - hours * 3_600_000).toISOString() },
            },
          },
        ],
        AT,
      ).filter((f) => f.severity === 'stale')

    expect(behind(STALE_AFTER_HOURS - 1)).toEqual([])
    expect(behind(STALE_AFTER_HOURS)).toHaveLength(1)
  })
})

describe('a site that does not answer', () => {
  /**
   * Ranked above everything else: if the host is down, the configuration
   * findings from the sites that did answer are not the story.
   */
  it('outranks every other finding', () => {
    const findings = judgeDeployments(
      [
        { site: 'down', health: null, error: 'connect ETIMEDOUT' },
        {
          site: 'up',
          health: {
            status: 'unhealthy',
            checks: [{ name: 'session_secret', status: 'degraded', required: true }],
            build: { builtAt: '2026-08-27T00:41:24.507Z' },
          },
        },
      ],
      AT,
    )
    expect(findings[0].severity).toBe('unreachable')
    expect(findings[0].detail).toContain('ETIMEDOUT')
  })
})

describe('the summary tells a reader what to do next', () => {
  const f = (severity: Finding['severity'], site = 's'): Finding => ({ site, severity, detail: 'measured' })

  it('is plain when everything is configured and current', () => {
    expect(summariseDeployments([], 3)).toContain('All 3 deployments')
  })

  it('leads with the required setting, and says a redeploy is needed', () => {
    const line = summariseDeployments([f('blocking', 'zippy-gecko'), f('degraded', 'zippy-gecko')], 3)
    expect(line).toContain('zippy-gecko')
    expect(line, 'setting a variable without redeploying changes nothing').toContain('redeploy')
  })

  it('reports a stale host as the host not publishing, not as a code problem', () => {
    const line = summariseDeployments([f('stale', 'voluble-rabanadas')], 3)
    expect(line).toContain('voluble-rabanadas')
    expect(line).toContain('not publishing')
  })

  it('says an unreachable host first, whatever else was found', () => {
    expect(summariseDeployments([f('unreachable', 'down'), f('blocking', 'up')], 2)).toContain('did not answer')
  })

  it('always says something', () => {
    for (const line of [
      summariseDeployments([], 0),
      summariseDeployments([], 3),
      summariseDeployments([f('degraded')], 1),
    ]) {
      expect(line.length).toBeGreaterThan(20)
    }
  })
})
