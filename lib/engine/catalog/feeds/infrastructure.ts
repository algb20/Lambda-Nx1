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
    map: { time: 'from' },
    note: 'Half-hourly. A grid under stress shows here before it shows anywhere else.',
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
    note: 'Where the internet is actually measured from — the ground truth behind outage claims.',
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
    name: 'OONI — network interference measurements',
    publisher: 'Open Observatory of Network Interference',
    url: 'https://api.ooni.io/api/v1/measurements?limit=50&order_by=measurement_start_time',
    kind: 'json',
    path: 'results',
    discipline: 'infra',
    topics: ['connectivity'],
    coverage: 'global',
    admiralty: 'B',
    licence: ccBy('OONI', 'https://ooni.org/about/data-policy/'),
    minIntervalSec: 3600,
    keyless: true,
    map: { title: 'input', time: 'measurement_start_time' },
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

  // ── Maritime ─────────────────────────────────────────────────────────────
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
