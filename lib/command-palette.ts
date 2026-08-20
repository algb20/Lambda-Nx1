/**
 * What ⌘K can reach, and how a typed query finds it.
 *
 * ## Why a command palette rather than more navigation
 *
 * The product has five tabs and twenty-seven gateways. Navigation surfaces can
 * hold the five; the twenty-seven live behind a picker inside one of them, and
 * reaching `space-weather` from the feed is currently three deliberate clicks
 * through a hierarchy the user must already understand.
 *
 * A palette collapses that to one keystroke and a few letters, and — the part
 * that matters more — it means **a new gateway is instantly reachable without
 * finding it a home in the navigation.** Every serious platform in the
 * 2026-08-20 field survey has one, and it is the cheapest professionalism in
 * the interface.
 *
 * ## The matching, and why not fuzzy
 *
 * Prefix and word-boundary matching, ranked. Deliberately *not* the fuzzy
 * subsequence match most palettes use: fuzzy matching makes "sea" find
 * "**s**pac**e**-we**a**ther", which is a result the user cannot explain and
 * therefore cannot trust. In a product whose whole argument is that a reader
 * should be able to check what it did, an unexplainable ranking is off-brand
 * in a way that a slightly less clever one is not.
 *
 * Kept free of React so the ranking is testable without a DOM.
 */

export interface Command {
  id: string
  /** What the user reads. */
  label: string
  /** Where it goes, in the reader's terms. */
  hint: string
  /** Grouping in the list. */
  group: 'Go to' | 'Gateways' | 'Tools'
  /** Extra words that should find it, beyond its own label. */
  keywords?: string[]
  /** Tab to switch to, for navigation commands. */
  tab?: string
  /** Gateway to open, for gateway commands. */
  gateway?: string
  /** Absolute path, for commands that leave the tab shell. */
  href?: string
}

export interface RankedCommand extends Command {
  score: number
  /** Which token produced the match, so the list can say why it is there. */
  matched: string
}

/** Lowercase, strip punctuation, split into words. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/[\s-]+/)
    .filter(Boolean)
}

/**
 * Score one command against a query.
 *
 * Higher is better; `null` means no match at all. The bands are wide apart on
 * purpose, so an exact label match can never be displaced by a keyword hit on
 * something else — the commonest way a palette surprises its user.
 */
export function scoreCommand(command: Command, query: string): RankedCommand | null {
  const q = query.trim().toLowerCase()
  if (!q) return { ...command, score: 0, matched: '' }

  const label = command.label.toLowerCase()
  if (label === q) return { ...command, score: 1000, matched: command.label }
  if (label.startsWith(q)) return { ...command, score: 800 - label.length, matched: command.label }

  // A word inside the label starting with the query: "weather" finds
  // "Space weather", which a user expects and a prefix-only match would miss.
  const labelWords = words(command.label)
  if (labelWords.some((w) => w.startsWith(q))) {
    return { ...command, score: 600 - label.length, matched: command.label }
  }

  for (const keyword of command.keywords ?? []) {
    const k = keyword.toLowerCase()
    if (k === q) return { ...command, score: 500, matched: keyword }
    if (k.startsWith(q)) return { ...command, score: 400 - k.length, matched: keyword }
    if (words(keyword).some((w) => w.startsWith(q))) {
      return { ...command, score: 300 - k.length, matched: keyword }
    }
  }

  // Last resort: the query appears inside the label. Ranked below every
  // boundary match, because "ate" finding "Sta**te**ments" is technically a hit
  // and rarely what was meant.
  if (label.includes(q)) return { ...command, score: 100 - label.length, matched: command.label }

  return null
}

/**
 * Rank the commands for a query.
 *
 * With an empty query this returns everything in its declared order rather than
 * nothing — an empty palette is a dead end, and the declared order is a usable
 * menu of what the product can do.
 */
export function rankCommands(commands: Command[], query: string, limit = 12): RankedCommand[] {
  const hits: RankedCommand[] = []
  for (const command of commands) {
    const hit = scoreCommand(command, query)
    if (hit) hits.push(hit)
  }
  if (!query.trim()) return hits.slice(0, limit)
  return hits.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).slice(0, limit)
}

/**
 * Move a selection through a list that wraps.
 *
 * Wrapping rather than stopping: a palette is a short cycle, and arrowing off
 * the end to find nothing happens is a small friction the user pays every time.
 */
export function moveSelection(current: number, delta: number, length: number): number {
  if (length <= 0) return 0
  return (((current + delta) % length) + length) % length
}

/**
 * Build the command list from the product's own registries.
 *
 * Takes them as arguments rather than importing, so this module stays free of
 * the gateway registry — and therefore free of anything the registry drags in.
 */
export function buildCommands(input: {
  tabs: ReadonlyArray<{ id: string; label: string; description: string }>
  gateways: ReadonlyArray<{ id: string; label: string }>
}): Command[] {
  const commands: Command[] = input.tabs.map((tab) => ({
    id: `tab:${tab.id}`,
    label: tab.label,
    hint: tab.description,
    group: 'Go to',
    keywords: [tab.id],
    tab: tab.id,
  }))

  for (const gateway of input.gateways) {
    commands.push({
      id: `gateway:${gateway.id}`,
      label: gateway.label,
      hint: 'Open this gateway',
      group: 'Gateways',
      keywords: [gateway.id],
      gateway: gateway.id,
    })
  }

  commands.push(
    {
      id: 'tool:setup',
      label: 'Check this deployment',
      hint: 'Diagnose why a copy is empty — server, network or database',
      group: 'Tools',
      keywords: ['setup', 'diagnose', 'broken', 'empty', 'health'],
      href: '/setup',
    },
    {
      id: 'tool:api',
      label: 'API documentation',
      hint: 'Every endpoint, what it returns and what it costs',
      group: 'Tools',
      keywords: ['api', 'docs', 'endpoints', 'developers', 'mcp'],
      href: '/docs/api',
    },
    {
      id: 'tool:pricing',
      label: 'Plans and pricing',
      hint: 'What is free, and what a paid plan adds',
      group: 'Tools',
      keywords: ['pricing', 'plans', 'upgrade', 'subscription', 'pi'],
      href: '/pricing',
    },
  )

  return commands
}
