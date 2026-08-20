import { describe, expect, it } from 'vitest'
import { buildCommands, moveSelection, rankCommands, scoreCommand, type Command } from './command-palette'

const commands = buildCommands({
  tabs: [
    { id: 'feed', label: 'Feed', description: 'Published research and what is happening now' },
    { id: 'globe', label: 'Globe', description: 'The standing brief and live events' },
    { id: 'intelligence', label: 'Investigate', description: 'Run an investigation' },
  ],
  gateways: [
    { id: 'space-weather', label: 'Space weather' },
    { id: 'statements', label: 'Statements' },
    { id: 'domain', label: 'Domain' },
    { id: 'threat', label: 'Threat' },
  ],
})

const find = (query: string, n = 1) => rankCommands(commands, query).slice(0, n).map((c) => c.label)

describe('finding a command by typing', () => {
  it('puts an exact label first', () => {
    expect(find('domain')[0]).toBe('Domain')
    expect(find('globe')[0]).toBe('Globe')
  })

  it('matches a prefix', () => {
    expect(find('stat')[0]).toBe('Statements')
    expect(find('thr')[0]).toBe('Threat')
  })

  /** A prefix-only match would miss this, and the user expects it to work. */
  it('matches a word inside the label, not only its start', () => {
    expect(find('weather')[0]).toBe('Space weather')
  })

  it('finds a gateway by its id when the label differs', () => {
    expect(find('space-weather')[0]).toBe('Space weather')
  })

  it('finds a tool by a word describing the problem, not its title', () => {
    expect(find('broken')[0]).toBe('Check this deployment')
    expect(find('mcp')[0]).toBe('API documentation')
  })

  /**
   * Fuzzy subsequence matching would make "sea" find "**s**pac**e**-we**a**ther".
   * In a product whose argument is that a reader can check what it did, a
   * ranking nobody can explain is worse than one that is slightly less clever.
   */
  it('does not match a scattered subsequence', () => {
    const hits = rankCommands(commands, 'sea')
    expect(hits.map((h) => h.label)).not.toContain('Space weather')
  })

  it('returns nothing for a query that matches nothing', () => {
    expect(rankCommands(commands, 'zzzzqqq')).toEqual([])
  })

  it('ignores case and surrounding space', () => {
    expect(find('  DOMAIN  ')[0]).toBe('Domain')
  })
})

describe('the order the list comes back in', () => {
  /** The commonest way a palette surprises its user. */
  it('never lets a keyword hit displace an exact label match', () => {
    const rigged: Command[] = [
      { id: 'a', label: 'Something else', hint: '', group: 'Tools', keywords: ['domain'] },
      { id: 'b', label: 'Domain', hint: '', group: 'Gateways' },
    ]
    expect(rankCommands(rigged, 'domain')[0].label).toBe('Domain')
  })

  it('prefers the shorter label when two match equally well', () => {
    const rigged: Command[] = [
      { id: 'a', label: 'Stat', hint: '', group: 'Tools' },
      { id: 'b', label: 'Statements and things', hint: '', group: 'Tools' },
    ]
    expect(rankCommands(rigged, 'sta')[0].label).toBe('Stat')
  })

  it('breaks a true tie alphabetically rather than by input order', () => {
    const rigged: Command[] = [
      { id: 'b', label: 'Beta', hint: '', group: 'Tools' },
      { id: 'a', label: 'Alfa', hint: '', group: 'Tools' },
    ]
    expect(rankCommands(rigged, 'a').map((c) => c.label)).toEqual(['Alfa', 'Beta'])
  })

  it('says which token produced the match, so the result is explainable', () => {
    expect(rankCommands(commands, 'broken')[0].matched).toBe('broken')
    expect(rankCommands(commands, 'domain')[0].matched).toBe('Domain')
  })

  it('honours the limit', () => {
    expect(rankCommands(commands, '', 3)).toHaveLength(3)
  })
})

/** An empty palette is a dead end; the declared order is a usable menu. */
describe('the empty query', () => {
  it('shows everything rather than nothing', () => {
    expect(rankCommands(commands, '').length).toBeGreaterThan(0)
  })

  it('keeps the declared order, so the first thing shown is the first tab', () => {
    expect(rankCommands(commands, '')[0].label).toBe('Feed')
  })
})

describe('what the palette is built from', () => {
  it('offers every tab and every gateway it was given', () => {
    expect(commands.filter((c) => c.tab)).toHaveLength(3)
    expect(commands.filter((c) => c.gateway)).toHaveLength(4)
  })

  it('gives every command a distinct id', () => {
    expect(new Set(commands.map((c) => c.id)).size).toBe(commands.length)
  })

  it('gives every command something to do', () => {
    for (const c of commands) {
      expect(Boolean(c.tab || c.gateway || c.href), c.label).toBe(true)
    }
  })

  it('gives every command a hint, so no row is a bare word', () => {
    for (const c of commands) expect(c.hint.length, c.label).toBeGreaterThan(0)
  })
})

describe('moving through the list', () => {
  it('wraps at both ends rather than stopping', () => {
    expect(moveSelection(0, -1, 5)).toBe(4)
    expect(moveSelection(4, 1, 5)).toBe(0)
  })

  it('steps normally in the middle', () => {
    expect(moveSelection(2, 1, 5)).toBe(3)
    expect(moveSelection(2, -1, 5)).toBe(1)
  })

  /** An empty result list must not produce NaN or a negative index. */
  it('stays at zero when there is nothing to move through', () => {
    expect(moveSelection(0, 1, 0)).toBe(0)
    expect(moveSelection(3, -1, 0)).toBe(0)
  })
})

describe('scoreCommand directly', () => {
  const c: Command = { id: 'x', label: 'Space weather', hint: '', group: 'Gateways', keywords: ['solar'] }

  it('returns null when nothing matches', () => {
    expect(scoreCommand(c, 'banana')).toBeNull()
  })

  it('scores an exact label above a keyword', () => {
    const exact = scoreCommand(c, 'space weather')!
    const keyword = scoreCommand(c, 'solar')!
    expect(exact.score).toBeGreaterThan(keyword.score)
  })

  it('scores a substring below every boundary match', () => {
    const boundary = scoreCommand(c, 'weather')!
    const substring = scoreCommand(c, 'eath')!
    expect(boundary.score).toBeGreaterThan(substring.score)
  })
})
