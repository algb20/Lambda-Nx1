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
