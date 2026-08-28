/**
 * One decision about mail, read by everything that needs to know it.
 *
 * ## Why this file exists
 *
 * Three places had to answer "can this deployment send email, and if not, what
 * is missing?": the provider factory in `lib/mail`, the `mail` check in
 * `lib/modules/health`, and the operator route at `/api/mail/test`. Each worked
 * it out separately from the same variables, and they had already drifted:
 *
 * - `createMailProvider` treated `MAIL_PROVIDER` as a forcing switch, but only
 *   honoured two of its values (`disabled`, `log`). Any other value — including
 *   the provider names an operator would naturally reach for, `MAIL_PROVIDER=
 *   resend` — was read, lowercased, and then silently ignored.
 * - The health check listed the variables to set and never mentioned
 *   `MAIL_PROVIDER` unless it was `disabled` or `log`.
 *
 * So an operator who set `MAIL_PROVIDER` to their provider's name had set a
 * variable that did nothing, and every surface in the product agreed to say
 * nothing about it. They are then told to "set a mail provider" while looking
 * at a variable named `MAIL_PROVIDER` that they have already set. There is no
 * way to get out of that loop by reading the advice, because the advice is
 * answering a different question from the one being asked.
 *
 * The permanent repair is not a better sentence in three files. It is one
 * function that decides, and three readers that report what it decided.
 *
 * ## What it is careful about
 *
 * It reports *names*, never values. Whether `RESEND_API_KEY` is set is not a
 * secret and is the only thing that makes the advice usable; the key itself
 * never leaves the environment.
 */

/** The HTTPS services we can send through, and the variable each one's key lives in. */
export const HTTP_MAIL_KEYS = {
  resend: 'RESEND_API_KEY',
  brevo: 'BREVO_API_KEY',
  postmark: 'POSTMARK_TOKEN',
} as const

export type HttpMailService = keyof typeof HTTP_MAIL_KEYS

/**
 * `Object.hasOwn`, not `in`: `in` walks the prototype chain, so
 * `MAIL_PROVIDER=toString` was accepted as a service name and then produced
 * advice about a key variable that does not exist. An operator's typo must not
 * be able to reach `Object.prototype`.
 */
export function isHttpMailService(value: string): value is HttpMailService {
  return Object.hasOwn(HTTP_MAIL_KEYS, value)
}

/** Every value `MAIL_PROVIDER` understands, for the message that lists them. */
export const MAIL_PROVIDER_VALUES = [
  ...(Object.keys(HTTP_MAIL_KEYS) as HttpMailService[]),
  'smtp',
  'log',
  'disabled',
] as const

export type MailMode = 'http' | 'smtp' | 'log' | 'off'

export interface MailPlan {
  /** How mail will actually be sent — or `off`, meaning it will not be. */
  mode: MailMode
  /** Which HTTPS service, when `mode` is `http`. */
  service: HttpMailService | null
  /** True when `MAIL_PROVIDER` chose this rather than the environment implying it. */
  forced: boolean
  /**
   * The one sentence that says what to do next, given what is already set —
   * or `null` when there is nothing to say. Present even when `mode` is not
   * `off`: `log` delivers nothing to real users, and a `MAIL_PROVIDER` value we
   * do not recognise is worth naming even though we then ignore it.
   */
  problem: string | null
}

const set = (v: string | undefined): boolean => typeof v === 'string' && v.trim().length > 0

type Env = Record<string, string | undefined>

const REDEPLOY = 'Adding a variable to the host is not enough on its own — redeploy so the running instance picks it up.'

/**
 * Decide how this environment sends mail.
 *
 * Pure: same environment, same plan. The provider factory, the health probe and
 * the operator route all call this, so a change to the rules changes all three
 * at once and cannot leave one of them describing a system that no longer
 * exists.
 */
export function planMail(env: Env): MailPlan {
  const from = env.MAIL_FROM?.trim() ?? ''
  const hasFrom = from.length > 0
  const smtp = set(env.SMTP_URL)
  const choice = (env.MAIL_PROVIDER ?? '').trim().toLowerCase()

  /** Which HTTPS keys are present, in preference order. */
  const keysPresent = (Object.keys(HTTP_MAIL_KEYS) as HttpMailService[]).filter((s) =>
    set(env[HTTP_MAIL_KEYS[s]]),
  )

  if (choice === 'disabled') {
    return {
      mode: 'off',
      service: null,
      forced: true,
      problem:
        'MAIL_PROVIDER=disabled is switching mail off and overriding everything else, including a working key. Clear it.',
    }
  }

  if (choice === 'log') {
    return {
      mode: 'log',
      service: null,
      forced: true,
      problem:
        'MAIL_PROVIDER=log — verification codes are written to the server log and never sent. Correct for development, wrong for anyone with users. Clear it for a real deployment.',
    }
  }

  if (choice === 'smtp') {
    return smtp
      ? { mode: 'smtp', service: null, forced: true, problem: null }
      : {
          mode: 'off',
          service: null,
          forced: true,
          problem: `MAIL_PROVIDER=smtp is set, but SMTP_URL is not — so there is nothing to connect to. Set SMTP_URL, or clear MAIL_PROVIDER and use an HTTPS key instead (which is what serverless hosts allow). ${REDEPLOY}`,
        }
  }

  if (isHttpMailService(choice)) {
    /**
     * A named service is honoured exactly, including its failure.
     *
     * It does not fall back to another key or to SMTP. "Force" has to mean
     * force, or the operator who names a provider and gets mail from a
     * different one has been misled by the very switch they used to be
     * explicit — and the health check would then report a provider they never
     * chose.
     */
    const keyName = HTTP_MAIL_KEYS[choice]
    if (!set(env[keyName])) {
      return {
        mode: 'off',
        service: null,
        forced: true,
        problem: `MAIL_PROVIDER=${choice} is set, but ${keyName} is not — so there is no key to send with. MAIL_PROVIDER only chooses which provider to use; it is not itself a credential. Add ${keyName}${hasFrom ? '' : ' and MAIL_FROM'}. ${REDEPLOY}`,
      }
    }
    if (!hasFrom) {
      return {
        mode: 'off',
        service: null,
        forced: true,
        problem: `${keyName} is set, but MAIL_FROM is not — so there is no sender address and nothing can be sent. Add MAIL_FROM (e.g. "Lambda <no-reply@yourdomain.com>") on an address ${choice} has verified for you. ${REDEPLOY}`,
      }
    }
    return { mode: 'http', service: choice, forced: true, problem: null }
  }

  /**
   * A value we do not recognise is ignored — but never in silence.
   *
   * This is the case that cost the most: the variable is set, it reads like the
   * answer, and it changes nothing. Saying so is the whole repair.
   */
  const unknownChoice =
    choice.length > 0
      ? `MAIL_PROVIDER=${choice} is not a value this app recognises, so it is being ignored. Use one of: ${MAIL_PROVIDER_VALUES.join(', ')} — or leave it unset and let the key you set decide.`
      : null

  const withUnknown = (problem: string | null): string | null =>
    unknownChoice ? (problem ? `${unknownChoice} ${problem}` : unknownChoice) : problem

  // An HTTPS key wins over SMTP when both are present: serverless hosts commonly
  // refuse outbound SMTP ports, so a correct SMTP_URL can work on a laptop and
  // time out in production. Port 443 is the one outbound path a function has.
  if (keysPresent.length > 0) {
    const service = keysPresent[0]
    const keyName = HTTP_MAIL_KEYS[service]
    if (!hasFrom) {
      return {
        mode: 'off',
        service: null,
        forced: false,
        problem: withUnknown(
          `${keysPresent.map((s) => HTTP_MAIL_KEYS[s]).join(' and ')} is set, but MAIL_FROM is not — so there is no sender address and nothing can be sent. Add MAIL_FROM (e.g. "Lambda <no-reply@yourdomain.com>") on an address your provider has verified. ${REDEPLOY}`,
        ),
      }
    }
    return { mode: 'http', service, forced: false, problem: withUnknown(null) }
  }

  if (smtp) return { mode: 'smtp', service: null, forced: false, problem: withUnknown(null) }

  return {
    mode: 'off',
    service: null,
    forced: false,
    problem: withUnknown(
      hasFrom
        ? `MAIL_FROM is set but no provider key is. Add one of ${Object.values(HTTP_MAIL_KEYS).join(', ')} (an HTTPS key, which serverless hosts allow), or SMTP_URL. ${REDEPLOY}`
        : `Set MAIL_FROM plus one of ${Object.values(HTTP_MAIL_KEYS).join(', ')} (an HTTPS key, which serverless hosts allow), or SMTP_URL. ${REDEPLOY}`,
    ),
  }
}
