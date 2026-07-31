import { describe, it, expect } from 'vitest'
import { formatSse, sseComment } from './sse'

describe('formatSse', () => {
  it('frames a JSON data event with an event name', () => {
    const out = formatSse({ event: 'target', data: { a: 1 } })
    expect(out).toBe('event: target\ndata: {"a":1}\n\n')
  })

  it('includes id and retry, and prefixes every line of a multi-line payload', () => {
    const out = formatSse({ id: '7', retryMs: 3000, data: 'line1\nline2' })
    expect(out).toBe('retry: 3000\nid: 7\ndata: line1\ndata: line2\n\n')
  })

  it('always ends with a blank line (message terminator)', () => {
    expect(formatSse({ data: 'x' }).endsWith('\n\n')).toBe(true)
  })
})

describe('sseComment', () => {
  it('is a comment line ignored by EventSource', () => {
    expect(sseComment('keep-alive')).toBe(': keep-alive\n\n')
  })
})
