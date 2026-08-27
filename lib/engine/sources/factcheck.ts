/**
 * Verification — the claim record, and how many independent checkers addressed it.
 *
 * ## The half of §2.13 that was missing
 *
 * `lib/modules/media.ts` verifies an **artefact**: an image's EXIF, its
 * reverse-image trail, whether it carries the fingerprints of generation. That
 * is one half of the reference's verification discipline. The other half — has
 * this **claim** already been checked, and by whom — did not exist anywhere in
 * the product. Not thinly: not at all.
 *
 * ## What this does that a list of fact-check headlines cannot
 *
 * Anyone can syndicate five RSS feeds. The thing worth building is the reading
 * on top: **how many independent checkers have addressed this subject**.
 *
 * That is our §2a independence discipline applied where it matters most. Five
 * checkers agreeing is worth something only if they are five origins, and here
 * they are — five newsrooms, five owners, and one of them a British charity
 * rather than an American newsroom. So the count is a genuine corroboration
 * reading rather than a headline tally.
 *
 * ## What it refuses to do
 *
 * **It never collapses the checks into a verdict.** Three checkers addressing a
 * claim is not three confirmations of any particular answer, and a product that
 * printed "FALSE — 3 sources" would be inventing a consensus out of the fact
 * that three people wrote about something.
 *
 * It also **never guesses a rating**. Of the five publishers, exactly one —
 * Lead Stories — encodes its finding in the title, after a double dash. For
 * that one the finding is recovered and shown. For the other four the verdict
 * lives on the page, and the row says so and links there. Guessing "False" from
 * a headline beginning "No," would be right often enough to be trusted and
 * wrong often enough to be dangerous, which is the worst combination available.
 *
 * ## §3
 *
 * Syndication feeds, read as published: the headline, the summary and the link.
 * The page behind the link is never fetched — that is the difference between
 * reading a feed and crawling a site, and between a licence we have and one we
 * do not.
 */
import type { Evidence, Source, SourceContext, SourceInput } from '../types'
import { parseFeed } from '../feedxml'
import { byTopic } from '../catalog'
import { independenceGroup } from '../catalog/types'
import type { CatalogSource } from '../catalog/types'
import { SourceUnavailableError } from '../fetch-guard'

interface CheckPoint {
  group: string
  headline: string
  detail?: string
  value?: number
  unit?: string
  at?: string | null
  url?: string
  weight?: number
  groupWeight?: number
}

const GROUP_ORDER = {
  corroboration: 100,
  matched: 90,
  latest: 50,
  publisher: 20,
} as const

function point(
  sourceKey: string,
  p: CheckPoint,
  info: 2 | 3 = 3,
): Evidence {
  return {
    claim: p.detail ? `${p.headline} — ${p.detail}` : p.headline,
    entity: { type: 'other', value: p.group },
    sourceKey,
    sourceUrl: p.url,
    retrievedAt: new Date().toISOString(),
    publishedAt: p.at ?? null,
    // A fact-check is a conclusion *about* evidence, never the evidence. The
    // primary document a checker cites always outranks the check itself.
    admiralty: { source: 'B', info },
    confidence: 'probable',
    data: { ...p },
  }
}

/**
 * The finding, where a publisher actually states one in the feed.
 *
 * Lead Stories titles its checks `Fact Check: <claim> -- <finding>`, so the
 * finding is genuinely recoverable there. Nothing else in this set encodes one,
 * and this function returns `null` for them rather than inferring.
 *
 * The temptation is to read a leading "No," as a false rating. It is right
 * often enough to feel safe and wrong often enough to matter — Full Fact's
 * *"Reform corrects claim that…"* has no leading negation and is a correction;
 * Snopes's *"Is X true? What we know"* is explicitly unresolved. A rating
 * shown with confidence and derived from grammar is worse than no rating.
 */
export function statedFinding(title: string, sourceKey: string): string | null {
  if (sourceKey !== 'lead_stories') return null
  const i = title.indexOf(' -- ')
  if (i < 0) return null
  const finding = title.slice(i + 4).trim()
  return finding.length > 0 ? finding : null
}

/** The claim a check is about, with the publisher's own labelling stripped. */
export function claimOf(title: string, sourceKey: string): string {
  let t = title.trim()
  if (sourceKey === 'lead_stories') {
    const i = t.indexOf(' -- ')
    if (i > 0) t = t.slice(0, i).trim()
    t = t.replace(/^(Fact Check|Prebunk|Debunk)\s*:\s*/i, '').trim()
  }
  return t
}

/**
 * Whether an item is reference material rather than a check.
 *
 * FactCheck.org's feed carries encyclopaedia entries about organisations
 * alongside its checks — *"Americans for Prosperity"*, *"American Bridge 21st
 * Century"* — distinguished only by a **`Players Guide` category**. Listing
 * those as fact-checks presents a reference page as a debunking, which
 * misrepresents both the page and the publisher.
 *
 * The first version of this read the title and the summary, and the live board
 * still showed them: the label is in `<category>`, which the feed parser used
 * to drop. `FeedEntry.categories` now carries it, so the filter reads the
 * **publisher's own classification** instead of guessing from prose — which is
 * the only version of this that could ever have worked.
 */
export function looksLikeReference(categories: string[], title = ''): boolean {
  return categories.some((c) => /players guide/i.test(c)) || /^players guide\b/i.test(title.trim())
}

/**
 * The publishers this gateway actually reads.
 *
 * `byTopic('factcheck')` alone is not that. It returns every catalogue record
 * carrying the topic, including ones that cannot run — a keyed route with no
 * credential, or a record explicitly disabled. The moment Google's Fact Check
 * Tools was catalogued as a keyed, inactive gap, this gateway counted it as a
 * sixth checker and reported **"6 independent fact-checkers have addressed
 * this"** when five had.
 *
 * That is not a display bug. Independent-checker count is the one figure this
 * gateway exists to produce and the §2a discipline applied where it matters
 * most: counting a source we cannot read is exactly the inflation this project
 * refuses in its source numbers. A catalogued gap must never become evidence.
 *
 * The filter is only the credential test, and that limit is deliberate. My
 * first version also excluded `enabled: false`, which removed **every**
 * publisher — because these five are `enabled: false` on purpose. That flag
 * means "driven by this gateway rather than by the ambient sweep", not
 * "unusable"; a fact-check has no coordinates and does not belong on a map.
 * Two different facts share one catalogue, and only one of them is about
 * whether we can read the source.
 */
export function factcheckFeeds(): CatalogSource[] {
  return byTopic('factcheck').filter(
    (f) => f.keyless || (f.keyEnv ? Boolean(process.env[f.keyEnv]) : false),
  )
}

const HOSTS = [...new Set(factcheckFeeds().map((f) => new URL(f.url).hostname.toLowerCase()))]

export const factChecks: Source = {
  key: 'factcheck',
  capability: 'verification',
  passive: true,
  hosts: HOSTS,
  // Low on purpose: this source fetches five feeds inside one run, and the
  // guardrail enforces an interval against the *source*, not the feed. Set
  // high, it would refuse its own second fetch and silently return one
  // publisher's view — the failure this codebase has paid for three times.
  minIntervalMs: 200,
  async run(input: SourceInput, ctx: SourceContext): Promise<Evidence[]> {
    const subject = input.value.trim()
    const query = subject.toLowerCase()
    const feeds = factcheckFeeds()

    const fetched = await Promise.allSettled(
      feeds.map(async (feed) => {
        const res = await ctx.fetch(feed.url, {
          headers: {
            Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5',
          },
        })
        if (!res.ok) throw new Error(`${feed.key}: provider answered ${res.status}`)
        return { feed, entries: parseFeed(await res.text()) }
      }),
    )

    /**
     * One checker failing is survivable; all five failing is not "nothing has
     * been checked". An empty verification panel reads as *this claim is not
     * disputed*, which is the most dangerous empty state in the product.
     */
    if (feeds.length > 0 && fetched.every((r) => r.status === 'rejected')) {
      throw new SourceUnavailableError(
        'factcheck',
        null,
        `all ${feeds.length} fact-checking publishers were unreachable`,
      )
    }

    interface Item {
      feed: CatalogSource
      title: string
      claim: string
      finding: string | null
      summary?: string
      link?: string
      at: string | null
      matches: boolean
    }

    const items: Item[] = []
    for (const result of fetched) {
      if (result.status !== 'fulfilled') continue
      const { feed, entries } = result.value
      for (const entry of entries.slice(0, 20)) {
        if (looksLikeReference(entry.categories, entry.title)) continue
        const claim = claimOf(entry.title, feed.key)
        items.push({
          feed,
          title: entry.title,
          claim,
          finding: statedFinding(entry.title, feed.key),
          summary: entry.summary,
          link: entry.link,
          at: entry.published ?? null,
          matches:
            query.length > 0 &&
            `${entry.title} ${entry.summary ?? ''}`.toLowerCase().includes(query),
        })
      }
    }

    function row(item: Item, group: string, groupWeight: number, weight: number): Evidence {
      const detail = [
        item.feed.publisher,
        item.finding ? `finding: ${item.finding}` : 'verdict on the page — open the check',
        item.summary?.slice(0, 160),
      ]
        .filter(Boolean)
        .join(' · ')
      return point(
        item.feed.key,
        {
          group,
          groupWeight,
          headline: item.claim,
          detail,
          at: item.at,
          url: item.link ?? item.feed.url,
          weight,
        },
        // A finding the publisher stated is better evidence than one that
        // requires opening a page we have not read.
        item.finding ? 2 : 3,
      )
    }

    const out: Evidence[] = []
    const matched = items.filter((i) => i.matches)

    if (subject && matched.length > 0) {
      /**
       * The reading this gateway exists for: how many **independent** checkers
       * addressed the subject. Counting publishers would count Poynter twice
       * if it ever ran two feeds; counting independence groups is the number
       * that belongs in a corroboration judgement, per §2a.
       */
      const origins = new Set(matched.map((i) => independenceGroup(i.feed)))
      out.push(
        point('factcheck', {
          group: `Independent checkers on “${subject}”`,
          groupWeight: GROUP_ORDER.corroboration,
          headline:
            origins.size === 1
              ? `1 independent fact-checker has addressed this`
              : `${origins.size} independent fact-checkers have addressed this`,
          detail:
            `${matched.length} check${matched.length === 1 ? '' : 's'} from ` +
            `${[...new Set(matched.map((i) => i.feed.publisher))].join(', ')}. ` +
            // Said explicitly, because the number invites exactly this mistake.
            `This counts who examined the subject — it is not a verdict, and checkers addressing ` +
            `the same subject may have reached different conclusions.`,
          value: origins.size,
          unit: 'independent checkers',
          weight: 1000,
        }),
      )

      for (const [i, item] of matched.slice(0, 25).entries()) {
        out.push(row(item, `Checks mentioning “${subject}”`, GROUP_ORDER.matched, 1000 - i))
      }
    }

    // The newest checks across every publisher — the honest default for
    // "what has just been debunked", and the answer when nothing was asked.
    const latest = [...items]
      .filter((i) => !i.matches)
      .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
      .slice(0, 15)
    const shown = new Set(latest.map((i) => i.title))
    for (const item of latest) {
      out.push(row(item, 'Latest checks', GROUP_ORDER.latest, 0))
    }

    // Everything else, filed under the newsroom that did the work, so a reader
    // who trusts one checker more than another can go straight to it.
    for (const item of items) {
      if (item.matches || shown.has(item.title)) continue
      out.push(row(item, item.feed.name, GROUP_ORDER.publisher, 0))
    }

    return out
  },
}

export const VERIFICATION_SOURCES: Source[] = [factChecks]
