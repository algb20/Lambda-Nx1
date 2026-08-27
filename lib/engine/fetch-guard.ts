/**
 * Telling "the provider said nothing" apart from "we could not reach the
 * provider".
 *
 * Sources used to swallow a failed response and return an empty list. The
 * orchestrator then recorded the run as successful, and the Source Integrity
 * panel showed a green light for a feed that had in fact been unreachable all
 * day. A board that reports healthy while it is blind is worse than one that is
 * obviously broken — an operator reads an empty map as "nothing is happening".
 *
 * So: a source that *decides* not to query (wrong input shape, not applicable)
 * still returns []. A source whose request actually failed throws, and the
 * failure surfaces with its reason.
 */
export class SourceUnavailableError extends Error {
  constructor(
    readonly sourceKey: string,
    readonly status: number | null | undefined,
    detail?: string,
  ) {
    // The detail is the more specific fact when we have one, so it leads. A
    // status of undefined (a response object without one) reads as unreachable
    // rather than as "answered undefined", which told an operator nothing.
    const reason =
      detail ??
      (typeof status === 'number' ? `provider answered ${status}` : 'provider unreachable')
    super(`${sourceKey}: ${reason}`)
    this.name = 'SourceUnavailableError'
  }
}

/**
 * Assert a response is usable. Returns it so it reads as a pass-through at the
 * call site.
 */
export function expectOk(sourceKey: string, res: Response): Response {
  if (!res.ok) throw new SourceUnavailableError(sourceKey, res.status)
  return res
}

/**
 * The one status that is a real answer rather than a refusal.
 *
 * ## The distinction, and why `if (!res.ok) return []` is not it
 *
 * Two very different things arrive as a non-OK status, and collapsing them is
 * how a board reports itself healthy while blind:
 *
 * - **"The thing you asked about does not exist."** A 404 from a lookup — no
 *   Gravatar for this address, no RDAP record for this domain — is the
 *   provider answering the question. Empty is the correct result.
 * - **"I will not serve you."** 429, 403, 451, 5xx. The question was never
 *   answered. Empty is a fabrication.
 *
 * Measured on the deployed site, this is not theoretical. `/api/chain` reported
 * **13 sources OK, 0 failed — and 0 movers**, because `coingecko_board` met a
 * throttle and returned `[]`. Thirteen green lights over a blank panel.
 *
 * So a source that genuinely wants "absent means empty" says so explicitly, for
 * the one status where that is true, and everything else still throws.
 */
export function expectFoundOrEmpty<T>(
  sourceKey: string,
  res: Response,
  empty: T,
): { found: false; value: T } | { found: true; res: Response } {
  if (res.status === 404) return { found: false, value: empty }
  expectOk(sourceKey, res)
  return { found: true, res }
}

/**
 * Parse JSON, treating an unparseable body as a provider failure rather than as
 * "no results" — a proxy's HTML error page is not an empty dataset.
 */
export async function expectJson<T>(sourceKey: string, res: Response): Promise<T> {
  expectOk(sourceKey, res)
  try {
    return (await res.json()) as T
  } catch {
    throw new SourceUnavailableError(sourceKey, res.status, 'response was not JSON')
  }
}
