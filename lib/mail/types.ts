/**
 * Mail port. App code sends through this interface and never through a vendor
 * SDK, so the delivery provider is a configuration change rather than a rewrite
 * (charter rule #4).
 */

export interface MailMessage {
  to: string
  subject: string
  /** Plain-text body. Always present — a mail with only HTML is a spam signal. */
  text: string
  /** Optional HTML alternative. */
  html?: string
  /**
   * Extra RFC 5322 headers, for the ones a message must carry to be treated
   * well rather than merely to be delivered — `List-Unsubscribe` above all.
   *
   * Values are written verbatim, so a caller must not put a newline in one:
   * a header value containing CRLF is header injection, and it is rejected
   * rather than escaped, because there is no legitimate reason to want it.
   */
  headers?: Record<string, string>
}

export interface MailResult {
  /** Whether the provider accepted the message for delivery. */
  delivered: boolean
  /**
   * What the provider said. Kept because a rejected address and a refused
   * connection need different operator responses, and "failed" tells neither.
   */
  detail: string
}

export interface MailProvider {
  readonly name: string
  /** True when this deployment can actually deliver mail. */
  readonly configured: boolean
  send(message: MailMessage): Promise<MailResult>
}
