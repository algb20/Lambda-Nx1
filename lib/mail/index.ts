/**
 * lib/mail — the only way the app sends email.
 *
 * Which provider is used is decided here, once, from the environment. Nothing
 * else in the codebase knows whether a message went out over SMTP or was
 * refused, which is what makes the delivery backend swappable (charter rule #4).
 *
 * ## When no mail is configured
 *
 * The honest answer is a refusal, not a pretence. `disabledProvider` reports
 * `configured: false` and returns `delivered: false` with a reason, and every
 * caller is written to branch on that rather than assume success. The visible
 * consequence — password reset answers 503 instead of silently doing nothing —
 * is the correct one: a user told "we sent you a code" who receives no code will
 * try again for an hour and then conclude the product is broken.
 */
import type { MailProvider, MailResult } from './types'
import { parseSmtpUrl, smtpProvider } from './smtp'
import { httpMailFromEnv, httpMailProvider } from './http'
import { planMail } from './config'

export { planMail, HTTP_MAIL_KEYS, MAIL_PROVIDER_VALUES } from './config'
export type { MailPlan, MailMode, HttpMailService } from './config'

export type { MailMessage, MailProvider, MailResult } from './types'

/** Refuses, and says why. Used when the deployment has no mail configuration. */
export const disabledProvider: MailProvider = {
  name: 'disabled',
  configured: false,
  async send(): Promise<MailResult> {
    return {
      delivered: false,
      detail: 'No mail provider configured (set SMTP_URL). Nothing was sent.',
    }
  },
}

/**
 * Records what it was asked to send instead of sending it.
 *
 * For local development and for tests, where a real submission would either fail
 * or — worse — succeed and mail a stranger. The code is written to the server
 * log deliberately: a developer running the sign-up flow needs to read it.
 */
export function logProvider(sink: (line: string) => void = console.info): MailProvider {
  return {
    name: 'log',
    configured: true,
    async send(message): Promise<MailResult> {
      sink(`[mail:log] to=${message.to} subject=${message.subject}\n${message.text}`)
      return { delivered: true, detail: 'written to the server log (MAIL_PROVIDER=log)' }
    },
  }
}

let cached: MailProvider | null = null

/**
 * Build the provider from the environment.
 *
 * `MAIL_PROVIDER` forces a choice; otherwise an HTTPS API key decides, then
 * `SMTP_URL`. A malformed `SMTP_URL` disables mail rather than throwing: a bad
 * mail setting must not be able to take down sign-in, which does not need mail
 * at all.
 */
export function createMailProvider(env: NodeJS.ProcessEnv = process.env): MailProvider {
  /**
   * The plan is the decision; this function only builds what it names.
   *
   * `planMail` is the single place that reads `MAIL_PROVIDER` — including the
   * values this function used to lowercase and then ignore. `MAIL_PROVIDER=
   * resend` now selects Resend, and if `RESEND_API_KEY` is absent it refuses
   * *as Resend* rather than quietly falling through to another key or to SMTP:
   * an operator who names a provider and receives mail from a different one has
   * been misled by the switch they used in order to be explicit.
   *
   * An HTTPS provider is preferred over SMTP when both are present and nothing
   * forced a choice. Not a matter of taste. This product's primary hosts are
   * Netlify and Vercel functions, where outbound connections on the SMTP ports
   * are commonly refused or silently dropped — so a correct `SMTP_URL` can work
   * on a laptop and time out in production. Port 443 is the one outbound path a
   * serverless function is guaranteed.
   */
  const plan = planMail(env)

  if (plan.mode === 'log') return logProvider()
  if (plan.mode === 'off') {
    if (plan.problem) console.error(`[mail] ${plan.problem}`)
    return disabledProvider
  }

  if (plan.mode === 'http') {
    const http = httpMailFromEnv(env)
    // `planMail` already established that the key and sender are both present,
    // so this cannot be null; the guard is here so a future change to either
    // side degrades to a refusal instead of a thrown request handler.
    if (http) return httpMailProvider(http)
    return disabledProvider
  }

  const url = (env.SMTP_URL ?? '').trim()
  try {
    return smtpProvider(parseSmtpUrl(url, env.MAIL_FROM?.trim() || undefined))
  } catch (error) {
    console.error(`[mail] SMTP_URL unusable, mail disabled: ${error instanceof Error ? error.message : error}`)
    return disabledProvider
  }
}

/** The process-wide provider. */
export function mailer(): MailProvider {
  if (!cached) cached = createMailProvider()
  return cached
}

/** Whether this deployment can deliver mail at all. */
export function mailConfigured(): boolean {
  return mailer().configured
}

/** Test seam — forget the cached provider so the environment is re-read. */
export function resetMailProvider(): void {
  cached = null
}
