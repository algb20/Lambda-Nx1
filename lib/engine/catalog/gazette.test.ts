import { describe, expect, it } from 'vitest'
import { CATALOG } from './index'

/**
 * The Gazette record must not turn private individuals into findings (R321).
 * Its OGL licence "does not cover the re-use of personal data", and charter §3
 * forbids targeting private individuals. These are the live notice shapes seen
 * on 2026-10-08.
 */
const gazette = CATALOG.find((s) => s.key === 'uk_gazette')!
const item = (code: string, title: string) => `<entry><f:notice-code>${code}</f:notice-code><title>${title}</title></entry>`

describe('The Gazette keeps company notices only', () => {
  it('has a keep rule', () => {
    expect(gazette.keepItem).toBeDefined()
  })

  it('keeps corporate insolvency and disclaimers', () => {
    for (const code of ['2406', '2441', '2443', '2452', '2603']) expect(gazette.keepItem!.test(item(code, 'ACME LTD')), code).toBe(true)
  })

  it('drops bankruptcy orders, personal dividends, deceased estates and named-person notices', () => {
    for (const code of ['2503', '2509', '2903', '1601', '1101']) expect(gazette.keepItem!.test(item(code, 'A PERSON')), code).toBe(false)
  })

  it('drops an item with no notice code rather than guessing', () => {
    expect(gazette.keepItem!.test('<entry><title>Unknown</title></entry>')).toBe(false)
  })
})
