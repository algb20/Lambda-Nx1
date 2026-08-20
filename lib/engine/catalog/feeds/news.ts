import type { CatalogSource } from '../types'
import { ccBy, publicFeed } from '../licence'

/**
 * News and reporting.
 *
 * This file is where the **independence group** earns its keep, and it is the
 * single most important idea in the catalogue.
 *
 * Twenty newspapers running one agency's wire is not twenty confirmations. It
 * is one, republished twenty times, and a corroboration score that counts
 * outlets rather than origins does not measure how well-established a claim is
 * — it measures how widely a single claim was syndicated. That is precisely
 * backwards, because heavy syndication of an unverified report is the shape of
 * a rumour propagating, not of a fact being confirmed.
 *
 * So national broadcasters that carry their own correspondents are their own
 * groups, and outlets that principally republish a wire share the wire's group.
 * The judgement is coarse and it is stated per source rather than hidden in an
 * algorithm, so it can be argued with.
 *
 * Ratings follow the same discipline as the rest of the catalogue: a public
 * broadcaster with its own newsroom is a B; an aggregator is a C; an outlet
 * whose funder has a stake in what it reports on is a C whatever its
 * production values.
 */
export const NEWS_SOURCES: CatalogSource[] = [
  // ── Wire services — the origins most other coverage descends from ────────
  {
    key: 'reuters_world',
    name: 'Reuters — world news',
    publisher: 'Reuters',
    url: 'https://www.reutersagency.com/feed/?best-topics=world&post_type=best',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'reuters',
    licence: publicFeed('Reuters', 'https://www.reutersagency.com/en/'),
    minIntervalSec: 900,
    keyless: true,
  },
  {
    key: 'ap_topnews',
    name: 'Associated Press — top news',
    publisher: 'Associated Press',
    url: 'https://feedx.net/rss/ap.xml',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'ap',
    licence: publicFeed('Associated Press'),
    minIntervalSec: 900,
    keyless: true,
  },
  {
    key: 'afp_via_gdelt',
    name: 'GDELT — global news events',
    publisher: 'The GDELT Project',
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=sourcelang:english&mode=artlist&maxrecords=75&format=json&sort=datedesc',
    kind: 'json',
    path: 'articles',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'C',
    // GDELT indexes everyone, so it is nobody's independent confirmation: it
    // is a view over the same corpus the other entries sit inside.
    independence: 'gdelt-aggregate',
    licence: publicFeed('The GDELT Project', 'https://www.gdeltproject.org/about.html'),
    minIntervalSec: 900,
    keyless: true,
    map: { title: 'title', url: 'url', time: 'seendate' },
    note: 'An index of world coverage — breadth, not corroboration.',
  },

  // ── Public broadcasters with their own newsrooms ─────────────────────────
  {
    key: 'bbc_world',
    name: 'BBC News — world',
    publisher: 'BBC',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'bbc',
    licence: publicFeed('BBC News', 'https://www.bbc.co.uk/usingthebbc/terms/'),
    minIntervalSec: 900,
    keyless: true,
  },
  {
    key: 'aljazeera',
    name: 'Al Jazeera English',
    publisher: 'Al Jazeera Media Network',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'aljazeera',
    licence: publicFeed('Al Jazeera', 'https://www.aljazeera.com/terms-and-conditions/'),
    minIntervalSec: 900,
    keyless: true,
  },
  {
    key: 'dw_world',
    name: 'Deutsche Welle — top stories',
    publisher: 'Deutsche Welle',
    url: 'https://rss.dw.com/rdf/rss-en-all',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'dw',
    licence: publicFeed('Deutsche Welle', 'https://www.dw.com/en/legal-notice/a-15718609'),
    minIntervalSec: 1800,
    keyless: true,
  },
  {
    key: 'france24',
    name: 'France 24 — international',
    publisher: 'France Médias Monde',
    url: 'https://www.france24.com/en/rss',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'france24',
    licence: publicFeed('France 24', 'https://www.france24.com/en/legal-notice'),
    minIntervalSec: 1800,
    keyless: true,
  },
  {
    key: 'npr_world',
    name: 'NPR — world',
    publisher: 'National Public Radio',
    url: 'https://feeds.npr.org/1004/rss.xml',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'npr',
    licence: publicFeed('NPR', 'https://www.npr.org/about-npr/179876898/terms-of-use'),
    minIntervalSec: 1800,
    keyless: true,
  },
  {
    key: 'abc_au',
    name: 'ABC News Australia — just in',
    publisher: 'Australian Broadcasting Corporation',
    url: 'https://www.abc.net.au/news/feed/2942460/rss.xml',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'abc-au',
    licence: publicFeed('ABC (Australia)', 'https://www.abc.net.au/privacy'),
    minIntervalSec: 1800,
    keyless: true,
  },
  {
    key: 'cbc_world',
    name: 'CBC News — world',
    publisher: 'Canadian Broadcasting Corporation',
    url: 'https://www.cbc.ca/webfeed/rss/rss-world',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'cbc',
    licence: publicFeed('CBC News', 'https://www.cbc.ca/aboutcbc/discover/termsofuse.html'),
    minIntervalSec: 1800,
    keyless: true,
  },
  {
    key: 'guardian_world',
    name: 'The Guardian — world',
    publisher: 'Guardian News & Media',
    url: 'https://www.theguardian.com/world/rss',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'guardian',
    licence: publicFeed('The Guardian', 'https://www.theguardian.com/help/terms-of-service'),
    minIntervalSec: 1800,
    keyless: true,
  },

  // ── Reference and encyclopaedic ──────────────────────────────────────────
  {
    key: 'wikipedia_current',
    name: 'Wikipedia — current events',
    publisher: 'Wikimedia Foundation',
    url: 'https://en.wikipedia.org/w/api.php?action=parse&page=Portal:Current_events&prop=text&format=json&formatversion=2',
    kind: 'json',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'C',
    independence: 'wikipedia',
    licence: publicFeed('Wikipedia (CC BY-SA)', 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use'),
    minIntervalSec: 3600,
    keyless: true,
    note: 'A summary written by editors from other coverage — a map of attention, not a source.',
  },
]

/**
 * Research and standards output.
 *
 * Separate from news because a preprint is a different kind of claim from a
 * report: it has not been reviewed, it says so, and treating the two the same
 * way is how "scientists find" headlines get built on nothing.
 */
export const RESEARCH_SOURCES: CatalogSource[] = [
  {
    key: 'arxiv_cs',
    name: 'arXiv — computer science',
    publisher: 'arXiv / Cornell University',
    url: 'https://export.arxiv.org/api/query?search_query=cat:cs.CR+OR+cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=50',
    kind: 'atom',
    discipline: 'sci',
    topics: ['research', 'technology'],
    coverage: 'global',
    // Not peer-reviewed, and the rating says so. The content can still be
    // excellent; the *status* of the claim is what a rating grades.
    admiralty: 'C',
    independence: 'arxiv',
    licence: publicFeed('arXiv', 'https://arxiv.org/help/api/tou'),
    minIntervalSec: 3600,
    keyless: true,
    note: 'Preprints — not peer reviewed. Graded C for status, not for quality.',
  },
  {
    key: 'nature_news',
    name: 'Nature — news',
    publisher: 'Springer Nature',
    url: 'https://www.nature.com/nature.rss',
    kind: 'rss',
    discipline: 'sci',
    topics: ['research'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'nature',
    licence: publicFeed('Nature', 'https://www.nature.com/info/terms-and-conditions'),
    minIntervalSec: 7200,
    keyless: true,
  },
  {
    key: 'science_news',
    name: 'Science — news',
    publisher: 'American Association for the Advancement of Science',
    url: 'https://www.science.org/rss/news_current.xml',
    kind: 'rss',
    discipline: 'sci',
    topics: ['research'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'science-aaas',
    licence: publicFeed('Science / AAAS', 'https://www.science.org/content/page/terms-service'),
    minIntervalSec: 7200,
    keyless: true,
  },
]

/**
 * Replacements for sources the 2026-08-14 probe found broken.
 *
 * Every URL here was requested with the engine's own agent and answered `200`
 * before the record was written — the first sources in this catalogue verified
 * against the live provider rather than against documentation. The others were
 * written from what a provider *says* it publishes, which is how a third of the
 * catalogue came to be pointing at addresses that had moved.
 *
 * What is deliberately absent is as important. Reuters withdrew its public feed
 * and several others sit behind bot challenges; the obvious workaround is to
 * pull those same mastheads out of a news aggregator. That is refused on two
 * grounds, and the second is the one that matters here: it would be one origin
 * wearing twenty names, and a corroboration count built on it would be a lie of
 * exactly the kind this catalogue exists to refuse. Where a publisher will not
 * be read directly, the gap is left open and the blind-spot map reports it.
 */
export const VERIFIED_NEWS_SOURCES: CatalogSource[] = [
  {
    key: 'un_news',
    name: 'UN News — all',
    publisher: 'United Nations',
    url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml',
    kind: 'rss',
    discipline: 'humint',
    topics: ['humanitarian', 'official', 'displacement', 'health'],
    coverage: 'global',
    // The UN reporting on its own operations is the record of those
    // operations, which is a different thing from reporting on a member state.
    admiralty: 'B',
    independence: 'un-news',
    licence: publicFeed('United Nations', 'https://www.un.org/en/about-us/terms-of-use'),
    minIntervalSec: 1800,
    keyless: true,
    note: 'Verified answering 2026-08-14. Replaces the ReliefWeb feeds, whose v1 API was retired.',
  },
  {
    key: 'paho_news',
    name: 'PAHO — Pan American Health Organization',
    publisher: 'Pan American Health Organization',
    url: 'https://www.paho.org/en/rss.xml',
    kind: 'rss',
    discipline: 'humint',
    topics: ['health', 'official'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'paho',
    licence: publicFeed('PAHO/WHO', 'https://www.paho.org/en/terms-use'),
    minIntervalSec: 7200,
    keyless: true,
    note: 'Verified answering 2026-08-14. Replaces paho_alerts, whose URL returned 404.',
  },
]
