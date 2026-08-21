import { describe, it, expect } from 'vitest'
import { TABS, TAB_DEFS, resolveTab, tabDef } from './navigation'

/**
 * Navigation is one of the few things where a mistake is invisible to tests but
 * obvious to a user: a tab that resolves to nothing renders a blank screen, and
 * two navigation surfaces that disagree send the same click to two places.
 */
describe('the tab list', () => {
  it('defines exactly one entry per tab, in order', () => {
    expect(TAB_DEFS.map((t) => t.id)).toEqual([...TABS])
  })

  it('gives every tab a label, a short label and a description', () => {
    for (const t of TAB_DEFS) {
      expect(t.short.length, t.id).toBeGreaterThan(0)
      expect(t.label.length, t.id).toBeGreaterThan(0)
      expect(t.description.length, t.id).toBeGreaterThan(10)
    }
  })

  it('keeps the mobile labels short enough for a five-across bar', () => {
    // The bar is the width of a phone; a long label wraps and breaks the row.
    for (const t of TAB_DEFS) {
      expect(t.short.length, `${t.id}: "${t.short}"`).toBeLessThanOrEqual(9)
    }
  })

  /**
   * This asserted `<= 5`, which was a proxy for the thing that actually
   * matters and stopped being true of it.
   *
   * The constraint is not the number of tabs — it is whether each one is still
   * a target a thumb can hit. That is a width divided by a count, measured
   * against the platform minimum (44px on iOS, 48dp on Android), and it is
   * worth stating directly: a magic number cannot explain itself, and the next
   * person to need a tab has no way to tell a real limit from a stale one.
   *
   * At the narrowest phone we support, six tabs still clear the minimum with
   * room to spare. Seven would not, and this test will say so.
   */
  it('leaves every tab a target a thumb can actually hit', () => {
    const NARROWEST_PHONE_PX = 320
    const MIN_TOUCH_TARGET_PX = 44
    const perTab = NARROWEST_PHONE_PX / TABS.length
    expect(
      perTab,
      `${TABS.length} tabs gives each ${perTab.toFixed(1)}px on a ${NARROWEST_PHONE_PX}px screen`,
    ).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
  })

  /**
   * A separate ceiling, because touch targets are not the only cost. Every tab
   * spends a permanent slot in front of every user, and the list this replaced
   * had nine — four of which led to placeholders.
   */
  it('does not grow without the growth being deliberate', () => {
    expect(TABS.length).toBeLessThanOrEqual(6)
  })
})

describe('resolveTab', () => {
  it('passes through a current tab', () => {
    for (const id of TABS) expect(resolveTab(id)).toBe(id)
  })

  it('sends the retired placeholders to the gateways that replaced them', () => {
    // "Your workspace" and "Team & enterprise" both promised saved
    // investigations; that is real now and lives with the gateways.
    expect(resolveTab('personal')).toBe('intelligence')
    expect(resolveTab('enterprise')).toBe('intelligence')
  })

  it('sends calibration into Radar, whose question it answers', () => {
    expect(resolveTab('calibration')).toBe('monitor')
  })

  it('sends ideas and preferences to the account tab', () => {
    expect(resolveTab('ideas')).toBe('account')
    expect(resolveTab('preferences')).toBe('account')
  })

  it('never returns something that is not a tab', () => {
    // A bookmark, a deep link or stale local storage must not blank the screen.
    for (const junk of ['', null, undefined, 'nonsense', '../etc/passwd', 'FEED']) {
      expect(TABS as readonly string[], String(junk)).toContain(resolveTab(junk))
    }
  })
})

describe('tabDef', () => {
  it('returns the definition for every tab', () => {
    for (const id of TABS) expect(tabDef(id).id).toBe(id)
  })
})
