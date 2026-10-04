import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CAPABILITIES,
  PLANNED,
  enforcedCapabilities,
  unenforcedPaidCapabilities,
} from './capabilities'
import { PLAN_LIST, PLANS, type Feature } from './plans'

const APP = join(process.cwd(), 'app')

/**
 * The registry is only worth having if it cannot lie.
 *
 * `plans.ts` declared eleven features and exactly one was enforced anywhere in
 * the codebase — a fact invisible from reading it. These tests make that class
 * of drift impossible to reintroduce: an enforcement point that does not exist
 * fails here, and a capability that claims to be live without one fails here.
 */
describe('the capability registry matches the code', () => {
  it('names an enforcement route that actually exists', () => {
    for (const cap of CAPABILITIES) {
      for (const route of cap.enforcedAt) {
        const file = join(APP, route, 'route.ts')
        expect(existsSync(file), `${cap.id} claims ${route}, which has no route.ts`).toBe(true)
      }
    }
  })

  it('never marks a capability live without an enforcement point', () => {
    for (const cap of CAPABILITIES) {
      if (cap.status !== 'live') continue
      expect(cap.enforcedAt.length, `${cap.id} is live but nothing enforces it`).toBeGreaterThan(0)
    }
  })

  it('never gives an unbuilt capability an enforcement point', () => {
    for (const cap of CAPABILITIES.filter((c) => c.status === 'planned')) {
      expect(cap.enforcedAt).toEqual([])
    }
  })

  /**
   * Every feature the plan table sells must be described somewhere a buyer can
   * read, or the pricing page is selling an identifier.
   */
  it('describes every feature the plans actually reference', () => {
    const described = new Set(CAPABILITIES.map((c) => c.id))
    const sold = new Set<Feature>(PLAN_LIST.flatMap((p) => p.features))
    const undescribed = [...sold].filter((f) => !described.has(f))
    expect(undescribed).toEqual([])
  })

  it('carries no capability the plans have never heard of', () => {
    const sold = new Set<Feature>(PLAN_LIST.flatMap((p) => p.features))
    const orphans = CAPABILITIES.filter((c) => !sold.has(c.id)).map((c) => c.id)
    expect(orphans).toEqual([])
  })

  it('gives every entry a description and an argued tier', () => {
    for (const cap of CAPABILITIES) {
      expect(cap.description.length, cap.id).toBeGreaterThan(30)
      expect(cap.fieldNote.length, `${cap.id} has no evidence for its tier`).toBeGreaterThan(30)
    }
  })

  it('has no duplicate ids', () => {
    const ids = CAPABILITIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('planned capabilities stay off the price list', () => {
  it('describes each one and says what the field charges', () => {
    for (const p of PLANNED) {
      expect(p.description.length, p.name).toBeGreaterThan(30)
      expect(p.fieldNote.length, p.name).toBeGreaterThan(30)
    }
  })

  /**
   * A planned capability with a `Feature` id could be added to a plan and would
   * then be sold before it exists. Keeping the two lists structurally different
   * is what prevents that, so this asserts they have not converged.
   */
  it('carries no feature id, so it cannot be sold by accident', () => {
    for (const p of PLANNED) {
      expect(Object.prototype.hasOwnProperty.call(p, 'id')).toBe(false)
    }
  })
})

/**
 * The honest state of the product, asserted rather than described.
 *
 * These are not aspirational tests. They record what is true today so that a
 * change in either direction is visible in a diff: wiring a gate makes a number
 * move, and quietly adding a paid feature without a gate makes one move too.
 */
describe('how much of the paid tier is actually enforced', () => {
  it('has exactly one capability genuinely gated today', () => {
    const live = enforcedCapabilities()
    expect(live.map((c) => c.id)).toEqual(['ai_analyst'])
  })

  it('knows which paid capabilities nothing checks', () => {
    const gap = unenforcedPaidCapabilities().map((c) => c.id)
    // Everything the Pro tier promises except the analyst runs unguarded. This
    // is the list that has to reach zero before `ENFORCE_TIERS` means anything.
    expect(gap).toContain('calibration')
    expect(gap).toContain('monitoring')
    expect(gap).toContain('export')
    expect(gap).not.toContain('ai_analyst')
  })

  it('keeps every gateway free, which is what charter §1 requires', () => {
    const gateways = CAPABILITIES.filter((c) => c.family === 'gateways')
    expect(gateways.length).toBeGreaterThan(5)
    for (const g of gateways) {
      expect(g.minPlan, `${g.id} should be reachable without an account`).toBe('free')
    }
  })

  /**
   * The registry argues for a different split than `plans.ts` currently
   * implements. That disagreement is deliberate and documented; this test
   * exists so nobody mistakes it for an oversight, and so it shows up the day
   * someone reconciles the two.
   */
  it('records where the registry and the live plan table still disagree', () => {
    const disagreements = CAPABILITIES.filter(
      (c) => c.minPlan === 'free' && !PLANS.free.features.includes(c.id),
    ).map((c) => c.id)

    expect(disagreements.sort()).toEqual(
      ['finance', 'ownership', 'procurement'].sort(),
    )
  })
})

/**
 * Regression: the calibration entry promised "Brier and log scores and a
 * domain breakdown" while `scoreboard()` computes a weighted accuracy, by
 * author and by confidence band, and nothing else. Brier and log scores need a
 * stated probability, and our claims carry a categorical confidence grade —
 * they cannot be computed from what is stored.
 *
 * Owner decision D-03 (2026-10-04, ledger R302): the ledger is a **calibration
 * / evaluation record** of earlier forecasts and claims — ours and others' —
 * scored against what happened. It may reference a forecast; it does not issue
 * one. Batch 01 had worded the price list as "our assessments", which hid the
 * forecasts it actually scores; batch 02 restores them, as an evaluation.
 */
describe('the calibration ledger claims only what it computes', () => {
  const calibration = CAPABILITIES.find((c) => c.id === 'calibration')!
  const pricingLine = () =>
    readFileSync(join(APP, 'pricing/page.tsx'), 'utf8')
      .split('\n')
      .find((l) => l.trim().startsWith('calibration:'))

  it('promises no metric the scoreboard does not produce', () => {
    expect(calibration.description).not.toMatch(/brier|log[- ]?score|domain breakdown|topic breakdown/i)
  })

  it('names what the scoreboard actually reports', () => {
    expect(calibration.description).toMatch(/accuracy/i)
    expect(calibration.description).toMatch(/author/i)
    expect(calibration.description).toMatch(/confidence/i)
  })

  it('describes an evaluation of forecasts and claims, per D-03', () => {
    for (const text of [calibration.description, pricingLine() ?? '']) {
      expect(text, 'what is evaluated').toMatch(/forecasts? and claims?/i)
      expect(text, 'that it is an evaluation').toMatch(/scored against/i)
    }
  })

  it('never presents the ledger as issuing forecasts', () => {
    for (const text of [calibration.description, pricingLine() ?? '']) {
      expect(text).not.toMatch(/\b(our forecasts|we forecast|predicts?)\b/i)
    }
  })
})
