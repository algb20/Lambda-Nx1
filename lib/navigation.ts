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
/**
 * `markets` was added as a sixth, and it had to earn the slot against the rule
 * stated above: a tab must answer a question a user arrives with, and must lead
 * to something real rather than to an apology.
 *
 * It does both. "What are prices and markets doing" is not a rephrasing of any
 * of the other five, and the destination was already fully populated — four
 * chains with height, fees, congestion and throughput; capitalisation and
 * dominance; movers with prices; twenty-five exchanges with volumes and
 * jurisdictions. All of it was being computed and then thrown away, because the
 * only consumer was a map layer that wanted the coordinates. The owner's
 * verdict was exactly right: no coins, no chains, no exchanges, nothing.
 *
 * Placed after `globe` because it is the same act — reading the world — over a
 * different surface.
 */
/**
 * The order, and why the globe sits in the middle of it.
 *
 * The globe is what this product is *for* — the live world with the agency that
 * measured each thing on it — and it was third of six, reached by a tap that
 * looked like any other. The owner asked for it centred, marked out from the
 * rest, and open on arrival, and that is the right instinct: the centre slot of
 * a bar is the one a thumb reaches without moving the hand, and every app that
 * has a single defining surface puts it there.
 *
 * So: two tabs, the globe, two tabs — a real centre, not an approximate one —
 * with `account` lifted out of the bar entirely and into the header, where
 * accounts live in every application anyone has used.
 */
/**
 * R338 (2026-10-09): the owner rejected the five-tab shell and gave a reference
 * design — a sidebar of named sections with Home first. The reasoning above is
 * kept as history; the rule it served still holds, and every entry below leads
 * to something real. Sections the reference shows that have no source yet
 * (Opportunities, Decisions, Workspace) are not listed until their Track M unit
 * makes them real (docs/reconciliation/BUILD_PLAN_R338.md).
 */
export const TABS = [
  'home',
  'intelligence',
  'situations',
  'monitor',
  'globe',
  'markets',
  'feed',
  'forecast',
  'risks',
  'knowledge',
  'account',
] as const

/** Where the product opens: the dashboard, as in the reference design. */
export const HOME_TAB: Tab = 'home'

/**
 * The phone bar: three destinations and "More", as in the reference phone
 * layout. Everything else is one tap away in the "More" sheet.
 */
export const BAR_TABS: readonly Tab[] = ['home', 'intelligence', 'globe']

export type Tab = (typeof TABS)[number]

/** Sidebar grouping, in reading order. */
export type NavGroup = 'main' | 'analysis' | 'library'

export interface TabDef {
  id: Tab
  /** Short label for the phone bar, where horizontal room is the constraint. */
  short: string
  /** Full label for the sidebar and the error boundary's message. */
  label: string
  /** One line explaining the destination. */
  description: string
  /** i18n key, so a translated shell stays in step with this list. */
  i18nKey: string
  group: NavGroup
}

export const TAB_DEFS: readonly TabDef[] = [
  { id: 'home', short: 'Home', label: 'Home', description: 'The world at a glance: situations, alerts, indicators and source health', i18nKey: 'nav.home', group: 'main' },
  { id: 'intelligence', short: 'Intel', label: 'Global Intelligence', description: `Run an investigation across ${ALL_MODES.length} passive gateways`, i18nKey: 'nav.intelligence', group: 'main' },
  { id: 'situations', short: 'Alerts', label: 'Situations & Alerts', description: 'Live events by severity, corroboration and region', i18nKey: 'nav.situations', group: 'main' },
  { id: 'monitor', short: 'Watch', label: 'Monitoring & Watchlist', description: 'What is being watched for you, and what changed', i18nKey: 'nav.monitor', group: 'main' },
  { id: 'globe', short: 'Maps', label: 'Maps & Geospatial', description: 'The live world on a map and a globe, with the agency that measured each event', i18nKey: 'nav.globe', group: 'main' },
  { id: 'markets', short: 'Data', label: 'Data & Analytics', description: 'Prices, chains, exchanges and the flows behind them', i18nKey: 'nav.markets', group: 'analysis' },
  { id: 'feed', short: 'Research', label: 'Research', description: 'Published research, signals and what is happening now', i18nKey: 'nav.feed', group: 'analysis' },
  { id: 'forecast', short: 'Forecast', label: 'Forecast & Scenarios', description: 'Forward-looking claims and how well they were called', i18nKey: 'nav.forecast', group: 'analysis' },
  { id: 'risks', short: 'Risks', label: 'Risks', description: 'Country pictures built from the events, sources and gaps behind them', i18nKey: 'nav.risks', group: 'analysis' },
  { id: 'knowledge', short: 'Library', label: 'Knowledge Base', description: 'What the radar has found and kept, with its sources', i18nKey: 'nav.knowledge', group: 'library' },
  { id: 'account', short: 'You', label: 'Settings', description: 'Profile, plan, language, theme and account', i18nKey: 'nav.preferences', group: 'library' },
]

/** Legacy tab ids kept working, so an old link or saved state still lands somewhere sane. */
const MOVED: Record<string, Tab> = {
  // The two placeholders. Saved investigations live with the gateways now.
  personal: 'intelligence',
  enterprise: 'intelligence',
  // Calibration is the evaluation of forward-looking claims (R338).
  calibration: 'forecast',
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
  if (!id) return HOME_TAB
  if ((TABS as readonly string[]).includes(id)) return id as Tab
  return MOVED[id] ?? HOME_TAB
}

/** The path a tab lives at. The home tab owns `/`; everything else owns its id. */
export function pathForTab(id: Tab): string {
  return id === HOME_TAB ? '/' : `/${id}`
}

export function tabDef(id: Tab): TabDef {
  return TAB_DEFS.find((t) => t.id === id) ?? TAB_DEFS[0]
}
