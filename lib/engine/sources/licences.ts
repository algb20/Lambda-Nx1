import type { Licence } from '../catalog/types'
import { CC0, PUBLIC_DOMAIN, WHO_TERMS, ccBy, ccBySa, needsAgreement, nonCommercial } from '../catalog/licence'

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

const US_GOV: CodedLicence = {
  state: 'verified',
  licence: PUBLIC_DOMAIN,
  checked: CHECKED,
  evidence:
    'Work of the United States federal government — not subject to copyright in the US (17 U.S.C. §105). Agencies: FAA, Federal Register (NARA/GPO), NOAA, U.S. Treasury USAspending, USGS.',
}

const FRANKFURTER: CodedLicence = {
  state: 'verified',
  licence: { id: 'frankfurter', name: 'Frankfurter API (rates under each provider\'s terms)', commercialUse: true, storage: true, redistribute: true, attribution: 'European Central Bank', termsUrl: 'https://frankfurter.dev/' },
  checked: CHECKED,
  evidence: 'Frankfurter: free, open-source, "no quotas", rate-limited against abuse; "the rates themselves fall under each provider\'s terms". ECB terms (read the same day) allow reuse with the ECB cited and modifications stated.',
  condition: 'ECB named as source; computed changes declared as computed.',
}

const MEMPOOL: CodedLicence = {
  state: 'verified',
  licence: { id: 'mempool-public-api', name: 'mempool.space public API', commercialUse: true, storage: true, redistribute: true, termsUrl: 'https://mempool.space/docs/api/rest' },
  checked: CHECKED,
  evidence: 'API docs: "we enforce rate limits … HTTP 429 … Consider an enterprise sponsorship if you need higher API limits." No restriction on commercial use is stated.',
  condition: 'Stay within the public rate limits; enterprise sponsorship only if more is needed.',
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

  crossref: {
    state: 'verified',
    licence: { id: 'crossref-metadata', name: 'Crossref metadata', commercialUse: true, storage: true, redistribute: true, termsUrl: 'https://www.crossref.org/documentation/retrieve-metadata/rest-api/' },
    checked: CHECKED,
    evidence: '"almost none of the metadata is subject to copyright, and you may use it for any purpose"; abstracts may be publishers\' copyright. No sign-up required.',
    condition: 'Titles and identifiers only; abstracts are not republished.',
  },
  gleif: {
    state: 'verified',
    licence: { ...CC0, termsUrl: 'https://www.gleif.org/en/meta/lei-data-terms-of-use/' },
    checked: CHECKED,
    evidence: 'LEI data terms: "The data available through the Access Service are provided under the CC0 licence."',
  },
  gleif_ownership: {
    state: 'verified',
    licence: { ...CC0, termsUrl: 'https://www.gleif.org/en/meta/lei-data-terms-of-use/' },
    checked: CHECKED,
    evidence: 'LEI data terms: "The data available through the Access Service are provided under the CC0 licence."',
  },
  arxiv: {
    state: 'verified',
    licence: { ...CC0, name: 'arXiv descriptive metadata (CC0)', termsUrl: 'https://info.arxiv.org/help/api/tou.html' },
    checked: CHECKED,
    evidence: 'arXiv API ToU: "You are free to use descriptive metadata about arXiv e-prints under the terms of the Creative Commons Universal (CC0 1.0) Public Domain Declaration"; tools that help users discover e-prints are permitted.',
    condition: 'Never represent the product as endorsed by arXiv; ≤ 1 request / 3 s, one connection.',
  },
  arxiv_watch: {
    state: 'verified',
    licence: { ...CC0, name: 'arXiv descriptive metadata (CC0)', termsUrl: 'https://info.arxiv.org/help/api/tou.html' },
    checked: CHECKED,
    evidence: 'Same arXiv API ToU as `arxiv`: descriptive metadata under CC0 1.0; discovery and notification tools are permitted.',
    condition: 'Never represent the product as endorsed by arXiv; ≤ 1 request / 3 s, one connection.',
  },
  gdelt: {
    state: 'verified',
    licence: { id: 'gdelt-terms', name: 'GDELT Project (citation and link required)', commercialUse: true, storage: true, redistribute: true, attribution: 'The GDELT Project — https://www.gdeltproject.org/', termsUrl: 'https://www.gdeltproject.org/about.html' },
    checked: CHECKED,
    evidence: '"available for unlimited and unrestricted use for any academic, commercial, or governmental use of any kind without fee"; "any use or redistribution of the data must include a citation to the GDELT Project and a link to this website".',
    condition: 'Citation and link shown under the news results.',
  },
  ecb_policy_rate: {
    state: 'verified',
    licence: { id: 'ecb-reuse', name: 'ECB statistics (source cited)', commercialUse: true, storage: true, redistribute: true, attribution: 'European Central Bank', termsUrl: 'https://www.ecb.europa.eu/services/disclaimer/html/index.en.html' },
    checked: CHECKED,
    evidence: 'ECB disclaimer & copyright: information may be reproduced if "the ECB must be cited as the source"; modifications such as calculated growth rates "must be stated explicitly"; if sold, buyers are told it is free from the ECB.',
    condition: 'ECB named as source; computed changes declared as computed.',
  },
  ecb_yield_curve: {
    state: 'verified',
    licence: { id: 'ecb-reuse', name: 'ECB statistics (source cited)', commercialUse: true, storage: true, redistribute: true, attribution: 'European Central Bank', termsUrl: 'https://www.ecb.europa.eu/services/disclaimer/html/index.en.html' },
    checked: CHECKED,
    evidence: 'Same ECB disclaimer & copyright terms as `ecb_policy_rate`: reproduction allowed with the ECB cited as source; computed modifications stated explicitly.',
    condition: 'ECB named as source; computed changes declared as computed.',
  },
  worldbank_economy: {
    state: 'verified',
    licence: { ...ccBy('World Bank', 'https://datacatalog.worldbank.org/public-licenses') },
    checked: CHECKED,
    evidence: 'World Bank data catalog default licence: CC BY 4.0 — "copy, modify and distribute data in any format for any purpose, including commercial use", with attribution.',
  },
  worldbank_projects: {
    state: 'verified',
    licence: { ...ccBy('World Bank', 'https://datacatalog.worldbank.org/public-licenses') },
    checked: CHECKED,
    evidence: 'Default licence of the World Bank data catalog (CC BY 4.0), which lists Projects & Operations; no dataset-specific exception was found.',
  },
  eurostat_hpi: {
    state: 'verified',
    licence: { id: 'eurostat-reuse', name: 'Eurostat (source acknowledged)', commercialUse: true, storage: true, redistribute: true, attribution: 'Eurostat', termsUrl: 'https://ec.europa.eu/eurostat/web/main/help/copyright-notice' },
    checked: CHECKED,
    evidence: '"Reuse of statistical data … for commercial or non-commercial purposes is authorised provided the source is acknowledged" — except data from non-EU countries and some trade data.',
    condition: 'Eurostat acknowledged on the property board; EU house-price series only.',
  },
  elexon_grid: {
    state: 'verified',
    licence: { id: 'elexon-bmrs', name: 'Elexon BMRS data licence', commercialUse: true, storage: true, redistribute: true, attribution: 'Contains BMRS data © Elexon Limited copyright and database right', termsUrl: 'https://www.elexon.co.uk/bsc/data/balancing-mechanism-reporting-agent/copyright-licence-bmrs-data/' },
    checked: CHECKED,
    evidence: 'Free to "exploit the BMRS Data, including commercially, or by including it in your own product or application", with the statement "Contains BMRS data © Elexon Limited copyright and database right [year]".',
    condition: 'Exact attribution in the power-grid board note.',
  },
  github: {
    state: 'verified',
    licence: { id: 'github-api-terms', name: 'GitHub API terms', commercialUse: true, storage: false, redistribute: false, termsUrl: 'https://docs.github.com/en/site-policy/github-terms/github-terms-of-service' },
    checked: CHECKED,
    evidence: 'Terms §H: no prohibition on commercial products; forbids excessive requests, token sharing to exceed limits, and selling users\' personal information.',
    condition: 'Public repository metadata only; within the unauthenticated rate limit.',
  },

  faa_nasstatus: US_GOV,
  federal_register: US_GOV,
  noaa_ndbc: US_GOV,
  noaa_swpc: US_GOV,
  usaspending: US_GOV,
  usgs_quakes: US_GOV,
  usgs_recent: US_GOV,
  fred_housing: {
    ...FRED_CITED,
    evidence:
      'FRED copyright class checked per series 2026-10-04: MSPUS, HOUST, RRVRUSQ156N, MSACSR "Public Domain: Citation requested"; MORTGAGE30US "Copyrighted: Citation required"; CSUSHPINSA "Pre-Approval Required" — removed.',
  } as CodedLicence,
  imf_commodities: {
    ...FRED_CITED,
    evidence:
      'All 18 IMF primary-commodity series on FRED checked 2026-10-04: "Copyrighted: Citation required" — commercial use allowed with attribution to FRED and the IMF.',
  } as CodedLicence,
  ukhpi_landregistry: {
    state: 'verified',
    licence: { id: 'OGL-UK-3.0', name: 'Open Government Licence v3.0', commercialUse: true, storage: true, redistribute: true, attribution: 'Contains HM Land Registry data © Crown copyright and database right', termsUrl: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/' },
    checked: CHECKED,
    evidence: 'GOV.UK "About the UK House Price Index": published under the Open Government Licence v3.0, which permits commercial reuse with the statement "Contains HM Land Registry data © Crown copyright and database right [year]. This data is licensed under the Open Government Licence v3.0."',
    condition: 'Exact statement shown on the property board.',
  },
  pubmed: {
    state: 'verified',
    licence: { id: 'ncbi-eutils', name: 'NCBI E-utilities (PubMed metadata)', commercialUse: true, storage: true, redistribute: true, termsUrl: 'https://www.ncbi.nlm.nih.gov/home/about/policies/' },
    checked: CHECKED,
    evidence: 'NCBI policies: "NLM does not claim the copyright on the abstracts in PubMed; however, journal publishers or authors may"; E-utilities: "no more than 3 requests every 1 second"; the NCBI disclaimer must be evident to users of services built on the APIs.',
    condition: 'esummary metadata only (no abstracts); 400 ms spacing; NCBI disclaimer linked under research results.',
  },
  wikipedia_itn: {
    state: 'verified',
    licence: ccBySa('Wikipedia contributors', 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use'),
    checked: CHECKED,
    evidence: 'Wikimedia Terms of Use: text under CC BY-SA 4.0 and GFDL; attribution may be "a hyperlink … to the article"; automated use must follow the User-Agent policy and API etiquette and not unduly burden servers.',
    condition: 'Each item links to its article; CC BY-SA 4.0 notice under news results; engine User-Agent carries a contact address.',
  },
  wikipedia_trending: {
    state: 'verified',
    licence: ccBySa('Wikipedia contributors', 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use'),
    checked: CHECKED,
    evidence: 'Same Wikimedia Terms of Use as wikipedia_itn; this source shows article titles linked to their articles, within the User-Agent policy.',
  },
  hf_papers: {
    state: 'unverified',
    reason:
      'Hugging Face terms read 2026-10-04: users must not "reproduce, republish, license any of our proprietary materials" without written permission, and say nothing specific about the Daily Papers listing. Whether that curated listing is their proprietary material is a DECISION REQUIRED.',
  },

  bis_speeches: {
    state: 'refused',
    licence: needsAgreement('Bank for International Settlements', 'https://www.bis.org/terms_conditions.htm'),
    checked: CHECKED,
    evidence: 'BIS terms: users may "download, display, print out, photocopy or redistribute any BIS Material for non-commercial purposes"; commercial reproduction needs written permission.',
  },
  frankfurter: FRANKFURTER,
  frankfurter_board: FRANKFURTER,
  ecb_reference_rates: FRANKFURTER,
  wikidata: {
    state: 'verified',
    licence: { ...CC0, termsUrl: 'https://www.wikidata.org/wiki/Wikidata:Licensing' },
    checked: CHECKED,
    evidence: 'Wikidata licensing: "All structured data (i.e. the main, Property, Lexeme, and EntitySchema namespaces) is released into the public domain under Creative Commons Zero."',
  },
  mempool: MEMPOOL,
  mempool_network: MEMPOOL,
  radio_browser: {
    state: 'verified',
    licence: { id: 'radio-browser', name: 'Radio Browser API', commercialUse: true, storage: true, redistribute: true, termsUrl: 'https://api.radio-browser.info/' },
    checked: CHECKED,
    evidence: '"This API is completely free and open source"; it may be used "in free and non free software"; clients must "send a speaking http agent string".',
  },
  iso_mic_registry: {
    state: 'verified',
    licence: { id: 'iso-10383-terms', name: 'ISO 10383 MIC website terms', commercialUse: true, storage: true, redistribute: false, termsUrl: 'https://www.iso20022.org/sites/default/files/2020-02/ISO10383_Terms_of_use.pdf' },
    checked: CHECKED,
    evidence: 'ISO 10383 terms of use: the material "is intended to be used and reproduced freely"; a non-exclusive right to use it, "excluding the right to reproduce all or substantial part of this website for the purpose of making such reproductions available to third parties".',
    condition: 'Individual venue-code lookups only; the list is never republished whole.',
  },
  official_statements: {
    state: 'unverified',
    reason:
      'Several publishers, read 2026-10-04: White House — "government-produced materials … are not copyright protected" (third-party content CC BY 3.0). United Nations — "News-related material can be used as long as the appropriate credit is given and the United Nations is advised"; other material needs written permission. Notifying the UN is an owner action — DECISION REQUIRED. EC, ECB, Fed, GOV.UK and IAEA feeds not yet read individually.',
  },
  'dns.google': { state: 'unverified', reason: 'Google Public DNS is governed by the Google APIs Terms of Service, which were not read in full on 2026-10-04.' },
  'dns.cloudflare': { state: 'unverified', reason: 'Cloudflare\'s 1.1.1.1 pages read on 2026-10-04 cover privacy only, not permitted use.' },
  wayback: { state: 'unverified', reason: 'The Internet Archive terms page could not be read on 2026-10-04 (help site did not resolve).' },
  wikimedia_pageviews: { state: 'unverified', reason: 'The Analytics API page read on 2026-10-04 does not state the licence of pageview data.' },
  courtlistener: { state: 'unverified', reason: 'courtlistener.com/terms answered 403 to the reader on 2026-10-04.' },
  gdacs: { state: 'unverified', reason: 'GDACS terms page answered 404 on 2026-10-04.' },
  crtsh: { state: 'unverified', reason: 'crt.sh publishes no terms of use; Certificate Transparency logs are public by design, but no provider statement was found.' },

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
  celestrak: { state: 'unverified', reason: 'CelesTrak\'s site (webmaster page read 2026-10-04) states no terms of use; not yet found elsewhere.' },
  ckan_federation: { state: 'unverified', reason: 'Each portal\'s metadata licence is recorded in lib/engine/registries/ckan/portals.ts (earlier work, not re-read on 2026-10-04), but the federation does not gate on those licences — a GAP recorded in batch 08.' },
  crypto_news: { state: 'unverified', reason: 'Several publishers\' RSS feeds (minepi.com, blog.ethereum.org, solana.com, …); their terms not yet read individually.' },
  ethereum_rpc: { state: 'unverified', reason: 'PublicNode terms for its public Ethereum RPC not yet read.' },
  factcheck: { state: 'unverified', reason: 'Several fact-checkers\' RSS feeds (Snopes, Full Fact, PolitiFact, …); their terms not yet read individually.' },
  hackernews: { state: 'unverified', reason: 'The HN Search (Algolia) API page read on 2026-10-04 states no terms or limits.' },
  iss_position: { state: 'unverified', reason: 'wheretheiss.at terms not yet read.' },
  openalex: { state: 'unverified', reason: 'OpenAlex help pages did not render their licence text on 2026-10-04.' },
  pi_network: { state: 'unverified', reason: 'Pi Network is Lambda NX\'s own identity and payment platform (CLAUDE.md §10); the Pi developer terms for its public mainnet API were not read on 2026-10-04.' },
  rdap: { state: 'unverified', reason: 'rdap.org redirects to each registry\'s RDAP service; registry terms vary and were not read.' },
  'username.web': { state: 'unverified', reason: 'Checks public profile URLs on several sites (GitHub, GitLab, dev.to, …); each site\'s terms on automated access not yet read.' },
}
