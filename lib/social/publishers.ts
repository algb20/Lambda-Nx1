/**
 * The publishers we can actually deliver through, all keyless except Telegram
 * (whose bot token the operator supplies and which we store encrypted).
 *
 * Every one of them validates its target *before* storage. A webhook URL is a
 * server-side request to an operator-supplied address, which is exactly the
 * shape of an SSRF, so `safeWebhookUrl` refuses anything that is not public
 * https — see the note there.
 */
import {
  renderPlainText,
  type ChannelConfig,
  type DeliveryResult,
  type SocialMessage,
  type SocialPlatform,
  type SocialPublisher,
} from './types'

const TIMEOUT_MS = 8_000

async function postJson(url: string, payload: unknown): Promise<DeliveryResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: 'error',
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, status: res.status, error: text.slice(0, 200) || `HTTP ${res.status}` }
    }
    return { ok: true, status: res.status }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Request failed' }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Validate an operator-supplied webhook URL.
 *
 * The server will POST to whatever this returns, so an unchecked value would let
 * an operator (or anyone who got hold of the admin secret) aim our server at
 * internal addresses and read the response codes — a classic SSRF. We require
 * https and reject hosts that resolve to private space by name. Hostnames that
 * only resolve to a private address at request time remain possible in
 * principle; requiring https and refusing redirects keeps that to a narrow,
 * admin-only path.
 */
export function safeWebhookUrl(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    host === '0.0.0.0' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return null
  }
  return url.toString()
}

/** A plain outgoing webhook — the bridge to every automation tool. */
export const webhookPublisher: SocialPublisher = {
  platform: 'webhook',
  targetHint: 'An https webhook URL that accepts a JSON POST',
  needsSecret: false,
  validateTarget: safeWebhookUrl,
  async publish(message: SocialMessage, config: ChannelConfig) {
    const url = safeWebhookUrl(config.target)
    if (!url) return { ok: false, error: 'Invalid webhook URL' }
    return postJson(url, {
      source: 'lambda-nx',
      kind: message.kind,
      title: message.title,
      body: message.body,
      url: message.url,
      author: message.author,
      publishedAt: message.publishedAt,
    })
  },
}

/** Discord takes the same webhook URL but its own payload shape. */
export const discordPublisher: SocialPublisher = {
  platform: 'discord',
  targetHint: 'A Discord channel webhook URL (Channel → Integrations → Webhooks)',
  needsSecret: false,
  validateTarget: (target) => {
    const url = safeWebhookUrl(target)
    if (!url) return null
    return /discord(app)?\.com\/api\/webhooks\//.test(url) ? url : null
  },
  async publish(message: SocialMessage, config: ChannelConfig) {
    const url = discordPublisher.validateTarget(config.target)
    if (!url) return { ok: false, error: 'Invalid Discord webhook URL' }
    return postJson(url, {
      content: message.url,
      embeds: [
        {
          title: message.title.slice(0, 256),
          description: message.body.slice(0, 4000),
          url: message.url,
          timestamp: message.publishedAt,
          footer: { text: message.author ? `Lambda NX · ${message.author}` : 'Lambda NX' },
        },
      ],
    })
  },
}

/** Slack incoming webhooks, with Block Kit so the post is readable. */
export const slackPublisher: SocialPublisher = {
  platform: 'slack',
  targetHint: 'A Slack incoming-webhook URL (hooks.slack.com/services/…)',
  needsSecret: false,
  validateTarget: (target) => {
    const url = safeWebhookUrl(target)
    if (!url) return null
    return /^https:\/\/hooks\.slack\.com\//.test(url) ? url : null
  },
  async publish(message: SocialMessage, config: ChannelConfig) {
    const url = slackPublisher.validateTarget(config.target)
    if (!url) return { ok: false, error: 'Invalid Slack webhook URL' }
    return postJson(url, {
      text: `${message.title} — ${message.url}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: message.title.slice(0, 150) } },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `${message.body.slice(0, 2900)}\n\n<${message.url}|Read on Lambda NX>` },
        },
      ],
    })
  },
}

/** Telegram Bot API — the one platform here that takes a token. */
export const telegramPublisher: SocialPublisher = {
  platform: 'telegram',
  targetHint: 'A chat id, e.g. -1001234567890 for a channel or @channelname',
  needsSecret: true,
  validateTarget: (target) => {
    const t = target.trim()
    if (/^-?\d{4,20}$/.test(t)) return t
    if (/^@[A-Za-z0-9_]{4,32}$/.test(t)) return t
    return null
  },
  async publish(message: SocialMessage, config: ChannelConfig) {
    const chatId = telegramPublisher.validateTarget(config.target)
    if (!chatId) return { ok: false, error: 'Invalid Telegram chat id' }
    if (!config.secret) return { ok: false, error: 'Missing bot token' }
    // The token is in the path, so it must never be logged with the URL.
    return postJson(`https://api.telegram.org/bot${config.secret}/sendMessage`, {
      chat_id: chatId,
      text: renderPlainText(message),
      disable_web_page_preview: false,
    })
  },
}

const PUBLISHERS: Record<SocialPlatform, SocialPublisher> = {
  webhook: webhookPublisher,
  discord: discordPublisher,
  slack: slackPublisher,
  telegram: telegramPublisher,
}

export function publisherFor(platform: SocialPlatform): SocialPublisher {
  return PUBLISHERS[platform]
}

export const ALL_PUBLISHERS: SocialPublisher[] = Object.values(PUBLISHERS)
