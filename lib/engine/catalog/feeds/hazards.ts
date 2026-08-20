import type { CatalogSource } from '../types'
import { PUBLIC_DOMAIN, ccBy, publicFeed } from '../licence'

/**
 * Hazard and Earth-observation sources: what instruments and official agencies
 * measured, as opposed to what anyone reported.
 *
 * These carry the highest Admiralty ratings in the catalogue and they earn
 * them. A seismic network publishing its own solutions is a different kind of
 * claim from a newspaper describing an earthquake, and the whole grading scheme
 * is worthless if that distinction is not made here, at the point where a
 * source enters the system.
 *
 * Two conventions run through the file:
 *
 *  - **Independence groups.** Several national services relay a common
 *    upstream. Where they do, they share a group, so a hazard reported by five
 *    relays of one warning centre scores as one confirmation rather than five.
 *  - **Coverage is honest.** A national service is authoritative for its own
 *    territory and nowhere else. Marking one `global` would silently claim
 *    worldwide coverage we do not have and hide a blind spot.
 */
/**
 * The national meteorological services that publish through MeteoAlarm, and the
 * territory each one is authoritative for.
 *
 * ## Why this is a list and not one feed
 *
 * MeteoAlarm used to serve a single Europe-wide Atom feed and the catalogue
 * carried it as one source. That feed is gone — it answers **404** and had been
 * doing so silently, because a feed that cannot be fetched is indistinguishable
 * on the board from a continent with no weather warnings. Europe was simply
 * missing.
 *
 * What replaced it is per-country, and that is better than a restoration.
 * Coverage in this catalogue is stated per territory (see the file header), and
 * one feed marked "Europe" could never say which country a warning was
 * authoritative for. Thirty-nine feeds each carrying one country's warnings can.
 *
 * They share the `eumetnet-meteoalarm` independence group on purpose: they are
 * distinct national services, but they reach us through one aggregator, and a
 * storm crossing four borders must not read as four independent confirmations.
 */
const METEOALARM: ReadonlyArray<readonly [slug: string, name: string, iso: string]> = [
  ['andorra', 'Andorra', 'AD'],
  ['austria', 'Austria', 'AT'],
  ['belgium', 'Belgium', 'BE'],
  ['bosnia-herzegovina', 'Bosnia and Herzegovina', 'BA'],
  ['bulgaria', 'Bulgaria', 'BG'],
  ['croatia', 'Croatia', 'HR'],
  ['cyprus', 'Cyprus', 'CY'],
  ['czechia', 'Czechia', 'CZ'],
  ['denmark', 'Denmark', 'DK'],
  ['estonia', 'Estonia', 'EE'],
  ['finland', 'Finland', 'FI'],
  ['france', 'France', 'FR'],
  ['germany', 'Germany', 'DE'],
  ['greece', 'Greece', 'GR'],
  ['hungary', 'Hungary', 'HU'],
  ['iceland', 'Iceland', 'IS'],
  ['ireland', 'Ireland', 'IE'],
  ['israel', 'Israel', 'IL'],
  ['italy', 'Italy', 'IT'],
  ['latvia', 'Latvia', 'LV'],
  ['lithuania', 'Lithuania', 'LT'],
  ['luxembourg', 'Luxembourg', 'LU'],
  ['malta', 'Malta', 'MT'],
  ['moldova', 'Moldova', 'MD'],
  ['montenegro', 'Montenegro', 'ME'],
  ['netherlands', 'Netherlands', 'NL'],
  ['norway', 'Norway', 'NO'],
  ['poland', 'Poland', 'PL'],
  ['portugal', 'Portugal', 'PT'],
  ['republic-of-north-macedonia', 'North Macedonia', 'MK'],
  ['romania', 'Romania', 'RO'],
  ['serbia', 'Serbia', 'RS'],
  ['slovakia', 'Slovakia', 'SK'],
  ['slovenia', 'Slovenia', 'SI'],
  ['spain', 'Spain', 'ES'],
  ['sweden', 'Sweden', 'SE'],
  ['switzerland', 'Switzerland', 'CH'],
  ['ukraine', 'Ukraine', 'UA'],
  ['united-kingdom', 'United Kingdom', 'GB'],
]

function meteoalarmCountries(): CatalogSource[] {
  return METEOALARM.map(([slug, name, iso]) => ({
    key: `meteoalarm_${slug.replace(/-/g, '_')}`,
    name: `Meteoalarm — ${name} severe weather warnings`,
    publisher: `EUMETNET / national meteorological service of ${name}`,
    url: `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-${slug}`,
    kind: 'atom' as const,
    discipline: 'geoint' as const,
    topics: ['weather', 'storm', 'flood'],
    coverage: [iso],
    admiralty: 'A' as const,
    independence: 'eumetnet-meteoalarm',
    licence: publicFeed('Meteoalarm / EUMETNET', 'https://meteoalarm.org/'),
    // Warnings are issued on the hour and amended within it. Thirty-nine feeds
    // at a quarter-hour each is well inside what the aggregator serves, and it
    // is the interval the aggregator itself refreshes on.
    minIntervalSec: 900,
    keyless: true,
    note: `Official warnings issued by ${name}'s own meteorological service, in CAP.`,
  }))
}

export const HAZARD_SOURCES: CatalogSource[] = [
  // ── Seismic ───────────────────────────────────────────────────────────────
  {
    key: 'usgs_quakes_hour',
    name: 'USGS earthquakes — past hour',
    publisher: 'United States Geological Survey',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
    kind: 'geojson',
    discipline: 'geoint',
    topics: ['earthquake'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'usgs',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 60,
    keyless: true,
    note: 'Every located event in the last hour, updated each minute.',
  },
  {
    key: 'usgs_quakes_day_m25',
    name: 'USGS earthquakes — M2.5+ past day',
    publisher: 'United States Geological Survey',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
    kind: 'geojson',
    discipline: 'geoint',
    topics: ['earthquake'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'usgs',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 300,
    keyless: true,
  },
  {
    key: 'usgs_quakes_week_significant',
    name: 'USGS significant earthquakes — past week',
    publisher: 'United States Geological Survey',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson',
    kind: 'geojson',
    discipline: 'geoint',
    topics: ['earthquake', 'tsunami'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'usgs',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 900,
    keyless: true,
  },
  {
    key: 'emsc_quakes',
    name: 'EMSC recent earthquakes',
    publisher: 'European-Mediterranean Seismological Centre',
    url: 'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=200&orderby=time',
    kind: 'json',
    path: 'features',
    discipline: 'geoint',
    topics: ['earthquake'],
    coverage: 'global',
    admiralty: 'A',
    // Deliberately its own group: EMSC solves independently of the USGS, which
    // is exactly what makes agreement between them worth something.
    independence: 'emsc',
    licence: ccBy('European-Mediterranean Seismological Centre', 'https://www.seismicportal.eu/'),
    minIntervalSec: 300,
    keyless: true,
    map: {
      title: 'properties.flynn_region',
      time: 'properties.time',
      lat: 'properties.lat',
      lon: 'properties.lon',
      magnitude: 'properties.mag',
    },
    note: 'An independent seismic solution — corroboration for USGS, not a copy of it.',
  },
  {
    key: 'bgs_quakes',
    name: 'British Geological Survey — recent earthquakes',
    publisher: 'British Geological Survey',
    url: 'https://quakes.bgs.ac.uk/feeds/MhSeismology.xml',
    kind: 'rss',
    discipline: 'geoint',
    topics: ['earthquake'],
    coverage: ['GB', 'IE'],
    admiralty: 'A',
    licence: ccBy('British Geological Survey', 'https://www.bgs.ac.uk/'),
    minIntervalSec: 900,
    keyless: true,
  },
  {
    key: 'geonet_quakes',
    name: 'GeoNet New Zealand — earthquakes',
    publisher: 'GNS Science / GeoNet',
    url: 'https://api.geonet.org.nz/quake?MMI=3',
    kind: 'json',
    path: 'features',
    discipline: 'geoint',
    topics: ['earthquake', 'volcano'],
    coverage: ['NZ'],
    admiralty: 'A',
    licence: ccBy('GeoNet / GNS Science', 'https://www.geonet.org.nz/'),
    minIntervalSec: 300,
    keyless: true,
    map: {
      title: 'properties.locality',
      time: 'properties.time',
      magnitude: 'properties.magnitude',
    },
  },

  // ── Multi-hazard alerting ────────────────────────────────────────────────
  {
    key: 'gdacs_alerts',
    name: 'GDACS global disaster alerts',
    publisher: 'European Commission / United Nations (GDACS)',
    url: 'https://www.gdacs.org/xml/rss.xml',
    kind: 'rss',
    discipline: 'geoint',
    topics: ['earthquake', 'flood', 'storm', 'volcano', 'drought'],
    coverage: 'global',
    admiralty: 'A',
    licence: publicFeed('GDACS', 'https://www.gdacs.org/'),
    minIntervalSec: 600,
    keyless: true,
    note: 'Multi-hazard alerts with a severity colour, jointly run by the EC and the UN.',
  },
  {
    key: 'nasa_eonet',
    name: 'NASA EONET natural events',
    publisher: 'NASA Earth Observatory',
    url: 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=200',
    kind: 'json',
    path: 'events',
    discipline: 'geoint',
    topics: ['wildfire', 'storm', 'volcano', 'flood', 'drought'],
    coverage: 'global',
    admiralty: 'A',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 900,
    keyless: true,
    map: { title: 'title', time: 'geometry.0.date' },
    note: 'Curated open natural events, each linked to the satellite observation behind it.',
  },
  {
    key: 'reliefweb_disasters',
    name: 'ReliefWeb disasters',
    publisher: 'UN OCHA',
    url: 'https://api.reliefweb.int/v2/disasters?appname=lambda-nx&limit=50&sort[]=date:desc&profile=list',
    kind: 'json',
    path: 'data',
    discipline: 'humint',
    topics: ['humanitarian', 'flood', 'storm', 'drought'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'un-ocha',
    licence: ccBy('UN OCHA ReliefWeb', 'https://reliefweb.int/terms-conditions'),
    minIntervalSec: 1800,
    /**
     * Not keyless any more, and off until that is resolved.
     *
     * v1 answers **410 Gone** and v2 answers **403** with "You are not using an
     * approved appname" — OCHA now issues appnames on request. That is a
     * credential in everything but name, so calling this keyless would be
     * false, and leaving it enabled would keep it in the count of integrations
     * while it contributes nothing. Both are the kind of quiet inflation §2a of
     * the charter exists to prevent.
     *
     * It stays in the catalogue, disabled, because the entry is the record of
     * what has to be done: request an appname at
     * https://apidoc.reliefweb.int/parameters#appname, put it in
     * RELIEFWEB_APPNAME, and turn this back on.
     */
    keyless: false,
    keyEnv: 'RELIEFWEB_APPNAME',
    enabled: false,
    map: { title: 'fields.name', time: 'fields.date.created' },
    note: 'Disabled: v1 is gone and v2 requires an appname approved by OCHA.',
  },

  // ── Weather warnings ─────────────────────────────────────────────────────
  {
    key: 'nws_alerts',
    name: 'US National Weather Service — active alerts',
    publisher: 'NOAA National Weather Service',
    url: 'https://api.weather.gov/alerts/active?severity=Extreme,Severe',
    kind: 'json',
    path: 'features',
    discipline: 'geoint',
    topics: ['storm', 'flood', 'weather'],
    coverage: ['US'],
    admiralty: 'A',
    independence: 'noaa',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 300,
    keyless: true,
    map: { title: 'properties.headline', time: 'properties.sent' },
  },
  {
    key: 'nhc_atlantic',
    name: 'NOAA National Hurricane Center — Atlantic',
    publisher: 'NOAA National Hurricane Center',
    url: 'https://www.nhc.noaa.gov/index-at.xml',
    kind: 'rss',
    discipline: 'geoint',
    topics: ['storm'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'noaa',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 900,
    keyless: true,
  },
  {
    key: 'nhc_pacific',
    name: 'NOAA National Hurricane Center — Eastern Pacific',
    publisher: 'NOAA National Hurricane Center',
    url: 'https://www.nhc.noaa.gov/index-ep.xml',
    kind: 'rss',
    discipline: 'geoint',
    topics: ['storm'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'noaa',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 900,
    keyless: true,
  },
  ...meteoalarmCountries(),

  // ── Volcanic ─────────────────────────────────────────────────────────────
  {
    key: 'si_volcano_weekly',
    name: 'Smithsonian / USGS weekly volcanic activity',
    publisher: 'Smithsonian Institution Global Volcanism Program',
    url: 'https://volcano.si.edu/news/WeeklyVolcanoRSS.xml',
    kind: 'rss',
    discipline: 'geoint',
    topics: ['volcano'],
    coverage: 'global',
    admiralty: 'A',
    licence: publicFeed('Smithsonian Global Volcanism Program', 'https://volcano.si.edu/'),
    minIntervalSec: 3600,
    keyless: true,
  },

  // ── Tsunami ──────────────────────────────────────────────────────────────
  {
    key: 'tsunami_gov',
    name: 'US Tsunami Warning System',
    publisher: 'NOAA Tsunami Warning Centers',
    url: 'https://www.tsunami.gov/events/xml/PAAQAtom.xml',
    kind: 'atom',
    discipline: 'geoint',
    topics: ['tsunami', 'earthquake'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'noaa',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 300,
    keyless: true,
  },

  // ── Space weather ────────────────────────────────────────────────────────
  {
    key: 'noaa_swpc_alerts',
    name: 'NOAA Space Weather Prediction Center — alerts',
    publisher: 'NOAA SWPC',
    url: 'https://services.swpc.noaa.gov/products/alerts.json',
    kind: 'json',
    discipline: 'geoint',
    topics: ['space-weather', 'space'],
    coverage: 'global',
    admiralty: 'A',
    independence: 'noaa',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 900,
    keyless: true,
    map: { title: 'message', time: 'issue_datetime' },
    note: 'Geomagnetic storms and radio blackouts — the ones that take grids and GNSS with them.',
  },
]
