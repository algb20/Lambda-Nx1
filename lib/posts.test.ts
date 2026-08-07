import { describe, it, expect } from 'vitest'
import {
  validatePostInput,
  safeHttpUrl,
  postPermalink,
  slugifyTitle,
  postToMarkdown,
  buildShareText,
  LAMBDA_GLYPH,
  type PublicPost,
} from './posts'

describe('validatePostInput', () => {
  it('accepts a good post and normalizes fields', () => {
    const r = validatePostInput({ title: '  Hello world  ', body: 'Body.', kind: 'research', visibility: 'unlisted' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.title).toBe('Hello world')
      expect(r.value.kind).toBe('research')
      expect(r.value.visibility).toBe('unlisted')
    }
  })

  it('rejects a too-short title and an empty body', () => {
    expect(validatePostInput({ title: 'ab', body: 'x' }).ok).toBe(false)
    expect(validatePostInput({ title: 'valid title', body: '' }).ok).toBe(false)
  })

  it('defaults kind to post and visibility to public', () => {
    const r = validatePostInput({ title: 'A title', body: 'x', kind: 'nonsense' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.kind).toBe('post')
      expect(r.value.visibility).toBe('public')
    }
  })

  it('drops an unsafe source URL but keeps an http one', () => {
    const bad = validatePostInput({ title: 'A title', body: 'x', sourceUrl: 'javascript:alert(1)' })
    const good = validatePostInput({ title: 'A title', body: 'x', sourceUrl: 'https://example.com/a' })
    if (bad.ok) expect(bad.value.sourceUrl).toBeNull()
    if (good.ok) expect(good.value.sourceUrl).toBe('https://example.com/a')
  })
})

describe('safeHttpUrl', () => {
  it('accepts http/https only', () => {
    expect(safeHttpUrl('https://a.com')).toBe('https://a.com/')
    expect(safeHttpUrl('http://a.com/x')).toBe('http://a.com/x')
    expect(safeHttpUrl('ftp://a.com')).toBeNull()
    expect(safeHttpUrl('data:text/html,x')).toBeNull()
    expect(safeHttpUrl('not a url')).toBeNull()
    expect(safeHttpUrl('')).toBeNull()
  })
})

describe('permalink + slug', () => {
  it('builds a clean permalink regardless of trailing slash', () => {
    expect(postPermalink('https://x.app', 'abc')).toBe('https://x.app/p/abc')
    expect(postPermalink('https://x.app/', 'abc')).toBe('https://x.app/p/abc')
  })

  it('slugifies titles, including non-latin, with a fallback', () => {
    expect(slugifyTitle('Hello, World!')).toBe('hello-world')
    expect(slugifyTitle('   ---   ')).toBe('post')
    expect(slugifyTitle('Café del Mar')).toBe('cafe-del-mar')
    expect(slugifyTitle('الذهب gold')).toContain('gold')
  })
})

const POST: PublicPost = {
  id: 'id1',
  kind: 'research',
  title: 'Gold through the ages',
  body: 'A long body. '.repeat(30),
  author: 'alice',
  sourceUrl: 'https://example.com/src',
  refType: null,
  refValue: null,
  locale: 'en',
  visibility: 'public',
  likeCount: 3,
  repostCount: 0,
  createdAt: '2026-08-07T10:00:00.000Z',
}

describe('postToMarkdown', () => {
  it('renders title, byline, body, source and a λ signature', () => {
    const md = postToMarkdown(POST, 'https://x.app/p/id1')
    expect(md).toContain('# Gold through the ages')
    expect(md).toContain('By alice')
    expect(md).toContain('Source: https://example.com/src')
    expect(md).toContain(`${LAMBDA_GLYPH} Lambda NX · https://x.app/p/id1`)
  })
})

describe('buildShareText', () => {
  it('truncates a long body and signs with λ + permalink', () => {
    const text = buildShareText(POST, 'https://x.app/p/id1')
    expect(text.startsWith('Gold through the ages')).toBe(true)
    expect(text).toContain('…')
    expect(text.endsWith('https://x.app/p/id1')).toBe(true)
    expect(text).toContain(LAMBDA_GLYPH)
  })
})
