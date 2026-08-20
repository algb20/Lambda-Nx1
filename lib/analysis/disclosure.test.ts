import { describe, expect, it } from 'vitest'
import { DISCLOSURE_ITEMS, assessFiling, describeItem, standoutCodes } from './disclosure'

describe('the item taxonomy', () => {
  it('gives every item a code, a label and what it actually means', () => {
    for (const item of DISCLOSURE_ITEMS) {
      expect(item.code, item.code).toMatch(/^\d\.\d{2}$/)
      expect(item.label.length, item.code).toBeGreaterThan(8)
      expect(item.means.length, item.code).toBeGreaterThan(30)
      expect(item.weight, item.code).toBeGreaterThanOrEqual(0)
      expect(item.weight, item.code).toBeLessThanOrEqual(100)
    }
  })

  it('lists each code once', () => {
    expect(new Set(DISCLOSURE_ITEMS.map((i) => i.code)).size).toBe(DISCLOSURE_ITEMS.length)
  })

  /**
   * The measurement this whole module rests on: on a real three-day window,
   * item 9.01 appeared on 92 of 100 filings. It is an administrative note that
   * documents are attached, and weighting it like a disclosure is what buries
   * a restatement under ninety-two exhibit lists.
   */
  it('gives the administrative item a weight of zero', () => {
    expect(describeItem('9.01')?.weight).toBe(0)
  })

  it('ranks the gravest disclosures above the ordinary ones', () => {
    const w = (code: string) => describeItem(code)!.weight
    expect(w('1.03')).toBeGreaterThan(w('4.02')) // bankruptcy over restatement
    expect(w('4.02')).toBeGreaterThan(w('4.01')) // restatement over auditor change
    expect(w('3.01')).toBeGreaterThan(w('2.02')) // delisting over earnings
    expect(w('2.06')).toBeGreaterThan(w('5.03')) // impairment over a bylaw edit
    expect(w('5.02')).toBeGreaterThan(w('8.01')) // an executive leaving over "other"
  })

  it('knows nothing about a code it does not carry', () => {
    expect(describeItem('9.99')).toBeNull()
  })
})

describe('grading one filing', () => {
  /**
   * Maximum, not sum. A filing carrying a bankruptcy notice and an exhibit list
   * is a bankruptcy notice, and summing several mild items would let three
   * routine disclosures outrank one restatement.
   */
  it('takes the most consequential item, not the total', () => {
    const serious = assessFiling(['1.03', '9.01'])
    const several = assessFiling(['2.02', '7.01', '8.01', '5.07', '9.01'])
    expect(serious.weight).toBe(100)
    expect(serious.weight).toBeGreaterThan(several.weight)
    expect(serious.leading?.code).toBe('1.03')
  })

  /** The real filing this found on a live run, and the reason the tape works. */
  it('surfaces a restatement filed alongside an auditor change', () => {
    const result = assessFiling(['4.01', '4.02', '9.01'])
    expect(result.leading?.code).toBe('4.02')
    expect(result.summary).toMatch(/^Serious/)
    expect(result.summary).toContain('cannot be relied upon')
  })

  it('calls a filing of only administrative items exactly that', () => {
    const result = assessFiling(['9.01'])
    expect(result.weight).toBe(0)
    expect(result.leading).toBeNull()
    expect(result.summary).toContain('Administrative')
  })

  it('orders the items it recognises, most consequential first', () => {
    expect(assessFiling(['9.01', '2.02', '4.02']).items.map((i) => i.code)).toEqual([
      '4.02',
      '2.02',
      '9.01',
    ])
  })

  /**
   * A code we do not recognise is a fact about our taxonomy, not about the
   * filing — dropping it would hide an item the SEC has since introduced.
   */
  it('reports an unknown code rather than discarding it', () => {
    const result = assessFiling(['9.99', '9.01'])
    expect(result.unknown).toEqual(['9.99'])
    expect(result.summary).toContain('9.99')
  })

  it('handles a filing with no item codes at all', () => {
    const result = assessFiling([])
    expect(result.weight).toBe(0)
    expect(result.items).toEqual([])
    expect(result.summary).toContain('Administrative')
  })

  it('bands the summary by gravity', () => {
    expect(assessFiling(['3.01']).summary).toMatch(/^Serious/)
    expect(assessFiling(['5.02']).summary).toMatch(/^Substantive/)
    expect(assessFiling(['2.02']).summary).toMatch(/^Routine/)
  })
})

describe('what stands out across a window', () => {
  /**
   * A different question from grading one filing: a heavy item arriving fifty
   * times is a busy season, not an alarm, so the count is shown beside it.
   */
  it('reports only the consequential codes, with how often each appeared', () => {
    const standouts = standoutCodes([
      { items: ['4.02', '9.01'] },
      { items: ['3.01'] },
      { items: ['2.02', '9.01'] },
      { items: ['8.01'] },
    ])
    expect(standouts.map((s) => s.item.code)).toEqual(['4.02', '3.01'])
    expect(standouts.every((s) => s.count === 1)).toBe(true)
  })

  it('counts repeats of the same code', () => {
    const standouts = standoutCodes([{ items: ['3.01'] }, { items: ['3.01'] }])
    expect(standouts[0].count).toBe(2)
  })

  it('returns nothing when the window is entirely routine', () => {
    expect(standoutCodes([{ items: ['9.01'] }, { items: ['2.02'] }])).toEqual([])
  })

  it('lets a caller lower the bar', () => {
    expect(standoutCodes([{ items: ['2.02'] }], 25).map((s) => s.item.code)).toEqual(['2.02'])
  })
})
