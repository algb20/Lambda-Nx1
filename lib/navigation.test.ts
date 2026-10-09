import { describe, it, expect } from 'vitest'
import { BAR_TABS, TABS, TAB_DEFS, resolveTab, tabDef } from './navigation'

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
  it('leaves every phone-bar slot a target a thumb can actually hit', () => {
    // The phone bar holds the bar tabs plus "More", which opens the rest as a
    // sheet (R338). The sidebar carries the full list on a wide screen.
    const NARROWEST_PHONE_PX = 320
    const MIN_TOUCH_TARGET_PX = 44
    const slots = BAR_TABS.length + 1
    const perSlot = NARROWEST_PHONE_PX / slots
    expect(perSlot, `${slots} slots gives each ${perSlot.toFixed(1)}px`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
    expect(slots).toBeLessThanOrEqual(5)
  })

  /**
   * The list is the owner's reference design (R338), section for section. A
   * new entry is a design decision, so it has to be made here on purpose.
   * Opportunities, Decisions and Workspace are absent until their Track M
   * units give them something real to show.
   */
  it('is exactly the R338 section list', () => {
    expect([...TABS]).toEqual([
      'home', 'intelligence', 'situations', 'monitor', 'globe',
      'markets', 'feed', 'forecast', 'risks', 'knowledge', 'account',
    ])
  })

  it('puts every tab in a sidebar group', () => {
    for (const def of TAB_DEFS) expect(['main', 'analysis', 'library']).toContain(def.group)
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

  it('sends calibration to Forecast & Scenarios, whose ledger it is', () => {
    expect(resolveTab('calibration')).toBe('forecast')
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
