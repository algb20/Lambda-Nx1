import { describe, expect, it } from 'vitest'
import {
  MAX_SIGNATURE_AGE_SECONDS,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  buildDelivery,
  deliveryId,
  sign,
  signedRequest,
  verifySignature,
} from './delivery'
import type { AlertRule, AlertSubject } from './rules'

const SECRET = 'a-receiver-shared-secret'
const NOW = Date.parse('2026-08-14T12:00:00.000Z')

const rule: AlertRule = {
  id: 'r1',
  name: 'Large corroborated quakes',
  enabled: true,
  condition: { field: 'magnitude', op: 'gte', value: 6.5 },
}

const subject: AlertSubject = {
  id: 'e1',
  title: 'Magnitude 7.4 earthquake strikes off Tohoku coast',
  category: 'seismic',
  country: 'Japan',
  lat: 38.3,
  lon: 142.4,
  magnitude: 7.4,
  severity: 0.98,
  independentOrigins: 3,
  grade: 'confirmed',
  sourceRating: 'A',
  sources: ['usgs_quakes', 'jma_quakes'],
  contested: false,
  observedAt: '2026-08-14T11:30:00.000Z',
  receivedAt: '2026-08-14T11:35:00.000Z',
}

describe('what a receiver is sent', () => {
  it('carries the evidence grade, which is what makes routing possible', () => {
    const d = buildDelivery(rule, subject, 'magnitude is at least 6.5')
    // A receiver can page a human for a corroborated event and file a
    // single-source one — a decision no threshold alert gives them the data for.
    expect(d.subject.grade).toBe('confirmed')
    expect(d.subject.independentOrigins).toBe(3)
    expect(d.subject.sources).toEqual(['usgs_quakes', 'jma_quakes'])
  })

  it('says in words which condition fired', () => {
    const d = buildDelivery(rule, subject, 'magnitude is at least 6.5')
    expect(d.because).toBe('magnitude is at least 6.5')
    expect(d.rule).toEqual({ id: 'r1', name: 'Large corroborated quakes' })
  })

  it('declares its schema version, so a receiver can refuse a shape it does not know', () => {
    expect(buildDelivery(rule, subject, 'x').version).toBe(1)
  })

  it('gives the same delivery id for the same rule firing on the same subject', () => {
    // A retried or overlapping sweep must not wake a receiver's page duty twice
    // for one earthquake.
    expect(deliveryId(rule, subject)).toBe(deliveryId(rule, subject))
    expect(deliveryId(rule, { ...subject, id: 'e2' })).not.toBe(deliveryId(rule, subject))
    expect(deliveryId({ ...rule, id: 'r2' }, subject)).not.toBe(deliveryId(rule, subject))
  })

  it('puts the idempotency key in a header too, for edge deduplication', () => {
    const req = signedRequest(SECRET, buildDelivery(rule, subject, 'x'), NOW)
    expect(req.headers['x-lambda-delivery-id']).toBe(deliveryId(rule, subject))
  })
})

describe('signing a delivery', () => {
  it('produces a signature the shipped verifier accepts', () => {
    const req = signedRequest(SECRET, buildDelivery(rule, subject, 'x'), NOW)
    expect(verifySignature(SECRET, req.body, req.headers, NOW)).toEqual({ ok: true })
  })

  it('rejects a body changed after signing', () => {
    const req = signedRequest(SECRET, buildDelivery(rule, subject, 'x'), NOW)
    const tampered = req.body.replace('7.4', '2.1')
    expect(verifySignature(SECRET, tampered, req.headers, NOW)).toEqual({
      ok: false,
      reason: 'bad-signature',
    })
  })

  it('rejects a signature from a different secret', () => {
    const req = signedRequest(SECRET, buildDelivery(rule, subject, 'x'), NOW)
    expect(verifySignature('another-secret', req.body, req.headers, NOW)).toEqual({
      ok: false,
      reason: 'bad-signature',
    })
  })

  it('rejects a replay of a delivery captured earlier', () => {
    // The reason the timestamp is inside the signed material at all: a replayed
    // alert is a false alarm at an hour of the attacker's choosing.
    const req = signedRequest(SECRET, buildDelivery(rule, subject, 'x'), NOW)
    const later = NOW + (MAX_SIGNATURE_AGE_SECONDS + 60) * 1000
    expect(verifySignature(SECRET, req.body, req.headers, later)).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('rejects a timestamp far in the future as firmly as an old one', () => {
    const future = Math.floor(NOW / 1000) + MAX_SIGNATURE_AGE_SECONDS + 600
    const body = JSON.stringify(buildDelivery(rule, subject, 'x'))
    const headers = {
      [TIMESTAMP_HEADER]: String(future),
      [SIGNATURE_HEADER]: sign(SECRET, body, future),
    }
    expect(verifySignature(SECRET, body, headers, NOW)).toEqual({ ok: false, reason: 'expired' })
  })

  it('names what was missing rather than failing opaquely', () => {
    const req = signedRequest(SECRET, buildDelivery(rule, subject, 'x'), NOW)
    expect(
      verifySignature(SECRET, req.body, { [TIMESTAMP_HEADER]: req.headers[TIMESTAMP_HEADER] }, NOW),
    ).toEqual({ ok: false, reason: 'missing-signature' })
    expect(
      verifySignature(SECRET, req.body, { [SIGNATURE_HEADER]: req.headers[SIGNATURE_HEADER] }, NOW),
    ).toEqual({ ok: false, reason: 'missing-timestamp' })
    expect(
      verifySignature(SECRET, req.body, { ...req.headers, [TIMESTAMP_HEADER]: 'yesterday' }, NOW),
    ).toEqual({ ok: false, reason: 'malformed-timestamp' })
  })

  it('does not leak the expected signature length by throwing on a short one', () => {
    const req = signedRequest(SECRET, buildDelivery(rule, subject, 'x'), NOW)
    expect(() =>
      verifySignature(SECRET, req.body, { ...req.headers, [SIGNATURE_HEADER]: 'v1=00' }, NOW),
    ).not.toThrow()
    expect(
      verifySignature(SECRET, req.body, { ...req.headers, [SIGNATURE_HEADER]: 'v1=00' }, NOW),
    ).toEqual({ ok: false, reason: 'bad-signature' })
  })

  it('signs the timestamp as well as the body', () => {
    // Moving the timestamp alone must invalidate the signature; if it did not,
    // the expiry check could simply be side-stepped by rewriting the header.
    const req = signedRequest(SECRET, buildDelivery(rule, subject, 'x'), NOW)
    const shifted = { ...req.headers, [TIMESTAMP_HEADER]: String(Math.floor(NOW / 1000) + 1) }
    expect(verifySignature(SECRET, req.body, shifted, NOW)).toEqual({
      ok: false,
      reason: 'bad-signature',
    })
  })
})
