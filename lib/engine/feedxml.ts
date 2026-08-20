/**
 * Dependency-free RSS 2.0 / Atom feed reader.
 *
 * Most of the standing feeds we watch (CISA advisories, arXiv category
 * listings) publish XML, not JSON. Rather than pull in a parser dependency —
 * and rather than write a second ad-hoc reader per source — the engine owns one
 * small reader over the subset of RSS/Atom that real feeds actually emit:
 * entries, titles, links, summaries, dates and authors.
 *
 * It is deliberately tolerant: feeds in the wild mix namespaces (`dc:creator`),
 * CDATA, escaped HTML and both date formats. Anything it cannot understand is
 * reported as absent rather than guessed — a missing date is `undefined`, never
 * "now", so nothing downstream can mistake a parse failure for a fresh item.
 */
import { publicationTime, publicationZoneOffset } from './observed'

export interface FeedEntry {
  title: string
  /** Canonical link to the item, when the feed provides one. */
  link?: string
  /** Plain-text summary — HTML markup stripped, whitespace collapsed. */
  summary?: string
  /** ISO 8601 timestamp, only when the feed gave a parseable date. */
  published?: string
  /**
   * The UTC offset the feed itself stated, in minutes east of UTC.
   *
   * `published` normalises to an instant, which is right for sorting and wrong
   * for display: `Thu, 14 Aug 2026 09:46:00 +0300` is the publisher telling us
   * what time it was *there*. Kept so a reader can be shown the hour the source
   * reported rather than only the hour in their own city.
   */
  publishedOffsetMinutes?: number
  /** The feed's own identifier for the item (Atom `<id>` / RSS `<guid>`). */
  id?: string
  authors: string[]
}

const NAMED_ENTITIES: Record<string, string> = {
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function codePoint(n: number): string {
  return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''
}

/** Unwrap CDATA and decode the XML entities feeds actually use. */
export function decodeXmlText(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => codePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => codePoint(parseInt(dec, 10)))
    .replace(/&(lt|gt|quot|apos|nbsp);/g, (_, name: string) => NAMED_ENTITIES[name])
    // `&amp;` last, so "&amp;lt;" decodes to "&lt;" and not to "<".
    .replace(/&amp;/g, '&')
}

/** Strip HTML markup (feed summaries are routinely HTML) and collapse whitespace. */
export function stripHtml(input: string): string {
  return input
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Raw inner XML of the first `<tag>…</tag>` in a fragment. */
function innerXml(fragment: string, tag: string): string | null {
  const m = fragment.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'))
  return m ? m[1] : null
}

/** Decoded, tag-stripped text of the first `<tag>…</tag>`; null when absent or empty. */
export function tagText(fragment: string, tag: string): string | null {
  const raw = innerXml(fragment, tag)
  if (raw === null) return null
  const text = stripHtml(decodeXmlText(raw))
  return text.length > 0 ? text : null
}

/** First non-empty `tagText` across several candidate tags. */
function firstTagText(fragment: string, tags: string[]): string | null {
  for (const tag of tags) {
    const value = tagText(fragment, tag)
    if (value) return value
  }
  return null
}

/**
 * Normalize a feed date to ISO; undefined if unparseable.
 *
 * Delegates to the engine's single publication-time parser rather than calling
 * `Date.parse` itself. It used to do the latter, and the cost was silent: a
 * `pubDate` in a format `Date.parse` rejects — Drupal's `Friday, August 14,
 * 2026 - 09:46`, which most European regulators publish — was dropped here,
 * before any adapter could see it. Two parsers meant two answers to the same
 * question, and only one of them was ever improved.
 */
export function feedDate(raw: string | null): string | undefined {
  return publicationTime(raw) ?? undefined
}

/**
 * The instant and the publisher's own offset, from one raw string.
 *
 * Returned as a pair so the two can never come apart: an offset attached to a
 * date that failed to parse would describe nothing, and a caller spreading this
 * gets both or neither.
 */
export function feedTime(raw: string | null): {
  published?: string
  publishedOffsetMinutes?: number
} {
  const published = feedDate(raw)
  if (!published) return {}
  const offset = publicationZoneOffset(raw)
  return offset === null ? { published } : { published, publishedOffsetMinutes: offset }
}

const SKIPPED_LINK_RELS = new Set(['self', 'enclosure', 'edit', 'replies', 'via'])

/**
 * The item's canonical link. RSS puts the URL in the element body; Atom puts it
 * in a `href` attribute across several `<link>` elements, only one of which is
 * the human-readable page.
 */
function entryLink(block: string): string | undefined {
  const rss = block.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i)
  if (rss) {
    const url = decodeXmlText(rss[1]).trim()
    if (/^https?:\/\//i.test(url)) return url
  }

  let fallback: string | undefined
  for (const tag of block.match(/<link\b[^>]*\/?>/gi) ?? []) {
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]
    if (!href) continue
    const url = decodeXmlText(href).trim()
    if (!/^https?:\/\//i.test(url)) continue
    const rel = tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase()
    if (rel && SKIPPED_LINK_RELS.has(rel)) continue
    if (!rel || rel === 'alternate') return url
    fallback ??= url
  }
  return fallback
}

function entryAuthors(block: string): string[] {
  const names: string[] = []
  for (const author of block.match(/<author(?:\s[^>]*)?>[\s\S]*?<\/author>/gi) ?? []) {
    // Atom nests <name>; RSS puts the value directly in the element.
    const direct = stripHtml(decodeXmlText(innerXml(author, 'author') ?? ''))
    const name = tagText(author, 'name') ?? (direct.length > 0 ? direct : null)
    if (name) names.push(name)
  }
  for (const creator of block.match(/<dc:creator(?:\s[^>]*)?>[\s\S]*?<\/dc:creator>/gi) ?? []) {
    const name = tagText(creator, 'dc:creator')
    if (name) names.push(name)
  }
  return [...new Set(names)]
}

/** Item blocks of a feed: Atom `<entry>` when present, else RSS `<item>`. */
export function feedBlocks(xml: string): string[] {
  const atom = xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi)
  if (atom && atom.length > 0) return atom
  return xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? []
}

/** Cut a summary to a readable length on a word boundary. */
export function truncate(text: string, max = 400): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + '…'
}

/**
 * Parse an RSS 2.0 or Atom document into entries. Items without a usable title
 * are dropped — a titleless entry carries nothing we could grade or show.
 */
export function parseFeed(xml: string, opts: { summaryMax?: number } = {}): FeedEntry[] {
  const entries: FeedEntry[] = []
  for (const block of feedBlocks(xml)) {
    const title = tagText(block, 'title')
    if (!title) continue
    const summary = firstTagText(block, ['summary', 'description', 'content:encoded', 'content'])
    entries.push({
      title,
      link: entryLink(block),
      summary: summary ? truncate(summary, opts.summaryMax ?? 400) : undefined,
      ...feedTime(firstTagText(block, ['published', 'pubDate', 'dc:date', 'updated'])),
      id: firstTagText(block, ['id', 'guid']) ?? undefined,
      authors: entryAuthors(block),
    })
  }
  return entries
}
