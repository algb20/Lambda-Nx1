import type { CatalogSource } from '../types'
import { PUBLIC_DOMAIN, ccBy, publicFeed } from '../licence'

/**
 * Infrastructure: energy, connectivity, transport and the environment they run
 * in.
 *
 * This is the layer competitors under-serve, and it is where a great deal of
 * consequence actually lives. A grid frequency excursion, a submarine-cable
 * fault, a national internet shutdown and a port closure are all measurable
 * events with named operators publishing them — and none of them appear in a
 * news feed until hours later, if at all.
 *
 * Everything here is an operator or regulator publishing about its **own**
 * network, which is why the ratings are high: nobody is better placed to know
 * that a grid is short of reserve than the body running it.
 */
export const INFRASTRUCTURE_SOURCES: CatalogSource[] = [
  // ── Electricity ──────────────────────────────────────────────────────────
  {
    key: 'uk_carbon_intensity',
    name: 'UK grid carbon intensity and generation mix',
    publisher: 'National Grid ESO',
    url: 'https://api.carbonintensity.org.uk/intensity',
    kind: 'json',
    path: 'data',
    discipline: 'infra',
    topics: ['energy'],
    coverage: ['GB'],
    admiralty: 'A',
    independence: 'nationalgrid-eso',
    licence: ccBy('National Grid ESO, Carbon Intensity API', 'https://carbonintensity.org.uk/'),
    minIntervalSec: 1800,
    keyless: true,
    /**
     * The record is three numbers and a word — `from`, `to`, `intensity` — with
     * nothing an adapter could read as a headline, so this feed answered every
     * half-hour and contributed nothing, and the board reported it as a quiet
     * hour. It was never quiet; it was unreadable.
     *
     * The forecast is deliberately absent from the headline. The measured figure
     * is what happened; the forecast is what someone expected to happen, and
     * this platform does not put predictions on the board (charter §1).
     */
    map: {
      time: 'from',
      titleTemplate:
        'UK grid carbon intensity {intensity.actual} gCO₂/kWh — {intensity.index}',
    },
    note: 'Half-hourly, measured. A grid under stress shows here before it shows anywhere else.',
  },
  {
    key: 'eia_electricity',
    name: 'US electricity operating data',
    publisher: 'US Energy Information Administration',
    url: 'https://www.eia.gov/opendata/',
    kind: 'json',
    discipline: 'infra',
    topics: ['energy'],
    coverage: ['US'],
    admiralty: 'A',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 3600,
    keyless: false,
    keyEnv: 'EIA_API_KEY',
    enabled: false,
    note: 'Free key. Registered but inert until one is set.',
  },
  {
    key: 'entsoe_transparency',
    name: 'ENTSO-E European electricity transparency',
    publisher: 'European Network of Transmission System Operators',
    url: 'https://web-api.tp.entsoe.eu/api',
    kind: 'json',
    discipline: 'infra',
    topics: ['energy'],
    coverage: 'global',
    admiralty: 'A',
    licence: ccBy('ENTSO-E Transparency Platform', 'https://transparency.entsoe.eu/'),
    minIntervalSec: 3600,
    keyless: false,
    keyEnv: 'ENTSO_E_TOKEN',
    enabled: false,
    note: 'Every European TSO’s load, generation and cross-border flow, in one place.',
  },

  // ── Air quality and environment ──────────────────────────────────────────
  {
    key: 'pm25_lass',
    name: 'PM2.5 open sensor network',
    publisher: 'LASS — Location Aware Sensing System',
    url: 'https://pm25.lass-net.org/API-1.0.0/device/all/latest/',
    kind: 'json',
    path: 'feeds',
    discipline: 'geoint',
    topics: ['air-quality'],
    coverage: 'global',
    // Community sensors, not reference-grade instruments. Useful density,
    // lower authority — and the rating is where that distinction is recorded.
    admiralty: 'C',
    licence: publicFeed('LASS PM2.5 open data', 'https://pm25.lass-net.org/'),
    minIntervalSec: 1800,
    keyless: true,
    map: { lat: 'gps_lat', lon: 'gps_lon', time: 'timestamp' },
    note: 'Dense community coverage; graded C because a low-cost sensor is not a reference monitor.',
  },
  {
    key: 'openaq_measurements',
    name: 'OpenAQ air-quality measurements',
    publisher: 'OpenAQ',
    url: 'https://api.openaq.org/v3/latest',
    kind: 'json',
    path: 'results',
    discipline: 'geoint',
    topics: ['air-quality', 'health'],
    coverage: 'global',
    admiralty: 'B',
    licence: ccBy('OpenAQ', 'https://openaq.org/'),
    minIntervalSec: 3600,
    keyless: false,
    keyEnv: 'OPENAQ_API_KEY',
    enabled: false,
    note: 'Aggregates government reference monitors worldwide. Free key.',
  },

  // ── Weather at model resolution ──────────────────────────────────────────
  {
    key: 'open_meteo_severe',
    name: 'Open-Meteo — multi-model forecast',
    publisher: 'Open-Meteo',
    url: 'https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=temperature_2m,wind_speed_10m',
    kind: 'json',
    discipline: 'geoint',
    topics: ['weather'],
    coverage: 'global',
    admiralty: 'B',
    licence: ccBy('Open-Meteo (ECMWF, NOAA, DWD, Météo-France models)', 'https://open-meteo.com/en/license'),
    minIntervalSec: 900,
    keyless: true,
    enabled: false,
    note: 'Point-query, driven by the geo gateway rather than the sweep.',
  },

  // ── Connectivity and the internet itself ─────────────────────────────────
  {
    key: 'ripe_atlas_anchors',
    name: 'RIPE Atlas — measurement anchors',
    publisher: 'RIPE NCC',
    url: 'https://atlas.ripe.net/api/v2/anchors/?format=json',
    kind: 'json',
    path: 'results',
    discipline: 'infra',
    topics: ['connectivity'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'ripe',
    licence: ccBy('RIPE NCC Atlas', 'https://atlas.ripe.net/legal/'),
    minIntervalSec: 7200,
    keyless: true,
    map: { title: 'fqdn', lat: 'geometry.coordinates.1', lon: 'geometry.coordinates.0' },
    /**
     * Out of the sweep, and kept for the coverage layer.
     *
     * This is an *inventory* of measurement stations, not a stream of events: a
     * row is a hostname like `at-klu-as1111.anchors.atlas.ripe.net`, with no
     * time and no severity. Because it states no time, every row was placed by
     * the moment we fetched it — which made all sixty-eight of them the freshest
     * things on the board, so they took the top of the European column and read
     * as breaking news about Austrian DNS.
     *
     * True, sourced, and not an event. The same distinction NOAA's bare "0.821"
     * reading needed. It still belongs in the catalogue — knowing where the
     * internet is measured from is exactly what the blind-spot layer is built on
     * — it simply must not be swept into the world picture.
     */
    enabled: false,
    note: 'Where the internet is actually measured from — the ground truth behind outage claims. An inventory, not an event stream: read by the coverage layer, not the sweep.',
  },
  {
    key: 'ripe_stat_announced',
    name: 'RIPEstat — routing and announcement data',
    publisher: 'RIPE NCC',
    url: 'https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS3333',
    kind: 'json',
    discipline: 'infra',
    topics: ['connectivity'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'ripe',
    licence: ccBy('RIPE NCC', 'https://stat.ripe.net/docs/terms'),
    minIntervalSec: 3600,
    keyless: true,
    enabled: false,
    note: 'Query-driven: the infrastructure gateway supplies the resource.',
  },
  {
    key: 'ooni_measurements',
    name: 'OONI — confirmed network blocking',
    publisher: 'Open Observatory of Network Interference',
    /**
     * Confirmed blocking only, not every measurement OONI records.
     *
     * The endpoint was the raw log: fifty rows an hour of routine probes, most
     * of them finding nothing, titled with a bare URL — and for the app tests
     * (`signal`, `whatsapp`) `input` is null altogether, so those rows carried
     * no headline at all and were silently dropped. A log of tests that found
     * nothing is not intelligence; it is the absence of intelligence, published
     * at fifty rows an hour.
     *
     * `confirmed=true` is OONI's own verdict that a site was *actually blocked*,
     * not merely slow or unreachable. That is an event: a named site, a named
     * country, at a stated time — the kind of thing this platform exists to put
     * on a map. `order=desc` because without it the API returns the oldest
     * confirmed blocks in its archive, which is the same trap NVD had.
     */
    url: 'https://api.ooni.io/api/v1/measurements?limit=50&confirmed=true&order_by=measurement_start_time&order=desc',
    kind: 'json',
    path: 'results',
    discipline: 'infra',
    topics: ['connectivity'],
    coverage: 'global',
    admiralty: 'B',
    licence: ccBy('OONI', 'https://ooni.org/about/data-policy/'),
    minIntervalSec: 3600,
    keyless: true,
    /**
     * A bare URL was not a headline. `https://fanack.com/` said nothing about
     * what had been found, and a reader could not tell it from any other row.
     * Now that every row is a confirmed block, the headline can say so — and it
     * names the country, because "blocked" without "where" is not a fact anyone
     * can use.
     */
    map: {
      titleTemplate: 'Blocked in {probe_cc}: {input}',
      title: 'input',
      time: 'measurement_start_time',
    },
    note: 'Censorship and blocking, measured by volunteers rather than asserted.',
  },
  {
    key: 'internet_outage_isoc',
    name: 'Internet Society Pulse — shutdowns',
    publisher: 'Internet Society',
    url: 'https://pulse.internetsociety.org/api/shutdowns',
    kind: 'json',
    discipline: 'infra',
    topics: ['connectivity'],
    coverage: 'global',
    admiralty: 'B',
    licence: ccBy('Internet Society Pulse', 'https://pulse.internetsociety.org/'),
    minIntervalSec: 3600,
    keyless: true,
    enabled: false,
    note: 'Documented national shutdowns. Endpoint shape to confirm before enabling.',
  },

  // ── Aviation ─────────────────────────────────────────────────────────────
  // `faa_nasstatus` used to sit here declaring `kind: 'json'`. The endpoint
  // answers a bespoke `<AIRPORT_STATUS_INFORMATION>` document, so every sweep
  // failed on "Unexpected token '<'" and the aviation topic was empty. It is now
  // a coded source with a real parser: `lib/engine/sources/aviation.ts`.
  {
    key: 'opensky_states',
    name: 'OpenSky Network — live aircraft states',
    publisher: 'OpenSky Network',
    url: 'https://opensky-network.org/api/states/all',
    kind: 'json',
    path: 'states',
    discipline: 'geoint',
    topics: ['aviation'],
    coverage: 'global',
    admiralty: 'B',
    // Deliberately kept in the catalogue and deliberately excluded: OpenSky's
    // terms require a prior agreement for commercial REST use. The licence
    // registry blocks it, and the record documents both the gap and its remedy.
    licence: {
      id: 'agreement-required',
      name: 'OpenSky Network (commercial use requires a prior agreement)',
      commercialUse: false,
      storage: true,
      redistribute: false,
      termsUrl: 'https://opensky-network.org/about/terms-of-use',
    },
    minIntervalSec: 60,
    keyless: true,
    note: 'Blocked by the licence registry until an agreement exists. The gap is real and named.',
  },

  /**
   * The UK's air accident investigator — added because aviation had **one**
   * working independent origin.
   *
   * The self-audit named it: *"aviation has 1 working independent origin.
   * Nothing on this topic can be corroborated beyond that."* One origin is not
   * a source of intelligence, it is a single point of failure with a citation —
   * if it is wrong, or quiet, the topic is wrong or quiet with it, and nothing
   * in the confidence grade can tell you so (charter §2a).
   *
   * The AAIB is a genuinely separate origin from the FAA: a different state, a
   * different legal regime, its own field investigations. It is not a
   * republisher of anything already counted.
   *
   * The `.atom` suffix is a gov.uk platform convention — every organisation
   * page serves one — which is why this is a stable URL rather than a feed path
   * that a site redesign will move. Verified live: 200, 20 entries, 703 ms.
   */
  {
    key: 'gov_uk_aaib',
    name: 'AAIB — air accident investigations',
    publisher: 'UK Air Accidents Investigation Branch',
    url: 'https://www.gov.uk/government/organisations/air-accidents-investigation-branch.atom',
    kind: 'rss',
    discipline: 'geoint',
    topics: ['aviation'],
    coverage: ['GB'],
    admiralty: 'A',
    independence: 'uk-gov',
    licence: ccBy(
      'AAIB, Open Government Licence v3.0',
      'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
    ),
    minIntervalSec: 3600,
    keyless: true,
    note: 'Second independent origin for aviation. Formal investigations and safety bulletins, not traffic data.',
  },

  // ── Maritime ─────────────────────────────────────────────────────────────
  /**
   * The maritime counterpart, and for the same reason: the topic rested on one
   * origin, and that origin was a NOAA tide gauge — an instrument, not an
   * account of anything happening at sea.
   *
   * Grouped as `uk-gov` alongside the AAIB rather than given its own
   * independence key. The two branches are separate investigators, but they
   * are one government publishing through one platform, and counting them as
   * two independent origins would inflate exactly the number this project
   * refuses to inflate (charter §2a). Maritime still rises from one origin to
   * two, honestly.
   *
   * Verified live: 200, 20 entries, 457 ms.
   */
  {
    key: 'gov_uk_maib',
    name: 'MAIB — marine accident investigations',
    publisher: 'UK Marine Accident Investigation Branch',
    url: 'https://www.gov.uk/government/organisations/marine-accident-investigation-branch.atom',
    kind: 'rss',
    discipline: 'geoint',
    topics: ['maritime'],
    coverage: ['GB'],
    admiralty: 'A',
    independence: 'uk-gov',
    licence: ccBy(
      'MAIB, Open Government Licence v3.0',
      'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
    ),
    minIntervalSec: 3600,
    keyless: true,
    note: 'Second independent origin for maritime. Casualty investigations and safety bulletins.',
  },
  {
    key: 'noaa_coops_water',
    name: 'NOAA CO-OPS — water levels and currents',
    publisher: 'NOAA Center for Operational Oceanographic Products',
    url: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_level&application=lambda&format=json&date=latest&station=8454000&datum=MLLW&units=metric&time_zone=gmt',
    kind: 'json',
    path: 'data',
    discipline: 'geoint',
    topics: ['maritime', 'flood'],
    coverage: ['US'],
    admiralty: 'A',
    independence: 'noaa',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 900,
    keyless: true,
    /**
     * The station is fixed in the URL above (8454000, Providence RI), so naming
     * it in the headline states a fact rather than guessing one. The row itself
     * carries only a time and a number — which is how this feed came to publish
     * world events titled "0.821".
     */
    map: {
      time: 't',
      titleTemplate: 'Water level {v} m at Providence, Rhode Island — NOAA gauge 8454000',
    },
    note: 'Storm surge measured at the gauge, not modelled. One station, not a national picture.',
  },
  {
    key: 'usgs_water_alerts',
    name: 'USGS — river gauge readings',
    publisher: 'United States Geological Survey',
    url: 'https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=tx&parameterCd=00065&siteStatus=active',
    kind: 'json',
    path: 'value.timeSeries',
    discipline: 'geoint',
    topics: ['flood'],
    coverage: ['US'],
    admiralty: 'A',
    independence: 'usgs',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 1800,
    keyless: true,
    map: { title: 'sourceInfo.siteName' },
    enabled: false,
    note: 'Per-state query; driven by the geo gateway rather than the sweep.',
  },
]
