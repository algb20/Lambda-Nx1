/**
 * Source registry. Sources register here by capability. Registration passes
 * through the guardrail, so only passive, host-declaring sources are accepted.
 */
import type { Capability, Source } from './types'
import { Guardrail } from './guardrail'

export class Registry {
  private readonly byCapability = new Map<Capability, Source[]>()
  readonly guardrail = new Guardrail()

  register(source: Source): void {
    this.guardrail.assertPassiveSource(source)
    this.guardrail.allowHosts(source.hosts)
    const list = this.byCapability.get(source.capability) ?? []
    if (!list.some((s) => s.key === source.key)) list.push(source)
    this.byCapability.set(source.capability, list)
  }

  registerAll(sources: Source[]): void {
    for (const s of sources) this.register(s)
  }

  sourcesFor(capability: Capability): Source[] {
    return this.byCapability.get(capability) ?? []
  }

  capabilities(): Capability[] {
    return [...this.byCapability.keys()]
  }

  clear(): void {
    this.byCapability.clear()
  }
}

/** Process-wide default registry. Module 1+ sources register into this. */
export const registry = new Registry()
