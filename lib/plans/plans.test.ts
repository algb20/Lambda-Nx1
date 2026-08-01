import { describe, it, expect } from 'vitest'
import { PLANS, getPlan, planHasFeature, requireTier } from './plans'

describe('plans config', () => {
  it('free unlocks core gateways; pro unlocks everything', () => {
    expect(planHasFeature('free', 'core_osint')).toBe(true)
    expect(planHasFeature('free', 'ai_analyst')).toBe(false)
    expect(planHasFeature('pro', 'ai_analyst')).toBe(true)
    expect(planHasFeature('pro', 'finance')).toBe(true)
  })

  it('getPlan falls back to free for unknown ids', () => {
    expect(getPlan('nonsense').id).toBe('free')
    expect(getPlan(null).id).toBe('free')
    expect(getPlan('pro').id).toBe('pro')
  })

  it('prices are numbers (env-overridable) and free is zero', () => {
    expect(PLANS.free.price.pi).toBe(0)
    expect(typeof PLANS.pro.price.pi).toBe('number')
    expect(typeof PLANS.pro.price.usd).toBe('number')
  })
})

describe('requireTier', () => {
  it('passes when the plan has the feature', () => {
    expect(requireTier('pro', 'ai_analyst')).toEqual({ ok: true })
    expect(requireTier('free', 'core_osint')).toEqual({ ok: true })
  })

  it('names the upgrade plan when it does not', () => {
    expect(requireTier('free', 'ai_analyst')).toEqual({ ok: false, upgradeTo: 'pro' })
    expect(requireTier('free', 'finance')).toEqual({ ok: false, upgradeTo: 'pro' })
  })
})
