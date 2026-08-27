import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * One tab's code arrives when that tab does.
 *
 * ## The regression this guards
 *
 * Every panel used to be a static import in the shell, so webpack put the whole
 * product in one chunk and every route downloaded all of it. Measured in a
 * phone-sized Chromium against the production build: **1,032 kB of JavaScript
 * decoded on every route** — `/pricing` included, a page that is a price list
 * and was carrying the globe, the country atlas, five dashboards and the
 * gateway console. After the split, the map route decodes 726 kB and the other
 * tabs 544–576 kB.
 *
 * It is asserted on the source rather than on a bundle report for the reason
 * that makes this class of regression dangerous: adding `import { X } from
 * '@/components/x'` to the shell compiles, renders, passes every other test and
 * is invisible in review. Nothing about the running app says the phone is now
 * downloading a panel nobody opened.
 *
 * The rule is only about *panels* — a tab's whole screen. Shell chrome that is
 * on screen from the first frame (the header, the navigation, the error
 * boundary) is meant to be in the first chunk and stays a static import.
 */

const SHELL = readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8')

/** The five tabs' panels, plus the two heaviest pieces of the map tab. */
const PANELS = [
  'home-feed',
  'intelligence-dashboard',
  'monitor-dashboard',
  'calibration-scoreboard',
  'markets-panel',
  'user-preferences',
  'globe-workspace',
  'live-columns',
  // Never renders below 1280px, so on a phone a static import is pure download.
  'context-rail',
]

describe('the shell loads one tab, not five', () => {
  it.each(PANELS)('%s is not a static import', (module) => {
    expect(
      SHELL,
      `${module} is statically imported by the shell, so every route downloads it — put it behind next/dynamic (see the note at the top of app/page.tsx)`,
    ).not.toMatch(new RegExp(`^import .*from ["']@/components/${module}["']`, 'm'))
  })

  it.each(PANELS)('%s is loaded on demand', (module) => {
    expect(
      SHELL,
      `${module} is neither statically imported nor dynamically loaded — did it lose its panel?`,
    ).toMatch(new RegExp(`dynamic\\(\\s*\\(\\)\\s*=>\\s*import\\(["']@/components/${module}["']`))
  })

  /**
   * Server rendering stays on for the panels.
   *
   * Each tab is prerendered at its own URL, and that is what makes a deep link
   * paint on the first frame and a crawler see the product rather than a
   * spinner — the thing `app/[tab]/page.tsx` exists for. `ssr: false` on a
   * panel would hand all of it back silently.
   *
   * The rail is the deliberate exception: it renders null below 1280px and has
   * no server output to preserve.
   */
  it('keeps the panels server-rendered', () => {
    // Comment lines are dropped first: the prose above the rail explains why it
    // is the exception, and a test that reads its own documentation as code
    // would fail on the sentence describing the thing it is checking.
    const code = SHELL.split('\n')
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join('\n')
    const optedOut = code
      .split(/const (?=\w+ = dynamic\()/)
      .filter((block) => /ssr:\s*false/.test(block))
      .map((block) => block.slice(0, block.indexOf(' ')))

    expect(
      optedOut,
      'a panel with ssr: false stops being prerendered, so its tab URL serves a spinner to readers and to crawlers alike',
    ).toEqual(['ContextRail'])
  })
})
