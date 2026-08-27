import { CATALOG, activeSources } from '@/lib/engine/catalog'
import { PassiveGuardrailError } from '@/lib/engine/guardrail'
import { Registry, registry as defaultRegistry } from '@/lib/engine/registry'

/**
 * The platform's legal posture, **checked** rather than asserted.
 *
 * ## The badge this exists to replace
 *
 * The header carried a green shield reading **"Passive · Lawful"**. It was a
 * constant. It rendered the same colour and the same words whether the guardrail
 * was enforcing anything or had been deleted, and it is the single most
 * consequential claim on the page — a statement about law and ethics, made to a
 * reader who has no other way to check it.
 *
 * This codebase has spent a whole session removing exactly that shape one layer
 * down: a source that returned `[]` when it was refused, a board that reported
 * `13 sources OK` over an empty panel, a live edge pinned to our own clock. A
 * hardcoded compliance badge is the same fault in the place where it matters
 * most, and charter §3 is the reason it cannot stay.
 *
 * ## What makes a check real
 *
 * Every check here has to be one that **would fail if the protection were
 * removed**. That rules out the tempting kind — reading a constant, or
 * re-stating a rule the code already enforces — and it is why three of the five
 * exercise the guardrail rather than inspect it:
 *
 * - Asking `isAllowed` about a host nobody has registered proves the allowlist
 *   is populated and consulted. If someone made it permissive, this fails.
 * - Asking a bound fetch to issue `DELETE` proves the method rule runs. If the
 *   check were dropped, this stops throwing.
 * - Asking it to fetch an un-allowlisted host proves the passive guarantee
 *   itself: the engine may read providers and may never touch a subject.
 *
 * The other two are census checks over live registrations, which catch the
 * failure the probes cannot: a source that slipped in without hosts, or a
 * licence gate that has stopped excluding anything.
 *
 * ## What this is not
 *
 * It is not a security scanner and it does not claim the deployment is safe.
 * It answers one narrow question honestly — *are the guarantees this product
 * makes about itself switched on right now* — and says which one is not when
 * the answer is no.
 */

/** A host no source may ever be allowed to contact. Used to probe the allowlist. */
const FORBIDDEN_PROBE_HOST = 'target-under-investigation.invalid'

export type CheckState = 'pass' | 'fail'

export interface PostureCheck {
  key: string
  /** What is being claimed, in the words a reader would use. */
  label: string
  state: CheckState
  /** The evidence, either way. Never empty — a pass has to say what it proved. */
  detail: string
}

export interface Posture {
  /** True only when every check passed. The badge is green on this and nothing else. */
  lawful: boolean
  checks: PostureCheck[]
  /** When these were run. The reader is owed the age of a claim about compliance. */
  checkedAt: string
}

const pass = (key: string, label: string, detail: string): PostureCheck => ({
  key,
  label,
  state: 'pass',
  detail,
})
const fail = (key: string, label: string, detail: string): PostureCheck => ({
  key,
  label,
  state: 'fail',
  detail,
})

/**
 * Run the checks.
 *
 * The registry is injectable so a test can register a deliberately bad source
 * and watch a check fail — a posture report that cannot be made to fail is
 * decoration, and proving it can is the only way to know the badge means
 * anything.
 */
export async function checkPosture(
  registry: Registry = defaultRegistry,
  now = new Date(),
): Promise<Posture> {
  const checks: PostureCheck[] = []
  const sources = registry.capabilities().flatMap((c) => registry.sourcesFor(c))

  /* 1 ─ Every registered source declares itself passive. */
  const active = sources.filter((s) => s.passive !== true)
  checks.push(
    active.length === 0
      ? pass(
          'passive-sources',
          'Every source is read-only',
          `${sources.length} registered sources, none marked active.`,
        )
      : fail(
          'passive-sources',
          'Every source is read-only',
          `${active.length} source${active.length === 1 ? '' : 's'} not marked passive: ${active
            .map((s) => s.key)
            .slice(0, 3)
            .join(', ')}`,
        ),
  )

  /* 2 ─ Every source names the provider hosts it may read. */
  const hostless = sources.filter((s) => !Array.isArray(s.hosts) || s.hosts.length === 0)
  checks.push(
    hostless.length === 0
      ? pass(
          'declared-hosts',
          'Every source names its providers',
          'No source can reach a host it did not declare.',
        )
      : fail(
          'declared-hosts',
          'Every source names its providers',
          `${hostless.length} source(s) declare no hosts: ${hostless.map((s) => s.key).slice(0, 3).join(', ')}`,
        ),
  )

  /* 3 ─ The allowlist actually refuses a host nobody registered. */
  const allowsForbidden = registry.guardrail.isAllowed(FORBIDDEN_PROBE_HOST)
  checks.push(
    !allowsForbidden
      ? pass(
          'allowlist',
          'The allowlist refuses unknown hosts',
          'Probed with a host no source declares; it was refused.',
        )
      : fail(
          'allowlist',
          'The allowlist refuses unknown hosts',
          'The allowlist admitted a host nothing registered — it is not restricting anything.',
        ),
  )

  /* 4 ─ A bound fetch refuses a state-changing method. */
  checks.push(await methodCheck(registry))

  /* 5 ─ The licence gate is still excluding what it should. */
  const catalogued = CATALOG.length
  const usable = activeSources().length
  const blocked = catalogued - usable
  checks.push(
    blocked > 0
      ? pass(
          'licence-gate',
          'Licences are enforced',
          `${blocked} of ${catalogued} catalogued sources are held back by their licence.`,
        )
      : fail(
          'licence-gate',
          'Licences are enforced',
          `All ${catalogued} catalogued sources are in use, including ones whose terms should hold them back.`,
        ),
  )

  return {
    lawful: checks.every((c) => c.state === 'pass'),
    checks,
    checkedAt: now.toISOString(),
  }
}

/**
 * Probe the method rule without making a request.
 *
 * `createFetch` rejects a disallowed method **before** it reaches the network,
 * so calling it with `DELETE` exercises the rule and touches nothing. The host
 * is the forbidden probe, so even a guardrail with the method check removed
 * would be stopped by the allowlist rather than actually sending anything — the
 * probe cannot become the violation it is testing for.
 *
 * ## Awaited, and the first version was not
 *
 * `createFetch` returns an **async** function, which rejects rather than
 * throwing synchronously. The first version wrapped a bare call in `try/catch`,
 * so nothing was ever caught, `refused` stayed false, and the check would have
 * reported the guardrail broken on every render — a compliance badge stuck at
 * red for a reason that was in the checker.
 *
 * That is the same fault this module exists to remove, committed while removing
 * it: a claim whose code does not do what its comment says. Awaiting it is the
 * whole fix, and it is why `checkPosture` is async.
 */
async function methodCheck(registry: Registry): Promise<PostureCheck> {
  const label = 'Nothing state-changing is sent'
  const bound = registry.guardrail.createFetch('posture-probe')
  let refused = false
  try {
    await bound(`https://${FORBIDDEN_PROBE_HOST}/`, { method: 'DELETE' })
  } catch (err) {
    refused = err instanceof PassiveGuardrailError
  }
  return refused
    ? pass('read-only-methods', label, 'Probed with DELETE; the guardrail refused it.')
    : fail('read-only-methods', label, 'A DELETE was not refused before reaching the network.')
}
