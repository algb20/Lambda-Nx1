import { describe, expect, it } from 'vitest'
import { LOCALES } from '@/lib/i18n/dictionaries'
import { codeEmail } from './templates'

const BASE = { to: 'reader@example.com', code: '482913', minutes: 15 } as const

describe('the code email', () => {
  it('puts the code in both the text and the HTML body', () => {
    const mail = codeEmail({ ...BASE, purpose: 'signup' })
    expect(mail.text).toContain('482913')
    expect(mail.html).toContain('482913')
  })

  it('always has a plain-text body — an HTML-only mail is a spam signal', () => {
    for (const locale of LOCALES) {
      for (const purpose of ['signup', 'reset'] as const) {
        expect(codeEmail({ ...BASE, purpose, locale }).text.trim().length).toBeGreaterThan(40)
      }
    }
  })

  it('writes every supported language rather than falling back to English', () => {
    const subjects = new Set(LOCALES.map((l) => codeEmail({ ...BASE, purpose: 'signup', locale: l }).subject))
    expect(subjects.size).toBe(LOCALES.length)
  })

  it('says how long the code lasts, in the reader’s language', () => {
    expect(codeEmail({ ...BASE, purpose: 'signup', locale: 'ar' }).text).toContain('15')
    expect(codeEmail({ ...BASE, purpose: 'signup', locale: 'en' }).text).toContain('15 minutes')
  })

  it('marks the Arabic message right-to-left', () => {
    expect(codeEmail({ ...BASE, purpose: 'reset', locale: 'ar' }).html).toContain('dir="rtl"')
  })

  /**
   * A right-to-left paragraph would otherwise reorder the digits visually, and
   * the reader would type the code backwards and be told it is wrong.
   */
  it('keeps the digits left-to-right inside a right-to-left message', () => {
    const html = codeEmail({ ...BASE, purpose: 'signup', locale: 'ar' }).html ?? ''
    const codeBlock = html.slice(html.indexOf('482913') - 400, html.indexOf('482913'))
    expect(codeBlock).toContain('dir="ltr"')
  })

  /**
   * No link, on purpose: a code the reader types into the page they are already
   * on cannot be turned into a phishing click, which a one-click reset link can.
   */
  it('contains no clickable link at all', () => {
    for (const purpose of ['signup', 'reset'] as const) {
      const mail = codeEmail({ ...BASE, purpose })
      expect(mail.html).not.toContain('<a ')
      expect(mail.text).not.toMatch(/https?:\/\//)
    }
  })

  /**
   * The address may belong to somebody who never asked, because anyone can type
   * anyone's address into the form. The message must be safe to receive by
   * mistake, so it says what to do about that and reveals nothing else.
   */
  it('is safe to receive by mistake — it names no account and no person', () => {
    const mail = codeEmail({ ...BASE, purpose: 'reset' })
    expect(mail.text.toLowerCase()).toContain('did not ask')
    expect(mail.text).not.toContain('reader@example.com')
  })

  it('loads no external resource, so opening it reports nothing back to us', () => {
    const html = codeEmail({ ...BASE, purpose: 'signup' }).html ?? ''
    expect(html).not.toMatch(/<img|<script|<link|url\(|https?:\/\//)
  })

  it('treats ar-EG as Arabic and an unknown tag as English', () => {
    expect(codeEmail({ ...BASE, purpose: 'signup', locale: 'ar-EG' }).subject).toBe(
      codeEmail({ ...BASE, purpose: 'signup', locale: 'ar' }).subject,
    )
    expect(codeEmail({ ...BASE, purpose: 'signup', locale: 'tlh' }).subject).toBe(
      codeEmail({ ...BASE, purpose: 'signup', locale: 'en' }).subject,
    )
  })

  it('uses different words for signing up and for recovering', () => {
    expect(codeEmail({ ...BASE, purpose: 'signup' }).subject).not.toBe(
      codeEmail({ ...BASE, purpose: 'reset' }).subject,
    )
  })
})
