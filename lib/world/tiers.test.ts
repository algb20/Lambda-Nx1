import { describe, expect, it } from 'vitest'
import { tierCounts, tierOf } from './tiers'

describe('severity tiers come from the source, then the measurement (R338)', () => {
  it('lets an agency alert level decide first', () => {
    expect(tierOf({ alertLevel: 'Red', severity: 0.1 })).toBe('critical')
    expect(tierOf({ alertLevel: 'Extreme', severity: 0 })).toBe('critical')
    expect(tierOf({ alertLevel: 'Orange', severity: 0.95 })).toBe('significant')
    expect(tierOf({ alertLevel: 'Severe', severity: 0 })).toBe('significant')
  })

  it('falls back to the graded severity', () => {
    expect(tierOf({ alertLevel: null, severity: 0.85 })).toBe('critical')
    expect(tierOf({ alertLevel: null, severity: 0.84 })).toBe('significant')
    expect(tierOf({ alertLevel: null, severity: 0.6 })).toBe('significant')
    expect(tierOf({ alertLevel: null, severity: 0.59 })).toBe('watch')
  })

  it('never promotes an ungraded event', () => {
    expect(tierOf({ alertLevel: null, severity: 0 })).toBe('watch')
    expect(tierOf({ alertLevel: 'Green', severity: 0 })).toBe('watch')
  })

  it('counts each tier', () => {
    expect(tierCounts([{ alertLevel: 'Red', severity: 0 }, { alertLevel: null, severity: 0.7 }, { alertLevel: null, severity: 0 }])).toEqual({
      critical: 1,
      significant: 1,
      watch: 1,
    })
  })
})
