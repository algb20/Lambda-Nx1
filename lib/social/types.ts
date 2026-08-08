/**
 * The social publishing port.
 *
 * Every destination sits behind this interface, so adding a network later is a
 * new publisher rather than a change to the posting flow (charter rule #4). App
 * code never talks to a platform SDK.
 *
 * What is deliberately *not* here: X, Facebook, LinkedIn and Instagram. Posting
 * to those requires an approved OAuth application, which we do not have, and a
 * button that cannot work is worse than no button. An outgoing webhook covers
 * every automation tool that bridges to them in the meantime.
 */
export type SocialPlatform = 'webhook' | 'discord' | 'slack' | 'telegram'

/** What a channel is asked to broadcast. Platform-neutral by design. */
export interface SocialMessage {
  title: string
  body: string
  /** Canonical link back to the post on Lambda NX. */
  url: string
  kind: 'post' | 'research' | 'signal'
  author: string | null
  publishedAt: string
}

export interface ChannelConfig {
  platform: SocialPlatform
  /** Webhook URL, or the Telegram chat id. */
  target: string
  /** Decrypted bot token, where the platform needs one. */
  secret?: string | null
}

export interface DeliveryResult {
  ok: boolean
  /** HTTP status where there was one — useful when diagnosing a dead channel. */
  status?: number
  error?: string
}

export interface SocialPublisher {
  readonly platform: SocialPlatform
  /** Human-readable description of what `target` must contain, for the UI. */
  readonly targetHint: string
  /** True when this platform additionally needs a secret (a bot token). */
  readonly needsSecret: boolean
  /** Reject a malformed target before it is ever stored. */
  validateTarget(target: string): string | null
  publish(message: SocialMessage, config: ChannelConfig): Promise<DeliveryResult>
}

/** Plain-text rendering shared by the publishers that have no rich format. */
export function renderPlainText(message: SocialMessage): string {
  const parts = [message.title]
  const body = message.body.trim()
  if (body) parts.push(body.length > 600 ? `${body.slice(0, 597)}…` : body)
  parts.push(message.url)
  return parts.join('\n\n')
}
