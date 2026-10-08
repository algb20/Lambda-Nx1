/**
 * Has a provider's licence text changed since we quoted it? (GL-06)
 *
 * The registry stores, for every licence decision, the sentence it rests on,
 * quoted from the provider's own page with the URL and the date. The cheapest
 * honest test of "did the terms change" is therefore not a hash of the page
 * (navigation, cookie banners and news items change it daily) but this: is the
 * sentence we relied on still there, word for word?
 *
 * - `present`         every fragment of the quote is on the page
 * - `partial`         some fragments are, some are not — re-read the page
 * - `missing`         none are — the terms changed or moved; the record is a
 *                     candidate for EXPIRED_OR_CHANGED (a person decides)
 * - `not-checkable`   the quote is a summary or a measurement, not verbatim
 *
 * Elisions ("…") and editorial brackets ("[prohibited]") split a quote into
 * fragments; fragments shorter than MIN_FRAGMENT are too generic to prove
 * anything and are ignored.
 */

export type QuoteState = 'present' | 'partial' | 'missing' | 'not-checkable'

export const MIN_FRAGMENT = 25

/** Text a reader sees: scripts and styles removed, tags dropped, entities decoded. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    .replace(/&hellip;/g, '…')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
}

/** Comparison form: typographic quotes and dashes folded, whitespace collapsed, case ignored. */
export function normalise(text: string): string {
  return text
    // One encoding for composed characters (Arabic diacritics arrive in either order).
    .normalize('NFKC')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″«»“”]/g, '"')
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    // Tag stripping leaves "copy , publish" where the page reads "copy, publish".
    .replace(/ ([,.;:!?)\]])/g, '$1')
    // A hyphen at a line break: "for-<br>profit" reads "for- profit".
    .replace(/(\p{L})- (\p{L})/gu, '$1-$2')
    .replace(/([(\[]) /g, '$1')
    .trim()
    .toLowerCase()
}

/** The verbatim pieces of a quote, split at elisions and editorial brackets. */
export function quoteFragments(quote: string): string[] {
  return quote
    .split(/…|\.\.\.|\[[^\]]*\]/)
    .map((f) => normalise(f).replace(/^["'\s.,;:]+|["'\s.,;:]+$/g, ''))
    .filter((f) => f.length >= MIN_FRAGMENT)
}

export function checkQuote(pageText: string, quote: string): QuoteState {
  const fragments = quoteFragments(quote)
  if (fragments.length === 0) return 'not-checkable'
  const page = normalise(pageText)
  const found = fragments.filter((f) => page.includes(f)).length
  if (found === fragments.length) return 'present'
  return found === 0 ? 'missing' : 'partial'
}

/** One record's verdict: the worst state among its checkable quotes. */
export function recordState(states: QuoteState[]): QuoteState {
  const checkable = states.filter((s) => s !== 'not-checkable')
  if (checkable.length === 0) return 'not-checkable'
  if (checkable.includes('missing')) return checkable.every((s) => s === 'missing') ? 'missing' : 'partial'
  if (checkable.includes('partial')) return 'partial'
  return 'present'
}

/** The verbatim parts of a paraphrase: what sits inside double quotes. */
export function quotedSegments(paraphrase: string): string[] {
  return [...paraphrase.matchAll(/"([^"]+)"|\u201C([^\u201D]+)\u201D/g)].map((m) => m[1] ?? m[2])
}

/** Check one piece of registry evidence according to what it is. */
export function checkEvidence(pageText: string, e: { quote: string; kind: 'quote' | 'paraphrase' | 'observation' }): QuoteState {
  if (e.kind === 'observation') return 'not-checkable'
  if (e.kind === 'quote') return checkQuote(pageText, e.quote)
  return recordState(quotedSegments(e.quote).map((seg) => checkQuote(pageText, seg)))
}
