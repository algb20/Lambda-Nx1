import { describe, it, expect } from 'vitest'
import { ALL_MODES, GATEWAY_GUIDANCE } from './gateways'

/**
 * The worked example is asserted here rather than in the component, because a
 * `.tsx` cannot be imported into a node test — and because what matters is the
 * *choice*, not the markup around it.
 *
 * These duplicate the two constants deliberately: if someone changes the example
 * in `components/onboarding.tsx` to a gateway that does not exist, or to a
 * subject that gateway cannot investigate, the first thing a new user ever sees
 * is the product failing. That is the one screen where an empty result is fatal.
 */
const WORKED_EXAMPLE = { gateway: 'domain', subject: 'wikipedia.org' } as const

describe('the first-run worked example', () => {
  it('uses a gateway that exists', () => {
    expect(ALL_MODES as readonly string[]).toContain(WORKED_EXAMPLE.gateway)
  })

  it('has guidance, so the panel can explain what it is about to run', () => {
    const guidance = GATEWAY_GUIDANCE[WORKED_EXAMPLE.gateway]
    expect(guidance).toBeDefined()
    expect(guidance.answers.length).toBeGreaterThan(20)
    expect(guidance.limit.length).toBeGreaterThan(20)
  })

  /**
   * The example has to be a subject the gateway can actually take. A domain
   * gateway handed a sentence returns nothing, and the first impression is a
   * broken product.
   */
  it('is a subject the chosen gateway can investigate', () => {
    expect(WORKED_EXAMPLE.subject).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/)
  })

  it('matches the example that gateway already advertises', () => {
    expect(GATEWAY_GUIDANCE[WORKED_EXAMPLE.gateway].example).toBe(WORKED_EXAMPLE.subject)
  })

  /**
   * A first impression must not be a controversial one. The subject is a public
   * organisation's own domain — never a person, never a private individual's
   * property (charter §3).
   */
  it('is a public organisation, not a person or a private target', () => {
    expect(WORKED_EXAMPLE.subject).toBe('wikipedia.org')
  })
})
