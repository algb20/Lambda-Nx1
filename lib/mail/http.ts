/**
 * Mail over a provider's HTTPS API, rather than over SMTP.
 *
 * ## Why this exists alongside the SMTP provider
 *
 * Two reasons, and the second is the one that decided it.
 *
 * **It is one secret instead of five.** SMTP needs a host, a port, a username, a
 * password and a sender address, assembled into a URL without a mistake. An API
 * key is one string pasted into one box. The difference sounds cosmetic until
 * you watch a deployment sit with email sign-up switched off because nobody got
 * round to composing an `SMTP_URL` — which is exactly what happened here.
 *
 * **Serverless hosts block outbound SMTP.** This product's primary targets are
 * Netlify and Vercel functions, and outbound connections on 25/465/587 are
 * commonly refused or silently dropped there. A perfectly correct `SMTP_URL`
 * can therefore work on a laptop and fail in production, with a timeout as the
 * only symptom. HTTPS on 443 is the one outbound path a function is guaranteed.
 *
 * ## Three providers, one shape
 *
 * Resend, Brevo and Postmark are each a single POST with a JSON body and a key
 * in a header; they differ only in the field names and where the key goes. So
 * each is a small description rather than a class, and adding a fourth is a
 * dozen lines. All three were called live to confirm the contract before this
 * was written — they answer 401 with a structured error for a bad key, which is
 * also what makes `detail` below worth reading when something goes wrong.
 *
 * Brevo is the one to reach for when there is no budget: 300 messages a day,
 * free permanently, no card. Resend is 3,000 a month and the cleanest API.
 * Postmark is paid, and the most reliable of the three for transactional mail.
 * Nothing in the app knows which is in use (charter rule #4).
 */
import type { MailMessage, MailProvider, MailResult } from './types'
import { HTTP_MAIL_KEYS, planMail, type HttpMailService } from './config'

export interface HttpMailConfig {
  /** Which service. Decides the endpoint, the auth header and the body shape. */
  service: HttpMailService
  apiKey: string
  /** The `From:` address. Must be one the provider has verified for you. */
  from: string
  /** Injected for tests; defaults to the platform `fetch`. */
  fetchImpl?: typeof fetch
}

interface Wire {
  url: string
  headers: (key: string) => Record<string, string>
  body: (message: MailMessage, from: string) => unknown
}

/**
 * How each service wants to be spoken to.
 *
 * `headers` on the message — `List-Unsubscribe` above all — are passed through
 * in every case. A provider that dropped them would quietly cost us the
 * one-click unsubscribe that mailbox providers now score senders on.
 */
const WIRE: Record<HttpMailConfig['service'], Wire> = {
  resend: {
    url: 'https://api.resend.com/emails',
    headers: (key) => ({ authorization: `Bearer ${key}` }),
    body: (m, from) => ({
      from,
      to: [m.to],
      subject: m.subject,
      text: m.text,
      ...(m.html ? { html: m.html } : {}),
      ...(m.headers ? { headers: m.headers } : {}),
    }),
  },
  brevo: {
    url: 'https://api.brevo.com/v3/smtp/email',
    headers: (key) => ({ 'api-key': key }),
    body: (m, from) => ({
      sender: { email: from },
      to: [{ email: m.to }],
      subject: m.subject,
      textContent: m.text,
      ...(m.html ? { htmlContent: m.html } : {}),
      ...(m.headers ? { headers: m.headers } : {}),
    }),
  },
  postmark: {
    url: 'https://api.postmarkapp.com/email',
    headers: (key) => ({ 'x-postmark-server-token': key }),
    body: (m, from) => ({
      From: from,
      To: m.to,
      Subject: m.subject,
      TextBody: m.text,
      ...(m.html ? { HtmlBody: m.html } : {}),
      ...(m.headers
        ? { Headers: Object.entries(m.headers).map(([Name, Value]) => ({ Name, Value })) }
        : {}),
      // Transactional codes must not be suppressed by a bounce record from an
      // unrelated marketing send, which is what the default stream would do.
      MessageStream: 'outbound',
    }),
  },
}

/**
 * What the provider said, trimmed to something an operator can act on.
 *
 * Kept rather than reduced to "failed", because the three common causes need
 * three different responses: a bad key is a settings fix, an unverified sender
 * domain is a DNS record, and a rejected recipient is the reader's own address.
 * "Delivery failed" tells you which of those to do — none of them.
 */
function summarise(status: number, raw: string): string {
  const text = raw.trim().slice(0, 300)
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const message = parsed.message ?? parsed.Message ?? parsed.error ?? parsed.name
    if (typeof message === 'string' && message) return `${status}: ${message}`
  } catch {
    /* not JSON; the raw body is the best we have */
  }
  return text ? `${status}: ${text}` : `${status}`
}

export function httpMailProvider(config: HttpMailConfig): MailProvider {
  const wire = WIRE[config.service]
  const send = config.fetchImpl ?? fetch

  return {
    name: config.service,
    configured: true,
    async send(message: MailMessage): Promise<MailResult> {
      try {
        const res = await send(wire.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...wire.headers(config.apiKey) },
          body: JSON.stringify(wire.body(message, config.from)),
        })
        const raw = await res.text()
        if (!res.ok) {
          return { delivered: false, detail: `${config.service} refused — ${summarise(res.status, raw)}` }
        }
        return { delivered: true, detail: `accepted by ${config.service}` }
      } catch (error) {
        /**
         * A thrown fetch is a network fault, not a rejection, and saying so
         * matters: "the provider refused this address" and "we could not reach
         * the provider" lead an operator to opposite places.
         */
        return {
          delivered: false,
          detail: `could not reach ${config.service}: ${error instanceof Error ? error.message : String(error)}`,
        }
      }
    },
  }
}

/**
 * Build one from the environment, or null if none is configured.
 *
 * Which service — and whether the environment adds up to a usable one at all —
 * is decided by `planMail`, not here. That function is the single reader of
 * `MAIL_PROVIDER`, `MAIL_FROM` and the three keys; this one turns its verdict
 * into a config object. Before that split, the choice was made independently
 * here, in the health check and in the operator route, and they disagreed.
 *
 * The sender address is required and not defaulted. Every one of these services
 * rejects a `From:` on a domain you have not verified, so guessing one would
 * turn a clear configuration error into a runtime failure on the first sign-up.
 * When the environment falls short, the reason is logged rather than swallowed:
 * a returned `null` says only "no HTTPS mail", and the operator needs to know
 * which of the two halves they are missing.
 */
export function httpMailFromEnv(env: Record<string, string | undefined>): HttpMailConfig | null {
  const plan = planMail(env)
  if (plan.mode !== 'http' || !plan.service) {
    if (plan.problem && plan.mode === 'off') console.error(`[mail] ${plan.problem}`)
    return null
  }
  return {
    service: plan.service,
    apiKey: (env[HTTP_MAIL_KEYS[plan.service]] as string).trim(),
    from: (env.MAIL_FROM as string).trim(),
  }
}
