import { describe, it, expect } from 'vitest'
import { registry } from '../registry'
import {
  allSourceCatalog,
  chainStateGatewaySources,
  registerAllSources,
  worldEventsGatewaySources,
} from './index'

/**
 * Registration integrity.
 *
 * A gateway's source list and the function that registers it drifted apart:
 * four hazard feeds were added to `worldEventsGatewaySources` while the
 * registrar still registered the older raw module export, so those four never
 * ran. Nothing failed — the map was simply missing a layer, and the Source
 * Integrity panel could not report a source it had never heard of.
 *
 * These assert the two things that would have caught it.
 */
describe('every declared source is actually registered', () => {
  registerAllSources()

  it('registers the whole world-events gateway, not a subset', () => {
    const registered = new Set(registry.sourcesFor('world_events').map((s) => s.key))
    for (const source of worldEventsGatewaySources) {
      expect(registered.has(source.key), `${source.key} is declared but never registered`).toBe(true)
    }
  })

  it('registers the whole chain-state gateway', () => {
    const registered = new Set(registry.sourcesFor('chain_state').map((s) => s.key))
    for (const source of chainStateGatewaySources) {
      expect(registered.has(source.key), `${source.key} is declared but never registered`).toBe(true)
    }
  })

  /**
   * The catalog is what the product tells users it reads. A key in the catalog
   * with no source behind it is a claim we do not honour.
   */
  it('has a live source behind every catalog entry', () => {
    const live = new Set(registry.capabilities().flatMap((c) => registry.sourcesFor(c).map((s) => s.key)))
    const missing = allSourceCatalog.filter((row) => row.enabled && !live.has(row.key))
    expect(missing.map((m) => m.key)).toEqual([])
  })

  it('registers only passive sources, which is the guarantee the guardrail rests on', () => {
    for (const source of registry.capabilities().flatMap((c) => registry.sourcesFor(c))) {
      expect(source.passive, source.key).toBe(true)
      expect(source.hosts.length, source.key).toBeGreaterThan(0)
    }
  })
})
