import { createHmac, timingSafeEqual } from 'node:crypto'
import type { AlertRule, AlertSubject } from './rules'

/**
 * Delivering an alert to someone else's system.
 *
 * A webhook is the one place this platform *pushes* rather than reads, and that
 * inverts the trust question. Everywhere else we ask whether we can believe a
 * source; here the receiver has to decide whether to believe us — and a plain
 * POST to a URL gives them nothing to decide with. Anyone who learns the URL
 * can send anything to it, and the receiver cannot tell the difference.
 *
 * So every delivery is signed, and the signature covers the timestamp as well
 * as the body. Signing only the body would let an attacker who captured one
 * delivery replay it forever, which matters more here than in most systems: a
 * replayed alert is a false alarm at an hour of the attacker's choosing.
 *
 * The scheme is HMAC-SHA256 over `v1:{timestamp}.{body}`, which is the shape
 * Stripe and GitHub converged on independently. Following it is not imitation —
 * it means a receiver can verify our deliveries with a library they already
 * have, and the failure mode of a scheme nobody recognises is that people skip
 * verification entirely.
 */

/** Deliveries older than this must be rejected by the receiver. */
export const MAX_SIGNATURE_AGE_SECONDS = 300

export const SIGNATURE_HEADER = 'x-lambda-signature'
export const TIMESTAMP_HEADER = 'x-lambda-timestamp'

/**
 * What a receiver actually gets.
 *
 * Two things are deliberately in here that a threshold alert could not carry,
 * and they are the reason this is worth building: `because` says which
 * condition fired in words, and the subject carries its **evidence grade** and
 * **independent origin count**. A receiving system can therefore route on how
 * well a thing is known — page a human for a corroborated event, file a
 * single-source one for review — which is a decision no other alerting product
 * in this category gives them the data to make.
 */
export interface AlertDelivery {
  /** Schema version, so a receiver can refuse a shape it does not know. */
  version: 1
  /** Unique per delivery — the receiver's idempotency key. */
  deliveryId: string
  rule: { id: string; name: string }
  /** The condition that fired, in plain words. */
  because: string
  subject: {
    id: string
    title: string
    category: string | null
    country: string | null
    lat: number | null
    lon: number | null
    magnitude: number | null
    severity: number | null
    grade: string | null
    independentOrigins: number
    sources: string[]
    contested: boolean
    observedAt: string | null
    receivedAt: string
  }
  firedAt: string
}

/**
 * A delivery id that is stable for one rule firing on one subject.
 *
 * Not random, deliberately. A scheduled sweep that runs twice — a retry, an
 * overlapping cron, a redeploy mid-run — would otherwise send two deliveries a
 * receiver cannot recognise as the same event, and the receiver's page duty
 * gets woken twice for one earthquake. Derived from the rule and subject, it is
 * an idempotency key they can actually use.
 */
export function deliveryId(rule: AlertRule, subject: AlertSubject): string {
  return createHmac('sha256', 'lambda-delivery-id')
    .update(`${rule.id}:${subject.id}`)
    .digest('hex')
    .slice(0, 32)
}

export function buildDelivery(
  rule: AlertRule,
  subject: AlertSubject,
  because: string,
  firedAt: string = new Date().toISOString(),
): AlertDelivery {
  return {
    version: 1,
    deliveryId: deliveryId(rule, subject),
    rule: { id: rule.id, name: rule.name },
    because,
    subject: {
      id: subject.id,
      title: subject.title,
      category: subject.category,
      country: subject.country,
      lat: subject.lat,
      lon: subject.lon,
      magnitude: subject.magnitude,
      severity: subject.severity,
      grade: subject.grade,
      independentOrigins: subject.independentOrigins,
      sources: subject.sources,
      contested: subject.contested,
      observedAt: subject.observedAt,
      receivedAt: subject.receivedAt,
    },
    firedAt,
  }
}

/** The signed material. Exported because a receiver must build it identically. */
export function signaturePayload(timestampSeconds: number, body: string): string {
  return `v1:${timestampSeconds}.${body}`
}

export function sign(secret: string, body: string, timestampSeconds: number): string {
  return `v1=${createHmac('sha256', secret)
    .update(signaturePayload(timestampSeconds, body))
    .digest('hex')}`
}

export interface SignedRequest {
  body: string
  headers: Record<string, string>
}

export function signedRequest(
  secret: string,
  delivery: AlertDelivery,
  now: number = Date.now(),
): SignedRequest {
  const timestamp = Math.floor(now / 1000)
  const body = JSON.stringify(delivery)
  return {
    body,
    headers: {
      'content-type': 'application/json',
      [TIMESTAMP_HEADER]: String(timestamp),
      [SIGNATURE_HEADER]: sign(secret, body, timestamp),
      // The idempotency key in a header too, so a receiver can dedupe at its
      // edge without parsing a body it has not yet verified.
      'x-lambda-delivery-id': delivery.deliveryId,
    },
  }
}

export type VerifyFailure =
  | 'missing-signature'
  | 'missing-timestamp'
  | 'malformed-timestamp'
  | 'expired'
  | 'bad-signature'

export type VerifyResult = { ok: true } | { ok: false; reason: VerifyFailure }

/**
 * Verify a delivery, exactly as a receiver should.
 *
 * Shipped rather than only documented, for a reason worth stating: a signing
 * scheme whose verification the integrator has to write from a prose
 * description is a signing scheme that gets verified wrongly. The two mistakes
 * are always the same — comparing with `===`, which leaks the correct signature
 * one byte at a time to anyone willing to measure, and skipping the timestamp,
 * which leaves replay wide open. Both are closed here, and this function is
 * what our own tests verify against.
 */
export function verifySignature(
  secret: string,
  body: string,
  headers: Record<string, string | undefined>,
  now: number = Date.now(),
  maxAgeSeconds: number = MAX_SIGNATURE_AGE_SECONDS,
): VerifyResult {
  const provided = headers[SIGNATURE_HEADER] ?? headers[SIGNATURE_HEADER.toUpperCase()]
  const rawTimestamp = headers[TIMESTAMP_HEADER] ?? headers[TIMESTAMP_HEADER.toUpperCase()]

  if (!provided) return { ok: false, reason: 'missing-signature' }
  if (!rawTimestamp) return { ok: false, reason: 'missing-timestamp' }

  const timestamp = Number(rawTimestamp)
  if (!Number.isFinite(timestamp) || !Number.isInteger(timestamp)) {
    return { ok: false, reason: 'malformed-timestamp' }
  }

  // Both directions: a timestamp far in the future is as suspect as an old one,
  // and accepting it would let an attacker mint a delivery valid indefinitely.
  const ageSeconds = Math.abs(now / 1000 - timestamp)
  if (ageSeconds > maxAgeSeconds) return { ok: false, reason: 'expired' }

  const expected = sign(secret, body, timestamp)
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  // `timingSafeEqual` throws on a length mismatch, which would itself leak the
  // expected length — so the lengths are compared first and both paths return
  // the same answer.
  if (a.length !== b.length) return { ok: false, reason: 'bad-signature' }
  return timingSafeEqual(a, b) ? { ok: true } : { ok: false, reason: 'bad-signature' }
}
