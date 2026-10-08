import { describe, expect, it } from 'vitest'
import { aiDisclosure } from './disclosure'

describe('AI-generated text is disclosed in words (EU AI Act Art. 50(4)–(5))', () => {
  it('says plainly that a model wrote it, and which', () => {
    expect(aiDisclosure({ provider: 'anthropic', model: 'model-x' })).toBe('AI-generated · anthropic · model-x')
  })
  it('never claims a model for the computed reading', () => {
    expect(aiDisclosure({ provider: 'deterministic', model: null })).toBe('computed — no model')
  })
})
