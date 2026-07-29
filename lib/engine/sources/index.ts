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

export const allSourceCatalog: CatalogRow[] = [...moduleOneSourceCatalog, ...moduleTwoSourceCatalog]

let registeredOne = false
let registeredTwo = false

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

export function registerAllSources(): void {
  registerModuleOneSources()
  registerModuleTwoSources()
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
}
