import { describe, it, expect } from 'vitest'
import { validateMonitorInput } from './monitors'

describe('validateMonitorInput', () => {
  it('accepts and normalizes a domain', () => {
    const m = validateMonitorInput({ targetType: 'domain', targetValue: 'https://Example.com/x', intervalMinutes: 120 })
    expect(m).toEqual({ targetType: 'domain', targetValue: 'example.com', intervalMinutes: 120 })
  })

  it('clamps the interval to [60, 43200] and defaults when missing', () => {
    expect(validateMonitorInput({ targetType: 'domain', targetValue: 'a.com', intervalMinutes: 5 }).intervalMinutes).toBe(60)
    expect(validateMonitorInput({ targetType: 'domain', targetValue: 'a.com', intervalMinutes: 999999 }).intervalMinutes).toBe(43200)
    expect(validateMonitorInput({ targetType: 'domain', targetValue: 'a.com' }).intervalMinutes).toBe(1440)
  })

  it('rejects non-domain types and invalid domains', () => {
    expect(() => validateMonitorInput({ targetType: 'ip', targetValue: '1.2.3.4' })).toThrow(/Only domain/)
    expect(() => validateMonitorInput({ targetType: 'domain', targetValue: 'nodot' })).toThrow(/Invalid domain/)
  })
})
