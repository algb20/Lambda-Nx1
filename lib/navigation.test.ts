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

  it('stays small enough that every tab is reachable with one thumb', () => {
    // The nine-tab bar is what this list replaced.
    expect(TABS.length).toBeLessThanOrEqual(5)
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
