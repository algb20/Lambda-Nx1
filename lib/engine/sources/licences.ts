import type { Licence } from '../catalog/types'
import { PUBLIC_DOMAIN, WHO_TERMS, needsAgreement, nonCommercial } from '../catalog/licence'

/**
 * The licence position of every **coded** source.
 *
 * ## Why this exists
 *
 * Catalogue records have always carried a licence, and the licence gate keeps
 * a refused one out of the sweep. Coded sources carried none, so the gate could
 * not see them. In batches 05 and 06 that gap let four coded sources call
 * providers whose terms refuse commercial use without a licence — OpenSky,
 * OpenSanctions, urlscan.io and Shodan InternetDB — while the product has paid
 * tiers (PHASE30_CLOSURE_AUDIT NEW-03).
 *
 * Every coded source now has an entry here, and
 * `lib/conformance/s-invariants.test.ts` fails if a registered source has none,
 * or if a refused one is registered. A new source therefore cannot run until
 * someone has written down what its terms allow.
 *
 * ## The three states, and why "unverified" is one of them
 *
 * - **verified** — the provider's own terms were read on `checked`, quoted in
 *   `evidence`, and allow use in this product (with any condition stated).
 * - **refused** — the terms refuse this product's use without a licence we do
 *   not hold. The source must not be registered; its adapter is kept.
 * - **unverified** — the terms have not been read yet. Recorded as such rather
 *   than guessed. A guess in the permissive direction is exactly the error
 *   this file exists to stop, and a guess in the restrictive direction would
 *   remove working sources on no evidence. Each one is a task, not a pass.
 */
export type CodedLicence =
  | { state: 'verified'; licence: Licence; checked: string; evidence: string; condition?: string }
  | { state: 'refused'; licence: Licence; checked: string; evidence: string }
  | { state: 'unverified'; reason: string }

const CHECKED = '2026-10-04'

const ABUSE_CH_REFUSED: CodedLicence = {
  state: 'refused',
  licence: { id: 'abuse-ch', name: 'abuse.ch (authenticated users only)', commercialUse: false, storage: true, redistribute: false, termsUrl: 'https://abuse.ch/terms-of-use/' },
  checked: '2026-10-04',
  evidence:
    '"Access to the abuse.ch Platforms is provided only to: Authenticated Users"; commercial use "may require a paid subscription, which will be managed by Spamhaus". ThreatFox and URLhaus APIs answered 401 without a key.',
}
const UNREAD: CodedLicence = { state: 'unverified', reason: 'Provider terms not yet read for commercial use.' }

const COINGECKO: CodedLicence = {
  state: 'verified',
  licence: {
    id: 'coingecko-api-terms',
    name: 'CoinGecko API terms',
    commercialUse: true,
    storage: true,
    // The terms forbid redistributing or syndicating *access to the API*;
    // showing the data inside the product is what they license.
    redistribute: false,
    attribution: 'Powered by CoinGecko',
    termsUrl: 'https://www.coingecko.com/en/api_terms',
  },
  checked: CHECKED,
  evidence:
    'Licence allows applications that "charge for your services and products that incorporate or integrates our CoinGecko API", provided they display "Powered by CoinGecko" (font size ≥ 10). Access may not be resold or syndicated.',
  condition: 'Show "Powered by CoinGecko" wherever the data appears — components/powered-by-coingecko.tsx.',
}

const FRED_CITED: CodedLicence = {
  state: 'verified',
  licence: { ...PUBLIC_DOMAIN, id: 'fred-citation', name: 'FRED series usable with citation', attribution: 'FRED, Federal Reserve Bank of St. Louis', termsUrl: 'https://fred.stlouisfed.org/legal/' },
  checked: CHECKED,
  evidence:
    'FRED legal: "Public Domain: Citation requested" and "Copyrighted: Citation required" series "may be used for internal commercial uses … provided that appropriate attribution is given to FRED as well as the original source". "Copyrighted: Pre-approval required" series are excluded from the board (FRED_PRE_APPROVAL_REQUIRED).',
  condition: 'Only citation-class series; each row names FRED and the original source.',
}

const US_FEDERAL: CodedLicence = {
  state: 'verified',
  licence: PUBLIC_DOMAIN,
  checked: CHECKED,
  evidence:
    'Work of the US federal government (17 U.S.C. §105). SEC fair-access policy read 2026-10-04: "Current max request rate: 10 requests/second", with a declared User-Agent carrying contact details.',
}

export const CODED_SOURCE_LICENCES: Record<string, CodedLicence> = {
  // ── Refused: terms forbid this product's use without a licence we do not hold ──
  opensky: {
    state: 'refused',
    licence: needsAgreement('OpenSky Network', 'https://opensky-network.org/about/terms-of-use'),
    checked: CHECKED,
    evidence: 'Commercial REST use requires a prior agreement (catalogue record opensky_states; batch 05).',
  },
  opensanctions: {
    state: 'refused',
    licence: nonCommercial('OpenSanctions — CC BY-NC 4.0', 'https://www.opensanctions.org/licensing/'),
    checked: CHECKED,
    evidence: '"Creative Commons 4.0 Attribution NonCommercial"; commercial use requires a paid licence. The API also answers 401 without a key.',
  },
  urlscan: {
    state: 'refused',
    licence: needsAgreement('urlscan.io', 'https://urlscan.io/terms/'),
    checked: CHECKED,
    evidence: '"Commercial use of any part of our service requires express written permission."',
  },
  'shodan.internetdb': {
    state: 'refused',
    licence: needsAgreement('Shodan InternetDB', 'https://internetdb.shodan.io/'),
    checked: CHECKED,
    evidence: '"free for non-commercial use … If you\'re using the InternetDB API to make money then you need an enterprise license."',
  },

  feodo: ABUSE_CH_REFUSED,
  urlhaus: ABUSE_CH_REFUSED,
  threatfox: ABUSE_CH_REFUSED,
  who_outbreaks: {
    state: 'refused',
    licence: WHO_TERMS,
    checked: CHECKED,
    evidence:
      'WHO terms: extracts "not for sale or for use in conjunction with commercial purposes"; other uses "require explicit, prior authorization in writing".',
  },

  // ── Verified ──────────────────────────────────────────────────────────────
  nominatim: {
    state: 'verified',
    licence: { id: 'ODbL-1.0', name: 'OpenStreetMap (ODbL) via Nominatim', commercialUse: true, storage: true, redistribute: true, attribution: '© OpenStreetMap contributors', termsUrl: 'https://operations.osmfoundation.org/policies/nominatim/' },
    checked: CHECKED,
    evidence:
      'Nominatim usage policy: "an absolute maximum of 1 request per second"; identify with a real User-Agent; "clearly display attribution"; no reselling of geocoding results, no auto-complete, no bulk grids. Commercial apps are not excluded.',
    condition: 'minIntervalMs 1100; engine User-Agent; ODbL attribution shown with Geo results; per-query use only.',
  },
  gravatar: {
    state: 'verified',
    licence: { id: 'gravatar-api', name: 'Gravatar API', commercialUse: true, storage: false, redistribute: false, termsUrl: 'https://docs.gravatar.com/rest/getting-started/' },
    checked: CHECKED,
    evidence: '"The Gravatar API is completely open and free to use" for "developers and organizations of all sizes", under the WordPress.com Guidelines for Responsible Use.',
  },
  coingecko: COINGECKO,
  coingecko_asset: COINGECKO,
  coingecko_board: COINGECKO,
  coingecko_exchanges: COINGECKO,
  coingecko_global: COINGECKO,
  coingecko_series: COINGECKO,
  fred_commodities: FRED_CITED,
  fred_indices: FRED_CITED,
  sec_edgar: US_FEDERAL,
  sec_edgar_ranking: US_FEDERAL,
  sec_full_text: US_FEDERAL,
  edgar: US_FEDERAL,

  // ── Read, and ambiguous: an owner decision, not a guess ───────────────────
  xposedornot: {
    state: 'unverified',
    reason:
      'Terms read 2026-10-04: "The free API is for personal and low-volume use"; commercial products needing more throughput should use paid plans. Whether this product\'s use counts as personal is a DECISION REQUIRED.',
  },
  solana_rpc: {
    state: 'unverified',
    reason:
      'Solana docs read 2026-10-04: "The public RPC endpoints are not intended for production applications" (100 requests / 10 s per IP). A dedicated RPC provider is a DECISION REQUIRED.',
  },

  // ── Not yet read ──────────────────────────────────────────────────────────
  arxiv: UNREAD,
  arxiv_watch: UNREAD,
  bis_speeches: UNREAD,
  celestrak: UNREAD,
  ckan_federation: UNREAD,
  courtlistener: UNREAD,
  crossref: UNREAD,
  crtsh: UNREAD,
  crypto_news: UNREAD,
  'dns.cloudflare': UNREAD,
  'dns.google': UNREAD,
  ecb_policy_rate: UNREAD,
  ecb_reference_rates: UNREAD,
  ecb_yield_curve: UNREAD,
  elexon_grid: UNREAD,
  ethereum_rpc: UNREAD,
  eurostat_hpi: UNREAD,
  faa_nasstatus: UNREAD,
  factcheck: UNREAD,
  federal_register: UNREAD,
  frankfurter: UNREAD,
  frankfurter_board: UNREAD,
  fred_housing: UNREAD,
  gdacs: UNREAD,
  gdelt: UNREAD,
  github: UNREAD,
  gleif: UNREAD,
  gleif_ownership: UNREAD,
  hackernews: UNREAD,
  hf_papers: UNREAD,
  imf_commodities: UNREAD,
  iso_mic_registry: UNREAD,
  iss_position: UNREAD,
  mempool: UNREAD,
  mempool_network: UNREAD,
  noaa_ndbc: UNREAD,
  noaa_swpc: UNREAD,
  official_statements: UNREAD,
  openalex: UNREAD,
  pi_network: UNREAD,
  pubmed: UNREAD,
  radio_browser: UNREAD,
  rdap: UNREAD,
  ukhpi_landregistry: UNREAD,
  usaspending: UNREAD,
  'username.web': UNREAD,
  usgs_quakes: UNREAD,
  usgs_recent: UNREAD,
  wayback: UNREAD,
  wikidata: UNREAD,
  wikimedia_pageviews: UNREAD,
  wikipedia_itn: UNREAD,
  wikipedia_trending: UNREAD,
  worldbank_economy: UNREAD,
  worldbank_projects: UNREAD,
}
