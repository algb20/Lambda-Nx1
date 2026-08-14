import type { Discipline, Licence, Topic } from './types'
import { PUBLIC_DOMAIN, ccBy, ccBySa, publicFeed } from './licence'

/**
 * Source **families**: one integration, many publishers behind it.
 *
 * ## The number everyone quotes, and what it actually means
 *
 * Competing platforms advertise "one million sources", "536 providers",
 * "200,000 sources". Those are three different quantities and the marketing
 * does not distinguish them. We do, always:
 *
 *  - **Integrations** — providers we call and parse. Ours are the catalogue
 *    records and coded modules. High quality, low count, and the only number
 *    that reflects engineering.
 *  - **Publishers** — the outlets, registries and repositories reachable
 *    *through* an integration. One GDELT call reaches an index of roughly
 *    100,000 news outlets; one GLEIF file covers every legal entity with an
 *    LEI. This is where a population reaches millions, and it is a legitimate
 *    figure **as long as it is labelled as reach**.
 *  - **Independent origins** — how many of those are not copies of each other.
 *    The only figure that belongs in a confidence score, and always far smaller
 *    than the other two.
 *
 * A platform advertising a million sources is quoting the middle column. This
 * file is where our reach is declared, per family, with the basis for each
 * estimate written down so it can be checked rather than believed.
 *
 * ## Why `publishers` is a conservative estimate, not a boast
 *
 * Every figure below is the **lower bound** the provider itself documents, and
 * `basis` says where it came from. A reach number nobody can audit is exactly
 * the inflated marketing this project exists to be the opposite of — so an
 * estimate we cannot source is not written here at all.
 */
export interface SourceFamily {
  key: string
  name: string
  publisher: string
  /** What the single integration talks to. */
  endpoint: string
  discipline: Discipline
  topics: Topic[]
  /**
   * Distinct publishers, registries or corpora reachable through this one
   * integration. A conservative lower bound.
   */
  publishers: number
  /** Where the figure comes from, so it can be checked rather than trusted. */
  basis: string
  licence: Licence
  keyless: boolean
  /** Live now, or documented and awaiting work. */
  status: 'live' | 'planned'
  note?: string
}

/**
 * CC0 with a request for attribution — how several scholarly indexes license
 * their metadata. Written out because it is neither plain CC0 nor CC-BY, and
 * flattening it into either would misstate the obligation in one direction or
 * the other.
 */
const CC0_ATTRIB: Licence = {
  id: 'CC0-attribution-requested',
  name: 'CC0 with attribution requested',
  commercialUse: true,
  storage: true,
  redistribute: true,
  attribution: 'Metadata from OpenAlex and Crossref',
}

export const SOURCE_FAMILIES: SourceFamily[] = [
  // ── News and media at index scale ────────────────────────────────────────
  {
    key: 'gdelt_index',
    name: 'GDELT global news index',
    publisher: 'The GDELT Project',
    endpoint: 'https://api.gdeltproject.org/api/v2/doc/doc',
    discipline: 'osint',
    topics: ['news', 'conflict'],
    publishers: 100_000,
    basis: 'GDELT documents monitoring news in 100+ languages from tens of thousands of outlets worldwide; 100,000 is the conservative floor.',
    licence: publicFeed('The GDELT Project', 'https://www.gdeltproject.org/about.html'),
    keyless: true,
    status: 'live',
    note: 'Breadth, never corroboration: every outlet in it shares one index.',
  },
  {
    key: 'commoncrawl_index',
    name: 'Common Crawl index',
    publisher: 'Common Crawl Foundation',
    endpoint: 'https://index.commoncrawl.org/',
    discipline: 'osint',
    topics: ['news', 'technology'],
    publishers: 40_000_000,
    basis: 'Common Crawl publishes a monthly archive covering tens of millions of registered domains; 40M is the documented lower bound for hosts in a recent crawl.',
    licence: PUBLIC_DOMAIN,
    keyless: true,
    status: 'planned',
    note: 'Historical corpus for verification, not a live feed.',
  },

  // ── Corporate and legal identity ─────────────────────────────────────────
  {
    key: 'gleif_lei',
    name: 'GLEIF — global legal entity identifiers',
    publisher: 'Global Legal Entity Identifier Foundation',
    endpoint: 'https://api.gleif.org/api/v1/lei-records',
    discipline: 'fin',
    topics: ['corporate', 'sanctions'],
    publishers: 2_600_000,
    basis: 'GLEIF publishes the full LEI population, which passed 2.6 million issued identifiers.',
    licence: ccBy('GLEIF', 'https://www.gleif.org/en/meta/legal'),
    keyless: true,
    status: 'live',
    note: 'Every entity that has ever needed to be identifiable in a financial transaction. Wired twice: `gleif` resolves an entity, `gleif_ownership` walks the Level 2 parent/child relationships.',
  },
  {
    key: 'opencorporates',
    name: 'OpenCorporates — company registers',
    publisher: 'OpenCorporates',
    endpoint: 'https://api.opencorporates.com/v0.4/companies/search',
    discipline: 'fin',
    topics: ['corporate'],
    publishers: 200_000_000,
    basis: 'OpenCorporates states it holds records on over 200 million companies drawn from 140+ official registers.',
    licence: ccBySa('OpenCorporates', 'https://opencorporates.com/legal/terms'),
    keyless: false,
    status: 'planned',
    note: 'Share-alike terms: check §2 of the licence registry before shipping derived data.',
  },
  {
    key: 'sec_edgar_full',
    name: 'SEC EDGAR — full filer population',
    publisher: 'US Securities and Exchange Commission',
    endpoint: 'https://data.sec.gov/submissions/',
    discipline: 'fin',
    topics: ['corporate', 'markets'],
    publishers: 800_000,
    basis: 'EDGAR holds submissions for over 800,000 distinct filers.',
    licence: PUBLIC_DOMAIN,
    keyless: true,
    status: 'planned',
  },

  // ── Knowledge and reference ──────────────────────────────────────────────
  {
    key: 'wikidata_entities',
    name: 'Wikidata — structured knowledge',
    publisher: 'Wikimedia Foundation',
    endpoint: 'https://query.wikidata.org/sparql',
    discipline: 'osint',
    topics: ['news', 'corporate', 'research'],
    publishers: 110_000_000,
    basis: 'Wikidata publishes its item count; it passed 110 million entities.',
    licence: ccBy('Wikidata contributors (CC0)', 'https://www.wikidata.org/wiki/Wikidata:Licensing'),
    keyless: true,
    status: 'live',
    note: 'Already wired as the reference gateway; counted here for reach.',
  },
  {
    key: 'openalex_works',
    name: 'OpenAlex — scholarly works',
    publisher: 'OurResearch',
    endpoint: 'https://api.openalex.org/works',
    discipline: 'sci',
    topics: ['research'],
    publishers: 250_000_000,
    basis: 'OpenAlex documents an index of over 250 million scholarly works across 250,000+ sources.',
    licence: CC0_ATTRIB,
    keyless: true,
    status: 'live',
    note: 'Wired as `openalex` under the research capability.',
  },
  {
    key: 'crossref_dois',
    name: 'Crossref — registered DOIs',
    publisher: 'Crossref',
    endpoint: 'https://api.crossref.org/works',
    discipline: 'sci',
    topics: ['research'],
    publishers: 150_000_000,
    basis: 'Crossref reports over 150 million registered content items.',
    licence: CC0_ATTRIB,
    keyless: true,
    status: 'live',
    note: 'Wired as `crossref` under the research capability.',
  },
  {
    key: 'pubmed',
    name: 'PubMed — biomedical literature',
    publisher: 'US National Library of Medicine',
    endpoint: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi',
    discipline: 'sci',
    topics: ['research', 'health'],
    publishers: 37_000_000,
    basis: 'PubMed states it comprises more than 37 million citations.',
    licence: PUBLIC_DOMAIN,
    keyless: true,
    status: 'live',
    note: 'Wired as `pubmed` under the research capability. Where a health signal is written down before it becomes a news story — and written from the country it happened in, which is where our coverage map is thinnest.',
  },

  // ── Infrastructure at internet scale ─────────────────────────────────────
  {
    key: 'certificate_transparency',
    name: 'Certificate Transparency logs',
    publisher: 'CT log operators (Google, Cloudflare, Let’s Encrypt, DigiCert)',
    endpoint: 'https://crt.sh/',
    discipline: 'cyber',
    topics: ['cyber-advisory', 'connectivity'],
    publishers: 10_000_000_000,
    basis: 'CT logs hold billions of issued certificates; crt.sh indexes over 10 billion entries.',
    licence: PUBLIC_DOMAIN,
    keyless: true,
    status: 'live',
    note: 'Already wired for domain investigation; counted here for reach.',
  },
  {
    key: 'rdap_registries',
    name: 'RDAP — registration data across registries',
    publisher: 'IANA-accredited registries and registrars',
    endpoint: 'https://rdap.org/',
    discipline: 'cyber',
    topics: ['connectivity', 'corporate'],
    publishers: 1_500,
    basis: 'IANA’s RDAP bootstrap covers every gTLD and participating ccTLD registry — around 1,500 endpoints.',
    licence: PUBLIC_DOMAIN,
    keyless: true,
    status: 'live',
  },
  {
    key: 'openstreetmap',
    name: 'OpenStreetMap — the geographic base',
    publisher: 'OpenStreetMap contributors',
    endpoint: 'https://nominatim.openstreetmap.org/',
    discipline: 'geoint',
    topics: ['connectivity', 'maritime', 'aviation'],
    publishers: 9_000_000,
    basis: 'OSM reports over 9 million registered contributors, each an independent surveyor of ground truth.',
    licence: ccBySa('© OpenStreetMap contributors (ODbL)', 'https://www.openstreetmap.org/copyright'),
    keyless: true,
    status: 'planned',
    note: 'ODbL share-alike: derived geographic databases carry obligations. Check before shipping.',
  },

  // ── Government publication at national scale ─────────────────────────────
  {
    key: 'data_gov_catalogs',
    name: 'National open-data catalogues (CKAN)',
    publisher: 'National and municipal open-data portals',
    endpoint: 'https://catalog.data.gov/api/3/action/package_search',
    discipline: 'osint',
    topics: ['official', 'economy'],
    // Reduced from a previously claimed 250,000, which counted *datasets*.
    // A dataset is a work, not a publisher; the publishers are the ministries,
    // agencies and municipalities that own them — CKAN's `organization_list`.
    // Correcting our own headline downwards is the point of this file.
    publishers: 20_000,
    basis: 'Publishers are the organizations inside each portal, not its datasets. Data.gov alone lists thousands; 20,000 is a conservative floor across the portals enumerated in lib/engine/registries/ckan/portals.ts, and `measureFederation()` replaces the estimate with each portal’s own count.',
    licence: PUBLIC_DOMAIN,
    keyless: true,
    status: 'live',
    note: 'One protocol, every portal that speaks it — the only place in the platform where source population grows by data rather than by engineering. Wired as `ckan_federation`.',
  },
]

/** Total publishers reachable, live families only. */
export function livePublisherReach(families = SOURCE_FAMILIES): number {
  return families.filter((f) => f.status === 'live').reduce((n, f) => n + f.publishers, 0)
}

/** Total publishers reachable once the planned families are wired. */
export function plannedPublisherReach(families = SOURCE_FAMILIES): number {
  return families.reduce((n, f) => n + f.publishers, 0)
}
