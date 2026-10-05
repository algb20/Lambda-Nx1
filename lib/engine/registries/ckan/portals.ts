import type { Licence } from '../../catalog/types'
import { ccBy, ccBySa, licenceProblem, PUBLIC_DOMAIN, publicFeed, WHO_TERMS } from '../../catalog/licence'

/**
 * The open-data portals we federate over.
 *
 * ## Why a registry of portals instead of a source per portal
 *
 * Every other feed in this engine is one integration per provider, because
 * every provider speaks its own shape. Open government data is the exception:
 * a large share of the world's national and municipal catalogues run **CKAN**
 * and expose the identical Action API at `/api/3/action/package_search`. One
 * client therefore reaches all of them, and adding a country is adding a row
 * here — not writing a module. This is the only place in the catalogue where
 * source population grows by *data* rather than by engineering, which is
 * exactly why it is worth building properly.
 *
 * ## What counts as a publisher here (and what does not)
 *
 * A portal is **not** a publisher. Inside a CKAN portal, the publishers are its
 * *organizations* — the individual ministries, agencies and municipalities that
 * own datasets. A dataset is not a publisher either; it is a work. Conflating
 * the three is how a catalogue of 100 portals gets advertised as "250,000
 * sources", and this project exists to be the opposite of that. So:
 *
 *   portals   → what we call        (`PORTALS.length`)
 *   organizations → publishers      (measured, per portal, by the federation)
 *   datasets  → works reachable     (measured, reported separately)
 *
 * None of those numbers is written down here as a guess. They are **measured**
 * by `measurePortal()` against the live portal, and a portal that has never
 * been measured contributes zero to reach rather than an estimate.
 *
 * ## Harvesting, and why independence is not portal-shaped
 *
 * Several portals are aggregators: `data.europa.eu` harvests the national
 * catalogues of every EU member state, and most national portals harvest their
 * own regional ones. A dataset found in both a harvester and its origin is
 * **one** origin, not two. `harvests` records that relationship so the
 * federation can collapse it — the same rule that stops twenty outlets carrying
 * one wire from reading as twenty confirmations.
 */
export interface DataPortal {
  key: string
  name: string
  /** The government or body that runs the catalogue itself. */
  operator: string
  /**
   * The CKAN API root, without a trailing slash and *without* `/api/3/action`.
   * The client appends the action path, so a portal that moves its API prefix
   * is one edit here rather than a change everywhere it is used.
   */
  base: string
  /** ISO 3166-1 alpha-2, or 'EU'/'global' for supranational catalogues. */
  country: string
  /**
   * The catalogue's own terms. Deliberately *not* treated as the licence of the
   * data inside it: CKAN records `license_id` per dataset, portals host mixed
   * licences, and assuming the portal's terms cover every dataset is how a
   * share-alike obligation gets missed. This is the licence of the *catalogue
   * metadata*; dataset licences are read per record.
   */
  metadataLicence: Licence
  /**
   * Portals whose datasets this one re-publishes. Reach and corroboration both
   * subtract these — see the harvesting note above.
   */
  harvests?: string[]
  enabled?: boolean
  note?: string
  /** Why a portal is off, with the date and what it answered — an observation, not a decision. */
  disabledNote?: string
}

const OGL_UK = ccBy(
  'Contains public sector information licensed under the Open Government Licence v3.0',
  'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
)

const OGL_CANADA = ccBy(
  'Contains information licensed under the Open Government Licence – Canada',
  'https://open.canada.ca/en/open-government-licence-canada',
)

/**
 * Portals confirmed to expose the CKAN Action API.
 *
 * Ordered by catalogue size where known, so a federated search that stops early
 * has already asked the broadest catalogues. Any portal we are not confident
 * speaks CKAN is carried `enabled: false` with the reason written beside it,
 * rather than left in to fail every sweep and pollute the health report — the
 * same rule the source catalogue uses.
 */
export const PORTALS: DataPortal[] = [
  // ── Anglosphere national catalogues ──────────────────────────────────────
  {
    key: 'us_data_gov',
    name: 'Data.gov',
    operator: 'US General Services Administration',
    base: 'https://catalog.data.gov',
    country: 'US',
    metadataLicence: PUBLIC_DOMAIN,
    note: 'The reference CKAN deployment. Harvests most US federal agency catalogues.',
    enabled: false,
    disabledNote: 'Observed 2026-10-05 (moved): 404 on /api/3/action/package_search — the catalogue API path has changed. Disabled until a recheck shows the API answering; a refusal is the operator\'s terms (charter §3) and is not worked around. Batch 10.',
  },
  {
    key: 'uk_data_gov',
    name: 'data.gov.uk',
    operator: 'UK Cabinet Office',
    base: 'https://data.gov.uk',
    country: 'GB',
    metadataLicence: OGL_UK,
  },
  {
    key: 'ca_open',
    name: 'Open Government Canada',
    operator: 'Treasury Board of Canada Secretariat',
    base: 'https://open.canada.ca/data',
    country: 'CA',
    metadataLicence: OGL_CANADA,
  },
  {
    key: 'au_data_gov',
    name: 'data.gov.au',
    operator: 'Australian Government Digital Transformation Agency',
    base: 'https://data.gov.au/data',
    country: 'AU',
    metadataLicence: ccBy('Commonwealth of Australia', 'https://data.gov.au/'),
  },
  {
    key: 'nz_data_govt',
    name: 'data.govt.nz',
    operator: 'Stats NZ',
    base: 'https://catalogue.data.govt.nz',
    country: 'NZ',
    metadataLicence: ccBy('New Zealand Government', 'https://data.govt.nz/'),
    enabled: false,
    disabledNote: 'Observed 2026-10-05 (bot-blocked): Imperva bot challenge (\"Pardon Our Interruption\") instead of the API. Disabled until a recheck shows the API answering; a refusal is the operator\'s terms (charter §3) and is not worked around. Batch 10.',
  },
  {
    key: 'ie_data_gov',
    name: 'data.gov.ie',
    operator: 'Irish Department of Public Expenditure',
    base: 'https://data.gov.ie',
    country: 'IE',
    metadataLicence: ccBy('Government of Ireland', 'https://data.gov.ie/pages/opendatalicence'),
  },

  // ── Europe ───────────────────────────────────────────────────────────────
  {
    key: 'eu_data_europa',
    name: 'data.europa.eu',
    operator: 'Publications Office of the European Union',
    base: 'https://data.europa.eu/api/hub/search',
    country: 'EU',
    metadataLicence: ccBy(
      'European Union, data.europa.eu',
      'https://data.europa.eu/en/data-policy',
    ),
    harvests: ['de_govdata', 'es_datos', 'nl_overheid', 'fi_avoindata', 'se_dataportal', 'ie_data_gov'],
    enabled: false,
    note:
      'Speaks its own search API, not the CKAN Action API — the client would silently return nothing. Left listed because the harvesting relationship it records is used even while it is off.',
  },
  {
    key: 'de_govdata',
    name: 'GovData Deutschland',
    operator: 'German Federal Ministry of the Interior',
    base: 'https://ckan.govdata.de',
    country: 'DE',
    metadataLicence: ccBy('GovData.de', 'https://www.govdata.de/impressum'),
  },
  {
    key: 'ch_opendata',
    name: 'opendata.swiss',
    operator: 'Swiss Federal Statistical Office',
    base: 'https://opendata.swiss',
    country: 'CH',
    metadataLicence: ccBy('opendata.swiss', 'https://opendata.swiss/en/terms-of-use/'),
  },
  {
    key: 'at_data_gv',
    name: 'data.gv.at',
    operator: 'Austrian Federal Chancellery',
    base: 'https://www.data.gv.at',
    country: 'AT',
    metadataLicence: ccBy('data.gv.at', 'https://www.data.gv.at/infos/nutzungsbedingungen/'),
    enabled: false,
    disabledNote: 'Observed 2026-10-05 (moved): 404 HTML on the CKAN API path. Disabled until a recheck shows the API answering; a refusal is the operator\'s terms (charter §3) and is not worked around. Batch 10.',
  },
  {
    key: 'nl_overheid',
    name: 'data.overheid.nl',
    operator: 'Netherlands Ministry of the Interior',
    base: 'https://data.overheid.nl/data',
    country: 'NL',
    metadataLicence: PUBLIC_DOMAIN,
  },
  {
    key: 'es_datos',
    name: 'datos.gob.es',
    operator: 'Spanish Ministry for Digital Transformation',
    base: 'https://datos.gob.es/apidata',
    country: 'ES',
    metadataLicence: ccBy('datos.gob.es', 'https://datos.gob.es/en/aviso-legal'),
    enabled: false,
    note: 'Exposes a DCAT-AP API rather than the CKAN Action API.',
  },
  {
    key: 'fi_avoindata',
    name: 'Avoindata.fi',
    operator: 'Finnish Digital Agency',
    base: 'https://www.avoindata.fi/data',
    country: 'FI',
    metadataLicence: ccBy('Avoindata.fi', 'https://www.avoindata.fi/en/info'),
    enabled: false,
    disabledNote: 'Observed 2026-10-05 (bot-blocked): 403 Forbidden to the engine\'s User-Agent. Disabled until a recheck shows the API answering; a refusal is the operator\'s terms (charter §3) and is not worked around. Batch 10.',
  },
  {
    key: 'se_dataportal',
    name: 'Sveriges dataportal',
    operator: 'Agency for Digital Government (DIGG)',
    base: 'https://admin.dataportal.se/store',
    country: 'SE',
    metadataLicence: ccBy('Sveriges dataportal', 'https://www.dataportal.se/en/about'),
    enabled: false,
    note: 'Runs EntryScape, not CKAN.',
  },
  {
    key: 'no_data',
    name: 'data.norge.no',
    operator: 'Norwegian Digitalisation Agency',
    base: 'https://data.norge.no',
    country: 'NO',
    metadataLicence: ccBy('data.norge.no', 'https://data.norge.no/'),
    enabled: false,
    note: 'DCAT-AP-NO endpoint, not the CKAN Action API.',
  },
  {
    key: 'it_dati',
    name: 'dati.gov.it',
    operator: 'Agenzia per l’Italia Digitale',
    base: 'https://www.dati.gov.it/opendata',
    country: 'IT',
    metadataLicence: ccBy('dati.gov.it', 'https://www.dati.gov.it/content/note-legali'),
    enabled: false,
    disabledNote: 'Observed 2026-10-05 (bot-blocked): 403 Forbidden to the engine\'s User-Agent. Disabled until a recheck shows the API answering; a refusal is the operator\'s terms (charter §3) and is not worked around. Batch 10.',
  },
  {
    key: 'pt_dados',
    name: 'dados.gov.pt',
    operator: 'Agência para a Modernização Administrativa',
    base: 'https://dados.gov.pt',
    country: 'PT',
    metadataLicence: ccBy('dados.gov.pt', 'https://dados.gov.pt/'),
    enabled: false,
    disabledNote: 'Observed 2026-10-05 (moved): 404 JSON on the CKAN API path. Disabled until a recheck shows the API answering; a refusal is the operator\'s terms (charter §3) and is not worked around. Batch 10.',
  },
  {
    key: 'ro_data_gov',
    name: 'data.gov.ro',
    operator: 'Romanian Government',
    base: 'https://data.gov.ro',
    country: 'RO',
    metadataLicence: ccBy('data.gov.ro', 'https://data.gov.ro/'),
    enabled: false,
    disabledNote: 'Observed 2026-10-05 (moved): connection reset / 404 on the CKAN API path. Disabled until a recheck shows the API answering; a refusal is the operator\'s terms (charter §3) and is not worked around. Batch 10.',
  },

  // ── Latin America, Africa, Asia ──────────────────────────────────────────
  {
    key: 'br_dados',
    name: 'dados.gov.br',
    operator: 'Brazilian Ministry of Management',
    base: 'https://dados.gov.br/dados',
    country: 'BR',
    metadataLicence: ccBy('dados.gov.br', 'https://dados.gov.br/'),
    enabled: false,
    disabledNote: 'Observed 2026-10-05 (credential): 401 — the API now requires authentication. Disabled until a recheck shows the API answering; a refusal is the operator\'s terms (charter §3) and is not worked around. Batch 10.',
  },
  {
    key: 'mx_datos',
    name: 'datos.gob.mx',
    operator: 'Government of Mexico',
    base: 'https://datos.gob.mx/busca',
    country: 'MX',
    metadataLicence: ccBy('datos.gob.mx', 'https://datos.gob.mx/libreusomx'),
    enabled: false,
    disabledNote: 'Observed 2026-10-05 (bot-blocked): Akamai \"Access Denied\" (403). Disabled until a recheck shows the API answering; a refusal is the operator\'s terms (charter §3) and is not worked around. Batch 10.',
  },
  {
    key: 'cl_datos',
    name: 'datos.gob.cl',
    operator: 'Government of Chile',
    base: 'https://datos.gob.cl',
    country: 'CL',
    metadataLicence: ccBy('datos.gob.cl', 'https://datos.gob.cl/'),
  },
  {
    key: 'ar_datos',
    name: 'datos.gob.ar',
    operator: 'Government of Argentina',
    base: 'https://datos.gob.ar',
    country: 'AR',
    metadataLicence: ccBy('datos.gob.ar', 'https://datos.gob.ar/acerca/seccion/marco-legal'),
  },
  {
    key: 'africa_open_data',
    name: 'Africa Open Data',
    operator: 'Code for Africa',
    base: 'https://africaopendata.org',
    country: 'global',
    metadataLicence: ccBySa('Code for Africa', 'https://africaopendata.org/about'),
    note: 'Pan-African aggregation — the widest single reach into a region every comparable platform reads thinly.',
    enabled: false,
    disabledNote: 'Observed 2026-10-05 (bot-blocked): Cloudflare challenge (\"Just a moment...\") instead of the API. Disabled until a recheck shows the API answering; a refusal is the operator\'s terms (charter §3) and is not worked around. Batch 10.',
  },
  {
    key: 'ke_open_data',
    name: 'Kenya Open Data',
    operator: 'Government of Kenya',
    base: 'https://africaopendata.org',
    country: 'KE',
    metadataLicence: ccBySa('Code for Africa', 'https://africaopendata.org/about'),
    harvests: ['africa_open_data'],
    enabled: false,
    note: 'Reached through the pan-African catalogue rather than separately; listed so the harvesting relationship is recorded.',
  },
  {
    key: 'sg_data_gov',
    name: 'data.gov.sg',
    operator: 'Government Technology Agency of Singapore',
    base: 'https://data.gov.sg',
    country: 'SG',
    metadataLicence: publicFeed('data.gov.sg', 'https://data.gov.sg/open-data-licence'),
    enabled: false,
    note: 'Migrated off CKAN to a bespoke API.',
  },
  {
    key: 'jp_data_go',
    name: 'DATA GO JP',
    operator: 'Government of Japan',
    base: 'https://www.data.go.jp/data',
    country: 'JP',
    metadataLicence: ccBy('DATA GO JP', 'https://www.data.go.jp/terms-of-use'),
  },
  {
    key: 'kr_data_go',
    name: 'Korea Public Data Portal',
    operator: 'Ministry of the Interior and Safety (Korea)',
    base: 'https://www.data.go.kr',
    country: 'KR',
    metadataLicence: ccBy('data.go.kr', 'https://www.data.go.kr/'),
    enabled: false,
    note: 'Bespoke API requiring a service key; catalogued for the source dossier.',
  },

  // ── Multilateral and scientific catalogues ───────────────────────────────
  {
    key: 'hdx_unocha',
    name: 'Humanitarian Data Exchange',
    operator: 'UN OCHA Centre for Humanitarian Data',
    base: 'https://data.humdata.org',
    country: 'global',
    metadataLicence: ccBy('UN OCHA HDX', 'https://data.humdata.org/faqs/licenses'),
    note: 'CKAN, and the single most operationally useful catalogue in the registry: displacement, food security and crisis response, in the regions our blind-spot map is loudest about.',
  },
  {
    key: 'who_gho',
    name: 'WHO data catalogue',
    operator: 'World Health Organization',
    base: 'https://apps.who.int/gho',
    country: 'global',
    metadataLicence: WHO_TERMS,
    enabled: false,
    note: 'OData/Athena API, not CKAN.',
  },
  {
    key: 'energydata_info',
    name: 'Energy Data (World Bank / ESMAP)',
    operator: 'World Bank ESMAP',
    base: 'https://energydata.info',
    country: 'global',
    metadataLicence: ccBy('energydata.info', 'https://energydata.info/terms'),
  },
]

/**
 * Portals the federation will actually query: enabled, **and** whose catalogue
 * terms the licence gate accepts for this product.
 *
 * The metadata licence was recorded on every portal but never consulted, so a
 * portal whose terms refuse commercial use would have been queried as soon as
 * someone enabled it — the same gap batch 05 found in the coded sources
 * (batch 09). The only refused portal today, `who_gho`, is also disabled.
 */
export function activePortals(portals = PORTALS): DataPortal[] {
  return portals.filter((p) => p.enabled !== false && licenceProblem(p.metadataLicence) === null)
}

/** Hostnames the federation contacts — what the passive guardrail allow-lists. */
export function portalHosts(portals = PORTALS): string[] {
  const hosts = new Set<string>()
  for (const p of portals) {
    try {
      hosts.add(new URL(p.base).hostname.toLowerCase())
    } catch {
      // A malformed base is caught by the registry test, not swallowed here in
      // a way that would quietly drop the host from the allowlist.
    }
  }
  return [...hosts].sort()
}

/**
 * Portals that are not re-publications of another portal in the registry.
 *
 * The federation counts these when it reports reach, so a harvester and the
 * catalogues it harvests never both count. Kept as a function rather than a
 * constant because `enabled` decides which harvesting relationships are live.
 */
export function independentPortals(portals = activePortals()): DataPortal[] {
  const present = new Set(portals.map((p) => p.key))
  return portals.filter((p) => !(p.harvests ?? []).some((k) => present.has(k)))
}
