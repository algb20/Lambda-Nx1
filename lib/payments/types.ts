/**
 * Payments port. App code depends on this interface, never on Pi or Stripe
 * directly, so the two are interchangeable (charter rule #4).
 */
export type PaymentProviderName = 'pi' | 'standard'

export interface PaymentResult {
  ok: boolean
  status: number
  data: unknown
}

export interface PaymentProvider {
  readonly name: PaymentProviderName
  approve(paymentId: string): Promise<PaymentResult>
  complete(paymentId: string, txid: string): Promise<PaymentResult>
  cancel(paymentId: string): Promise<PaymentResult>
}
