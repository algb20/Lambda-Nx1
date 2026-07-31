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
// Gateway — Procurement & Public Contracts
import { usaspending, worldbankProjects } from './procurement'
// Gateway — Ownership & beneficial-control networks
import { gleifOwnership } from './ownership'
// Gateway — News & Signals
import { gdeltNews, wikiInTheNews } from './news'

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

export const marketsGatewaySources: Source[] = [coingecko, edgar, frankfurter]

export const procurementGatewaySources: Source[] = [usaspending, worldbankProjects]

export const ownershipGatewaySources: Source[] = [gleifOwnership]

export const newsGatewaySources: Source[] = [gdeltNews, wikiInTheNews]

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

export function registerAllSources(): void {
  registerModuleOneSources()
  registerModuleTwoSources()
  registerThreatGateway()
  registerFinanceGateway()
  registerMarketsGateway()
  registerProcurementGateway()
  registerOwnershipGateway()
  registerNewsGateway()
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
}
