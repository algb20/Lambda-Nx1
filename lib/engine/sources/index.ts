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

let registered = false

/** Idempotently register Module 1 sources into the default registry. */
export function registerModuleOneSources(): void {
  if (registered) return
  registry.registerAll(moduleOneSources)
  registered = true
}

export { cloudflareDns, googleDns, rdap, crtsh, wayback, internetdb, urlscan }
