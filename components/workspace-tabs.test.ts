import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The globe page as workspaces, held in place.
 *
 * The measurements this file protects: 11,439px of stacked panels became
 * 8,989px once everything empty collapsed, and only stopped being a column at
 * all once the four jobs on it became four tabs. All three of the rules below
 * are ways that could silently come undone.
 */

const read = (file: string) =>
  readFileSync(join(process.cwd(), file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')

describe('the globe tab is four workspaces, not one column', () => {
  const workspace = read('components/globe-workspace.tsx')

  it('offers the map, the brief, the countries and the categories', () => {
    for (const id of ['map', 'brief', 'countries', 'categories']) {
      expect(workspace, `the ${id} workspace is missing`).toContain(`id: '${id}'`)
    }
  })

  /**
   * The map is what a reader opening a globe came for. If it ever stops being
   * the first workspace, the default view of a map product is not a map.
   */
  it('opens on the map', () => {
    const first = workspace.indexOf("id: 'map'")
    for (const id of ['brief', 'countries', 'categories']) {
      expect(first).toBeLessThan(workspace.indexOf(`id: '${id}'`))
    }
  })

  /**
   * The panels used to hang off the bottom of the globe component, which is
   * how the column got that long in the first place. Rendering them there
   * again would restore the stack while the tabs were still on screen — the
   * worst of both.
   */
  it('the globe component no longer renders the other three panels', () => {
    const globe = read('components/globe-view.tsx')
    expect(globe).not.toContain('<CategoryPanels')
    expect(globe).not.toContain('<CountryDossier')
    expect(globe).not.toContain('<StandingBriefPanel')
  })

  /**
   * One world picture, four views of it. A panel that fetched its own would
   * show a different world from the globe beside it, and the tab counts would
   * stop matching what opening the tab reveals.
   */
  it('reads the shared world store rather than fetching again', () => {
    expect(workspace).toContain('useWorldReport')
    expect(workspace).not.toMatch(/fetch\(/)
  })
})

describe('the chosen workspace survives a reload', () => {
  const tabs = read('components/workspace-tabs.tsx')

  /**
   * This page reloads itself on a timer. A tab strip holding its state only in
   * memory loses the reader's place every time the world sweep lands.
   */
  it('carries the choice in the address', () => {
    expect(tabs).toContain('location.hash')
    expect(tabs).toContain('hashchange')
  })

  /**
   * `replaceState`, not `pushState`: four taps to compare four workspaces must
   * not become four presses of back to leave the page.
   */
  it('does not fill the history with tab taps', () => {
    expect(tabs).toContain('replaceState')
    expect(tabs).not.toContain('pushState')
  })

  /**
   * The server has no address bar. Reading the hash during render makes the
   * two sides disagree about which panel exists, and React answers a mismatch
   * by throwing the server HTML away and rebuilding the document — a bug this
   * codebase has already paid for twice.
   */
  it('reads the address after mount, never during render', () => {
    const initialiser = tabs.slice(tabs.indexOf('useState('), tabs.indexOf('useState(') + 80)
    expect(initialiser).not.toContain('fromHash')
    expect(tabs).toMatch(/useEffect\(\(\) => \{[\s\S]{0,200}fromHash/)
  })
})
