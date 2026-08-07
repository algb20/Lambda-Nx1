import { describe, it, expect, vi } from 'vitest'
import {
  withTimeout,
  classifyPiFailure,
  piStatusMessage,
  shouldBlockApp,
  PiTimeoutError,
  PI_TIMEOUTS,
} from './pi-client'

describe('withTimeout', () => {
  it('resolves normally when the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000, 'step')).resolves.toBe('ok')
  })

  it('propagates a rejection unchanged rather than masking it as a timeout', async () => {
    const boom = new Error('provider said no')
    await expect(withTimeout(Promise.reject(boom), 1000, 'step')).rejects.toBe(boom)
  })

  it('rejects with a PiTimeoutError when the promise never settles', async () => {
    // A promise that never settles — exactly what Pi.authenticate() does
    // outside Pi Browser, and the reason the app used to hang forever.
    const never = new Promise<string>(() => {})
    await expect(withTimeout(never, 5, 'Pi authentication')).rejects.toThrow(PiTimeoutError)
    await expect(withTimeout(never, 5, 'Pi authentication')).rejects.toThrow(
      /Pi authentication timed out/,
    )
  })

  it('clears the timer on success so nothing fires afterwards', async () => {
    const cancel = vi.fn()
    const schedule = vi.fn(() => 42 as unknown as ReturnType<typeof setTimeout>)
    await withTimeout(Promise.resolve('ok'), 1000, 'step', schedule, cancel)
    expect(cancel).toHaveBeenCalledWith(42)
  })

  it('clears the timer on failure too', async () => {
    const cancel = vi.fn()
    const schedule = vi.fn(() => 7 as unknown as ReturnType<typeof setTimeout>)
    await expect(
      withTimeout(Promise.reject(new Error('x')), 1000, 'step', schedule, cancel),
    ).rejects.toThrow('x')
    expect(cancel).toHaveBeenCalledWith(7)
  })
})

describe('classifyPiFailure', () => {
  it('treats a timeout as "not inside Pi Browser", not as an error', () => {
    expect(classifyPiFailure(new PiTimeoutError('Pi authentication', 15_000))).toBe('unavailable')
  })

  it('treats anything else as a real error', () => {
    expect(classifyPiFailure(new Error('network down'))).toBe('error')
    expect(classifyPiFailure('something odd')).toBe('error')
  })
})

describe('shouldBlockApp', () => {
  it('blocks only while connecting', () => {
    expect(shouldBlockApp('connecting')).toBe(true)
  })

  it('lets the app render on every settled outcome, including failure', () => {
    // The free gateways never needed an account, so a failed sign-in must not
    // cost the visitor the whole product.
    for (const status of ['authenticated', 'unavailable', 'error'] as const) {
      expect(shouldBlockApp(status), status).toBe(false)
    }
  })
})

describe('piStatusMessage', () => {
  it('explains the Pi Browser requirement without implying breakage', () => {
    const msg = piStatusMessage('unavailable')
    expect(msg).toMatch(/Pi Browser/)
    expect(msg).toMatch(/without an account/)
    expect(msg).not.toMatch(/failed|error/i)
  })

  it('includes the underlying detail for a genuine error', () => {
    expect(piStatusMessage('error', 'network down')).toMatch(/network down/)
  })

  it('still reads sensibly for an error with no detail', () => {
    expect(piStatusMessage('error')).toMatch(/keep browsing/)
  })
})

describe('PI_TIMEOUTS', () => {
  it('bounds every step that could otherwise hang', () => {
    for (const [step, ms] of Object.entries(PI_TIMEOUTS)) {
      expect(ms, step).toBeGreaterThan(0)
      expect(ms, step).toBeLessThanOrEqual(30_000)
    }
  })
})
