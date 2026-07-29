/**
 * Module 1 sources (Domain / Infrastructure) — all passive, all keyless.
 * Registering them wires each into the default registry under its capability,
 * with fallback siblings where available (e.g. two DoH providers for `dns`).
 */
import { registry } from '../registry'
import { cloudflareDns, googleDns } from './dns'
import { rdap } from './rdap'
import { crtsh } from './crtsh'
import { wayback } from './wayback'
import { internetdb } from './internetdb'
import { urlscan } from './urlscan'
import type { Source } from '../types'

export const moduleOneSources: Source[] = [
  cloudflareDns,
  googleDns,
  rdap,
  crtsh,
  wayback,
  urlscan,
  internetdb,
]

/** Catalog rows for the sources table (referential integrity for evidence/scans). */
export const moduleOneSourceCatalog: Array<{
  key: string
  name: string
  capability: string
  passive: boolean
  enabled: boolean
}> = [
  { key: 'dns.cloudflare', name: 'Cloudflare DNS-over-HTTPS', capability: 'dns', passive: true, enabled: true },
  { key: 'dns.google', name: 'Google DNS-over-HTTPS', capability: 'dns', passive: true, enabled: true },
  { key: 'rdap', name: 'RDAP registration', capability: 'whois', passive: true, enabled: true },
  { key: 'crtsh', name: 'crt.sh Certificate Transparency', capability: 'subdomains', passive: true, enabled: true },
  { key: 'wayback', name: 'Wayback Machine', capability: 'archive', passive: true, enabled: true },
  { key: 'urlscan', name: 'urlscan.io', capability: 'tech', passive: true, enabled: true },
  { key: 'shodan.internetdb', name: 'Shodan InternetDB', capability: 'ip_reputation', passive: true, enabled: true },
]

let registered = false

/** Idempotently register Module 1 sources into the default registry. */
export function registerModuleOneSources(): void {
  if (registered) return
  registry.registerAll(moduleOneSources)
  registered = true
}

export { cloudflareDns, googleDns, rdap, crtsh, wayback, internetdb, urlscan }
