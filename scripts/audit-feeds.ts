/**
 * Ask every catalogued publisher directly, and say what we could read.
 *
 * ## Why this exists
 *
 * The engine reports a feed as `empty` when it answered and gave us nothing,
 * and that state is deliberately not a failure — a quiet hour is real, and the
 * absence of events is never evidence that nothing happened.
 *
 * But `empty` also hides its opposite. A publisher can answer 200 with a
 * thousand records that our mapping cannot read, and the board will call it a
 * quiet hour every time. Measured on the live board: NVD returned 381,076
 * vulnerabilities and contributed nothing, because its records carry their
 * headline at `cve.id` and the adapter looked for `title`. Nothing was broken
 * anywhere a test could see it. The feed was simply, permanently silent.
 *
 * So this goes to the source. For each feed it fetches the real URL, counts the
 * records actually present, and reports whether the first one carries anything
 * the adapter would accept as a headline. A feed with records and no readable
 * title is a mapping bug; a feed with no records is genuinely quiet.
 *
 * Passive and read-only, like everything else here: it reads the same public
 * endpoints the engine reads, at the same rate, and writes nothing.
 *
 *   npx tsx scripts/audit-feeds.ts                 # every enabled feed
 *   npx tsx scripts/audit-feeds.ts gdelt nvd_recent
 */
import { CATALOG } from '../lib/engine/catalog/index'
import { decodeBody, fillTemplate, headline, requestUrl } from '../lib/engine/catalog/adapter'
import type { CatalogSource } from '../lib/engine/catalog/types'
import { USER_AGENT } from '../lib/engine/guardrail'

/** How long to wait on one publisher before moving on. */
const TIMEOUT_MS = 25_000

type Verdict = 'readable' | 'unreadable' | 'quiet' | 'unreachable'

interface Finding {
  key: string
  verdict: Verdict
  status: number | null
  bytes: number
  records: number
  detail: string
}

function dig(value: unknown, path?: string): unknown {
  if (!path) return value
  return path
    .split('.')
    .reduce<unknown>((acc, part) => (acc as Record<string, unknown> | undefined)?.[part], value)
}

function firstText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** What the JSON adapter would find, using the same lookups it uses. */
function readJson(source: CatalogSource, text: string): { records: number; detail: string } {
  const body: unknown = JSON.parse(text)
  const rows = source.path ? dig(body, source.path) : body
  const list = Array.isArray(rows) ? rows : (dig(body, 'features') as unknown[] | undefined) ?? []
  if (list.length === 0) return { records: 0, detail: 'no records in the payload' }

  const row = list[0]
  // The real headline, produced the way the adapter produces it — a template
  // that *looks* right but resolves to nothing is exactly the failure this
  // script exists to catch, so reporting the template itself would be useless.
  /**
   * `headline()` is applied here for the same reason this script uses the
   * engine's own lookups and the engine's own headers: an audit that reports
   * something the product would never publish is measuring the instrument, not
   * the feed. Without it this printed a two-line title for a source the board
   * renders on one.
   */
  const title = headline(
    fillTemplate(source.map?.titleTemplate, row) ??
    firstText(dig(row, source.map?.title)) ??
    firstText(dig(row, 'title')) ??
    firstText(dig(row, 'name')) ??
    firstText(dig(row, 'headline')) ??
    firstText(dig(row, 'properties.title')),
  )
  if (title) return { records: list.length, detail: `title: ${title.slice(0, 62)}` }
  const keys = Object.keys((row ?? {}) as Record<string, unknown>).join(', ')
  return { records: list.length, detail: `NO READABLE TITLE — record keys: ${keys.slice(0, 90)}` }
}

/**
 * What the feed parser would find. Counting only, not a second parser.
 *
 * The title is read from *inside* the first item rather than by position among
 * all the `<title>` elements on the page. Counting positions looked simpler and
 * was wrong: a channel that declares an `<image><title>` shifts every index by
 * one, and the script reported two perfectly healthy feeds as unreadable.
 */
function readFeed(text: string): { records: number; detail: string } {
  const items = text.match(/<(item|entry)[\s>]/g) ?? []
  if (items.length === 0) return { records: 0, detail: 'no <item> or <entry> elements' }
  const firstItem = text.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/)?.[0] ?? ''
  const itemTitle = firstItem
    .match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]
    ?.replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, '')
    .trim()
  const clean = headline(itemTitle)
  return clean
    ? { records: items.length, detail: `title: ${clean.slice(0, 62)}` }
    : { records: items.length, detail: 'NO READABLE TITLE — items carry no <title>' }
}

/**
 * When a feed has moved, ask the publisher's own page where it went.
 *
 * Every site that publishes a feed is supposed to advertise it in its `<head>`
 * as `<link rel="alternate" type="application/rss+xml">`, and most still do.
 * A 404 on a feed URL is therefore usually answerable without a search: the new
 * address is sitting on the front page.
 *
 * This only *proposes*. Nothing is changed on the strength of it — a discovered
 * URL still has to be fetched, read and judged before it earns a catalogue
 * entry, because "the site has a feed" and "the site has the feed we were
 * relying on" are different claims.
 */
async function discoverFeeds(pageUrl: string): Promise<string[]> {
  try {
    const origin = new URL(pageUrl).origin
    const res = await fetch(origin, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    })
    if (!res.ok) return []
    const html = await decodeBody(res)
    const found = new Set<string>()
    for (const tag of html.match(/<link[^>]+>/gi) ?? []) {
      if (!/rel=["']?alternate/i.test(tag)) continue
      if (!/type=["']?application\/(rss|atom)\+xml/i.test(tag)) continue
      const href = tag.match(/href=["']([^"']+)["']/i)?.[1]
      if (href) found.add(new URL(href, origin).toString())
    }
    return [...found].slice(0, 4)
  } catch {
    return []
  }
}

async function audit(source: CatalogSource): Promise<Finding> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    /**
     * The engine's own headers, character for character.
     *
     * Not a detail. The first run of this script sent its own user agent and
     * reported 51 feeds unreachable — a number that said nothing about the
     * product, because publishers routinely refuse an agent they do not
     * recognise and accept the one the engine actually presents. An audit taken
     * with a different instrument from the thing being audited measures the
     * instrument.
     *
     * Which is why this **imports** `USER_AGENT` rather than repeating it. The
     * copy that used to sit here was true when written and became false the
     * moment the engine consolidated its identity — the same audit, still
     * claiming to send the engine's headers, would have gone back to measuring
     * itself without a line of it changing.
     */
    const res = await fetch(requestUrl(source, new Date()), {
      signal: controller.signal,
      headers: {
        // The record's own agent where it declares one — the SEC mandates a
        // contact address and 403s anything else, so an audit that ignored the
        // override would report a working feed as dead.
        'User-Agent': source.userAgent ?? USER_AGENT,
        Accept:
          source.kind === 'geojson' || source.kind === 'json'
            ? 'application/json, application/geo+json;q=0.9, */*;q=0.5'
            : 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5',
      },
      redirect: 'follow',
    })
    const text = await decodeBody(res)
    if (!res.ok) {
      // A 404 or 410 means it moved; ask the publisher where to. A 403 means we
      // are being refused, and no amount of discovery changes that.
      const moved = res.status === 404 || res.status === 410
      const candidates = moved ? await discoverFeeds(source.url) : []
      return {
        key: source.key,
        verdict: 'unreachable',
        status: res.status,
        bytes: text.length,
        records: 0,
        detail:
          `publisher answered ${res.status}` +
          (candidates.length ? ` — the site advertises: ${candidates.join(' , ')}` : ''),
      }
    }
    const read = source.kind === 'json' ? readJson(source, text) : readFeed(text)
    const verdict: Verdict =
      read.records === 0 ? 'quiet' : read.detail.startsWith('NO READABLE') ? 'unreadable' : 'readable'
    return { key: source.key, verdict, status: res.status, bytes: text.length, ...read }
  } catch (err) {
    return {
      key: source.key,
      verdict: 'unreachable',
      status: null,
      bytes: 0,
      records: 0,
      detail: (err as Error).message.slice(0, 70),
    }
  } finally {
    clearTimeout(timer)
  }
}

async function main(): Promise<void> {
  const wanted = process.argv.slice(2)
  const sources = CATALOG.filter(
    (s) => (wanted.length === 0 ? s.enabled !== false : wanted.includes(s.key)),
  )
  const findings: Finding[] = []

  for (const source of sources) {
    const finding = await audit(source)
    findings.push(finding)
    const mark =
      finding.verdict === 'unreadable' ? 'UNREADABLE' : finding.verdict === 'quiet' ? 'quiet     ' : finding.verdict === 'unreachable' ? 'unreachable' : 'ok        '
    console.log(
      `${mark} ${finding.key.padEnd(28)} records=${String(finding.records).padStart(5)}  ${finding.detail}`,
    )
  }

  const unreadable = findings.filter((f) => f.verdict === 'unreadable')
  console.log(
    `\n${findings.length} audited · ${findings.filter((f) => f.verdict === 'readable').length} readable · ` +
      `${findings.filter((f) => f.verdict === 'quiet').length} genuinely quiet · ` +
      `${unreadable.length} publishing records we cannot read · ` +
      `${findings.filter((f) => f.verdict === 'unreachable').length} unreachable`,
  )
  if (unreadable.length > 0) {
    console.log(`\nMapping bugs, not quiet hours: ${unreadable.map((f) => f.key).join(', ')}`)
  }
}

void main()
