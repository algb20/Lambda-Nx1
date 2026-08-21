import type { CatalogSource } from '../types'
import { PUBLIC_DOMAIN, ccBy, publicFeed } from '../licence'

/**
 * Institutional and official publication.
 *
 * The distinction that matters here is between an institution publishing about
 * **itself** and anyone reporting on it. A central bank's own release is a
 * primary document; a story about that release is not. Both are useful and they
 * are not the same evidence, so they are graded differently and grouped
 * differently — a wire story and the press release it describes must never
 * count as two independent confirmations of each other.
 */
export const OFFICIAL_SOURCES: CatalogSource[] = [
  // ── Health ───────────────────────────────────────────────────────────────
  {
    key: 'who_don',
    name: 'WHO Disease Outbreak News',
    publisher: 'World Health Organization',
    url: 'https://www.who.int/feeds/entity/csr/don/en/rss.xml',
    kind: 'rss',
    discipline: 'humint',
    topics: ['health'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'who',
    licence: publicFeed('World Health Organization', 'https://www.who.int/about/policies/terms-of-use'),
    minIntervalSec: 3600,
    keyless: true,
    note: 'The authoritative record of verified outbreaks.',
  },
  {
    key: 'ecdc_threats',
    name: 'ECDC communicable disease threats',
    publisher: 'European Centre for Disease Prevention and Control',
    url: 'https://www.ecdc.europa.eu/en/taxonomy/term/1416/feed',
    kind: 'rss',
    discipline: 'humint',
    topics: ['health'],
    coverage: 'global',
    admiralty: 'A',
    licence: ccBy('ECDC', 'https://www.ecdc.europa.eu/en/copyright'),
    minIntervalSec: 3600,
    keyless: true,
  },
  {
    key: 'cdc_outbreaks',
    name: 'US CDC outbreak notices',
    publisher: 'US Centers for Disease Control and Prevention',
    url: 'https://tools.cdc.gov/api/v2/resources/media/403372.rss',
    kind: 'rss',
    discipline: 'humint',
    topics: ['health'],
    coverage: 'global',
    admiralty: 'A',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 3600,
    keyless: true,
  },

  // ── Humanitarian & displacement ──────────────────────────────────────────
  {
    key: 'reliefweb_reports',
    name: 'ReliefWeb situation reports',
    publisher: 'UN OCHA',
    url: 'https://api.reliefweb.int/v1/reports?appname=lambda-nx&limit=50&sort[]=date:desc&profile=list',
    kind: 'json',
    path: 'data',
    discipline: 'humint',
    topics: ['humanitarian', 'displacement', 'conflict'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'un-ocha',
    licence: ccBy('UN OCHA ReliefWeb', 'https://reliefweb.int/terms-conditions'),
    minIntervalSec: 1800,
    keyless: true,
    map: { title: 'fields.title', time: 'fields.date.created' },
  },
  {
    key: 'unhcr_news',
    name: 'UNHCR news and refugee data',
    publisher: 'UN Refugee Agency',
    url: 'https://www.unhcr.org/rss.xml',
    kind: 'rss',
    discipline: 'humint',
    topics: ['displacement', 'humanitarian'],
    coverage: 'global',
    admiralty: 'A',
    licence: publicFeed('UNHCR', 'https://www.unhcr.org/terms-and-conditions'),
    minIntervalSec: 3600,
    keyless: true,
  },
  {
    key: 'ifrc_appeals',
    name: 'IFRC emergency appeals',
    publisher: 'International Federation of Red Cross and Red Crescent Societies',
    // `go.ifrc.org` now serves the single-page app for this path and returns
    // its HTML shell to an API request. The API itself lives on the admin host,
    // unchanged and unauthenticated.
    url: 'https://goadmin.ifrc.org/api/v2/appeal/?format=json&limit=40&ordering=-start_date',
    kind: 'json',
    path: 'results',
    discipline: 'humint',
    topics: ['humanitarian'],
    coverage: 'global',
    admiralty: 'A',
    licence: ccBy('IFRC GO', 'https://go.ifrc.org/'),
    minIntervalSec: 3600,
    keyless: true,
    map: { title: 'name', time: 'start_date' },
  },

  // ── Food security & agriculture ──────────────────────────────────────────
  {
    key: 'fao_giews',
    name: 'FAO GIEWS food-security alerts',
    publisher: 'UN Food and Agriculture Organization',
    url: 'https://www.fao.org/giews/rss/en/',
    kind: 'rss',
    discipline: 'humint',
    topics: ['humanitarian', 'drought'],
    coverage: 'global',
    admiralty: 'A',
    licence: ccBy('FAO GIEWS', 'https://www.fao.org/contact-us/terms/en/'),
    minIntervalSec: 7200,
    keyless: true,
  },

  // ── Economic & monetary ──────────────────────────────────────────────────
  {
    key: 'ecb_press',
    // One institution, one independence group: an ECB speech and an ECB press
    // release are not two independent confirmations of the ECB's position.
    independence: 'ecb',
    name: 'European Central Bank — press releases',
    publisher: 'European Central Bank',
    url: 'https://www.ecb.europa.eu/rss/press.html',
    kind: 'rss',
    discipline: 'fin',
    topics: ['economy', 'markets', 'official'],
    coverage: 'global',
    admiralty: 'A',
    licence: publicFeed('European Central Bank', 'https://www.ecb.europa.eu/services/disclaimer/html/index.en.html'),
    minIntervalSec: 1800,
    keyless: true,
  },
  {
    key: 'fed_press',
    independence: 'federalreserve',
    name: 'US Federal Reserve — press releases',
    publisher: 'Board of Governors of the Federal Reserve System',
    url: 'https://www.federalreserve.gov/feeds/press_all.xml',
    kind: 'rss',
    discipline: 'fin',
    topics: ['economy', 'markets', 'official'],
    coverage: ['US'],
    admiralty: 'A',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 1800,
    keyless: true,
  },
  {
    key: 'imf_news',
    name: 'IMF news and country reports',
    publisher: 'International Monetary Fund',
    url: 'https://www.imf.org/en/News/RSS?language=eng',
    kind: 'rss',
    discipline: 'fin',
    topics: ['economy', 'official'],
    coverage: 'global',
    admiralty: 'A',
    licence: publicFeed('International Monetary Fund', 'https://www.imf.org/external/terms.htm'),
    minIntervalSec: 3600,
    keyless: true,
  },
  {
    key: 'worldbank_news',
    name: 'World Bank news',
    publisher: 'World Bank Group',
    url: 'https://www.worldbank.org/en/news/all?format=rss',
    kind: 'rss',
    discipline: 'fin',
    topics: ['economy', 'official'],
    coverage: 'global',
    admiralty: 'A',
    licence: ccBy('World Bank', 'https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets'),
    minIntervalSec: 3600,
    keyless: true,
  },
  {
    key: 'bis_press',
    name: 'Bank for International Settlements',
    publisher: 'Bank for International Settlements',
    url: 'https://www.bis.org/doclist/all_rss.xml',
    kind: 'rss',
    discipline: 'fin',
    topics: ['economy', 'official'],
    coverage: 'global',
    admiralty: 'A',
    licence: publicFeed('Bank for International Settlements', 'https://www.bis.org/terms_conditions.htm'),
    minIntervalSec: 7200,
    keyless: true,
  },
  {
    key: 'eurostat_releases',
    name: 'Eurostat statistical releases',
    publisher: 'Eurostat',
    url: 'https://ec.europa.eu/eurostat/api/dissemination/catalogue/rss/en/statistics-update.rss',
    kind: 'rss',
    discipline: 'fin',
    topics: ['economy'],
    coverage: 'global',
    admiralty: 'A',
    licence: ccBy('Eurostat', 'https://ec.europa.eu/eurostat/about-us/policies/copyright'),
    minIntervalSec: 7200,
    keyless: true,
  },

  // ── Sanctions & corporate registries ─────────────────────────────────────
  {
    key: 'opensanctions_updates',
    name: 'OpenSanctions — dataset updates',
    publisher: 'OpenSanctions',
    url: 'https://data.opensanctions.org/datasets/latest/default/index.json',
    kind: 'json',
    discipline: 'fin',
    topics: ['sanctions', 'corporate'],
    coverage: 'global',
    admiralty: 'B',
    licence: ccBy('OpenSanctions', 'https://www.opensanctions.org/licensing/'),
    minIntervalSec: 86400,
    keyless: true,
    note: 'Consolidated sanctions and PEP data, assembled from official lists.',
  },
  {
    key: 'uk_companies_house',
    name: 'UK Companies House — company data',
    publisher: 'Companies House (UK)',
    url: 'https://find-and-update.company-information.service.gov.uk/',
    kind: 'json',
    discipline: 'fin',
    topics: ['corporate'],
    coverage: ['GB'],
    admiralty: 'A',
    licence: ccBy('Companies House, Open Government Licence v3.0', 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/'),
    minIntervalSec: 3600,
    keyless: false,
    keyEnv: 'COMPANIES_HOUSE_API_KEY',
    enabled: false,
    note: 'Needs a free key. Registered but inert until one is set.',
  },

  // ── Procurement ──────────────────────────────────────────────────────────
  {
    key: 'ted_europa',
    name: 'TED — EU public procurement notices',
    publisher: 'Publications Office of the European Union',
    url: 'https://ted.europa.eu/api/v3.0/notices/search?q=*&pageSize=50&scope=3',
    kind: 'json',
    path: 'results',
    discipline: 'fin',
    topics: ['procurement'],
    coverage: 'global',
    admiralty: 'A',
    licence: ccBy('Publications Office of the EU (TED)', 'https://ted.europa.eu/en/simap/legal-notice'),
    minIntervalSec: 3600,
    keyless: true,
    map: { title: 'title', time: 'publicationDate' },
  },
  /**
   * World Bank procurement notices — the second independent origin for a topic
   * that had exactly one.
   *
   * TED covers EU contracting. That is a large slice of the world and it is
   * still one slice: nothing procured in Asia, Africa or Latin America appeared
   * anywhere, and nothing TED published could be corroborated against a second
   * publisher. The Bank's notices are a different origin over a different
   * geography — Bhutan, Ethiopia, Peru — which is what makes it a second
   * *origin* rather than a second copy (charter §2a).
   *
   * ## Two deliberate choices in the mapping
   *
   * `noticedate` is the publication date and is what `time` reads. The record
   * also carries `submission_deadline_date`, which is ISO-formatted and
   * therefore tempting — and it is a **deadline in the future**, not a time of
   * publication. Pointing `time` at it would date every notice weeks ahead and
   * corrupt every recency judgement on the board. `20-Aug-2026` parses
   * correctly; verified rather than assumed.
   *
   * `titleTemplate` builds a headline from the country and the description,
   * because no field on this record is a headline. The alternative — pointing
   * `title` at `bid_description` — is how a tide gauge came to publish a world
   * event called "0.821".
   *
   * **Nothing personal is mapped.** These records carry `contact_email` and
   * `contact_address`, frequently a named individual's personal address. They
   * are public, and publishing them would still be a purpose we cannot justify
   * (charter §3, data minimisation). The mapping takes country, description and
   * date, and nothing else.
   *
   * Verified live: 200, 20 notices, 724 ms.
   */
  {
    key: 'worldbank_procurement',
    name: 'World Bank — procurement notices',
    publisher: 'The World Bank',
    url: 'https://search.worldbank.org/api/v2/procnotices?format=json&rows=50',
    kind: 'json',
    path: 'procnotices',
    discipline: 'fin',
    topics: ['procurement'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'worldbank',
    licence: ccBy('The World Bank', 'https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets'),
    minIntervalSec: 3600,
    keyless: true,
    map: {
      titleTemplate: '{project_ctry_name}: {bid_description}',
      title: 'notice_type',
      time: 'noticedate',
    },
    note: 'Second independent origin for procurement, and the first outside the EU.',
  },

  // ── Space ────────────────────────────────────────────────────────────────
  {
    key: 'nasa_breaking',
    name: 'NASA news',
    publisher: 'NASA',
    url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss',
    kind: 'rss',
    discipline: 'sci',
    topics: ['space', 'research'],
    coverage: 'global',
    admiralty: 'A',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 3600,
    keyless: true,
  },
]
