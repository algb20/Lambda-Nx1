import type { CatalogSource } from '../types'
import { publicFeed } from '../licence'

/**
 * Regional and multilingual reporting.
 *
 * Every platform in this field indexes English-language wires and calls the
 * result global coverage. It is not: an event in the Sahel, the Andes or
 * Central Asia is usually reported locally, in a local language, hours before
 * any English wire notices — and often never noticed at all. A "global" map
 * built on English sources has an enormous blind spot shaped exactly like the
 * places least covered by international media, which are also the places where
 * a warning matters most.
 *
 * So this file exists to reach reporting where it originates. Two consequences
 * follow, and both are deliberate:
 *
 *  - **Independence groups matter more here, not less.** A regional outlet
 *    republishing a wire is still one confirmation, and grouping is what stops
 *    "eight local sources agree" from meaning "eight papers ran the same
 *    agency copy".
 *  - **Ratings are honest about ownership.** A state broadcaster reporting on
 *    its own government is not an independent observer of it, whatever its
 *    production values. Those are rated C, and the reason is written down.
 */
export const REGIONAL_SOURCES: CatalogSource[] = [
  // ── Middle East & North Africa ───────────────────────────────────────────
  {
    key: 'aljazeera_arabic',
    name: 'الجزيرة — الأخبار',
    publisher: 'Al Jazeera Media Network',
    url: 'https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdff8b8cab9',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    // Same newsroom as the English service: one group, not two.
    independence: 'aljazeera',
    licence: publicFeed('Al Jazeera', 'https://www.aljazeera.com/terms-and-conditions/'),
    minIntervalSec: 1800,
    keyless: true,
  },
  {
    key: 'bbc_arabic',
    name: 'BBC News عربي',
    publisher: 'BBC',
    url: 'https://feeds.bbci.co.uk/arabic/rss.xml',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'bbc',
    licence: publicFeed('BBC News', 'https://www.bbc.co.uk/usingthebbc/terms/'),
    minIntervalSec: 1800,
    keyless: true,
  },
  {
    key: 'france24_arabic',
    name: 'فرانس 24',
    publisher: 'France Médias Monde',
    url: 'https://www.france24.com/ar/rss',
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
    key: 'middleeasteye',
    name: 'Middle East Eye',
    publisher: 'Middle East Eye',
    url: 'https://www.middleeasteye.net/rss',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news', 'conflict'],
    coverage: 'global',
    admiralty: 'C',
    independence: 'middleeasteye',
    licence: publicFeed('Middle East Eye', 'https://www.middleeasteye.net/'),
    minIntervalSec: 3600,
    keyless: true,
  },

  // ── Africa ───────────────────────────────────────────────────────────────
  {
    key: 'allafrica',
    name: 'AllAfrica — continental aggregation',
    publisher: 'AllAfrica Global Media',
    url: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    // An aggregator of African outlets: breadth, not independent authority.
    admiralty: 'C',
    independence: 'allafrica-aggregate',
    licence: publicFeed('AllAfrica', 'https://allafrica.com/misc/info/terms.html'),
    minIntervalSec: 1800,
    keyless: true,
    note: 'Reaches hundreds of African outlets one platform-level integration cannot otherwise see.',
  },
  {
    key: 'africanews',
    name: 'Africanews',
    publisher: 'Euronews / Africanews',
    url: 'https://www.africanews.com/feed/rss',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'euronews',
    licence: publicFeed('Africanews', 'https://www.africanews.com/terms-and-conditions/'),
    minIntervalSec: 1800,
    keyless: true,
  },

  // ── Asia-Pacific ─────────────────────────────────────────────────────────
  {
    key: 'nhk_world',
    name: 'NHK World Japan',
    publisher: 'Japan Broadcasting Corporation',
    url: 'https://www3.nhk.or.jp/nhkworld/en/news/feeds/',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'nhk',
    licence: publicFeed('NHK World', 'https://www3.nhk.or.jp/nhkworld/en/terms/'),
    minIntervalSec: 1800,
    keyless: true,
  },
  {
    key: 'the_hindu',
    name: 'The Hindu — national',
    publisher: 'The Hindu Group',
    url: 'https://www.thehindu.com/news/national/feeder/default.rss',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'thehindu',
    licence: publicFeed('The Hindu', 'https://www.thehindu.com/terms-of-use/'),
    minIntervalSec: 1800,
    keyless: true,
  },
  {
    key: 'channel_news_asia',
    name: 'CNA — Asia',
    publisher: 'Mediacorp',
    url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'cna',
    licence: publicFeed('CNA', 'https://www.channelnewsasia.com/terms-and-conditions'),
    minIntervalSec: 1800,
    keyless: true,
  },
  {
    key: 'scmp_news',
    name: 'South China Morning Post',
    publisher: 'South China Morning Post',
    url: 'https://www.scmp.com/rss/91/feed',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'scmp',
    licence: publicFeed('SCMP', 'https://www.scmp.com/terms-conditions'),
    minIntervalSec: 1800,
    keyless: true,
  },

  // ── Latin America ────────────────────────────────────────────────────────
  {
    key: 'elpais_america',
    name: 'El País — América',
    publisher: 'Grupo PRISA',
    url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/america/portada',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'elpais',
    licence: publicFeed('El País', 'https://elpais.com/estaticos/aviso-legal/'),
    minIntervalSec: 1800,
    keyless: true,
  },
  {
    key: 'infobae',
    name: 'Infobae — América',
    publisher: 'Infobae',
    url: 'https://www.infobae.com/feeds/rss/',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'C',
    independence: 'infobae',
    licence: publicFeed('Infobae', 'https://www.infobae.com/terminos-y-condiciones/'),
    minIntervalSec: 1800,
    keyless: true,
  },

  // ── Europe (non-English origins) ─────────────────────────────────────────
  {
    key: 'euronews',
    name: 'Euronews',
    publisher: 'Euronews',
    url: 'https://www.euronews.com/rss',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'euronews',
    licence: publicFeed('Euronews', 'https://www.euronews.com/terms-of-use'),
    minIntervalSec: 1800,
    keyless: true,
  },
  {
    key: 'lemonde_international',
    name: 'Le Monde — international',
    publisher: 'Groupe Le Monde',
    url: 'https://www.lemonde.fr/international/rss_full.xml',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'lemonde',
    licence: publicFeed('Le Monde', 'https://www.lemonde.fr/mentions-legales/'),
    minIntervalSec: 1800,
    keyless: true,
  },
  {
    key: 'spiegel_international',
    name: 'DER SPIEGEL — international',
    publisher: 'DER SPIEGEL',
    url: 'https://www.spiegel.de/international/index.rss',
    kind: 'rss',
    discipline: 'osint',
    topics: ['news'],
    coverage: 'global',
    admiralty: 'B',
    independence: 'spiegel',
    licence: publicFeed('DER SPIEGEL', 'https://www.spiegel.de/dienste/impressum-1000000.html'),
    minIntervalSec: 1800,
    keyless: true,
  },
]
