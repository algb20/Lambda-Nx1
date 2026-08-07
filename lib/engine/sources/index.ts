/**
 * OSINT sources — all passive, all keyless. Registering them wires each into the
 * default registry under its capability, with fallback siblings where available.
 */
import { registry } from '../registry'
import type { Source } from '../types'
// Module 1 — Domain / Infrastructure
import { cloudflareDns, googleDns } from './dns'
import { rdap } from './rdap'
import { crtsh } from './crtsh'
import { wayback } from './wayback'
import { internetdb } from './internetdb'
import { urlscan } from './urlscan'
// Module 2 — Email / Username footprint
import { usernameWeb } from './username'
import { xposedornot } from './breach'
import { gravatar } from './gravatar'
// Gateway — Threat Intelligence (CTI)
import { feodo, urlhaus, threatfox } from './threat'
// Gateway — Financial / Sanctions / Corporate
import { opensanctions, gleif, mempool } from './finance'
// Gateway — Markets & Economy
import { coingecko, edgar, frankfurter } from './markets'
import { worldbankEconomy } from './economy'
// Gateway — Procurement & Public Contracts
import { usaspending, worldbankProjects } from './procurement'
// Gateway — Ownership & beneficial-control networks
import { gleifOwnership } from './ownership'
// Gateway — News & Signals
import { gdeltNews, wikiInTheNews, usgsQuakes, reliefWeb } from './news'
import { wikidata } from './reference'
// Gateway — Markets Board (live multi-class overview)
import { coingeckoTop, stooqCommodities, stooqIndices, frankfurterBoard } from './markets-board'
// Gateway — Geospatial (places + flights)
import { nominatim, opensky } from './geo'
// Gateway — Research & tech-trend
import { openalex, crossref, githubTrend, arxiv, hackerNews } from './research'
// Internal Radar — standing ⭐ watch feeds
import { cisaKev, cisaAdvisories, huggingfacePapers, arxivWatch, watchSources } from './watch'
// Gateway — Daily global trending
import { wikipediaTrending, wikimediaPageviews, trendingSources } from './trending'
// Gateway — Live world events (geolocated, sensor- and agency-measured)
import { nasaEonet, usgsRecentQuakes, worldEventSources } from './world-events'
// Gateway — Blockchain radar (on-chain network state)
import { mempoolNetwork, coingeckoGlobal, chainStateSources } from './chain'

export const moduleOneSources: Source[] = [
  cloudflareDns,
  googleDns,
  rdap,
  crtsh,
  wayback,
  urlscan,
  internetdb,
]

export const moduleTwoSources: Source[] = [usernameWeb, xposedornot, gravatar]

export const threatGatewaySources: Source[] = [feodo, urlhaus, threatfox]

export const financeGatewaySources: Source[] = [opensanctions, gleif, mempool]

export const marketsGatewaySources: Source[] = [coingecko, edgar, frankfurter, worldbankEconomy]

export const procurementGatewaySources: Source[] = [usaspending, worldbankProjects]

export const ownershipGatewaySources: Source[] = [gleifOwnership]

export const newsGatewaySources: Source[] = [gdeltNews, wikiInTheNews, usgsQuakes, reliefWeb]

export const marketsBoardSources: Source[] = [
  coingeckoTop,
  stooqCommodities,
  stooqIndices,
  frankfurterBoard,
]

export const geoGatewaySources: Source[] = [nominatim, opensky]

export const researchGatewaySources: Source[] = [openalex, crossref, githubTrend, arxiv, hackerNews]

export const referenceGatewaySources: Source[] = [wikidata]

export const watchFeedSources: Source[] = watchSources

export const trendingGatewaySources: Source[] = trendingSources

export const worldEventsGatewaySources: Source[] = worldEventSources

export const chainStateGatewaySources: Source[] = chainStateSources

interface CatalogRow {
  key: string
  name: string
  capability: string
  passive: boolean
  enabled: boolean
}

export const moduleOneSourceCatalog: CatalogRow[] = [
  { key: 'dns.cloudflare', name: 'Cloudflare DNS-over-HTTPS', capability: 'dns', passive: true, enabled: true },
  { key: 'dns.google', name: 'Google DNS-over-HTTPS', capability: 'dns', passive: true, enabled: true },
  { key: 'rdap', name: 'RDAP registration', capability: 'whois', passive: true, enabled: true },
  { key: 'crtsh', name: 'crt.sh Certificate Transparency', capability: 'subdomains', passive: true, enabled: true },
  { key: 'wayback', name: 'Wayback Machine', capability: 'archive', passive: true, enabled: true },
  { key: 'urlscan', name: 'urlscan.io', capability: 'tech', passive: true, enabled: true },
  { key: 'shodan.internetdb', name: 'Shodan InternetDB', capability: 'ip_reputation', passive: true, enabled: true },
]

export const moduleTwoSourceCatalog: CatalogRow[] = [
  { key: 'username.web', name: 'Username presence (web)', capability: 'username_presence', passive: true, enabled: true },
  { key: 'xposedornot', name: 'XposedOrNot breach check', capability: 'email_breach', passive: true, enabled: true },
  { key: 'gravatar', name: 'Gravatar profile', capability: 'email_breach', passive: true, enabled: true },
]

export const threatGatewayCatalog: CatalogRow[] = [
  { key: 'feodo', name: 'Feodo Tracker (abuse.ch)', capability: 'threat', passive: true, enabled: true },
  { key: 'urlhaus', name: 'URLhaus (abuse.ch)', capability: 'threat', passive: true, enabled: true },
  { key: 'threatfox', name: 'ThreatFox (abuse.ch)', capability: 'threat', passive: true, enabled: true },
]

export const financeGatewayCatalog: CatalogRow[] = [
  { key: 'opensanctions', name: 'OpenSanctions', capability: 'sanctions', passive: true, enabled: true },
  { key: 'gleif', name: 'GLEIF (LEI)', capability: 'sanctions', passive: true, enabled: true },
  { key: 'mempool', name: 'mempool.space (BTC)', capability: 'wallet', passive: true, enabled: true },
]

export const marketsGatewayCatalog: CatalogRow[] = [
  { key: 'coingecko', name: 'CoinGecko (crypto markets)', capability: 'market', passive: true, enabled: true },
  { key: 'edgar', name: 'SEC EDGAR (filings)', capability: 'securities', passive: true, enabled: true },
  { key: 'frankfurter', name: 'Frankfurter (ECB FX)', capability: 'fx', passive: true, enabled: true },
  { key: 'worldbank_economy', name: 'World Bank (macro indicators)', capability: 'economy', passive: true, enabled: true },
]

export const procurementGatewayCatalog: CatalogRow[] = [
  { key: 'usaspending', name: 'USAspending.gov (US federal awards)', capability: 'procurement', passive: true, enabled: true },
  { key: 'worldbank_projects', name: 'World Bank projects', capability: 'procurement', passive: true, enabled: true },
]

export const ownershipGatewayCatalog: CatalogRow[] = [
  { key: 'gleif_ownership', name: 'GLEIF ownership (Level 2)', capability: 'ownership', passive: true, enabled: true },
]

export const newsGatewayCatalog: CatalogRow[] = [
  { key: 'gdelt', name: 'GDELT global news', capability: 'news', passive: true, enabled: true },
  { key: 'wikipedia_itn', name: 'Wikipedia In the news', capability: 'news', passive: true, enabled: true },
  { key: 'usgs_quakes', name: 'USGS earthquakes (live, geolocated)', capability: 'news', passive: true, enabled: true },
  { key: 'reliefweb', name: 'ReliefWeb / UN OCHA (humanitarian)', capability: 'news', passive: true, enabled: true },
]

export const marketsBoardCatalog: CatalogRow[] = [
  { key: 'coingecko_board', name: 'CoinGecko top crypto', capability: 'market_board', passive: true, enabled: true },
  { key: 'stooq_commodities', name: 'Stooq commodities', capability: 'market_board', passive: true, enabled: true },
  { key: 'stooq_indices', name: 'Stooq stock indices', capability: 'market_board', passive: true, enabled: true },
  { key: 'frankfurter_board', name: 'Frankfurter FX (ECB)', capability: 'market_board', passive: true, enabled: true },
]

export const geoGatewayCatalog: CatalogRow[] = [
  { key: 'nominatim', name: 'Nominatim (OpenStreetMap)', capability: 'geo', passive: true, enabled: true },
  { key: 'opensky', name: 'OpenSky Network (flights)', capability: 'geo', passive: true, enabled: true },
]

export const researchGatewayCatalog: CatalogRow[] = [
  { key: 'openalex', name: 'OpenAlex (scholarly works)', capability: 'research', passive: true, enabled: true },
  { key: 'crossref', name: 'Crossref (scholarly records)', capability: 'research', passive: true, enabled: true },
  { key: 'github', name: 'GitHub (tech-trend repos)', capability: 'research', passive: true, enabled: true },
  { key: 'arxiv', name: 'arXiv (preprint frontier)', capability: 'research', passive: true, enabled: true },
  { key: 'hackernews', name: 'Hacker News (industry signal)', capability: 'research', passive: true, enabled: true },
]

export const referenceGatewayCatalog: CatalogRow[] = [
  { key: 'wikidata', name: 'Wikidata (structured facts)', capability: 'reference', passive: true, enabled: true },
]

export const watchFeedCatalog: CatalogRow[] = [
  { key: 'cisa_kev', name: 'CISA Known Exploited Vulnerabilities', capability: 'watch', passive: true, enabled: true },
  { key: 'cisa_advisories', name: 'CISA cybersecurity advisories', capability: 'watch', passive: true, enabled: true },
  { key: 'hf_papers', name: 'Hugging Face daily papers', capability: 'watch', passive: true, enabled: true },
  { key: 'arxiv_watch', name: 'arXiv category frontier (cs.AI/CR/DC/LG)', capability: 'watch', passive: true, enabled: true },
]

export const trendingGatewayCatalog: CatalogRow[] = [
  { key: 'wikipedia_trending', name: 'Wikipedia most-read (daily trending)', capability: 'trending', passive: true, enabled: true },
  { key: 'wikimedia_pageviews', name: 'Wikimedia pageviews (top viewed)', capability: 'trending', passive: true, enabled: true },
]

export const worldEventsGatewayCatalog: CatalogRow[] = [
  { key: 'nasa_eonet', name: 'NASA EONET (natural hazards, geolocated)', capability: 'world_events', passive: true, enabled: true },
  { key: 'usgs_recent', name: 'USGS seismic (M2.5+ past day)', capability: 'world_events', passive: true, enabled: true },
]

export const chainStateGatewayCatalog: CatalogRow[] = [
  { key: 'mempool_network', name: 'mempool.space (Bitcoin network state)', capability: 'chain_state', passive: true, enabled: true },
  { key: 'coingecko_global', name: 'CoinGecko global (market structure)', capability: 'chain_state', passive: true, enabled: true },
]

export const allSourceCatalog: CatalogRow[] = [
  ...moduleOneSourceCatalog,
  ...moduleTwoSourceCatalog,
  ...threatGatewayCatalog,
  ...financeGatewayCatalog,
  ...marketsGatewayCatalog,
  ...procurementGatewayCatalog,
  ...ownershipGatewayCatalog,
  ...newsGatewayCatalog,
  ...marketsBoardCatalog,
  ...geoGatewayCatalog,
  ...researchGatewayCatalog,
  ...referenceGatewayCatalog,
  ...watchFeedCatalog,
  ...trendingGatewayCatalog,
  ...worldEventsGatewayCatalog,
  ...chainStateGatewayCatalog,
]

let registeredOne = false
let registeredTwo = false
let registeredThreat = false

export function registerModuleOneSources(): void {
  if (registeredOne) return
  registry.registerAll(moduleOneSources)
  registeredOne = true
}

export function registerModuleTwoSources(): void {
  if (registeredTwo) return
  registry.registerAll(moduleTwoSources)
  registeredTwo = true
}

export function registerThreatGateway(): void {
  if (registeredThreat) return
  registry.registerAll(threatGatewaySources)
  registeredThreat = true
}

let registeredFinance = false
export function registerFinanceGateway(): void {
  if (registeredFinance) return
  registry.registerAll(financeGatewaySources)
  registeredFinance = true
}

let registeredMarkets = false
export function registerMarketsGateway(): void {
  if (registeredMarkets) return
  registry.registerAll(marketsGatewaySources)
  registeredMarkets = true
}

let registeredProcurement = false
export function registerProcurementGateway(): void {
  if (registeredProcurement) return
  registry.registerAll(procurementGatewaySources)
  registeredProcurement = true
}

let registeredOwnership = false
export function registerOwnershipGateway(): void {
  if (registeredOwnership) return
  registry.registerAll(ownershipGatewaySources)
  registeredOwnership = true
}

let registeredNews = false
export function registerNewsGateway(): void {
  if (registeredNews) return
  registry.registerAll(newsGatewaySources)
  registeredNews = true
}

let registeredBoard = false
export function registerMarketsBoard(): void {
  if (registeredBoard) return
  registry.registerAll(marketsBoardSources)
  registeredBoard = true
}

let registeredGeo = false
export function registerGeoGateway(): void {
  if (registeredGeo) return
  registry.registerAll(geoGatewaySources)
  registeredGeo = true
}

let registeredResearch = false
export function registerResearchGateway(): void {
  if (registeredResearch) return
  registry.registerAll(researchGatewaySources)
  registeredResearch = true
}

let registeredReference = false
export function registerReferenceGateway(): void {
  if (registeredReference) return
  registry.registerAll(referenceGatewaySources)
  registeredReference = true
}

let registeredWatch = false
export function registerWatchFeeds(): void {
  if (registeredWatch) return
  registry.registerAll(watchFeedSources)
  registeredWatch = true
}

let registeredTrending = false
export function registerTrendingGateway(): void {
  if (registeredTrending) return
  registry.registerAll(trendingGatewaySources)
  registeredTrending = true
}

let registeredWorldEvents = false
export function registerWorldEventsGateway(): void {
  if (registeredWorldEvents) return
  registry.registerAll(worldEventSources)
  registeredWorldEvents = true
}

let registeredChainState = false
export function registerChainStateGateway(): void {
  if (registeredChainState) return
  registry.registerAll(chainStateGatewaySources)
  registeredChainState = true
}

export function registerAllSources(): void {
  registerModuleOneSources()
  registerModuleTwoSources()
  registerThreatGateway()
  registerFinanceGateway()
  registerMarketsGateway()
  registerProcurementGateway()
  registerOwnershipGateway()
  registerNewsGateway()
  registerMarketsBoard()
  registerGeoGateway()
  registerResearchGateway()
  registerReferenceGateway()
  registerWatchFeeds()
  registerTrendingGateway()
  registerWorldEventsGateway()
  registerChainStateGateway()
}

export {
  cloudflareDns,
  googleDns,
  rdap,
  crtsh,
  wayback,
  internetdb,
  urlscan,
  usernameWeb,
  xposedornot,
  gravatar,
  feodo,
  urlhaus,
  threatfox,
  opensanctions,
  gleif,
  mempool,
  coingecko,
  edgar,
  frankfurter,
  usaspending,
  worldbankProjects,
  gleifOwnership,
  gdeltNews,
  wikiInTheNews,
  usgsQuakes,
  reliefWeb,
  coingeckoTop,
  stooqCommodities,
  stooqIndices,
  frankfurterBoard,
  wikidata,
  cisaKev,
  cisaAdvisories,
  huggingfacePapers,
  arxivWatch,
  nasaEonet,
  usgsRecentQuakes,
  mempoolNetwork,
  coingeckoGlobal,
}
