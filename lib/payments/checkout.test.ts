import { describe, it, expect } from 'vitest'
import { buildCheckoutIntent, decideGrant, purchasablePlans, CheckoutError } from './checkout'
import { PLANS } from '../plans/plans'

describe('buildCheckoutIntent', () => {
  it('prices the payment from our plans table, not from the caller', () => {
    const intent = buildCheckoutIntent('pro')
    expect(intent.amount).toBe(PLANS.pro.price.pi)
    expect(intent.plan).toBe('pro')
    expect(intent.metadata).toEqual({ kind: 'subscription', plan: 'pro', interval: 'month' })
  })

  it('writes a memo the payer can recognise in their Pi wallet', () => {
    expect(buildCheckoutIntent('pro').memo).toMatch(/Lambda NX Pro/)
  })

  it('refuses an unknown plan rather than charging for nothing', () => {
    expect(() => buildCheckoutIntent('enterprise')).toThrow(CheckoutError)
    expect(() => buildCheckoutIntent('')).toThrow(/Unknown plan/)
  })

  it('refuses to charge for a free plan', () => {
    expect(() => buildCheckoutIntent('free')).toThrow(/nothing to pay for/)
  })
})

describe('purchasablePlans', () => {
  it('offers only plans that cost something', () => {
    const ids = purchasablePlans().map((p) => p.id)
    expect(ids).toContain('pro')
    expect(ids).not.toContain('free')
  })
})

describe('decideGrant', () => {
  const meta = { kind: 'subscription', plan: 'pro' }

  it('grants the plan on a completed payment', () => {
    const d = decideGrant({ action: 'complete', ok: true, metadata: meta })
    expect(d).toMatchObject({ grant: true, plan: 'pro' })
  })

  it('grants nothing on approval — approval is not payment', () => {
    // Granting here would hand Pro to anyone who opens checkout and walks away.
    expect(decideGrant({ action: 'approve', ok: true, metadata: meta }).grant).toBe(false)
  })

  it('grants nothing when the payment did not succeed', () => {
    expect(decideGrant({ action: 'complete', ok: false, metadata: meta }).grant).toBe(false)
  })

  it('grants nothing for an unrecognised plan instead of defaulting to one', () => {
    for (const bad of [{ plan: 'enterprise' }, { plan: 42 }, {}, undefined, null, 'nonsense']) {
      const d = decideGrant({ action: 'complete', ok: true, metadata: bad })
      expect(d.grant, JSON.stringify(bad)).toBe(false)
      expect(d.plan).toBeNull()
    }
  })

  it('never grants a free plan through payment', () => {
    expect(decideGrant({ action: 'complete', ok: true, metadata: { plan: 'free' } }).grant).toBe(false)
  })

  it('explains every refusal, so a support case is never a guess', () => {
    for (const input of [
      { action: 'approve', ok: true, metadata: meta },
      { action: 'complete', ok: false, metadata: meta },
      { action: 'complete', ok: true, metadata: { plan: 'nope' } },
    ]) {
      expect(decideGrant(input).reason.length).toBeGreaterThan(10)
    }
  })
})
