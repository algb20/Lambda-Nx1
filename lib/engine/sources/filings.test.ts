import { describe, expect, it } from 'vitest'
import { filingUrl, parseDisplayName, readFilings, windowDates } from './filings'

/** The shape EDGAR's search index really returns, taken from a live response. */
const hit = (over: Record<string, unknown> = {}) => ({
  _id: '0001193125-26-042752:d460978d8k.htm',
  _source: {
    ciks: ['0001099219'],
    display_names: ['METLIFE INC  (MET, MET-PA)  (CIK 0001099219)'],
    file_date: '2026-08-19',
    form: '8-K',
    items: ['2.02', '9.01'],
    adsh: '0001193125-26-042752',
    biz_locations: ['New York, NY'],
    ...over,
  },
})

const body = (...hits: ReturnType<typeof hit>[]) => ({ hits: { hits } })

describe('reading how EDGAR names a company', () => {
  it('splits the name, the tickers and the CIK apart', () => {
    expect(parseDisplayName('METLIFE INC  (MET, MET-PA)  (CIK 0001099219)')).toEqual({
      company: 'METLIFE INC',
      cik: '0001099219',
      tickers: ['MET', 'MET-PA'],
    })
  })

  it('handles a filer with no ticker', () => {
    expect(parseDisplayName('HANDLEMAN CO /MI/  (CIK 0000314727)')).toEqual({
      company: 'HANDLEMAN CO /MI/',
      cik: '0000314727',
      tickers: [],
    })
  })

  it('keeps the name when there is nothing else to parse', () => {
    const parsed = parseDisplayName('SOME PRIVATE FILER')
    expect(parsed.company).toBe('SOME PRIVATE FILER')
    expect(parsed.cik).toBeNull()
  })

  it('does not mistake a parenthesised word for a ticker', () => {
    expect(parseDisplayName('ACME (DELAWARE) INC  (CIK 0000000123)').tickers).toEqual([])
  })

  it('survives an empty name', () => {
    expect(parseDisplayName('').company).toBe('')
  })
})

describe('the link back to the filing', () => {
  it('builds the SEC’s own index page for a filing', () => {
    expect(filingUrl('0001099219', '0001193125-26-042752')).toBe(
      'https://www.sec.gov/Archives/edgar/data/1099219/000119312526042752/0001193125-26-042752-index.htm',
    )
  })

  it('still returns something usable when the CIK is missing', () => {
    expect(filingUrl(null, '0001193125-26-042752')).toContain('browse-edgar')
  })
})

describe('turning hits into graded filings', () => {
  it('reads a filing with everything it carries', () => {
    const [f] = readFilings(body(hit()))
    expect(f.company).toBe('METLIFE INC')
    expect(f.tickers).toEqual(['MET', 'MET-PA'])
    expect(f.cik).toBe('0001099219')
    expect(f.form).toBe('8-K')
    expect(f.filedAt).toBe('2026-08-19')
    expect(f.items).toEqual(['2.02', '9.01'])
    expect(f.location).toBe('New York, NY')
  })

  /**
   * One filing appears once per document inside it, and the accession number is
   * what identifies the filing. Without this a single 8-K with four exhibits is
   * four rows saying the same thing.
   */
  it('counts a filing once however many documents it contains', () => {
    const filings = readFilings(
      body(hit({ adsh: '0001-26-000001' }), hit({ adsh: '0001-26-000001' })),
    )
    expect(filings).toHaveLength(1)
  })

  /**
   * The whole reason this gateway exists. Ranking by date shows the reader
   * ninety-two exhibit notices and buries the restatement among them.
   */
  it('puts the most consequential disclosure first, not the newest', () => {
    const filings = readFilings(
      body(
        hit({ adsh: 'a', file_date: '2026-08-20', items: ['9.01'] }),
        hit({ adsh: 'b', file_date: '2026-08-18', items: ['4.02', '9.01'] }),
        hit({ adsh: 'c', file_date: '2026-08-19', items: ['2.02'] }),
      ),
    )
    expect(filings.map((f) => f.accession)).toEqual(['b', 'c', 'a'])
    expect(filings[0].meaning).toContain('cannot be relied upon')
  })

  it('breaks a tie in gravity by date, newest first', () => {
    const filings = readFilings(
      body(
        hit({ adsh: 'older', file_date: '2026-08-17', items: ['5.02'] }),
        hit({ adsh: 'newer', file_date: '2026-08-20', items: ['5.02'] }),
      ),
    )
    expect(filings.map((f) => f.accession)).toEqual(['newer', 'older'])
  })

  it('carries a filing with no item codes rather than dropping it', () => {
    const [f] = readFilings(body(hit({ items: undefined, form: '10-K' })))
    expect(f.form).toBe('10-K')
    expect(f.items).toEqual([])
    expect(f.weight).toBe(0)
  })

  it('returns nothing for a body that is not a search result', () => {
    expect(readFilings(null)).toEqual([])
    expect(readFilings({})).toEqual([])
    expect(readFilings({ hits: {} })).toEqual([])
  })

  it('skips a hit with no company name rather than emitting a blank row', () => {
    expect(readFilings(body(hit({ display_names: [] })))).toHaveLength(0)
  })
})

describe('the search window', () => {
  it('returns the last n days as two ISO dates', () => {
    const { start, end } = windowDates(4, new Date('2026-08-20T12:00:00Z'))
    expect(end).toBe('2026-08-20')
    expect(start).toBe('2026-08-16')
  })

  /**
   * Filings cluster on business days. A Monday asking for "today" would show an
   * empty market rather than Friday's disclosures.
   */
  it('looks back far enough to cross a weekend', () => {
    const { start, end } = windowDates(4, new Date('2026-08-24T09:00:00Z')) // a Monday
    expect(new Date(end).getTime() - new Date(start).getTime()).toBeGreaterThanOrEqual(
      3 * 86_400_000,
    )
  })
})
