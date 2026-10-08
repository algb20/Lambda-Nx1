import { describe, expect, it } from 'vitest'
import { checkEvidence, checkQuote, htmlToText, quoteFragments, recordState } from './terms-check'

const PAGE = htmlToText(`<html><head><script>var x = "Your use is for your own personal and non-commercial use only."</script></head>
<body><nav>Home</nav><p>Your use of the Guardian Site and Guardian Content is for your own personal and
non&#8209;commercial use only.</p><p>You shall not use any &ldquo;robot&rdquo;, &lsquo;spider&rsquo; or crawler.</p></body></html>`)

describe('terms change detection (GL-06, R323)', () => {
  it('finds a quote that is still on the page, across line breaks and typography', () => {
    expect(checkQuote(PAGE, 'Your use of the Guardian Site and Guardian Content is for your own personal and non-commercial use only.')).toBe('present')
    expect(checkQuote(PAGE, 'You shall not use any "robot", \'spider\' or crawler.')).toBe('present')
  })

  it('reports a quote that has gone — the terms changed (negative control)', () => {
    expect(checkQuote(PAGE, 'All content is available under the Open Government Licence v3.0, except where otherwise stated')).toBe('missing')
  })

  it('never matches text hidden in a script', () => {
    const scriptOnly = htmlToText('<script>var t = "This exact clause lives only inside a script tag here."</script><p>Hello</p>')
    expect(checkQuote(scriptOnly, 'This exact clause lives only inside a script tag here.')).toBe('missing')
  })

  it('splits a quote at elisions and editorial brackets', () => {
    expect(quoteFragments('Except as expressly authorized … you agree not to scrape the Service [prohibited] or the Service Content commercially')).toEqual([
      'except as expressly authorized',
      'you agree not to scrape the service',
      'or the service content commercially',
    ])
    expect(checkQuote(PAGE, 'Your use of the Guardian Site … something that is no longer written there')).toBe('partial')
  })

  it('does not pretend to check a summary', () => {
    expect(checkQuote(PAGE, 'API docs: rate limits')).toBe('not-checkable')
  })

  it('takes the worst state for a record', () => {
    expect(recordState(['present', 'not-checkable'])).toBe('present')
    expect(recordState(['present', 'missing'])).toBe('partial')
    expect(recordState(['missing', 'missing'])).toBe('missing')
    expect(recordState(['not-checkable'])).toBe('not-checkable')
  })

  it('reads punctuation the way the page shows it, not the way tags left it', () => {
    const ogl = htmlToText('<p>You are free to: <ul><li>copy</li>, publish, distribute and transmit the <em>Information</em>;</ul></p>')
    expect(checkQuote(ogl, 'You are free to: copy, publish, distribute and transmit the Information;')).toBe('present')
  })

  it('checks evidence by kind: verbatim, quoted parts of a summary, or not at all', () => {
    expect(checkEvidence(PAGE, { kind: 'observation', quote: 'Terms page answered 403 on 2026-10-05.' })).toBe('not-checkable')
    expect(
      checkEvidence(PAGE, { kind: 'paraphrase', quote: 'Guardian terms: "Your use of the Guardian Site and Guardian Content is for your own personal" and more.' }),
    ).toBe('present')
    expect(checkEvidence(PAGE, { kind: 'paraphrase', quote: 'Summary: "a clause that the page does not contain at all anymore".' })).toBe('missing')
  })

  it('reads the extraction artefacts real pages produced (R323 live run)', () => {
    // abuse.ch: a hyphen at a line break; MeteoAlarm: an undecoded &copy;;
    // An-Nahar: Arabic diacritics in a different order; GLEIF: a comma where
    // the quote ended with a full stop.
    expect(checkQuote(htmlToText('<p>commercial or for-<br>profit needs may require a paid subscription</p>'), 'commercial or for-profit needs may require a paid subscription')).toBe('present')
    expect(checkQuote(htmlToText('<footer>&copy; 2026 MeteoAlarm. Data provided by EUMETNET members.</footer>'), '© 2026 MeteoAlarm. Data provided by EUMETNET members.')).toBe('present')
    expect(checkQuote('يُحظَّر نسخ أو تخزين أي محتوى لأغراض غير الاستعمال الشخصي', 'يُحظَّر نسخ أو تخزين أي محتوى لأغراض غير الاستعمال الشخصي'.normalize('NFD'))).toBe('present')
    expect(checkQuote('are provided under the CC0 licence, see CC0 1.0 Universal', 'The data available … are provided under the CC0 licence.')).toBe('present')
  })
})
