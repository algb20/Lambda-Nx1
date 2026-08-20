// Counted, never written down. The description said "sixteen" while the
// product shipped twenty-six, which is the kind of small lie that makes a
// reader distrust every other number on the page.
import { ALL_MODES } from './gateways'

/**
 * The application's tabs — one definition, used by every navigation surface.
 *
 * ## Why there are five and not nine
 *
 * The shell had grown to nine tabs, and four of them did not earn a place in
 * a navigation bar:
 *
 *  - **Your workspace** and **Team & enterprise** were both empty placeholders.
 *    Two of the nine destinations rendered a "coming soon" card. A tab that
 *    leads nowhere is worse than a missing feature: it spends the scarcest
 *    thing the interface has — a permanent slot in front of every user — to
 *    deliver an apology. What they promised (saved investigations) is real
 *    now and lives with the gateways that produce it.
 *  - **Ideas** duplicated the floating feedback button, which is on every
 *    screen already. Two doors onto one room, one of them costing a tab.
 *  - **Calibration** is a real feature, but it answers a Radar question — how
 *    well did our monitoring call things — so it belongs inside Radar rather
 *    than beside it.
 *
 * What remains is one tab per question a user actually arrives with: what is
 * happening, where, what can I investigate, what is being watched for me, and
 * who am I. Nothing real was removed; three things moved to where they belong
 * and two apologies were deleted.
 *
 * Keeping this list in one module is what makes the desktop sidebar and the
 * mobile bar impossible to disagree with each other.
 */
export const TABS = ['feed', 'globe', 'intelligence', 'monitor', 'account'] as const

export type Tab = (typeof TABS)[number]

export interface TabDef {
  id: Tab
  /** Short label for the mobile bar, where horizontal room is the constraint. */
  short: string
  /** Full label for the desktop sidebar and the error boundary's message. */
  label: string
  /** One line explaining the destination — the desktop rail has room for it. */
  description: string
  /** i18n key, so a translated shell stays in step with this list. */
  i18nKey: string
}

export const TAB_DEFS: readonly TabDef[] = [
  {
    id: 'feed',
    short: 'Feed',
    label: 'The feed',
    description: 'Published research, signals and what is happening now',
    i18nKey: 'nav.feed',
  },
  {
    id: 'globe',
    short: 'World',
    label: 'The world map',
    description: 'The standing brief, and live events on the globe with the agency that measured each',
    i18nKey: 'nav.globe',
  },
  {
    id: 'intelligence',
    short: 'Gateways',
    label: 'The intelligence gateways',
    description: `Run an investigation across ${ALL_MODES.length} passive gateways`,
    i18nKey: 'nav.intelligence',
  },
  {
    id: 'monitor',
    short: 'Radar',
    label: 'Radar monitoring',
    description: 'What is being watched for you, and how well it has called things',
    i18nKey: 'nav.monitor',
  },
  {
    id: 'account',
    short: 'You',
    label: 'Your account',
    description: 'Profile, plan, groups, ideas and settings',
    i18nKey: 'nav.preferences',
  },
]

/** Legacy tab ids kept working, so an old link or saved state still lands somewhere sane. */
const MOVED: Record<string, Tab> = {
  // The two placeholders. Saved investigations live with the gateways now.
  personal: 'intelligence',
  enterprise: 'intelligence',
  // Calibration answers a Radar question.
  calibration: 'monitor',
  // Ideas is in the account panel, and on every screen via the floating button.
  ideas: 'account',
  // Renamed.
  preferences: 'account',
}

/**
 * Resolve any tab id — current or retired — to a tab that exists.
 *
 * Retired ids are redirected rather than rejected: a bookmark, a deep link or a
 * value left in local storage from an older build must not land the user on a
 * blank screen.
 */
export function resolveTab(id: string | null | undefined): Tab {
  if (!id) return 'feed'
  if ((TABS as readonly string[]).includes(id)) return id as Tab
  return MOVED[id] ?? 'feed'
}

export function tabDef(id: Tab): TabDef {
  return TAB_DEFS.find((t) => t.id === id) ?? TAB_DEFS[0]
}
