import { registry } from '../registry'
import { activeSources, catalogHosts } from './index'
import { catalogSource } from './adapter'
import type { CatalogSource } from './types'

/**
 * Register the catalogue with the engine.
 *
 * The guardrail's allowlist is not maintained here: `registry.register` reads
 * each source's declared `hosts`, and the adapter derives those from the very
 * URL the source will request. So the set of hosts the engine may reach is a
 * consequence of the sources that exist, never a list kept alongside them —
 * which is the only arrangement where the two cannot drift apart.
 *
 * Only `activeSources()` is registered, so licence-blocked, disabled and
 * unconfigured entries never reach the engine at all. That check belongs before
 * registration rather than at request time: "we do not have permission to use
 * this" is not a runtime error to catch and log, it is a source that must not
 * exist in this build.
 */
let registered = false

export function registerCatalog(): { sources: number; hosts: number } {
  const active = activeSources()

  if (!registered) {
    registry.registerAll(active.map(catalogSource))
    registered = true
  }

  return { sources: active.length, hosts: catalogHosts(active).length }
}

/** Test seam: forget the registration so a suite can register a fresh set. */
export function resetCatalogRegistration(): void {
  registered = false
}

/** The active catalogue records, for the source dossier and health reporting. */
export function registeredCatalog(): CatalogSource[] {
  return activeSources()
}
