import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SUBSCRIPTION_VISIBLE, TIERS_ENFORCED, PLAN_LIST } from './plans'

/**
 * Subscriptions are hidden while the pricing is decided (R273) — hidden, not
 * removed. These hold both halves of that: nothing offers a price on screen,
 * and everything behind it still exists and still works the day it returns.
 */
describe('the subscription surface is out of sight', () => {
  it('is hidden unless a deployment explicitly turns it on', () => {
    expect(SUBSCRIPTION_VISIBLE, 'showing a price is an opt-in, not a default').toBe(false)
  })

  /**
   * Two flags, deliberately. Enforcement answers "does the free plan stop at
   * twenty investigations"; visibility answers "does a visitor see a price".
   * Collapsing them would have left the panel on screen with nothing enforced —
   * inviting payment for something every visitor already has.
   */
  it('is a separate decision from whether tiers are enforced', () => {
    const source = readFileSync(join(process.cwd(), 'lib/plans/plans.ts'), 'utf8')
    expect(source).toContain('NEXT_PUBLIC_SHOW_SUBSCRIPTION')
    expect(source).toContain('ENFORCE_TIERS')
    expect(TIERS_ENFORCED).toBe(false)
  })

  /** Every surface that offers a price has to consult the flag, not its caller. */
  it('is checked by each surface that shows a price', () => {
    for (const file of [
      'components/upgrade-panel.tsx',
      'components/header.tsx',
      'components/user-preferences.tsx',
    ]) {
      expect(
        readFileSync(join(process.cwd(), file), 'utf8'),
        `${file} can show a price without asking whether prices are shown`,
      ).toContain('SUBSCRIPTION_VISIBLE')
    }
  })

  /**
   * The plans, prices and payment flow stay whole. Hiding a feature by deleting
   * it is how a feature comes back as a rewrite rather than as a variable.
   */
  it('leaves the plans themselves intact and priced', () => {
    expect(PLAN_LIST.map((p) => p.id)).toEqual(['free', 'pro'])
    const pro = PLAN_LIST.find((p) => p.id === 'pro')
    expect(pro?.price.pi).toBeGreaterThan(0)
    expect(pro?.price.usd).toBeGreaterThan(0)
  })
})
