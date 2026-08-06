import { describe, it, expect } from 'vitest'
import { parseFeed, decodeXmlText, stripHtml, feedDate, truncate } from './feedxml'

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>arXiv Query</title>
  <entry>
    <id>http://arxiv.org/abs/2601.00001v1</id>
    <updated>2026-08-02T10:00:00Z</updated>
    <published>2026-08-01T09:30:00Z</published>
    <title>Passive Collection &amp; Graded Evidence</title>
    <summary>  A study of
      multi-source corroboration.  </summary>
    <link href="http://arxiv.org/abs/2601.00001v1" rel="alternate" type="text/html"/>
    <link href="http://arxiv.org/pdf/2601.00001v1" rel="related" type="application/pdf"/>
    <author><name>Ada Lovelace</name></author>
    <author><name>Grace Hopper</name></author>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2601.00002v1</id>
    <published>not-a-date</published>
    <title>Second Paper</title>
  </entry>
</feed>`

const RSS = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Cybersecurity Advisories</title>
    <link>https://www.cisa.gov/cybersecurity-advisories</link>
    <item>
      <title><![CDATA[ICS Advisory: Vendor X Controller]]></title>
      <link>https://www.cisa.gov/advisories/icsa-26-001</link>
      <description>&lt;p&gt;A vulnerability &lt;strong&gt;affects&lt;/strong&gt; the controller.&lt;/p&gt;</description>
      <pubDate>Mon, 03 Aug 2026 14:00:00 +0000</pubDate>
      <guid isPermaLink="false">icsa-26-001</guid>
      <dc:creator>CISA</dc:creator>
    </item>
    <item>
      <link>https://www.cisa.gov/advisories/no-title</link>
    </item>
  </channel>
</rss>`

describe('feedxml — text decoding', () => {
  it('decodes entities, with &amp; resolved last', () => {
    expect(decodeXmlText('Tom &amp; Jerry')).toBe('Tom & Jerry')
    // "&amp;lt;" must become the literal "&lt;", not "<".
    expect(decodeXmlText('&amp;lt;b&amp;gt;')).toBe('&lt;b&gt;')
    expect(decodeXmlText('&#65;&#x42;')).toBe('AB')
  })

  it('unwraps CDATA', () => {
    expect(decodeXmlText('<![CDATA[raw <b>text</b>]]>')).toBe('raw <b>text</b>')
  })

  it('ignores out-of-range numeric references instead of throwing', () => {
    expect(decodeXmlText('&#99999999;x')).toBe('x')
  })

  it('strips markup and collapses whitespace', () => {
    expect(stripHtml('<p>Hello   <b>world</b></p>')).toBe('Hello world')
    expect(stripHtml('<script>evil()</script>safe')).toBe('safe')
  })

  it('normalizes both feed date formats and rejects junk', () => {
    expect(feedDate('Mon, 03 Aug 2026 14:00:00 +0000')).toBe('2026-08-03T14:00:00.000Z')
    expect(feedDate('2026-08-01T09:30:00Z')).toBe('2026-08-01T09:30:00.000Z')
    expect(feedDate('not-a-date')).toBeUndefined()
    expect(feedDate(null)).toBeUndefined()
  })

  it('truncates on a word boundary', () => {
    expect(truncate('alpha beta gamma delta', 12)).toBe('alpha beta…')
    expect(truncate('short', 12)).toBe('short')
  })
})

describe('feedxml — Atom', () => {
  it('reads entries with links, dates and authors', () => {
    const entries = parseFeed(ATOM)
    expect(entries).toHaveLength(2)
    const [first] = entries
    expect(first.title).toBe('Passive Collection & Graded Evidence')
    // rel="alternate" wins over rel="related" (the PDF).
    expect(first.link).toBe('http://arxiv.org/abs/2601.00001v1')
    expect(first.summary).toBe('A study of multi-source corroboration.')
    // <published> is preferred over <updated>.
    expect(first.published).toBe('2026-08-01T09:30:00.000Z')
    expect(first.authors).toEqual(['Ada Lovelace', 'Grace Hopper'])
    expect(first.id).toBe('http://arxiv.org/abs/2601.00001v1')
  })

  it('reports an unparseable date as absent rather than guessing "now"', () => {
    expect(parseFeed(ATOM)[1].published).toBeUndefined()
  })

  it('does not mistake the feed title for an entry', () => {
    expect(parseFeed(ATOM).some((e) => e.title === 'arXiv Query')).toBe(false)
  })
})

describe('feedxml — RSS', () => {
  it('reads items, unwrapping CDATA and stripping escaped HTML', () => {
    const entries = parseFeed(RSS)
    expect(entries).toHaveLength(1) // the titleless item is dropped
    const [item] = entries
    expect(item.title).toBe('ICS Advisory: Vendor X Controller')
    expect(item.link).toBe('https://www.cisa.gov/advisories/icsa-26-001')
    expect(item.summary).toBe('A vulnerability affects the controller.')
    expect(item.published).toBe('2026-08-03T14:00:00.000Z')
    expect(item.authors).toEqual(['CISA'])
  })

  it('returns nothing for a non-feed document', () => {
    expect(parseFeed('<html><body>not a feed</body></html>')).toEqual([])
    expect(parseFeed('')).toEqual([])
  })
})
