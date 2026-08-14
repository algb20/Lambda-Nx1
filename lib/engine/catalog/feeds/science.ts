import type { CatalogSource } from '../types'
import { PUBLIC_DOMAIN, ccBy, publicFeed } from '../licence'

/**
 * Earth systems and space — the instruments, not the reporting.
 *
 * Space-weather alerts and the Smithsonian volcanism record are deliberately
 * absent: both are already carried in `feeds/hazards.ts`, and the duplicate-key
 * test is what caught the second copy. One record per source, always — two
 * entries for one feed would count as two origins and inflate every
 * corroboration score that touched them.
 *
 * Every source here is an **A**, and the reason is the same in each case: the
 * publisher operates the instrument. A satellite constellation reporting its
 * own retrievals, a magnetometer network reporting its own field measurements,
 * a tide gauge reporting its own water level — these are records, not reports
 * about records, and that distinction is the difference between an Admiralty A
 * and everything below it.
 *
 * The category matters to this platform for a reason beyond completeness. The
 * blind-spot map exists because press coverage of a region collapses to nothing
 * the moment international attention moves on, and instruments do not do that:
 * a seismometer in the Sahel reports at the same rate whether or not anyone is
 * watching. Instrument coverage is therefore the only kind that is roughly
 * *even* across the world, and it is what keeps a thin region from going dark
 * entirely.
 */
export const SCIENCE_SOURCES: CatalogSource[] = [
  // ── Space weather ────────────────────────────────────────────────────────
  {
    key: 'noaa_swpc_kindex',
    name: 'NOAA SWPC — planetary K-index',
    publisher: 'NOAA Space Weather Prediction Center',
    url: 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
    kind: 'json',
    discipline: 'geoint',
    topics: ['space-weather'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'noaa-swpc',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 1800,
    keyless: true,
    enabled: false,
    note: 'A time series rather than an event stream; catalogued for the dossier and read directly by the space-weather layer.',
  },
  {
    key: 'nasa_donki',
    name: 'NASA DONKI — space weather notifications',
    publisher: 'NASA Goddard Space Flight Center',
    url: 'https://api.nasa.gov/DONKI/notifications',
    kind: 'json',
    discipline: 'geoint',
    topics: ['space-weather', 'space'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'nasa-donki',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 3600,
    keyless: false,
    keyEnv: 'NASA_API_KEY',
    note: 'Independent of NOAA — a second instrument network on the same phenomenon, which is what makes corroboration possible here at all.',
  },

  // ── Ice, ocean and climate ───────────────────────────────────────────────
  {
    key: 'nsidc_news',
    name: 'National Snow and Ice Data Center — analyses',
    publisher: 'NSIDC, University of Colorado Boulder',
    url: 'https://nsidc.org/rss.xml',
    kind: 'rss',
    discipline: 'geoint',
    topics: ['weather'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'nsidc',
    licence: ccBy('NSIDC', 'https://nsidc.org/about/use_copyright.html'),
    minIntervalSec: 21600,
    keyless: true,
  },
  {
    key: 'copernicus_news',
    name: 'Copernicus — Earth observation programme',
    publisher: 'European Commission / ESA Copernicus',
    url: 'https://www.copernicus.eu/en/rss.xml',
    kind: 'rss',
    discipline: 'geoint',
    topics: ['weather', 'wildfire', 'flood'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'copernicus',
    licence: ccBy('Copernicus Programme', 'https://www.copernicus.eu/en/access-data/copyright-and-licences'),
    minIntervalSec: 21600,
    keyless: true,
  },
  {
    key: 'noaa_tsunami',
    name: 'NOAA Tsunami Warning System',
    publisher: 'NOAA National Weather Service',
    url: 'https://www.tsunami.gov/events/xml/PAAQAtom.xml',
    kind: 'atom',
    discipline: 'geoint',
    topics: ['tsunami', 'earthquake'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'noaa-tsunami',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 300,
    keyless: true,
    note: 'The shortest-fuse feed in the catalogue: minutes matter, so it is polled at five.',
  },
  {
    key: 'esa_observing',
    name: 'ESA — observing the Earth',
    publisher: 'European Space Agency',
    url: 'https://www.esa.int/rssfeed/Our_Activities/Observing_the_Earth',
    kind: 'rss',
    discipline: 'geoint',
    topics: ['space', 'weather'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'esa',
    licence: ccBy('European Space Agency', 'https://www.esa.int/Services/Terms_and_conditions'),
    minIntervalSec: 21600,
    keyless: true,
  },

  // ── Air quality ──────────────────────────────────────────────────────────
  {
    key: 'openaq_latest',
    name: 'OpenAQ — global air quality measurements',
    publisher: 'OpenAQ',
    url: 'https://api.openaq.org/v3/parameters',
    kind: 'json',
    path: 'results',
    discipline: 'geoint',
    topics: ['air-quality', 'health'],
    coverage: 'global',
    // OpenAQ aggregates government reference monitors. The monitors are A; the
    // aggregation of them is a B, and the honest rating is the aggregation's.
    admiralty: 'B',
    independence: 'openaq',
    licence: ccBy('OpenAQ contributors', 'https://openaq.org/#/about'),
    minIntervalSec: 3600,
    keyless: false,
    keyEnv: 'OPENAQ_API_KEY',
    map: { title: 'name' },
    note: 'Reaches tens of thousands of reference monitors run by national agencies — reach, not integrations.',
  },

  // ── Volcanic and geological ──────────────────────────────────────────────
  {
    key: 'usgs_volcano',
    name: 'USGS Volcano Hazards — activity notices',
    publisher: 'US Geological Survey',
    url: 'https://volcanoes.usgs.gov/vhp/rss/hans.xml',
    kind: 'rss',
    discipline: 'geoint',
    topics: ['volcano'],
    coverage: ['US'],
    admiralty: 'A',
    independence: 'usgs',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 3600,
    keyless: true,
  },

  // ── Standards and measurement ────────────────────────────────────────────
  {
    key: 'ietf_rfc',
    name: 'IETF — newly published RFCs',
    publisher: 'Internet Engineering Task Force',
    url: 'https://www.rfc-editor.org/rfcrss.xml',
    kind: 'rss',
    discipline: 'sci',
    topics: ['technology', 'connectivity'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'ietf',
    licence: publicFeed('IETF Trust', 'https://trustee.ietf.org/documents/trust-legal-provisions/'),
    minIntervalSec: 86400,
    keyless: true,
    note: 'How the internet is actually specified. A change here precedes a change in what is deployable by years.',
  },
  {
    key: 'w3c_news',
    name: 'W3C — standards news',
    publisher: 'World Wide Web Consortium',
    url: 'https://www.w3.org/blog/news/feed',
    kind: 'rss',
    discipline: 'sci',
    topics: ['technology'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'w3c',
    licence: ccBy('W3C', 'https://www.w3.org/copyright/document-license-2023/'),
    minIntervalSec: 86400,
    keyless: true,
  },
  {
    key: 'nist_cyber',
    name: 'NIST — cybersecurity publications',
    publisher: 'US National Institute of Standards and Technology',
    url: 'https://www.nist.gov/news-events/cybersecurity/rss.xml',
    kind: 'rss',
    discipline: 'cyber',
    topics: ['cyber-advisory', 'technology'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'nist',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 86400,
    keyless: true,
  },
]
