import { describe, expect, it } from 'vitest'
import { formatUsd, latestFact, padCik, recentInstantFrames, resolveFiler } from './companies'

describe('resolving what a person typed to a filer', () => {
  const ROWS = [
    { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' },
    { cik_str: 1418121, ticker: 'APLE', title: 'Apple Hospitality REIT, Inc.' },
    { cik_str: 1045810, ticker: 'NVDA', title: 'NVIDIA CORP' },
    { cik_str: 789019, ticker: 'MSFT', title: 'MICROSOFT CORP' },
  ]

  it('takes an exact ticker first', () => {
    expect(resolveFiler(ROWS, 'NVDA')?.cik).toBe('1045810')
    expect(resolveFiler(ROWS, 'nvda')?.cik).toBe('1045810')
  })

  /**
   * The reason the passes are ordered: a substring match alone sends "Apple" to
   * whichever Apple-named REIT happens to sort first.
   */
  it('sends a bare name to the company that bears it, not to a longer namesake', () => {
    expect(resolveFiler(ROWS, 'Apple')?.title).toBe('Apple Inc.')
  })

  it('ignores the legal suffix a person omits', () => {
    expect(resolveFiler(ROWS, 'Microsoft')?.cik).toBe('789019')
    expect(resolveFiler(ROWS, 'NVIDIA')?.cik).toBe('1045810')
  })

  it('still finds a company by a distinctive fragment', () => {
    expect(resolveFiler(ROWS, 'Hospitality')?.cik).toBe('1418121')
  })

  it('answers null rather than guessing', () => {
    expect(resolveFiler(ROWS, 'zzzz-not-a-company')).toBeNull()
    expect(resolveFiler(ROWS, '   ')).toBeNull()
  })
})

describe('EDGAR path forms', () => {
  it('pads a CIK to the ten digits every path wants', () => {
    expect(padCik(320193)).toBe('CIK0000320193')
    expect(padCik('1045810')).toBe('CIK0001045810')
    expect(padCik('CIK0000320193')).toBe('CIK0000320193')
  })

  /**
   * A frame is only populated once enough filers have reported into it, so the
   * current quarter is reliably empty. Walking back is how the lag is handled
   * without a hard-coded guess that breaks on a calendar boundary.
   */
  it('asks for closed quarters, newest first', () => {
    expect(recentInstantFrames(new Date('2026-08-20T00:00:00Z'), 3)).toEqual([
      'CY2026Q2I',
      'CY2026Q1I',
      'CY2025Q4I',
    ])
  })

  it('rolls back across a year boundary', () => {
    expect(recentInstantFrames(new Date('2026-01-15T00:00:00Z'), 3)).toEqual([
      'CY2025Q4I',
      'CY2025Q3I',
      'CY2025Q2I',
    ])
  })
})

describe('reading a concept out of XBRL', () => {
  const REVENUE = {
    label: 'Revenue',
    tags: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues'],
    unit: 'USD',
  }

  /**
   * The defect this exists to prevent, seen on real data: NVIDIA stopped using
   * `RevenueFromContractWithCustomerExcludingAssessedTax` after their FY2022
   * 10-K. Reading the preferred tag first returned their **2022** revenue beside
   * a 2026 balance sheet, with nothing on the card to say the two were four
   * years apart.
   */
  it('takes the newest period across every candidate tag, not the preferred tag’s newest', () => {
    const facts = {
      facts: {
        'us-gaap': {
          RevenueFromContractWithCustomerExcludingAssessedTax: {
            units: { USD: [{ val: 26_914_000_000, end: '2022-01-30', form: '10-K' }] },
          },
          Revenues: { units: { USD: [{ val: 81_615_000_000, end: '2026-04-26', form: '10-Q' }] } },
        },
      },
    }
    const found = latestFact(facts, REVENUE)
    expect(found?.value).toBe(81_615_000_000)
    expect(found?.tag).toBe('Revenues')
  })

  /** Preference order still decides when two tags describe the same period. */
  it('prefers the standard tag when two tags cover the same period', () => {
    const facts = {
      facts: {
        'us-gaap': {
          RevenueFromContractWithCustomerExcludingAssessedTax: {
            units: { USD: [{ val: 100, end: '2026-06-30', form: '10-Q' }] },
          },
          Revenues: { units: { USD: [{ val: 999, end: '2026-06-30', form: '10-Q' }] } },
        },
      },
    }
    expect(latestFact(facts, REVENUE)?.value).toBe(100)
  })

  /**
   * "Most recent" is the period the fact *describes*, not when it was filed. A
   * company restating an old quarter files it today, and reading by filing date
   * would report a two-year-old figure as current.
   */
  it('ranks by the period described, not by the filing date', () => {
    const facts = {
      facts: {
        'us-gaap': {
          Revenues: {
            units: {
              USD: [
                { val: 10, end: '2026-06-30', form: '10-Q', filed: '2026-07-29' },
                { val: 20, end: '2024-06-30', form: '10-Q/A', filed: '2026-08-15' },
              ],
            },
          },
        },
      },
    }
    expect(latestFact(facts, REVENUE)?.value).toBe(10)
  })

  it('answers null for a concept the company has never reported', () => {
    expect(latestFact({ facts: { 'us-gaap': {} } }, REVENUE)).toBeNull()
    expect(latestFact({}, REVENUE)).toBeNull()
  })

  it('reads IFRS filers too, not only us-gaap', () => {
    const facts = { facts: { 'ifrs-full': { Revenues: { units: { USD: [{ val: 5, end: '2026-03-31', form: '20-F' }] } } } } }
    expect(latestFact(facts, REVENUE)?.value).toBe(5)
  })

  it('ignores a point with no period, which cannot be ranked', () => {
    const facts = { facts: { 'us-gaap': { Revenues: { units: { USD: [{ val: 7 }] } } } } }
    expect(latestFact(facts, REVENUE)).toBeNull()
  })
})

describe('presenting large money', () => {
  it('compacts to the unit a reader thinks in', () => {
    expect(formatUsd(4_424_900_000_000)).toBe('$4.42T')
    expect(formatUsd(383_266_000_000)).toBe('$383.27B')
    expect(formatUsd(4_500_000)).toBe('$4.5M')
    expect(formatUsd(1234)).toBe('$1,234')
  })

  it('keeps a loss a loss', () => {
    expect(formatUsd(-2_500_000_000)).toBe('-$2.50B')
  })
})
