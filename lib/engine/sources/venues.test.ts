import { describe, expect, it } from 'vitest'
import { parseCsv, parseCsvLine, readMicRegistry } from './venues'

/**
 * A fragment of the real ISO 10383 file, kept verbatim including its quoting.
 *
 * Real rows rather than invented ones, because the two things most likely to
 * break here — commas inside quoted legal entity names, and a country stored as
 * a two-letter code — are both properties of the actual file.
 */
const HEADER =
  '"MIC","OPERATING MIC","OPRT/SGMT","MARKET NAME-INSTITUTION DESCRIPTION","LEGAL ENTITY NAME","LEI","MARKET CATEGORY CODE","ACRONYM","ISO COUNTRY CODE (ISO 3166)","CITY","WEBSITE","STATUS","CREATION DATE","LAST UPDATE DATE","LAST VALIDATION DATE","EXPIRY DATE","COMMENTS"'

const row = (cells: Partial<Record<string, string>>) => {
  const d: Record<string, string> = {
    MIC: 'XTST',
    OP: 'XTST',
    SEG: 'OPRT',
    NAME: 'TEST EXCHANGE',
    ENTITY: 'TEST EXCHANGE PLC',
    LEI: '969500HMVSZ0TCV65D58',
    CAT: 'RMKT',
    ACR: 'TSX',
    CC: 'GB',
    CITY: 'LONDON',
    WEB: 'WWW.TEST.COM',
    STATUS: 'ACTIVE',
    ...cells,
  }
  return `"${d.MIC}","${d.OP}","${d.SEG}","${d.NAME}","${d.ENTITY}","${d.LEI}","${d.CAT}","${d.ACR}","${d.CC}","${d.CITY}","${d.WEB}","${d.STATUS}","20210927","20210927","20210927","",""`
}

const csv = (...rows: string[]) => [HEADER, ...rows].join('\n')

describe('reading a quoted CSV', () => {
  /**
   * The reason this is not `split(',')`. Several legal entity names in the real
   * registry contain commas, and a naive split shifts every column after them —
   * silently, and on exactly the rows that carry the most information.
   */
  it('keeps a comma inside a quoted field', () => {
    expect(parseCsvLine('"a","b, with comma","c"')).toEqual(['a', 'b, with comma', 'c'])
  })

  it('reads a doubled quote as one literal quote', () => {
    expect(parseCsvLine('"say ""hi""","b"')).toEqual(['say "hi"', 'b'])
  })

  it('handles empty fields at either end', () => {
    expect(parseCsvLine('"","b",""')).toEqual(['', 'b', ''])
  })

  it('tolerates CRLF and a trailing newline', () => {
    expect(parseCsv('"a","b"\r\n"c","d"\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('returns nothing for an empty body rather than a row of blanks', () => {
    expect(parseCsv('')).toEqual([])
    expect(parseCsv('\n\n')).toEqual([])
  })
})

describe('what the registry yields', () => {
  it('reads a venue with everything it carries', () => {
    const [venue] = readMicRegistry(csv(row({})), '')
    expect(venue.mic).toBe('XTST')
    expect(venue.name).toBe('TEST EXCHANGE')
    expect(venue.legalEntity).toBe('TEST EXCHANGE PLC')
    expect(venue.lei).toBe('969500HMVSZ0TCV65D58')
    expect(venue.countryIso).toBe('GB')
    expect(venue.city).toBe('LONDON')
    expect(venue.categoryLabel).toBe('Regulated market')
    expect(venue.kind).toBe('regulated')
  })

  /** History, not the market as it stands. */
  it('drops venues that are not active', () => {
    expect(readMicRegistry(csv(row({ STATUS: 'EXPIRED' })), '')).toHaveLength(0)
    expect(readMicRegistry(csv(row({ STATUS: 'SUSPENDED' })), '')).toHaveLength(0)
  })

  it('turns the registry’s bare hostname into a usable link', () => {
    expect(readMicRegistry(csv(row({ WEB: 'WWW.TEST.COM' })), '')[0].website).toBe(
      'https://www.test.com',
    )
  })

  it('does not repeat the operating MIC when it is the venue itself', () => {
    expect(readMicRegistry(csv(row({ MIC: 'XTST', OP: 'XTST' })), '')[0].operatingMic).toBeNull()
    expect(readMicRegistry(csv(row({ MIC: 'XSEG', OP: 'XTST' })), '')[0].operatingMic).toBe('XTST')
  })

  it('sorts a crypto provider into the crypto group, not the regulated one', () => {
    expect(readMicRegistry(csv(row({ CAT: 'CASP' })), '')[0].kind).toBe('crypto')
  })

  /** A category we cannot name is a fact worth showing, not "Other". */
  it('shows an unknown category code rather than hiding it', () => {
    const [venue] = readMicRegistry(csv(row({ CAT: 'ZZZZ' })), '')
    expect(venue.categoryLabel).toBe('ZZZZ')
    expect(venue.kind).toBe('other')
  })

  it('reports no LEI as null rather than an empty string', () => {
    expect(readMicRegistry(csv(row({ LEI: '' })), '')[0].lei).toBeNull()
  })
})

describe('searching the registry', () => {
  const body = csv(
    row({ MIC: 'XNSA', NAME: 'THE NIGERIAN STOCK EXCHANGE', CC: 'NG', CITY: 'LAGOS', LEI: '' }),
    row({ MIC: 'NASX', NAME: 'NASD OTC MARKET', CC: 'NG', CITY: 'LAGOS', LEI: '' }),
    row({ MIC: 'XSAU', NAME: 'SAUDI EXCHANGE', CC: 'SA', CITY: 'RIYADH' }),
  )

  it('finds a venue by its MIC', () => {
    expect(readMicRegistry(body, 'nasx').map((v) => v.mic)).toEqual(['NASX'])
  })

  /**
   * The bug a live search found. The registry stores `NG`, so "nigeria" matched
   * only the venue whose *name* happens to contain the word — every other
   * Nigerian venue was invisible to the obvious query, and the same held for
   * every country whose venues are not named after it.
   */
  it('finds venues by country name, not only by the two-letter code', () => {
    expect(readMicRegistry(body, 'nigeria').map((v) => v.mic).sort()).toEqual(['NASX', 'XNSA'])
    expect(readMicRegistry(body, 'saudi arabia').map((v) => v.mic)).toEqual(['XSAU'])
  })

  /**
   * A two-letter query is an identifier, not a fragment. Substring-matching it
   * made `ng` match every venue with "excha**ng**e" in its name — which is
   * nearly all of them.
   */
  it('treats a two-letter query as a code, not as a fragment', () => {
    expect(readMicRegistry(body, 'ng').map((v) => v.mic).sort()).toEqual(['NASX', 'XNSA'])
    // "EXCHANGE" contains "ng" and must not match on that.
    expect(readMicRegistry(body, 'ng').every((v) => v.countryIso === 'NG')).toBe(true)
  })

  it('lets a two-letter query find a MIC as well as a country', () => {
    expect(readMicRegistry(csv(row({ MIC: 'XX', CC: 'FR' })), 'xx').map((v) => v.mic)).toEqual([
      'XX',
    ])
  })

  it('finds a venue by city', () => {
    expect(readMicRegistry(body, 'riyadh').map((v) => v.mic)).toEqual(['XSAU'])
  })

  it('ignores case and surrounding space', () => {
    expect(readMicRegistry(body, '  NIGERIA  ')).toHaveLength(2)
  })

  it('returns everything active when the query is empty', () => {
    expect(readMicRegistry(body, '')).toHaveLength(3)
  })

  it('returns nothing — not everything — when nothing matches', () => {
    expect(readMicRegistry(body, 'atlantis')).toHaveLength(0)
  })
})

describe('a malformed or empty file', () => {
  it('yields nothing rather than throwing', () => {
    expect(readMicRegistry('', '')).toEqual([])
    expect(readMicRegistry(HEADER, '')).toEqual([])
  })

  it('skips a row with no MIC instead of emitting a nameless venue', () => {
    expect(readMicRegistry(csv(row({ MIC: '' })), '')).toHaveLength(0)
  })
})
