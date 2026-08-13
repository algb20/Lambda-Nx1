import { describe, it, expect } from 'vitest'
import {
  EmptyDossierError,
  bibEscape,
  bibKey,
  buildDossier,
  csvCell,
  dominantDirection,
  dossierFilename,
  htmlEscape,
  renderDossier,
  safeHref,
  toBibtex,
  toCitations,
  toCsv,
  toJson,
  toMarkdown,
  toPrintableHtml,
} from './dossier'
import type { Evidence } from '@/lib/engine/types'

const ev = (over: Partial<Evidence> = {}): Evidence => ({
  claim: 'example.com resolves to 93.184.216.34',
  sourceKey: 'dns_google',
  sourceUrl: 'https://dns.google/resolve?name=example.com',
  retrievedAt: '2026-08-10T09:00:00.000Z',
  admiralty: { source: 'A', info: 1 },
  confidence: 'confirmed',
  ...over,
})

const dossier = (evidence: Evidence[] = [ev()], over = {}) =>
  buildDossier({
    subject: 'example.com',
    kind: 'Domain & infrastructure',
    generatedAt: '2026-08-11T12:00:00.000Z',
    evidence,
    ...over,
  })

describe('buildDossier', () => {
  it('refuses to produce a document with nothing in it', () => {
    expect(() => dossier([])).toThrow(EmptyDossierError)
  })

  /**
   * The point of the reference list: forty findings from six sources are six
   * references. A per-finding reference list is a log, not a citation.
   */
  it('cites each source once however many findings came from it', () => {
    const d = dossier([
      ev(),
      ev({ claim: 'MX record found' }),
      ev({ claim: 'NS record found' }),
      ev({ sourceKey: 'rdap_org', sourceUrl: 'https://rdap.org/domain/example.com' }),
    ])
    expect(d.references).toHaveLength(2)
    expect(d.references[0].findings).toBe(3)
    expect(d.references[1].sourceKey).toBe('rdap_org')
    expect(d.findings.map((f) => f.reference)).toEqual([1, 1, 1, 2])
  })

  /** The same source legitimately cites different pages; those are distinct. */
  it('separates the distinct pages of one source into distinct references', () => {
    const d = dossier([
      ev({ sourceUrl: 'https://dns.google/resolve?name=a.example.com' }),
      ev({ sourceUrl: 'https://dns.google/resolve?name=b.example.com' }),
    ])
    expect(d.references).toHaveLength(2)
  })

  it('cites the earliest time the claim was actually seen', () => {
    const d = dossier([
      ev({ retrievedAt: '2026-08-10T18:00:00.000Z' }),
      ev({ claim: 'second', retrievedAt: '2026-08-10T06:00:00.000Z' }),
    ])
    expect(d.references[0].retrievedAt).toBe('2026-08-10T06:00:00.000Z')
  })

  it('carries the seal and the trust assessment', () => {
    const d = dossier([ev(), ev({ sourceKey: 'rdap_org', sourceUrl: 'https://rdap.org/x' })])
    expect(d.seal).toMatch(/^lnx1-[0-9a-f]{16}$/)
    expect(d.trust.independentSources).toBe(2)
  })

  /** Same findings ⇒ same seal, which is what makes the document citable. */
  it('produces a stable seal for the same findings in any order', () => {
    const a = ev()
    const b = ev({ claim: 'second', sourceKey: 'rdap_org' })
    expect(dossier([a, b]).seal).toBe(dossier([b, a]).seal)
  })

  it('keeps a source with no URL rather than dropping its findings', () => {
    const d = dossier([ev({ sourceUrl: undefined })])
    expect(d.references[0].url).toBeNull()
    expect(d.findings).toHaveLength(1)
  })

  it('records no grade rather than inventing one', () => {
    const d = dossier([ev({ admiralty: undefined })])
    expect(d.findings[0].admiralty).toBeNull()
  })

  /**
   * Found by exporting real output: the printable page refused a `javascript:`
   * URL, but CSV, the citation list and BibTeX printed it verbatim. A renderer
   * that has to remember is a renderer that will forget, so the model refuses
   * the URL once and every rendering inherits the refusal.
   */
  describe('a hostile source URL is refused once, for every format', () => {
    const hostile = dossier([
      ev({ sourceUrl: 'javascript:alert(1)' }),
      ev({ claim: 'second', sourceKey: 'rdap_org', sourceUrl: 'data:text/html,<script>' }),
    ])

    it('drops it from the model', () => {
      expect(hostile.references.every((r) => r.url === null)).toBe(true)
    })

    it('keeps the finding, because the claim is still evidence', () => {
      expect(hostile.findings).toHaveLength(2)
    })

    it('never reaches CSV, citations, BibTeX, Markdown or the printed page', () => {
      for (const rendered of [
        toCsv(hostile),
        toCitations(hostile),
        toBibtex(hostile),
        toMarkdown(hostile),
        toPrintableHtml(hostile),
      ]) {
        expect(rendered).not.toContain('javascript:')
        expect(rendered).not.toContain('data:text/html')
      }
    })

    it('still carries an ordinary link through untouched', () => {
      expect(dossier().references[0].url).toBe('https://dns.google/resolve?name=example.com')
    })
  })
})

describe('dossierFilename', () => {
  it('is safe on every filesystem and sorts by date', () => {
    expect(dossierFilename(dossier(), 'csv')).toBe('lambda-example.com-2026-08-11.csv')
  })

  it('gives citations and bibtex their conventional extensions', () => {
    expect(dossierFilename(dossier(), 'citations')).toMatch(/\.txt$/)
    expect(dossierFilename(dossier(), 'bibtex')).toMatch(/\.bib$/)
  })

  it('never lets a subject escape into a path', () => {
    const d = dossier([ev()], { subject: '../../etc/passwd' })
    const name = dossierFilename(d, 'json')
    expect(name).not.toContain('/')
    expect(name).not.toContain('..')
  })

  it('falls back to a name when the subject reduces to nothing', () => {
    expect(dossierFilename(dossier([ev()], { subject: '……' }), 'json')).toContain('dossier')
  })
})

describe('csvCell — a spreadsheet executes what looks like a formula', () => {
  it('neutralises every formula lead-in', () => {
    for (const lead of ['=', '+', '-', '@']) {
      expect(csvCell(`${lead}cmd|'/c calc'!A1`)).toMatch(/^'/)
    }
  })

  it('quotes and doubles per RFC 4180', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"')
  })

  it('leaves ordinary text alone', () => {
    expect(csvCell('example.com')).toBe('example.com')
    expect(csvCell(null)).toBe('')
    expect(csvCell(7)).toBe('7')
  })
})

describe('toCsv', () => {
  const csv = toCsv(dossier([ev(), ev({ claim: '=SUM(A1)', sourceKey: 'rdap_org' })]))

  it('leads with a header row and uses CRLF', () => {
    expect(csv.split('\r\n')[0]).toBe(
      'claim,entity,source,reference,source_url,retrieved_at,admiralty,confidence',
    )
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('carries the source URL onto every row, so a cell is checkable alone', () => {
    expect(csv).toContain('https://dns.google/resolve?name=example.com')
  })

  it('escapes a claim that would otherwise be a formula', () => {
    expect(csv).toContain("'=SUM(A1)")
  })
})

describe('toJson', () => {
  it('round-trips to the same model', () => {
    const d = dossier()
    const parsed = JSON.parse(toJson(d))
    expect(parsed.platform).toBe('Lambda')
    expect(parsed.seal).toBe(d.seal)
    expect(parsed.findings).toHaveLength(1)
  })
})

describe('toCitations', () => {
  const text = toCitations(dossier([ev(), ev({ sourceKey: 'rdap_org', sourceUrl: null as never })]))

  it('numbers references and gives each a retrieval date', () => {
    expect(text).toContain('[1] dns_google.')
    expect(text).toContain('Retrieved 2026-08-10.')
  })

  it('states the seal, so a reader can verify the set it came from', () => {
    expect(text).toMatch(/Seal lnx1-[0-9a-f]{16}/)
  })

  it('cites a source that has no URL rather than omitting it', () => {
    expect(text).toContain('[2] rdap_org.')
  })
})

describe('toBibtex', () => {
  it('produces one parseable entry per reference', () => {
    const bib = toBibtex(dossier([ev(), ev({ sourceKey: 'rdap_org', sourceUrl: 'https://rdap.org/x' })]))
    expect(bib.match(/@misc\{/g)).toHaveLength(2)
    expect(bib).toContain('howpublished = {\\url{https://dns.google/resolve?name=example.com}}')
  })

  it('escapes the characters BibTeX reserves', () => {
    expect(bibEscape('100% of {a & b}_c')).toBe('100\\% of \\{a \\& b\\}\\_c')
  })

  it('gives every entry a distinct, legal key', () => {
    const d = dossier([ev(), ev({ sourceKey: 'rdap_org' })])
    const keys = d.references.map((r) => bibKey(d, r))
    expect(new Set(keys).size).toBe(2)
    for (const k of keys) expect(k).toMatch(/^[a-z0-9]+$/)
  })
})

describe('toMarkdown', () => {
  const md = toMarkdown(dossier([ev({ claim: 'a | b pipe' })], { note: 'Checked by hand.' }))

  it('opens with the subject and states the assessment', () => {
    expect(md.startsWith('# example.com')).toBe(true)
    expect(md).toContain('Independent sources:')
    // One A-rated source is "probable", never "confirmed" — the document must
    // not read stronger than the evidence behind it.
    expect(md).toContain('Overall confidence: probable')
  })

  it('reaches "confirmed" only when two reliable sources agree', () => {
    const md = toMarkdown(
      dossier([ev(), ev({ sourceKey: 'rdap_org', sourceUrl: 'https://rdap.org/x' })]),
    )
    expect(md).toContain('Overall confidence: confirmed')
  })

  it('escapes a pipe so the findings table does not break apart', () => {
    expect(md).toContain('a \\| b pipe')
  })

  it("includes the analyst's note only when there is one", () => {
    expect(md).toContain('## Analyst note')
    expect(toMarkdown(dossier())).not.toContain('## Analyst note')
  })

  it('ends with the provenance statement, not a bare table', () => {
    expect(md).toContain('Collected passively from public sources')
  })
})

describe('htmlEscape and safeHref — this document is opened in a browser', () => {
  it('escapes every character that could open a tag or attribute', () => {
    expect(htmlEscape(`<script>alert("x")</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    )
    expect(htmlEscape("it's")).toBe('it&#39;s')
  })

  it('refuses a scheme that is not http(s)', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull()
    expect(safeHref('data:text/html,<script>')).toBeNull()
    expect(safeHref('not a url')).toBeNull()
    expect(safeHref(null)).toBeNull()
  })

  it('keeps an ordinary link', () => {
    expect(safeHref('https://dns.google/x')).toBe('https://dns.google/x')
  })
})

describe('dominantDirection', () => {
  it('follows the content, so an Arabic dossier is laid out right-to-left', () => {
    expect(dominantDirection('تحليل استخباراتي لنطاق')).toBe('rtl')
    expect(dominantDirection('example.com resolves')).toBe('ltr')
    expect(dominantDirection('')).toBe('ltr')
  })
})

describe('toPrintableHtml', () => {
  it('sets the document direction from its own content', () => {
    const arabic = toPrintableHtml(
      dossier([ev({ claim: 'النطاق يشير إلى عنوان في ألمانيا' })], { subject: 'نطاق' }),
    )
    expect(arabic).toContain('dir="rtl"')
    expect(arabic).toContain('lang="ar"')
    expect(toPrintableHtml(dossier())).toContain('dir="ltr"')
  })

  /** The whole reason this is HTML and not hand-written PDF bytes. */
  it('asks for an Arabic-capable font stack and A4 print geometry', () => {
    const html = toPrintableHtml(dossier())
    expect(html).toContain('Noto Naskh Arabic')
    expect(html).toContain('@page { size: A4')
  })

  it('never emits an unescaped claim', () => {
    const html = toPrintableHtml(dossier([ev({ claim: '<img src=x onerror=alert(1)>' })]))
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })

  it('does not turn a hostile URL into a clickable link', () => {
    const html = toPrintableHtml(dossier([ev({ sourceUrl: 'javascript:alert(1)' })]))
    expect(html).not.toContain('href="javascript:')
    expect(html).toContain('no public URL')
  })

  it('keeps a finding and its citation on the same page', () => {
    expect(toPrintableHtml(dossier())).toContain('break-inside: avoid')
  })
})

describe('renderDossier', () => {
  const d = dossier()

  it('gives every format the right content type and filename', () => {
    expect(renderDossier(d, 'csv').contentType).toBe('text/csv; charset=utf-8')
    expect(renderDossier(d, 'json').contentType).toBe('application/json; charset=utf-8')
    expect(renderDossier(d, 'html').contentType).toBe('text/html; charset=utf-8')
    expect(renderDossier(d, 'bibtex').filename).toMatch(/\.bib$/)
  })

  it('produces a non-empty body for every format', () => {
    for (const f of ['json', 'csv', 'markdown', 'citations', 'bibtex', 'html'] as const) {
      expect(renderDossier(d, f).body.length, f).toBeGreaterThan(20)
    }
  })
})
