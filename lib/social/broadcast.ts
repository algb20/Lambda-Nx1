/**
 * Broadcasting a published post to the configured channels.
 *
 * Two rules shape this:
 *
 *  1. **Publishing a post must never fail because a channel is down.** Delivery
 *     runs after the post is safely stored, every channel is attempted
 *     independently, and every outcome is recorded rather than thrown.
 *  2. **Auto-publish is opt-in per channel and per kind.** A channel is only
 *     reached automatically when it is enabled, has auto-publish on, and its
 *     kind filter matches — three separate switches, because "it started posting
 *     everything" is the failure mode operators actually fear.
 */
import { publisherFor } from './publishers'
import { decryptSecret } from './secrets'
import type { DeliveryResult, SocialMessage, SocialPlatform } from './types'

export interface ChannelRecord {
  id: string
  platform: SocialPlatform
  label: string
  target: string
  secretEnc: string | null
  enabled: boolean
  autoPublish: boolean
  kindFilter: 'post' | 'research' | 'signal' | null
}

export interface BroadcastOutcome {
  channelId: string
  label: string
  platform: SocialPlatform
  result: DeliveryResult
}

/** Which channels should receive this post without anyone pressing a button. */
export function channelsForAutoPublish(
  channels: ChannelRecord[],
  kind: SocialMessage['kind'],
): ChannelRecord[] {
  return channels.filter(
    (c) => c.enabled && c.autoPublish && (c.kindFilter === null || c.kindFilter === kind),
  )
}

/** Send to one channel. Never throws — the outcome is the return value. */
export async function deliver(
  channel: ChannelRecord,
  message: SocialMessage,
): Promise<DeliveryResult> {
  if (!channel.enabled) return { ok: false, error: 'Channel is disabled' }
  const publisher = publisherFor(channel.platform)
  if (!publisher) return { ok: false, error: `Unknown platform ${channel.platform}` }

  let secret: string | null = null
  if (publisher.needsSecret) {
    if (!channel.secretEnc) return { ok: false, error: 'No stored token for this channel' }
    secret = decryptSecret(channel.secretEnc)
    if (!secret) {
      // Almost always a rotated SOCIAL_SECRET_KEY. Say so — an operator staring
      // at "delivery failed" would otherwise go looking at the platform.
      return { ok: false, error: 'Stored token could not be decrypted (was the key rotated?)' }
    }
  }

  try {
    return await publisher.publish(message, {
      platform: channel.platform,
      target: channel.target,
      secret,
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Delivery failed' }
  }
}

/**
 * Fan a message out to several channels at once. Channels are independent, so
 * one slow endpoint must not delay the rest.
 */
export async function broadcast(
  channels: ChannelRecord[],
  message: SocialMessage,
): Promise<BroadcastOutcome[]> {
  return Promise.all(
    channels.map(async (channel) => ({
      channelId: channel.id,
      label: channel.label,
      platform: channel.platform,
      result: await deliver(channel, message),
    })),
  )
}
